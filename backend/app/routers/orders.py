"""Pedidos: criação, consulta, novo pagamento e atualização em tempo real (SSE)."""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal, get_db
from app.models import Order, PaymentMethod, PaymentStatus
from app.payments.base import PaymentError
from app.ratelimit import limit
from app.schemas import CardPaymentIn, OrderIn, OrderOut, PaymentOut
from app.services.orders import OrderError, create_order, load_order, retry_payment, sync_payment
from app.services.store import get_store

router = APIRouter(prefix="/api/orders", tags=["pedidos"])


def order_out(db: Session, order: Order) -> OrderOut:
    out = OrderOut.model_validate(order)
    if order.payments:
        out.payment = PaymentOut.model_validate(order.payments[-1])
    out.store_whatsapp = get_store(db).whatsapp
    out.payments_environment = get_settings().payments_environment
    return out


@router.post("", response_model=OrderOut, status_code=201, dependencies=[Depends(limit(10, 60))])
async def post_order(
    data: OrderIn,
    db: Session = Depends(get_db),
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=16, max_length=80),
):
    try:
        order, _ = await create_order(db, data, idempotency_key)
    except OrderError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    return order_out(db, order)


@router.get("/{public_id}", response_model=OrderOut)
def get_order(public_id: str, db: Session = Depends(get_db)):
    order = load_order(db, public_id)
    if order is None:
        raise HTTPException(404, "Pedido não encontrado.")
    return order_out(db, order)


@router.post("/{public_id}/sync", response_model=OrderOut, dependencies=[Depends(limit(20, 60))])
async def sync_order(public_id: str, db: Session = Depends(get_db)):
    """Confere no provedor o status do último pagamento pendente (retorno do Checkout Pro, etc.)."""
    order = load_order(db, public_id)
    if order is None:
        raise HTTPException(404, "Pedido não encontrado.")
    pending = [p for p in order.payments if p.status in (PaymentStatus.pending, PaymentStatus.in_process)]
    if pending:
        try:
            await sync_payment(db, pending[-1], actor="customer_sync")
        except PaymentError:
            pass
        order = load_order(db, public_id)
    return order_out(db, order)  # type: ignore[arg-type]


class RetryIn(BaseModel):
    payment_method: PaymentMethod
    card: CardPaymentIn | None = None


@router.post("/{public_id}/payments", response_model=OrderOut, dependencies=[Depends(limit(6, 60))])
async def new_payment(public_id: str, data: RetryIn, db: Session = Depends(get_db)):
    order = load_order(db, public_id)
    if order is None:
        raise HTTPException(404, "Pedido não encontrado.")
    try:
        await retry_payment(db, order, data.payment_method, data.card)
    except OrderError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    return order_out(db, load_order(db, public_id))  # type: ignore[arg-type]


@router.get("/{public_id}/events")
async def order_events(public_id: str, request: Request):
    """Server-Sent Events: emite o pedido sempre que status ou pagamento mudam."""

    def snapshot() -> tuple[str, str] | None:
        with SessionLocal() as db:
            order = load_order(db, public_id)
            if order is None:
                return None
            out = order_out(db, order)
            key = f"{out.status}|{out.payment_status}|{len(out.history)}"
            return key, out.model_dump_json()

    first = await asyncio.to_thread(snapshot)
    if first is None:
        raise HTTPException(404, "Pedido não encontrado.")

    async def stream():
        last_key, payload = first
        yield f"event: order\ndata: {payload}\n\n"
        ticks = 0
        while ticks < 1200:  # ~1h; o navegador reconecta sozinho
            if await request.is_disconnected():
                break
            await asyncio.sleep(3)
            ticks += 1
            snap = await asyncio.to_thread(snapshot)
            if snap is None:
                break
            key, payload = snap
            if key != last_key:
                last_key = key
                yield f"event: order\ndata: {payload}\n\n"
                status = json.loads(payload)["status"]
                if status in ("delivered", "cancelled"):
                    break
            elif ticks % 5 == 0:
                yield ": ping\n\n"

    return StreamingResponse(
        stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )
