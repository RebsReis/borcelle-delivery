"""Modelo relacional da Borcelle.

Valores monetários são sempre inteiros em centavos (sufixo _cents).
Pedidos guardam um retrato (snapshot) de nome, preço e opções no momento da
compra, para que alterações futuras no cardápio não reescrevam o histórico.
"""
from __future__ import annotations

import enum
from datetime import date, datetime, time

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# --------------------------------------------------------------------------- cardápio


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    products: Mapped[list[Product]] = relationship(back_populates="category", order_by="Product.position")


class ProductBadge(str, enum.Enum):
    best_seller = "best_seller"
    new = "new"


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("price_cents >= 0", name="ck_products_price"),
        CheckConstraint(
            "promo_price_cents IS NULL OR (promo_price_cents >= 0 AND promo_price_cents < price_cents)",
            name="ck_products_promo",
        ),
        Index("ix_products_category_position", "category_id", "position"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    ingredients: Mapped[list[str]] = mapped_column(JSON, default=list)
    price_cents: Mapped[int] = mapped_column(Integer)
    promo_price_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    badge: Mapped[ProductBadge | None] = mapped_column(Enum(ProductBadge, name="product_badge"), nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_recommended: Mapped[bool] = mapped_column(Boolean, default=False)
    # Hambúrguer que tem versão combo: aponta para o produto combo correspondente
    combo_product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)

    category: Mapped[Category] = relationship(back_populates="products")
    option_links: Mapped[list[ProductOptionGroup]] = relationship(
        back_populates="product", order_by="ProductOptionGroup.position", cascade="all, delete-orphan"
    )

    @property
    def effective_price_cents(self) -> int:
        return self.promo_price_cents if self.promo_price_cents is not None else self.price_cents


class OptionGroupKind(str, enum.Enum):
    single = "single"  # escolha única (ponto da carne, molho da casa)
    multiple = "multiple"  # adicionais
    remove = "remove"  # retirar ingredientes (preço 0)


class OptionGroup(Base):
    __tablename__ = "option_groups"
    __table_args__ = (
        CheckConstraint("min_select >= 0", name="ck_option_groups_min"),
        CheckConstraint("max_select >= min_select AND max_select >= 1", name="ck_option_groups_max"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    kind: Mapped[OptionGroupKind] = mapped_column(Enum(OptionGroupKind, name="option_group_kind"))
    min_select: Mapped[int] = mapped_column(Integer, default=0)
    max_select: Mapped[int] = mapped_column(Integer, default=1)
    options: Mapped[list[Option]] = relationship(
        back_populates="group", order_by="Option.position", cascade="all, delete-orphan"
    )

    @property
    def required(self) -> bool:
        return self.min_select > 0


class Option(Base):
    __tablename__ = "options"
    __table_args__ = (CheckConstraint("price_cents >= 0", name="ck_options_price"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("option_groups.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    group: Mapped[OptionGroup] = relationship(back_populates="options")


class ProductOptionGroup(Base):
    __tablename__ = "product_option_groups"
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("option_groups.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    product: Mapped[Product] = relationship(back_populates="option_links")
    group: Mapped[OptionGroup] = relationship()


# --------------------------------------------------------------------------- loja


class StoreSettings(TimestampMixin, Base):
    """Linha única (id = 1) com a configuração da loja."""

    __tablename__ = "store_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), default="Borcelle Hamburgueria")
    phone: Mapped[str] = mapped_column(String(30), default="")
    whatsapp: Mapped[str] = mapped_column(String(30), default="")
    address: Mapped[str] = mapped_column(String(300), default="")
    timezone: Mapped[str] = mapped_column(String(60), default="America/Sao_Paulo")
    prep_time_minutes: Mapped[int] = mapped_column(Integer, default=25)
    pickup_eta_minutes: Mapped[int] = mapped_column(Integer, default=20)
    min_order_cents: Mapped[int] = mapped_column(Integer, default=0)
    is_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    pause_message: Mapped[str] = mapped_column(String(200), default="")
    accept_scheduled: Mapped[bool] = mapped_column(Boolean, default=True)
    schedule_days_ahead: Mapped[int] = mapped_column(Integer, default=1)
    delivery_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    pickup_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # Formas de pagamento habilitadas individualmente
    pay_pix: Mapped[bool] = mapped_column(Boolean, default=True)
    pay_credit_online: Mapped[bool] = mapped_column(Boolean, default=True)
    pay_debit_online: Mapped[bool] = mapped_column(Boolean, default=True)
    pay_card_on_delivery: Mapped[bool] = mapped_column(Boolean, default=True)
    pay_cash: Mapped[bool] = mapped_column(Boolean, default=True)
    pay_wallet: Mapped[bool] = mapped_column(Boolean, default=False)
    max_installments: Mapped[int] = mapped_column(Integer, default=3)
    min_installment_cents: Mapped[int] = mapped_column(Integer, default=3000)


class BusinessHours(Base):
    __tablename__ = "business_hours"
    __table_args__ = (CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_hours_weekday"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    weekday: Mapped[int] = mapped_column(Integer, index=True)  # 0 = segunda ... 6 = domingo
    opens_at: Mapped[time] = mapped_column(Time)
    closes_at: Mapped[time] = mapped_column(Time)  # menor que opens_at = vira a meia-noite


class Holiday(Base):
    __tablename__ = "holidays"
    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, unique=True)
    name: Mapped[str] = mapped_column(String(120))


class DeliveryZone(Base):
    """Região atendida por faixa de CEP (8 dígitos, inteiro)."""

    __tablename__ = "delivery_zones"
    __table_args__ = (
        CheckConstraint("cep_end >= cep_start", name="ck_zone_range"),
        CheckConstraint("fee_cents >= 0", name="ck_zone_fee"),
        Index("ix_zone_range", "cep_start", "cep_end"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    cep_start: Mapped[int] = mapped_column(Integer)
    cep_end: Mapped[int] = mapped_column(Integer)
    fee_cents: Mapped[int] = mapped_column(Integer)
    eta_min_minutes: Mapped[int] = mapped_column(Integer, default=30)
    eta_max_minutes: Mapped[int] = mapped_column(Integer, default=50)
    min_order_cents: Mapped[int] = mapped_column(Integer, default=0)
    free_shipping_over_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class CouponKind(str, enum.Enum):
    percent = "percent"
    fixed = "fixed"
    free_shipping = "free_shipping"


class Coupon(TimestampMixin, Base):
    __tablename__ = "coupons"
    __table_args__ = (CheckConstraint("value >= 0", name="ck_coupon_value"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    description: Mapped[str] = mapped_column(String(200), default="")
    kind: Mapped[CouponKind] = mapped_column(Enum(CouponKind, name="coupon_kind"))
    value: Mapped[int] = mapped_column(Integer, default=0)  # % (0-100) ou centavos
    min_order_cents: Mapped[int] = mapped_column(Integer, default=0)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uses: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# --------------------------------------------------------------------------- clientes


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20), index=True)
    email: Mapped[str] = mapped_column(String(200), index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)  # fase 2
    addresses: Mapped[list[Address]] = relationship(back_populates="customer", cascade="all, delete-orphan")


class Address(TimestampMixin, Base):
    __tablename__ = "addresses"
    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(40), default="Casa")
    cep: Mapped[str] = mapped_column(String(8))
    street: Mapped[str] = mapped_column(String(200))
    number: Mapped[str] = mapped_column(String(20))
    complement: Mapped[str] = mapped_column(String(100), default="")
    neighborhood: Mapped[str] = mapped_column(String(100))
    city: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(2))
    reference: Mapped[str] = mapped_column(String(200), default="")
    customer: Mapped[Customer] = relationship(back_populates="addresses")


# --------------------------------------------------------------------------- pedidos


class OrderStatus(str, enum.Enum):
    awaiting_payment = "awaiting_payment"
    received = "received"
    confirmed = "confirmed"
    preparing = "preparing"
    ready = "ready"
    out_for_delivery = "out_for_delivery"  # na retirada: "Disponível para retirada"
    delivered = "delivered"
    cancelled = "cancelled"


class Fulfillment(str, enum.Enum):
    delivery = "delivery"
    pickup = "pickup"


class PaymentMethod(str, enum.Enum):
    pix = "pix"
    credit_online = "credit_online"
    debit_online = "debit_online"
    card_on_delivery = "card_on_delivery"
    cash = "cash"
    wallet = "wallet"

    @property
    def is_online(self) -> bool:
        return self in (PaymentMethod.pix, PaymentMethod.credit_online, PaymentMethod.debit_online, PaymentMethod.wallet)


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    in_process = "in_process"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"
    refunded = "refunded"
    expired = "expired"
    on_delivery = "on_delivery"  # pago na entrega/retirada


class Order(TimestampMixin, Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("total_cents >= 0", name="ck_orders_total"),
        Index("ix_orders_status_created", "status", "created_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[int] = mapped_column(Integer, unique=True)  # número exibido (#1042)
    public_id: Mapped[str] = mapped_column(String(24), unique=True)  # identificador não adivinhável da URL
    idempotency_key: Mapped[str] = mapped_column(String(80), unique=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    customer_phone: Mapped[str] = mapped_column(String(20))
    customer_email: Mapped[str] = mapped_column(String(200))
    fulfillment: Mapped[Fulfillment] = mapped_column(Enum(Fulfillment, name="fulfillment"))
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    address: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("delivery_zones.id", ondelete="SET NULL"), nullable=True)
    subtotal_cents: Mapped[int] = mapped_column(Integer)
    delivery_fee_cents: Mapped[int] = mapped_column(Integer, default=0)
    discount_cents: Mapped[int] = mapped_column(Integer, default=0)
    total_cents: Mapped[int] = mapped_column(Integer)
    coupon_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod, name="payment_method"))
    payment_status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus, name="payment_status"))
    change_for_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus, name="order_status"))
    eta_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    marketing_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    notify_whatsapp: Mapped[bool] = mapped_column(Boolean, default=False)
    purchase_tracked: Mapped[bool] = mapped_column(Boolean, default=False)

    items: Mapped[list[OrderItem]] = relationship(back_populates="order", cascade="all, delete-orphan")
    payments: Mapped[list[Payment]] = relationship(
        back_populates="order", order_by="Payment.id", cascade="all, delete-orphan"
    )
    history: Mapped[list[OrderStatusHistory]] = relationship(
        back_populates="order", order_by="OrderStatusHistory.id", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_items_qty"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    product_name: Mapped[str] = mapped_column(String(120))
    unit_base_cents: Mapped[int] = mapped_column(Integer)
    unit_total_cents: Mapped[int] = mapped_column(Integer)
    quantity: Mapped[int] = mapped_column(Integer)
    line_total_cents: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str] = mapped_column(Text, default="")
    order: Mapped[Order] = relationship(back_populates="items")
    options: Mapped[list[OrderItemOption]] = relationship(back_populates="item", cascade="all, delete-orphan")


class OrderItemOption(Base):
    __tablename__ = "order_item_options"
    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("order_items.id", ondelete="CASCADE"), index=True)
    option_id: Mapped[int | None] = mapped_column(ForeignKey("options.id", ondelete="SET NULL"), nullable=True)
    group_name: Mapped[str] = mapped_column(String(80))
    group_kind: Mapped[str] = mapped_column(String(20))
    option_name: Mapped[str] = mapped_column(String(80))
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    item: Mapped[OrderItem] = relationship(back_populates="options")


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus, name="order_status"))
    note: Mapped[str] = mapped_column(String(300), default="")
    actor: Mapped[str] = mapped_column(String(80), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    order: Mapped[Order] = relationship(back_populates="history")


class Payment(TimestampMixin, Base):
    __tablename__ = "payments"
    __table_args__ = (UniqueConstraint("provider", "provider_payment_id", name="uq_payment_provider_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(30))
    method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod, name="payment_method"))
    provider_payment_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus, name="payment_status"))
    status_detail: Mapped[str] = mapped_column(String(120), default="")
    amount_cents: Mapped[int] = mapped_column(Integer)
    installments: Mapped[int] = mapped_column(Integer, default=1)
    idempotency_key: Mapped[str] = mapped_column(String(80), unique=True)
    pix_qr_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    pix_qr_code_base64: Mapped[str | None] = mapped_column(Text, nullable=True)
    redirect_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refunded_cents: Mapped[int] = mapped_column(Integer, default=0)
    raw: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    order: Mapped[Order] = relationship(back_populates="payments")


class WebhookEvent(Base):
    """Registro de webhooks recebidos (auditoria e descarte de duplicados)."""

    __tablename__ = "webhook_events"
    __table_args__ = (UniqueConstraint("provider", "event_key", name="uq_webhook_event"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(30))
    event_key: Mapped[str] = mapped_column(String(160))
    payload: Mapped[dict] = mapped_column(JSON)
    signature_valid: Mapped[bool] = mapped_column(Boolean)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor: Mapped[str] = mapped_column(String(80))
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str] = mapped_column(String(40))
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
