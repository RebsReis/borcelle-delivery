from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import Fulfillment, PaymentMethod


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------------------- cardápio


class OptionOut(ORM):
    id: int
    name: str
    price_cents: int
    is_available: bool
    is_default: bool


class OptionGroupOut(ORM):
    id: int
    code: str
    name: str
    kind: str
    min_select: int
    max_select: int
    options: list[OptionOut]


class ProductOut(ORM):
    id: int
    slug: str
    name: str
    description: str
    ingredients: list[str]
    price_cents: int
    promo_price_cents: int | None
    image_url: str | None
    badge: str | None
    is_available: bool
    is_featured: bool
    is_recommended: bool
    combo_product_id: int | None
    category_slug: str
    option_groups: list[OptionGroupOut]


class CategoryOut(ORM):
    id: int
    slug: str
    name: str


class MenuOut(BaseModel):
    categories: list[CategoryOut]
    products: list[ProductOut]


# ----------------------------------------------------------------- loja


class StoreOut(BaseModel):
    name: str
    phone: str
    whatsapp: str
    address: str
    is_open: bool
    is_paused: bool
    pause_message: str
    next_opening: datetime | None
    prep_time_minutes: int
    pickup_eta_minutes: int
    delivery_eta_min: int
    delivery_eta_max: int
    min_order_cents: int
    accept_scheduled: bool
    delivery_enabled: bool
    pickup_enabled: bool
    payment_methods: list[str]
    max_installments: int
    payments_environment: str
    mp_public_key: str


class CepOut(BaseModel):
    cep: str
    street: str
    neighborhood: str
    city: str
    state: str
    served: bool
    zone_name: str | None = None
    fee_cents: int | None = None
    eta_min_minutes: int | None = None
    eta_max_minutes: int | None = None
    min_order_cents: int | None = None
    free_shipping_over_cents: int | None = None


# ----------------------------------------------------------------- carrinho / cotação


class CartItemIn(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, le=50)
    option_ids: list[int] = Field(default_factory=list, max_length=40)
    notes: str = Field(default="", max_length=200)


class QuoteIn(BaseModel):
    items: list[CartItemIn] = Field(min_length=1, max_length=40)
    coupon_code: str | None = Field(default=None, max_length=40)
    fulfillment: Fulfillment = Fulfillment.delivery
    cep: str | None = None


class QuoteOptionOut(BaseModel):
    option_id: int
    group_name: str
    group_kind: str
    name: str
    price_cents: int


class QuoteItemOut(BaseModel):
    index: int
    product_id: int
    name: str
    quantity: int
    unit_base_cents: int
    unit_total_cents: int
    line_total_cents: int
    options: list[QuoteOptionOut]
    notes: str


class QuoteOut(BaseModel):
    items: list[QuoteItemOut]
    subtotal_cents: int
    delivery_fee_cents: int
    discount_cents: int
    total_cents: int
    coupon_code: str | None
    coupon_message: str | None
    delivery_served: bool | None
    min_order_cents: int
    errors: list[str]


# ----------------------------------------------------------------- pedido


class CustomerIn(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    phone: str = Field(min_length=10, max_length=20)
    email: EmailStr

    @field_validator("phone")
    @classmethod
    def digits_only(cls, v: str) -> str:
        d = "".join(ch for ch in v if ch.isdigit())
        if len(d) < 10 or len(d) > 11:
            raise ValueError("Telefone deve ter DDD + número")
        return d

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v.split(" ")) < 2:
            raise ValueError("Informe nome e sobrenome")
        return v


class AddressIn(BaseModel):
    cep: str
    street: str = Field(min_length=2, max_length=200)
    number: str = Field(min_length=1, max_length=20)
    complement: str = Field(default="", max_length=100)
    neighborhood: str = Field(min_length=2, max_length=100)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=2)
    reference: str = Field(default="", max_length=200)


class CardPaymentIn(BaseModel):
    """Dados devolvidos pelo Card Payment Brick: o cartão já vem tokenizado."""

    token: str = Field(min_length=8, max_length=200)
    payment_method_id: str = Field(max_length=40)
    issuer_id: str | int | None = None
    installments: int = Field(default=1, ge=1, le=12)
    identification_type: str | None = Field(default=None, max_length=10)
    identification_number: str | None = Field(default=None, max_length=20)


class OrderIn(BaseModel):
    customer: CustomerIn
    fulfillment: Fulfillment
    scheduled_for: datetime | None = None
    address: AddressIn | None = None
    items: list[CartItemIn] = Field(min_length=1, max_length=40)
    coupon_code: str | None = Field(default=None, max_length=40)
    notes: str = Field(default="", max_length=500)
    payment_method: PaymentMethod
    change_for_cents: int | None = Field(default=None, ge=0)
    card: CardPaymentIn | None = None
    marketing_consent: bool = False
    notify_whatsapp: bool = False
    expected_total_cents: int | None = None


class PaymentOut(ORM):
    method: str
    status: str
    status_detail: str
    amount_cents: int
    installments: int
    pix_qr_code: str | None
    pix_qr_code_base64: str | None
    redirect_url: str | None
    expires_at: datetime | None


class HistoryOut(ORM):
    status: str
    note: str
    created_at: datetime


class OrderItemOptionOut(ORM):
    group_name: str
    group_kind: str
    option_name: str
    price_cents: int


class OrderItemOut(ORM):
    product_name: str
    quantity: int
    unit_total_cents: int
    line_total_cents: int
    notes: str
    options: list[OrderItemOptionOut]


class OrderOut(ORM):
    public_id: str
    number: int
    status: str
    payment_status: str
    payment_method: str
    fulfillment: str
    customer_name: str
    customer_phone: str
    address: dict | None
    scheduled_for: datetime | None
    eta_at: datetime | None
    subtotal_cents: int
    delivery_fee_cents: int
    discount_cents: int
    total_cents: int
    coupon_code: str | None
    change_for_cents: int | None
    notes: str
    created_at: datetime
    items: list[OrderItemOut]
    history: list[HistoryOut]
    payment: PaymentOut | None = None
    store_whatsapp: str = ""
    payments_environment: str = ""


class StatusUpdateIn(BaseModel):
    status: str
    note: str = Field(default="", max_length=300)
