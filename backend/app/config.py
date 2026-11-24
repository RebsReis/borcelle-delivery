from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://borcelle:borcelle@localhost:5432/borcelle"
    # URL pública do frontend (redirecionamentos, links de acompanhamento)
    frontend_url: str = "http://localhost:3000"
    # URL pública do backend (usada como notification_url dos webhooks)
    public_api_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000"

    # Chave simples para a rota administrativa provisória da fase 1
    admin_api_key: str = ""

    # Mercado Pago
    mp_access_token: str = ""
    mp_public_key: str = ""
    mp_webhook_secret: str = ""
    mp_api_base: str = "https://api.mercadopago.com"
    pix_expiration_minutes: int = 30

    # ViaCEP
    viacep_base: str = "https://viacep.com.br/ws"

    # Meta Conversions API (opcional)
    meta_pixel_id: str = ""
    meta_capi_token: str = ""

    # WhatsApp Cloud API (opcional)
    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""

    # Reconciliação de pagamentos pendentes (segundos; 0 desliga)
    reconcile_interval_seconds: int = 60

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def payments_environment(self) -> str:
        """unconfigured | sandbox | production"""
        if not self.mp_access_token:
            return "unconfigured"
        return "sandbox" if self.mp_access_token.startswith("TEST-") else "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
