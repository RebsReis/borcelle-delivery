"""Integração com a API REST do Mercado Pago (Checkout Transparente + Checkout Pro).

Docs: https://www.mercadopago.com.br/developers/pt/reference
- Credenciais TEST-... = ambiente de testes (sandbox).
- O status de um pagamento sempre é confirmado consultando GET /v1/payments/{id};
  o conteúdo do webhook é só um aviso.
"""
from __future__ import annotations

import hashlib
import hmac
from datetime import datetime

import httpx

from app.config import get_settings
from app.models import PaymentStatus
from app.payments.base import (
    CardRequest,
    ChargeResult,
    PaymentError,
    PaymentProvider,
    PixRequest,
    ProviderNotConfigured,
    RedirectRequest,
)

STATUS_MAP = {
    "pending": PaymentStatus.pending,
    "authorized": PaymentStatus.in_process,
    "in_process": PaymentStatus.in_process,
    "in_mediation": PaymentStatus.in_process,
    "approved": PaymentStatus.approved,
    "rejected": PaymentStatus.rejected,
    "cancelled": PaymentStatus.cancelled,
    "refunded": PaymentStatus.refunded,
    "charged_back": PaymentStatus.refunded,
}


def _reais(cents: int) -> float:
    return round(cents / 100, 2)


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


class MercadoPagoProvider(PaymentProvider):
    name = "mercadopago"

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None):
        self.settings = get_settings()
        self._transport = transport

    @property
    def configured(self) -> bool:
        return bool(self.settings.mp_access_token)

    def _client(self) -> httpx.AsyncClient:
        if not self.configured:
            raise ProviderNotConfigured(
                "Pagamento online indisponível: credenciais do Mercado Pago não configuradas."
            )
        return httpx.AsyncClient(
            base_url=self.settings.mp_api_base,
            headers={"Authorization": f"Bearer {self.settings.mp_access_token}"},
            timeout=20,
            transport=self._transport,
        )

    async def _request(self, method: str, path: str, *, json: dict | None = None, idem: str | None = None) -> dict:
        headers = {"X-Idempotency-Key": idem} if idem else {}
        async with self._client() as client:
            try:
                resp = await client.request(method, path, json=json, headers=headers)
            except httpx.HTTPError as exc:
                raise PaymentError("Não foi possível falar com o Mercado Pago. Tente novamente.") from exc
        data = resp.json() if resp.content else {}
        if resp.status_code >= 400:
            msg = data.get("message") or data.get("error") or f"HTTP {resp.status_code}"
            raise PaymentError(f"Mercado Pago recusou a solicitação: {msg}")
        return data

    def _result(self, data: dict) -> ChargeResult:
        tx = (data.get("point_of_interaction") or {}).get("transaction_data") or {}
        return ChargeResult(
            provider_payment_id=str(data["id"]),
            status=STATUS_MAP.get(data.get("status", ""), PaymentStatus.pending),
            status_detail=data.get("status_detail") or "",
            pix_qr_code=tx.get("qr_code"),
            pix_qr_code_base64=tx.get("qr_code_base64"),
            redirect_url=tx.get("ticket_url"),
            expires_at=_parse_dt(data.get("date_of_expiration")),
            raw={k: data.get(k) for k in ("id", "status", "status_detail", "payment_method_id", "transaction_amount", "date_approved", "live_mode", "external_reference")},
        )

    def _notification_url(self) -> str | None:
        url = f"{self.settings.public_api_url.rstrip('/')}/api/payments/webhooks/mercadopago"
        # O Mercado Pago rejeita notification_url que não seja https pública
        return url if url.startswith("https://") else None

    async def create_pix(self, req: PixRequest) -> ChargeResult:
        body = {
            "transaction_amount": _reais(req.amount_cents),
            "description": req.description,
            "payment_method_id": "pix",
            "external_reference": req.external_reference,
            "date_of_expiration": req.expires_at.isoformat(timespec="milliseconds"),
            "payer": {"email": req.payer_email, "first_name": req.payer_first_name, "last_name": req.payer_last_name},
        }
        if url := self._notification_url():
            body["notification_url"] = url
        return self._result(await self._request("POST", "/v1/payments", json=body, idem=req.idempotency_key))

    async def create_card(self, req: CardRequest) -> ChargeResult:
        payer: dict = {"email": req.payer_email}
        if req.identification_type and req.identification_number:
            payer["identification"] = {"type": req.identification_type, "number": req.identification_number}
        body = {
            "transaction_amount": _reais(req.amount_cents),
            "token": req.token,
            "description": req.description,
            "installments": req.installments,
            "payment_method_id": req.payment_method_id,
            "external_reference": req.external_reference,
            "payer": payer,
            "binary_mode": False,
        }
        if req.issuer_id:
            body["issuer_id"] = str(req.issuer_id)
        if url := self._notification_url():
            body["notification_url"] = url
        return self._result(await self._request("POST", "/v1/payments", json=body, idem=req.idempotency_key))

    async def create_redirect(self, req: RedirectRequest) -> ChargeResult:
        """Checkout Pro: saldo/conta Mercado Pago e demais meios da carteira."""
        body = {
            "items": [{"title": req.title, "quantity": 1, "unit_price": _reais(req.amount_cents), "currency_id": "BRL"}],
            "external_reference": req.external_reference,
            "payer": {"email": req.payer_email},
            "back_urls": {"success": req.back_url, "pending": req.back_url, "failure": req.back_url},
            "auto_return": "approved",
        }
        if url := self._notification_url():
            body["notification_url"] = url
        data = await self._request("POST", "/checkout/preferences", json=body, idem=req.idempotency_key)
        link = data.get("sandbox_init_point") if self.settings.payments_environment == "sandbox" else data.get("init_point")
        return ChargeResult(
            provider_payment_id=f"pref_{data['id']}", status=PaymentStatus.pending, redirect_url=link, raw={"preference_id": data["id"]}
        )

    async def get_payment(self, provider_payment_id: str) -> ChargeResult:
        return self._result(await self._request("GET", f"/v1/payments/{provider_payment_id}"))

    async def search_by_reference(self, external_reference: str) -> ChargeResult | None:
        data = await self._request(
            "GET", f"/v1/payments/search?external_reference={external_reference}&sort=date_created&criteria=desc"
        )
        results = data.get("results") or []
        return self._result(results[0]) if results else None

    async def cancel(self, provider_payment_id: str) -> ChargeResult:
        return self._result(await self._request("PUT", f"/v1/payments/{provider_payment_id}", json={"status": "cancelled"}))

    async def refund(self, provider_payment_id: str, amount_cents: int | None, idempotency_key: str) -> ChargeResult:
        body = {"amount": _reais(amount_cents)} if amount_cents else {}
        await self._request("POST", f"/v1/payments/{provider_payment_id}/refunds", json=body, idem=idempotency_key)
        return await self.get_payment(provider_payment_id)

    # ------------------------------------------------------------- webhooks

    def webhook_payment_id(self, query: dict[str, str], body: dict) -> str | None:
        topic = query.get("type") or query.get("topic") or body.get("type") or body.get("topic")
        if topic not in ("payment", None):
            return None
        pid = query.get("data.id") or (body.get("data") or {}).get("id") or query.get("id")
        return str(pid) if pid else None

    def verify_webhook(self, headers: dict[str, str], query: dict[str, str], body: dict) -> bool:
        """Valida o cabeçalho x-signature (HMAC-SHA256 com a assinatura secreta do painel).

        Manifesto: id:{data.id};request-id:{x-request-id};ts:{ts};
        """
        secret = self.settings.mp_webhook_secret
        if not secret:
            return False
        signature = headers.get("x-signature", "")
        request_id = headers.get("x-request-id", "")
        parts = dict(p.strip().split("=", 1) for p in signature.split(",") if "=" in p)
        ts, v1 = parts.get("ts"), parts.get("v1")
        data_id = query.get("data.id") or str((body.get("data") or {}).get("id") or "")
        if not ts or not v1 or not data_id:
            return False
        if data_id.isalnum():
            data_id = data_id.lower()
        manifest = f"id:{data_id};"
        if request_id:
            manifest += f"request-id:{request_id};"
        manifest += f"ts:{ts};"
        expected = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, v1)
