"""Webhooks dos provedores de pagamento."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Order, Payment, WebhookEvent
from app.payments import get_provider
from app.payments.base import PaymentError
from app.services.orders import apply_charge, sync_payment

router = APIRouter(prefix="/api/payments", tags=["pagamentos"])
log = logging.getLogger("borcelle.webhooks")


@router.post("/webhooks/mercadopago")
async def mercadopago_webhook(request: Request, db: Session = Depends(get_db)):
    provider = get_provider()
    query = dict(request.query_params)
    try:
        body = await request.json()
    except ValueError:
        body = {}
    headers = {k.lower(): v for k, v in request.headers.items()}

    valid = provider.verify_webhook(headers, query, body if isinstance(body, dict) else {})
    payment_id = provider.webhook_payment_id(query, body if isinstance(body, dict) else {})
    event_key = f"{payment_id}:{headers.get('x-request-id', '')}:{body.get('action', '') if isinstance(body, dict) else ''}"
    db.add(WebhookEvent(provider=provider.name, event_key=event_key[:160], payload={"query": query, "body": body}, signature_valid=valid))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"ok": True, "duplicate": True}

    if not valid:
        log.warning("Webhook com assinatura inválida: %s", event_key)
        raise HTTPException(401, "Assinatura inválida")
    if not payment_id:
        return {"ok": True, "ignored": True}

    payment = db.scalar(
        select(Payment).where(Payment.provider == provider.name, Payment.provider_payment_id == payment_id)
    )
    if payment is None:
        # Pagamento do Checkout Pro: o id só é conhecido agora; procura pela referência externa
        try:
            result = await provider.get_payment(payment_id)
        except PaymentError:
            raise HTTPException(502, "Falha ao consultar pagamento")
        ref = (result.raw or {}).get("external_reference")
        order = db.scalar(select(Order).where(Order.public_id == ref)) if ref else None
        wallet = next(
            (p for p in reversed(order.payments) if (p.provider_payment_id or "").startswith("pref_")), None
        ) if order else None
        if wallet is None:
            return {"ok": True, "unknown": True}
        wallet.provider_payment_id = result.provider_payment_id
        apply_charge(db, order, wallet, result, actor="webhook")
        db.commit()
        return {"ok": True}
    try:
        await sync_payment(db, payment, actor="webhook")
    except PaymentError as exc:
        raise HTTPException(502, str(exc)) from exc
    return {"ok": True}
