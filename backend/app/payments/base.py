"""Contrato dos provedores de pagamento.

Mercado Pago é o provedor padrão. Para adicionar Pagar.me, Asaas ou outro,
implemente PaymentProvider e registre-o em app/payments/__init__.py.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime

from app.models import PaymentStatus


class PaymentError(Exception):
    """Erro de comunicação ou recusa técnica do provedor."""


class ProviderNotConfigured(PaymentError):
    pass


@dataclass
class ChargeResult:
    provider_payment_id: str
    status: PaymentStatus
    status_detail: str = ""
    pix_qr_code: str | None = None
    pix_qr_code_base64: str | None = None
    redirect_url: str | None = None
    expires_at: datetime | None = None
    raw: dict | None = None


@dataclass
class PixRequest:
    amount_cents: int
    description: str
    external_reference: str
    payer_email: str
    payer_first_name: str
    payer_last_name: str
    expires_at: datetime
    idempotency_key: str


@dataclass
class CardRequest:
    amount_cents: int
    description: str
    external_reference: str
    payer_email: str
    token: str
    payment_method_id: str
    issuer_id: str | None
    installments: int
    identification_type: str | None
    identification_number: str | None
    idempotency_key: str


@dataclass
class RedirectRequest:
    amount_cents: int
    title: str
    external_reference: str
    payer_email: str
    back_url: str
    idempotency_key: str


class PaymentProvider(ABC):
    name: str

    @property
    @abstractmethod
    def configured(self) -> bool: ...

    @abstractmethod
    async def create_pix(self, req: PixRequest) -> ChargeResult: ...

    @abstractmethod
    async def create_card(self, req: CardRequest) -> ChargeResult: ...

    @abstractmethod
    async def create_redirect(self, req: RedirectRequest) -> ChargeResult: ...

    @abstractmethod
    async def get_payment(self, provider_payment_id: str) -> ChargeResult: ...

    @abstractmethod
    async def cancel(self, provider_payment_id: str) -> ChargeResult: ...

    @abstractmethod
    async def refund(self, provider_payment_id: str, amount_cents: int | None, idempotency_key: str) -> ChargeResult: ...

    @abstractmethod
    def verify_webhook(self, headers: dict[str, str], query: dict[str, str], body: dict) -> bool: ...

    @abstractmethod
    def webhook_payment_id(self, query: dict[str, str], body: dict) -> str | None: ...
