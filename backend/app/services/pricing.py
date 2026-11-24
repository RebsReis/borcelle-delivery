"""Cálculo de preços no servidor. O valor enviado pelo navegador nunca é usado."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Coupon, CouponKind, DeliveryZone, Fulfillment, Option, OptionGroup, Product, ProductOptionGroup
from app.schemas import CartItemIn, QuoteItemOut, QuoteOptionOut, QuoteOut
from app.services.delivery import CepError, find_zone, zone_fee
from app.services.store import get_store


class PricingError(Exception):
    pass


@dataclass
class PricedCart:
    items: list[QuoteItemOut]
    subtotal_cents: int
    delivery_fee_cents: int
    discount_cents: int
    total_cents: int
    coupon: Coupon | None
    coupon_message: str | None
    zone: DeliveryZone | None
    delivery_served: bool | None
    min_order_cents: int
    errors: list[str] = field(default_factory=list)

    def to_out(self) -> QuoteOut:
        return QuoteOut(
            items=self.items,
            subtotal_cents=self.subtotal_cents,
            delivery_fee_cents=self.delivery_fee_cents,
            discount_cents=self.discount_cents,
            total_cents=self.total_cents,
            coupon_code=self.coupon.code if self.coupon else None,
            coupon_message=self.coupon_message,
            delivery_served=self.delivery_served,
            min_order_cents=self.min_order_cents,
            errors=self.errors,
        )


def _load_products(db: Session, ids: set[int]) -> dict[int, Product]:
    rows = db.scalars(
        select(Product)
        .where(Product.id.in_(ids))
        .options(
            selectinload(Product.option_links)
            .selectinload(ProductOptionGroup.group)
            .selectinload(OptionGroup.options)
        )
    ).all()
    return {p.id: p for p in rows}


def price_item(product: Product, item: CartItemIn, index: int) -> QuoteItemOut:
    if not product.is_available:
        raise PricingError(f"{product.name} está indisponível no momento.")
    groups = [link.group for link in product.option_links]
    option_map: dict[int, tuple[OptionGroup, Option]] = {
        o.id: (g, o) for g in groups for o in g.options
    }
    chosen: list[tuple[OptionGroup, Option]] = []
    seen: set[int] = set()
    for oid in item.option_ids:
        if oid in seen:
            continue
        seen.add(oid)
        if oid not in option_map:
            raise PricingError(f"Opção inválida para {product.name}.")
        g, o = option_map[oid]
        if not o.is_available:
            raise PricingError(f"{o.name} está indisponível no momento.")
        chosen.append((g, o))

    for g in groups:
        count = sum(1 for cg, _ in chosen if cg.id == g.id)
        if count < g.min_select:
            raise PricingError(f"{product.name}: escolha {g.name.lower()}.")
        if count > g.max_select:
            raise PricingError(f"{product.name}: máximo de {g.max_select} em {g.name.lower()}.")

    base = product.effective_price_cents
    extras = sum(o.price_cents for _, o in chosen)
    unit = base + extras
    return QuoteItemOut(
        index=index,
        product_id=product.id,
        name=product.name,
        quantity=item.quantity,
        unit_base_cents=base,
        unit_total_cents=unit,
        line_total_cents=unit * item.quantity,
        options=[
            QuoteOptionOut(
                option_id=o.id, group_name=g.name, group_kind=g.kind.value, name=o.name, price_cents=o.price_cents
            )
            for g, o in chosen
        ],
        notes=item.notes.strip(),
    )


def validate_coupon(db: Session, code: str, subtotal_cents: int) -> tuple[Coupon | None, str | None]:
    coupon = db.scalar(select(Coupon).where(func.upper(Coupon.code) == code.strip().upper()))
    now = datetime.now(timezone.utc)
    if coupon is None or not coupon.is_active:
        return None, "Cupom inválido."
    if coupon.valid_from and now < coupon.valid_from:
        return None, "Este cupom ainda não está valendo."
    if coupon.valid_until and now > coupon.valid_until:
        return None, "Este cupom expirou."
    if coupon.max_uses is not None and coupon.uses >= coupon.max_uses:
        return None, "Este cupom esgotou."
    if subtotal_cents < coupon.min_order_cents:
        return None, f"Cupom válido para pedidos a partir de R$ {coupon.min_order_cents / 100:.2f}".replace(".", ",")
    return coupon, None


def price_cart(
    db: Session,
    items: list[CartItemIn],
    *,
    fulfillment: Fulfillment,
    cep: str | None,
    coupon_code: str | None,
    strict: bool,
) -> PricedCart:
    """strict=True levanta PricingError no primeiro problema (criação de pedido)."""
    store = get_store(db)
    products = _load_products(db, {i.product_id for i in items})
    errors: list[str] = []
    priced: list[QuoteItemOut] = []
    for idx, item in enumerate(items):
        product = products.get(item.product_id)
        try:
            if product is None:
                raise PricingError("Um dos produtos não existe mais no cardápio.")
            priced.append(price_item(product, item, idx))
        except PricingError as exc:
            if strict:
                raise
            errors.append(str(exc))

    subtotal = sum(i.line_total_cents for i in priced)

    zone = None
    served: bool | None = None
    fee = 0
    min_order = store.min_order_cents
    if fulfillment == Fulfillment.delivery:
        if not store.delivery_enabled:
            errors.append("Delivery indisponível no momento. Escolha retirada.")
        if cep:
            try:
                zone = find_zone(db, cep)
            except CepError as exc:
                errors.append(str(exc))
            served = zone is not None
            if zone is None:
                errors.append("Ainda não entregamos neste CEP. Você pode retirar no balcão.")
            else:
                fee = zone_fee(zone, subtotal)
                min_order = max(min_order, zone.min_order_cents)
        elif strict:
            raise PricingError("Informe o endereço de entrega.")
    elif not store.pickup_enabled:
        errors.append("Retirada indisponível no momento.")

    coupon = None
    coupon_message = None
    discount = 0
    if coupon_code:
        coupon, coupon_message = validate_coupon(db, coupon_code, subtotal)
        if coupon is None and strict:
            raise PricingError(coupon_message or "Cupom inválido.")
        if coupon:
            if coupon.kind == CouponKind.percent:
                discount = round(subtotal * min(coupon.value, 100) / 100)
            elif coupon.kind == CouponKind.fixed:
                discount = min(coupon.value, subtotal)
            else:
                discount = fee
            coupon_message = coupon.description or "Cupom aplicado."

    if priced and subtotal < min_order:
        errors.append(f"Pedido mínimo de R$ {min_order / 100:.2f}".replace(".", ","))

    if strict and errors:
        raise PricingError(errors[0])

    total = max(subtotal + fee - discount, 0)
    return PricedCart(
        items=priced,
        subtotal_cents=subtotal,
        delivery_fee_cents=fee,
        discount_cents=discount,
        total_cents=total,
        coupon=coupon,
        coupon_message=coupon_message,
        zone=zone,
        delivery_served=served,
        min_order_cents=min_order,
        errors=errors,
    )
