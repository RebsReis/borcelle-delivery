"""Consulta de CEP (ViaCEP) e regiões de entrega."""
from __future__ import annotations

import re

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import DeliveryZone


class CepError(Exception):
    pass


def normalize_cep(cep: str) -> str:
    digits = re.sub(r"\D", "", cep or "")
    if len(digits) != 8:
        raise CepError("CEP inválido. Use 8 dígitos.")
    return digits


def find_zone(db: Session, cep: str) -> DeliveryZone | None:
    value = int(normalize_cep(cep))
    return db.scalar(
        select(DeliveryZone)
        .where(DeliveryZone.is_active.is_(True), DeliveryZone.cep_start <= value, DeliveryZone.cep_end >= value)
        .order_by(DeliveryZone.fee_cents)
        .limit(1)
    )


def zone_fee(zone: DeliveryZone, subtotal_cents: int) -> int:
    if zone.free_shipping_over_cents is not None and subtotal_cents >= zone.free_shipping_over_cents:
        return 0
    return zone.fee_cents


async def lookup_cep(cep: str, client: httpx.AsyncClient | None = None) -> dict:
    digits = normalize_cep(cep)
    url = f"{get_settings().viacep_base}/{digits}/json/"
    own = client is None
    client = client or httpx.AsyncClient(timeout=6)
    try:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise CepError("Não foi possível consultar o CEP agora. Preencha o endereço manualmente.") from exc
    finally:
        if own:
            await client.aclose()
    if data.get("erro"):
        raise CepError("CEP não encontrado.")
    return {
        "cep": digits,
        "street": data.get("logradouro", ""),
        "neighborhood": data.get("bairro", ""),
        "city": data.get("localidade", ""),
        "state": data.get("uf", ""),
        "complement": data.get("complemento", ""),
    }
