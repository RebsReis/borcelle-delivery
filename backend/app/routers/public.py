"""Rotas públicas: loja, cardápio, CEP e cotação do carrinho."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.db import get_db
from app.models import Category, DeliveryZone, OptionGroup, Product, ProductOptionGroup
from app.schemas import CategoryOut, CepOut, MenuOut, OptionGroupOut, ProductOut, QuoteIn, QuoteOut, StoreOut
from app.services.delivery import CepError, find_zone, lookup_cep, normalize_cep
from app.services.orders import enabled_methods
from app.services.pricing import price_cart
from app.services.store import get_store, is_open, next_opening, schedule_slots

router = APIRouter(prefix="/api", tags=["público"])


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/store", response_model=StoreOut)
def store_info(db: Session = Depends(get_db)):
    store = get_store(db)
    zones = db.scalars(select(DeliveryZone).where(DeliveryZone.is_active.is_(True))).all()
    open_now = is_open(db, store)
    s = get_settings()
    return StoreOut(
        name=store.name,
        phone=store.phone,
        whatsapp=store.whatsapp,
        address=store.address,
        is_open=open_now,
        is_paused=store.is_paused,
        pause_message=store.pause_message,
        next_opening=None if open_now else next_opening(db, store),
        prep_time_minutes=store.prep_time_minutes,
        pickup_eta_minutes=store.pickup_eta_minutes,
        delivery_eta_min=min((z.eta_min_minutes for z in zones), default=store.prep_time_minutes),
        delivery_eta_max=max((z.eta_max_minutes for z in zones), default=store.prep_time_minutes + 25),
        min_order_cents=store.min_order_cents,
        accept_scheduled=store.accept_scheduled,
        delivery_enabled=store.delivery_enabled,
        pickup_enabled=store.pickup_enabled,
        payment_methods=[m.value for m in enabled_methods(store)],
        max_installments=store.max_installments,
        payments_environment=s.payments_environment,
        mp_public_key=s.mp_public_key,
    )


@router.get("/store/slots")
def store_slots(db: Session = Depends(get_db)):
    store = get_store(db)
    return {"slots": [s.isoformat() for s in schedule_slots(db, store)]}


def _product_out(p: Product) -> ProductOut:
    return ProductOut(
        id=p.id,
        slug=p.slug,
        name=p.name,
        description=p.description,
        ingredients=p.ingredients or [],
        price_cents=p.price_cents,
        promo_price_cents=p.promo_price_cents,
        image_url=p.image_url,
        badge=p.badge.value if p.badge else None,
        is_available=p.is_available,
        is_featured=p.is_featured,
        is_recommended=p.is_recommended,
        combo_product_id=p.combo_product_id,
        category_slug=p.category.slug,
        option_groups=[OptionGroupOut.model_validate(link.group) for link in p.option_links],
    )


@router.get("/menu", response_model=MenuOut)
def menu(db: Session = Depends(get_db)):
    cats = db.scalars(select(Category).where(Category.is_active.is_(True)).order_by(Category.position)).all()
    products = db.scalars(
        select(Product)
        .join(Category)
        .where(Category.is_active.is_(True))
        .order_by(Category.position, Product.position)
        .options(
            selectinload(Product.category),
            selectinload(Product.option_links).selectinload(ProductOptionGroup.group).selectinload(OptionGroup.options),
        )
    ).all()
    return MenuOut(categories=[CategoryOut.model_validate(c) for c in cats], products=[_product_out(p) for p in products])


@router.get("/delivery/cep/{cep}", response_model=CepOut)
async def cep_info(cep: str, db: Session = Depends(get_db)):
    try:
        digits = normalize_cep(cep)
    except CepError as exc:
        raise HTTPException(422, str(exc)) from exc
    try:
        addr = await lookup_cep(digits)
    except CepError as exc:
        # Sem ViaCEP ainda dá para validar a área por faixa de CEP
        zone = find_zone(db, digits)
        if zone is None:
            raise HTTPException(404, str(exc)) from exc
        addr = {"cep": digits, "street": "", "neighborhood": "", "city": "", "state": ""}
    zone = find_zone(db, digits)
    return CepOut(
        cep=digits,
        street=addr["street"],
        neighborhood=addr["neighborhood"],
        city=addr["city"],
        state=addr["state"],
        served=zone is not None,
        zone_name=zone.name if zone else None,
        fee_cents=zone.fee_cents if zone else None,
        eta_min_minutes=zone.eta_min_minutes if zone else None,
        eta_max_minutes=zone.eta_max_minutes if zone else None,
        min_order_cents=zone.min_order_cents if zone else None,
        free_shipping_over_cents=zone.free_shipping_over_cents if zone else None,
    )


@router.post("/cart/quote", response_model=QuoteOut)
def quote(data: QuoteIn, db: Session = Depends(get_db)):
    priced = price_cart(
        db, data.items, fulfillment=data.fulfillment, cep=data.cep, coupon_code=data.coupon_code, strict=False
    )
    return priced.to_out()
