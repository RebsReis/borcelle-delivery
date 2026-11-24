"""Efeitos externos após mudanças de pedido: WhatsApp e Meta Conversions API.

Ambos só rodam quando configurados no .env e com consentimento do cliente.
Falhas são registradas em log e nunca interrompem o fluxo do pedido.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import time

import httpx

from app.config import get_settings

log = logging.getLogger("borcelle.notify")

STATUS_MESSAGES = {
    "received": "Recebemos seu pedido #{number}. Já já começamos a preparar!",
    "confirmed": "Pedido #{number} confirmado pela cozinha.",
    "preparing": "Pedido #{number} está na chapa.",
    "ready": "Pedido #{number} está pronto.",
    "out_for_delivery": "Pedido #{number} saiu para entrega.",
    "out_for_delivery_pickup": "Pedido #{number} está disponível para retirada.",
    "delivered": "Pedido #{number} entregue. Bom apetite!",
    "cancelled": "Pedido #{number} foi cancelado. Fale com a gente se precisar.",
}


def _sha(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()


async def _send_whatsapp(phone: str, text: str) -> None:
    s = get_settings()
    url = f"https://graph.facebook.com/v19.0/{s.whatsapp_phone_number_id}/messages"
    body = {"messaging_product": "whatsapp", "to": f"55{phone}", "type": "text", "text": {"body": text}}
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(url, json=body, headers={"Authorization": f"Bearer {s.whatsapp_token}"})
        r.raise_for_status()


def whatsapp_status(*, phone: str, number: int, status: str, fulfillment: str, consent: bool) -> None:
    s = get_settings()
    if not (consent and s.whatsapp_token and s.whatsapp_phone_number_id):
        return
    key = "out_for_delivery_pickup" if status == "out_for_delivery" and fulfillment == "pickup" else status
    template = STATUS_MESSAGES.get(key)
    if not template:
        return
    _fire(_send_whatsapp(phone, template.format(number=number)), "whatsapp")


async def _send_capi(event: dict) -> None:
    s = get_settings()
    url = f"https://graph.facebook.com/v19.0/{s.meta_pixel_id}/events"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(url, json={"data": [event], "access_token": s.meta_capi_token})
        r.raise_for_status()


def capi_purchase(*, public_id: str, email: str, phone: str, total_cents: int, consent: bool) -> bool:
    """Envia Purchase à Meta. event_id = public_id deduplica com o Pixel do navegador."""
    s = get_settings()
    if not (consent and s.meta_pixel_id and s.meta_capi_token):
        return False
    event = {
        "event_name": "Purchase",
        "event_time": int(time.time()),
        "event_id": public_id,
        "action_source": "website",
        "event_source_url": f"{s.frontend_url}/pedido/{public_id}",
        "user_data": {"em": [_sha(email)], "ph": [_sha("55" + phone)]},
        "custom_data": {"currency": "BRL", "value": round(total_cents / 100, 2), "order_id": public_id},
    }
    _fire(_send_capi(event), "capi")
    return True


def _fire(coro, label: str) -> None:
    async def runner():
        try:
            await coro
        except Exception as exc:  # noqa: BLE001
            log.warning("%s falhou: %s", label, exc)

    try:
        asyncio.get_running_loop().create_task(runner())
    except RuntimeError:
        coro.close()
