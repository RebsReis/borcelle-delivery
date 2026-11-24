"""Operação mínima da fase 1 (sem interface): listar pedidos, mudar status, estornar.

Protegida pela chave ADMIN_API_KEY no cabeçalho X-Admin-Key. Na fase 2 esta
rota passa a usar login de administrador com permissões por função.
"""
from __future__ import annotations

import hmac

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Order, OrderStatus
from app.payments.base import PaymentError
from app.ratelimit import limit
from app.routers.orders import order_out
from app.schemas import OrderOut, StatusUpdateIn
from app.services.orders import OrderError, load_order, refund_order, set_status


def require_admin(x_admin_key: str = Header(default="")) -> str:
    key = get_settings().admin_api_key
    if not key or not hmac.compare_digest(key, x_admin_key):
        raise HTTPException(401, "Não autorizado")
    return "admin_key"


router = APIRouter(
    prefix="/api/admin", tags=["admin (fase 1)"], dependencies=[Depends(limit(120, 60)), Depends(require_admin)]
)


@router.get("/orders", response_model=list[OrderOut])
def list_orders(status: str | None = None, db: Session = Depends(get_db)):
    q = select(Order.public_id).order_by(Order.created_at.desc()).limit(100)
    if status:
        q = q.where(Order.status == OrderStatus(status))
    return [order_out(db, load_order(db, pid)) for pid in db.scalars(q).all()]  # type: ignore[arg-type]


@router.patch("/orders/{public_id}/status", response_model=OrderOut)
def update_status(public_id: str, data: StatusUpdateIn, db: Session = Depends(get_db), actor: str = Depends(require_admin)):
    order = load_order(db, public_id)
    if order is None:
        raise HTTPException(404, "Pedido não encontrado.")
    try:
        set_status(db, order, OrderStatus(data.status), actor=actor, note=data.note)
    except ValueError as exc:
        raise HTTPException(422, "Status desconhecido") from exc
    except OrderError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    db.commit()
    return order_out(db, load_order(db, public_id))  # type: ignore[arg-type]


@router.post("/orders/{public_id}/refund", response_model=OrderOut)
async def refund(public_id: str, db: Session = Depends(get_db), actor: str = Depends(require_admin)):
    order = load_order(db, public_id)
    if order is None:
        raise HTTPException(404, "Pedido não encontrado.")
    try:
        await refund_order(db, order, actor)
    except OrderError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    except PaymentError as exc:
        raise HTTPException(502, str(exc)) from exc
    return order_out(db, load_order(db, public_id))  # type: ignore[arg-type]
