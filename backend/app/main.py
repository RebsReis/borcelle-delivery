from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db import SessionLocal
from app.models import Payment, PaymentStatus
from app.payments import get_provider
from app.routers import admin, orders, payments, public
from app.services.orders import sync_payment

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("borcelle")


async def reconcile_pending() -> None:
    """Rede de segurança para webhooks perdidos: confere pagamentos em aberto."""
    if not get_provider().configured:
        return
    with SessionLocal() as db:
        rows = db.scalars(
            select(Payment)
            .where(Payment.status.in_([PaymentStatus.pending, PaymentStatus.in_process]))
            .options(selectinload(Payment.order))
            .limit(50)
        ).all()
        for p in rows:
            try:
                await sync_payment(db, p)
            except Exception as exc:  # noqa: BLE001
                db.rollback()
                log.warning("Reconciliação do pagamento %s falhou: %s", p.id, exc)


async def reconcile_loop(interval: int) -> None:
    while True:
        await asyncio.sleep(interval)
        await reconcile_pending()


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    log.info("Pagamentos: %s", s.payments_environment)
    task = asyncio.create_task(reconcile_loop(s.reconcile_interval_seconds)) if s.reconcile_interval_seconds > 0 else None
    yield
    if task:
        task.cancel()


app = FastAPI(title="Borcelle Delivery API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "Idempotency-Key", "X-Admin-Key"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:])
    msg = str(first.get("msg", "Dados inválidos")).replace("Value error, ", "")
    return JSONResponse(status_code=422, content={"detail": msg, "field": field})


app.include_router(public.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(admin.router)
