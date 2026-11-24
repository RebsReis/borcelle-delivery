from app.payments.base import PaymentProvider
from app.payments.mercadopago import MercadoPagoProvider

_provider: PaymentProvider | None = None


def get_provider() -> PaymentProvider:
    """Provedor ativo. Troque aqui para usar outro gateway (Pagar.me, Asaas...)."""
    global _provider
    if _provider is None:
        _provider = MercadoPagoProvider()
    return _provider


def set_provider(provider: PaymentProvider | None) -> None:
    """Usado nos testes para injetar um provedor com transporte simulado."""
    global _provider
    _provider = provider
