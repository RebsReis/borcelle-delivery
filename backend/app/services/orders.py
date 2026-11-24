"""Criação de pedidos, pagamentos e transições de status."""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.models import (
    AuditLog,
    Coupon,
    Fulfillment,
    Order,
    OrderItem,
    OrderItemOption,
    OrderStatus,
    OrderStatusHistory,
    Payment,
    PaymentMethod,
    PaymentStatus,
)
from app.payments import get_provider
from app.payments.base import CardRequest, ChargeResult, PaymentError, PixRequest, RedirectRequest
from app.schemas import CardPaymentIn, OrderIn
from app.services import notify
from app.services.pricing import PricingError, price_cart
from app.services.store import get_store, is_open, is_valid_slot

log = logging.getLogger("borcelle.orders")


class OrderError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


ALLOWED = {
    OrderStatus.awaiting_payment: {OrderStatus.received, OrderStatus.cancelled},
    OrderStatus.received: {OrderStatus.confirmed, OrderStatus.cancelled},
    OrderStatus.confirmed: {OrderStatus.preparing, OrderStatus.cancelled},
    OrderStatus.preparing: {OrderStatus.ready, OrderStatus.cancelled},
    OrderStatus.ready: {OrderStatus.out_for_delivery, OrderStatus.delivered, OrderStatus.cancelled},
    OrderStatus.out_for_delivery: {OrderStatus.delivered},
    OrderStatus.delivered: set(),
    OrderStatus.cancelled: set(),
}

ENABLED_FLAG = {
    PaymentMethod.pix: "pay_pix",
    PaymentMethod.credit_online: "pay_credit_online",
    PaymentMethod.debit_online: "pay_debit_online",
    PaymentMethod.card_on_delivery: "pay_card_on_delivery",
    PaymentMethod.cash: "pay_cash",
    PaymentMethod.wallet: "pay_wallet",
}


def enabled_methods(store) -> list[PaymentMethod]:
    provider_ok = get_provider().configured
    out = []
    for m, flag in ENABLED_FLAG.items():
        if getattr(store, flag) and (provider_ok or not m.is_online):
            out.append(m)
    return out


def load_order(db: Session, public_id: str) -> Order | None:
    return db.scalar(
        select(Order)
        .where(Order.public_id == public_id)
        .options(
            selectinload(Order.items).selectinload(OrderItem.options),
            selectinload(Order.payments),
            selectinload(Order.history),
        )
        .execution_options(populate_existing=True)
    )


def _audit(db: Session, actor: str, action: str, order: Order, data: dict | None = None) -> None:
    db.add(AuditLog(actor=actor, action=action, entity="order", entity_id=order.public_id, data=data))


def set_status(db: Session, order: Order, new: OrderStatus, *, actor: str = "system", note: str = "") -> None:
    if new == order.status:
        return
    if new not in ALLOWED[order.status]:
        raise OrderError(f"Transição inválida: {order.status.value} → {new.value}", 409)
    old = order.status
    order.status = new
    db.add(OrderStatusHistory(order_id=order.id, status=new, note=note, actor=actor))
    _audit(db, actor, "status_change", order, {"from": old.value, "to": new.value, "note": note})
    notify.whatsapp_status(
        phone=order.customer_phone,
        number=order.number,
        status=new.value,
        fulfillment=order.fulfillment.value,
        consent=order.notify_whatsapp,
    )
    if new == OrderStatus.received and not order.purchase_tracked:
        order.purchase_tracked = notify.capi_purchase(
            public_id=order.public_id,
            email=order.customer_email,
            phone=order.customer_phone,
            total_cents=order.total_cents,
            consent=order.marketing_consent,
        )


def _eta(db: Session, order: Order, base: datetime) -> datetime:
    store = get_store(db)
    if order.scheduled_for:
        return order.scheduled_for
    if order.fulfillment == Fulfillment.pickup:
        return base + timedelta(minutes=store.pickup_eta_minutes)
    minutes = store.prep_time_minutes + 25
    if order.zone_id:
        from app.models import DeliveryZone

        zone = db.get(DeliveryZone, order.zone_id)
        if zone:
            minutes = zone.eta_max_minutes
    return base + timedelta(minutes=minutes)


def apply_charge(db: Session, order: Order, payment: Payment, result: ChargeResult, *, actor: str = "system") -> None:
    """Aplica ao pedido o resultado de uma consulta/criação no provedor."""
    payment.provider_payment_id = payment.provider_payment_id or result.provider_payment_id
    payment.status = result.status
    payment.status_detail = result.status_detail
    payment.pix_qr_code = result.pix_qr_code or payment.pix_qr_code
    payment.pix_qr_code_base64 = result.pix_qr_code_base64 or payment.pix_qr_code_base64
    payment.redirect_url = result.redirect_url or payment.redirect_url
    payment.expires_at = result.expires_at or payment.expires_at
    payment.raw = result.raw or payment.raw
    order.payment_status = result.status

    if result.status == PaymentStatus.approved and order.status == OrderStatus.awaiting_payment:
        set_status(db, order, OrderStatus.received, actor=actor, note="Pagamento aprovado")
        order.eta_at = _eta(db, order, datetime.now(timezone.utc))
    elif result.status == PaymentStatus.approved and order.status == OrderStatus.cancelled:
        # Pagamento chegou depois do cancelamento: precisa de estorno manual/automático
        _audit(db, actor, "approved_after_cancel", order, {"payment": payment.provider_payment_id})
    elif result.status in (PaymentStatus.refunded,):
        _audit(db, actor, "payment_refunded", order, {"payment": payment.provider_payment_id})


def _split_name(name: str) -> tuple[str, str]:
    parts = name.split(" ", 1)
    return parts[0], parts[1] if len(parts) > 1 else ""


async def charge(db: Session, order: Order, method: PaymentMethod, card: CardPaymentIn | None, attempt: int) -> Payment:
    provider = get_provider()
    settings = get_settings()
    payment = Payment(
        order_id=order.id,
        provider=provider.name,
        method=method,
        status=PaymentStatus.pending,
        amount_cents=order.total_cents,
        idempotency_key=f"{order.idempotency_key}:pay{attempt}",
        installments=card.installments if card else 1,
    )
    db.add(payment)
    db.flush()
    first, last = _split_name(order.customer_name)
    desc = f"Pedido #{order.number} Borcelle"
    try:
        if method == PaymentMethod.pix:
            result = await provider.create_pix(
                PixRequest(
                    amount_cents=order.total_cents,
                    description=desc,
                    external_reference=order.public_id,
                    payer_email=order.customer_email,
                    payer_first_name=first,
                    payer_last_name=last,
                    expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.pix_expiration_minutes),
                    idempotency_key=payment.idempotency_key,
                )
            )
        elif method in (PaymentMethod.credit_online, PaymentMethod.debit_online):
            if card is None:
                raise OrderError("Dados do cartão ausentes.")
            store = get_store(db)
            installments = card.installments if method == PaymentMethod.credit_online else 1
            if installments > store.max_installments:
                raise OrderError("Número de parcelas não permitido.")
            result = await provider.create_card(
                CardRequest(
                    amount_cents=order.total_cents,
                    description=desc,
                    external_reference=order.public_id,
                    payer_email=order.customer_email,
                    token=card.token,
                    payment_method_id=card.payment_method_id,
                    issuer_id=str(card.issuer_id) if card.issuer_id else None,
                    installments=installments,
                    identification_type=card.identification_type,
                    identification_number=card.identification_number,
                    idempotency_key=payment.idempotency_key,
                )
            )
        elif method == PaymentMethod.wallet:
            result = await provider.create_redirect(
                RedirectRequest(
                    amount_cents=order.total_cents,
                    title=desc,
                    external_reference=order.public_id,
                    payer_email=order.customer_email,
                    back_url=f"{settings.frontend_url}/pedido/{order.public_id}",
                    idempotency_key=payment.idempotency_key,
                )
            )
        else:
            raise OrderError("Forma de pagamento não é online.")
    except PaymentError as exc:
        payment.status = PaymentStatus.rejected
        payment.status_detail = str(exc)[:120]
        order.payment_status = PaymentStatus.rejected
        db.commit()
        return payment
    apply_charge(db, order, payment, result)
    db.commit()
    return payment


def _new_public_id() -> str:
    return secrets.token_urlsafe(9).replace("-", "x").replace("_", "y")


async def create_order(db: Session, data: OrderIn, idempotency_key: str) -> tuple[Order, bool]:
    """Retorna (pedido, criado_agora). Repetir a mesma chave devolve o mesmo pedido."""
    existing = db.scalar(select(Order).where(Order.idempotency_key == idempotency_key))
    if existing:
        return load_order(db, existing.public_id), False  # type: ignore[return-value]

    store = get_store(db)
    now = datetime.now(timezone.utc)

    if data.scheduled_for:
        if not store.accept_scheduled:
            raise OrderError("Pedidos agendados não estão disponíveis.")
        if not is_valid_slot(db, store, data.scheduled_for):
            raise OrderError("Horário de agendamento indisponível. Escolha outro.")
    elif not is_open(db, store):
        msg = store.pause_message if store.is_paused and store.pause_message else "Estamos fechados agora."
        raise OrderError(f"{msg} Você pode agendar seu pedido.", 409)

    if data.payment_method not in enabled_methods(store):
        raise OrderError("Forma de pagamento indisponível.")
    if data.payment_method in (PaymentMethod.credit_online, PaymentMethod.debit_online) and not data.card:
        raise OrderError("Dados do cartão ausentes.")

    if data.card and data.payment_method == PaymentMethod.credit_online and data.card.installments > store.max_installments:
        raise OrderError(f"Parcelamento em até {store.max_installments}x.")

    if data.fulfillment == Fulfillment.delivery and data.address is None:
        raise OrderError("Informe o endereço de entrega.")

    try:
        priced = price_cart(
            db,
            data.items,
            fulfillment=data.fulfillment,
            cep=data.address.cep if data.address else None,
            coupon_code=data.coupon_code,
            strict=True,
        )
    except PricingError as exc:
        raise OrderError(str(exc)) from exc

    if data.expected_total_cents is not None and data.expected_total_cents != priced.total_cents:
        raise OrderError("Os valores do pedido mudaram. Revise o total antes de confirmar.", 409)

    if data.card and data.payment_method == PaymentMethod.credit_online and data.card.installments > 1:
        if priced.total_cents / data.card.installments < store.min_installment_cents:
            raise OrderError(f"Parcela mínima de R$ {store.min_installment_cents / 100:.2f}".replace(".", ","))

    if data.payment_method == PaymentMethod.cash and data.change_for_cents is not None:
        if data.change_for_cents < priced.total_cents:
            raise OrderError("O valor para troco precisa ser maior que o total.")

    if priced.coupon and priced.coupon.max_uses is not None:
        res = db.execute(
            update(Coupon)
            .where(Coupon.id == priced.coupon.id, Coupon.uses < Coupon.max_uses)
            .values(uses=Coupon.uses + 1)
        )
        if res.rowcount == 0:
            raise OrderError("Este cupom esgotou.")
    elif priced.coupon:
        priced.coupon.uses += 1

    online = data.payment_method.is_online
    number = db.scalar(text("SELECT nextval('order_number_seq')"))
    order = Order(
        number=number,
        public_id=_new_public_id(),
        idempotency_key=idempotency_key,
        customer_name=data.customer.name,
        customer_phone=data.customer.phone,
        customer_email=str(data.customer.email),
        fulfillment=data.fulfillment,
        scheduled_for=data.scheduled_for,
        address=data.address.model_dump() if data.fulfillment == Fulfillment.delivery and data.address else None,
        zone_id=priced.zone.id if priced.zone else None,
        subtotal_cents=priced.subtotal_cents,
        delivery_fee_cents=priced.delivery_fee_cents,
        discount_cents=priced.discount_cents,
        total_cents=priced.total_cents,
        coupon_code=priced.coupon.code if priced.coupon else None,
        notes=data.notes.strip(),
        payment_method=data.payment_method,
        payment_status=PaymentStatus.pending if online else PaymentStatus.on_delivery,
        change_for_cents=data.change_for_cents if data.payment_method == PaymentMethod.cash else None,
        status=OrderStatus.awaiting_payment if online else OrderStatus.received,
        marketing_consent=data.marketing_consent,
        notify_whatsapp=data.notify_whatsapp,
    )
    for qi in priced.items:
        item = OrderItem(
            product_id=qi.product_id,
            product_name=qi.name,
            unit_base_cents=qi.unit_base_cents,
            unit_total_cents=qi.unit_total_cents,
            quantity=qi.quantity,
            line_total_cents=qi.line_total_cents,
            notes=qi.notes,
        )
        item.options = [
            OrderItemOption(
                option_id=o.option_id, group_name=o.group_name, group_kind=o.group_kind, option_name=o.name, price_cents=o.price_cents
            )
            for o in qi.options
        ]
        order.items.append(item)
    db.add(order)
    try:
        db.flush()
    except IntegrityError:
        # Corrida com a mesma chave de idempotência: devolve o pedido já gravado
        db.rollback()
        existing = db.scalar(select(Order).where(Order.idempotency_key == idempotency_key))
        if existing:
            return load_order(db, existing.public_id), False  # type: ignore[return-value]
        raise
    db.add(OrderStatusHistory(order_id=order.id, status=order.status, note="Pedido criado"))
    _audit(db, "customer", "order_created", order, {"total": order.total_cents, "method": order.payment_method.value})
    order.eta_at = _eta(db, order, now)
    if not online:
        set_status_initial_side_effects(order)
    db.commit()

    if online:
        await charge(db, order, data.payment_method, data.card, attempt=1)
    return load_order(db, order.public_id), True  # type: ignore[return-value]


def set_status_initial_side_effects(order: Order) -> None:
    """Pedido pago na entrega nasce como 'recebido': dispara os mesmos avisos."""
    notify.whatsapp_status(
        phone=order.customer_phone, number=order.number, status="received",
        fulfillment=order.fulfillment.value, consent=order.notify_whatsapp,
    )
    order.purchase_tracked = notify.capi_purchase(
        public_id=order.public_id, email=order.customer_email, phone=order.customer_phone,
        total_cents=order.total_cents, consent=order.marketing_consent,
    )


async def retry_payment(db: Session, order: Order, method: PaymentMethod, card: CardPaymentIn | None) -> Payment:
    if order.status != OrderStatus.awaiting_payment:
        raise OrderError("Este pedido não está aguardando pagamento.", 409)
    if not method.is_online or method not in enabled_methods(get_store(db)):
        raise OrderError("Forma de pagamento indisponível.")
    pending = [p for p in order.payments if p.status in (PaymentStatus.pending, PaymentStatus.in_process)]
    if any(p.method != PaymentMethod.pix or p.status == PaymentStatus.in_process for p in pending):
        raise OrderError("Já existe um pagamento em análise para este pedido.", 409)
    # Cancela PIX anterior ainda aberto para não haver duas cobranças válidas
    for p in pending:
        if p.provider_payment_id:
            try:
                await get_provider().cancel(p.provider_payment_id)
            except PaymentError:
                log.warning("Falha ao cancelar PIX %s", p.provider_payment_id)
        p.status = PaymentStatus.cancelled
    order.payment_method = method
    db.commit()
    return await charge(db, order, method, card, attempt=len(order.payments) + 1)


async def sync_payment(db: Session, payment: Payment, actor: str = "reconcile") -> None:
    """Consulta o provedor e aplica o status real. Trata expiração do PIX."""
    if not payment.provider_payment_id or payment.provider_payment_id.startswith("pref_"):
        provider = get_provider()
        if hasattr(provider, "search_by_reference") and payment.method == PaymentMethod.wallet:
            result = await provider.search_by_reference(payment.order.public_id)  # type: ignore[attr-defined]
            if result:
                payment.provider_payment_id = result.provider_payment_id
                apply_charge(db, payment.order, payment, result, actor=actor)
                db.commit()
        return
    result = await get_provider().get_payment(payment.provider_payment_id)
    order = payment.order
    expired = payment.expires_at and payment.expires_at < datetime.now(timezone.utc)
    if result.status == PaymentStatus.pending and expired:
        try:
            result = await get_provider().cancel(payment.provider_payment_id)
        except PaymentError:
            pass
        result.status = PaymentStatus.expired
        apply_charge(db, order, payment, result, actor=actor)
        if order.status == OrderStatus.awaiting_payment:
            set_status(db, order, OrderStatus.cancelled, actor=actor, note="PIX expirado sem pagamento")
    else:
        apply_charge(db, order, payment, result, actor=actor)
        if (
            result.status in (PaymentStatus.cancelled, PaymentStatus.expired)
            and payment.method == PaymentMethod.pix
            and expired
            and order.status == OrderStatus.awaiting_payment
        ):
            set_status(db, order, OrderStatus.cancelled, actor=actor, note="PIX expirado sem pagamento")
    db.commit()


async def refund_order(db: Session, order: Order, actor: str) -> None:
    approved = [p for p in order.payments if p.status == PaymentStatus.approved]
    if not approved:
        raise OrderError("Não há pagamento aprovado para estornar.")
    for p in approved:
        result = await get_provider().refund(p.provider_payment_id, None, f"{p.idempotency_key}:refund")  # type: ignore[arg-type]
        p.refunded_cents = p.amount_cents
        apply_charge(db, order, p, result, actor=actor)
    _audit(db, actor, "refund", order)
    db.commit()
