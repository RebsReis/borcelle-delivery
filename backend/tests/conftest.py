"""Testes contra um PostgreSQL real (banco borcelle_test) com o Mercado Pago simulado.

O Mercado Pago é substituído por um httpx.MockTransport que imita a API REST,
então nenhum pagamento real ou de sandbox é feito aqui. Para testar no sandbox
real do Mercado Pago, veja docs/PAGAMENTOS.md.
"""
from __future__ import annotations

import hashlib
import hmac
import itertools
import json
import os
import time as _time
from datetime import time

import httpx
import pytest

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://borcelle:borcelle@localhost:5432/borcelle_test")
os.environ["MP_ACCESS_TOKEN"] = "TEST-123"
os.environ["MP_PUBLIC_KEY"] = "TEST-pub"
os.environ["MP_WEBHOOK_SECRET"] = "segredo-webhook"
os.environ["ADMIN_API_KEY"] = "admin-teste"
os.environ["RECONCILE_INTERVAL_SECONDS"] = "0"

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import delete, text  # noqa: E402

from app import ratelimit  # noqa: E402
from app.db import SessionLocal, engine  # noqa: E402
from app.models import BusinessHours, StoreSettings  # noqa: E402
from app.payments import set_provider  # noqa: E402
from app.payments.mercadopago import MercadoPagoProvider  # noqa: E402


class FakeMercadoPago:
    """Estado mínimo de pagamentos para imitar /v1/payments."""

    def __init__(self):
        self.payments: dict[str, dict] = {}
        self.ids = itertools.count(int(_time.time() * 1000))
        self.idem: dict[str, str] = {}
        self.next_card_status = "approved"
        self.calls: list[tuple[str, str]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.calls.append((request.method, request.url.path))
        path = request.url.path
        if request.method == "POST" and path == "/v1/payments":
            key = request.headers.get("x-idempotency-key")
            if key in self.idem:
                return httpx.Response(201, json=self.payments[self.idem[key]])
            body = json.loads(request.content)
            pid = str(next(self.ids))
            pay = {
                "id": int(pid),
                "status": "pending" if body["payment_method_id"] == "pix" else self.next_card_status,
                "status_detail": "pending_waiting_transfer" if body["payment_method_id"] == "pix" else "accredited",
                "transaction_amount": body["transaction_amount"],
                "external_reference": body["external_reference"],
                "payment_method_id": body["payment_method_id"],
                "date_of_expiration": body.get("date_of_expiration"),
            }
            if body["payment_method_id"] == "pix":
                pay["point_of_interaction"] = {
                    "transaction_data": {"qr_code": f"00020126PIX{pid}", "qr_code_base64": "iVBORw0KGgo=", "ticket_url": "https://mp/ticket"}
                }
            if pay["status"] == "rejected":
                pay["status_detail"] = "cc_rejected_insufficient_amount"
            self.payments[pid] = pay
            self.idem[key] = pid
            return httpx.Response(201, json=pay)
        if path.startswith("/v1/payments/") and path.endswith("/refunds"):
            pid = path.split("/")[3]
            self.payments[pid]["status"] = "refunded"
            return httpx.Response(201, json={"id": 1, "payment_id": int(pid)})
        if path.startswith("/v1/payments/"):
            pid = path.split("/")[3]
            if pid not in self.payments:
                return httpx.Response(404, json={"message": "not found"})
            if request.method == "PUT":
                self.payments[pid]["status"] = json.loads(request.content)["status"]
            return httpx.Response(200, json=self.payments[pid])
        return httpx.Response(404, json={"message": "rota simulada inexistente"})

    def approve(self, pid: str) -> None:
        self.payments[pid]["status"] = "approved"
        self.payments[pid]["status_detail"] = "accredited"


def sign(data_id: str, request_id: str = "req-1", ts: str = "1700000000", secret: str = "segredo-webhook") -> dict:
    manifest = f"id:{data_id.lower()};request-id:{request_id};ts:{ts};"
    v1 = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return {"x-signature": f"ts={ts},v1={v1}", "x-request-id": request_id}


@pytest.fixture(scope="session", autouse=True)
def database():
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "alembic"))
    command.upgrade(cfg, "head")
    from app.seed import run

    run()
    yield


@pytest.fixture(autouse=True)
def always_open():
    """Loja aberta 24h durante os testes (exceto quando o teste muda)."""
    ratelimit.reset()
    with SessionLocal() as db:
        db.execute(delete(BusinessHours))
        for wd in range(7):
            db.add(BusinessHours(weekday=wd, opens_at=time(0, 0), closes_at=time(23, 59, 59)))
        store = db.get(StoreSettings, 1)
        store.is_paused = False
        db.commit()
    yield


@pytest.fixture
def mp():
    fake = FakeMercadoPago()
    set_provider(MercadoPagoProvider(transport=httpx.MockTransport(fake.handler)))
    yield fake
    set_provider(None)


@pytest.fixture
def client(mp):
    from app.main import app

    with TestClient(app) as c:
        yield c
