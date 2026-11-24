from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Coupon, Option, Product, StoreSettings
from tests.conftest import sign


def ids():
    with SessionLocal() as db:
        prod = {p.slug: p.id for p in db.scalars(select(Product))}
        opt = {o.name: o.id for o in db.scalars(select(Option))}
    return prod, opt


CUSTOMER = {"name": "Maria Souza", "phone": "(12) 99876-5432", "email": "maria@example.com"}
ADDRESS = {"cep": "12210-100", "street": "Rua Teste", "number": "10", "neighborhood": "Centro", "city": "São José dos Campos", "state": "SP"}


def order_body(method="cash", **kw):
    prod, opt = ids()
    body = {
        "customer": CUSTOMER,
        "fulfillment": "delivery",
        "address": ADDRESS,
        "items": [{"product_id": prod["double-bacon"], "quantity": 1, "option_ids": [opt["Ao ponto"], opt["Bacon extra"]]}],
        "payment_method": method,
    }
    body.update(kw)
    return body


def post(client, body, key=None):
    return client.post("/api/orders", json=body, headers={"Idempotency-Key": key or uuid.uuid4().hex})


# ----------------------------------------------------------------- preço


def test_quote_recalcula_no_servidor(client):
    prod, opt = ids()
    r = client.post("/api/cart/quote", json={
        "items": [{"product_id": prod["double-bacon"], "quantity": 2, "option_ids": [opt["Ao ponto"], opt["Bacon extra"]]}],
        "cep": "12210100",
    })
    d = r.json()
    assert d["subtotal_cents"] == (3890 + 590) * 2
    assert d["delivery_fee_cents"] == 0  # frete grátis acima de R$ 80 no Centro
    assert d["errors"] == []


def test_grupo_obrigatorio_e_maximo(client):
    prod, opt = ids()
    r = client.post("/api/cart/quote", json={"items": [{"product_id": prod["double-bacon"], "quantity": 1}]})
    assert "ponto da carne" in r.json()["errors"][0]
    r = client.post("/api/cart/quote", json={"items": [{"product_id": prod["double-bacon"], "quantity": 1,
        "option_ids": [opt["Ao ponto"], opt["Mal passado"]]}]})
    assert "máximo" in r.json()["errors"][0]


def test_opcao_de_outro_produto_e_recusada(client):
    prod, opt = ids()
    r = client.post("/api/cart/quote", json={"items": [{"product_id": prod["agua-mineral"], "quantity": 1, "option_ids": [opt["Bacon extra"]]}]})
    assert "inválida" in r.json()["errors"][0]


def test_produto_indisponivel(client):
    prod, _ = ids()
    r = post(client, order_body(items=[{"product_id": prod["veggie-grao"], "quantity": 1}]))
    assert r.status_code == 400 and "indisponível" in r.json()["detail"]


def test_cep_fora_da_area(client):
    r = post(client, order_body(address={**ADDRESS, "cep": "01001-000"}))
    assert r.status_code == 400 and "Ainda não entregamos" in r.json()["detail"]


def test_total_divergente(client):
    r = post(client, order_body(expected_total_cents=1))
    assert r.status_code == 409


def test_cupom_percentual_e_minimo(client):
    prod, opt = ids()
    q = client.post("/api/cart/quote", json={"items": [{"product_id": prod["agua-mineral"], "quantity": 1}], "coupon_code": "BEMVINDO10"}).json()
    assert q["discount_cents"] == 0 and "a partir" in q["coupon_message"]
    q = client.post("/api/cart/quote", json={"items": [{"product_id": prod["combo-dupla"], "quantity": 1, "option_ids": [opt["Coca-Cola lata"]]}], "coupon_code": "bemvindo10"}).json()
    assert q["discount_cents"] == 799


def test_cupom_esgotado(client):
    with SessionLocal() as db:
        c = db.scalar(select(Coupon).where(Coupon.code == "BORCELLE5"))
        c.max_uses, c.uses = 1, 0
        db.commit()
    assert post(client, order_body(coupon_code="BORCELLE5")).status_code == 201
    r = post(client, order_body(coupon_code="BORCELLE5"))
    assert r.status_code == 400 and "esgotou" in r.json()["detail"]


# ----------------------------------------------------------------- pedidos


def test_pedido_dinheiro_com_troco(client):
    body = order_body("cash", change_for_cents=10000)
    r = post(client, body)
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["status"] == "received" and d["payment_status"] == "on_delivery"
    assert d["total_cents"] == 3890 + 590 + 500
    assert d["items"][0]["options"][1]["option_name"] == "Bacon extra"
    r = post(client, order_body("cash", change_for_cents=100))
    assert r.status_code == 400


def test_idempotencia(client):
    key = uuid.uuid4().hex
    a = post(client, order_body(), key).json()
    b = post(client, order_body(), key).json()
    assert a["public_id"] == b["public_id"] and a["number"] == b["number"]


def test_loja_fechada_e_agendamento(client):
    with SessionLocal() as db:
        db.get(StoreSettings, 1).is_paused = True
        db.commit()
    r = post(client, order_body())
    assert r.status_code == 409
    with SessionLocal() as db:
        db.get(StoreSettings, 1).is_paused = False
        db.commit()
    slots = client.get("/api/store/slots").json()["slots"]
    assert slots
    r = post(client, order_body(scheduled_for=slots[0]))
    assert r.status_code == 201 and r.json()["scheduled_for"]
    assert post(client, order_body(scheduled_for="2020-01-01T12:00:00-03:00")).status_code == 400


def test_pix_webhook_aprova(client, mp):
    r = post(client, order_body("pix"))
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["status"] == "awaiting_payment" and d["payment"]["pix_qr_code"].startswith("00020126")
    pid = next(iter(mp.payments))
    # webhook com assinatura inválida é rejeitado
    bad = client.post(f"/api/payments/webhooks/mercadopago?data.id={pid}&type=payment", json={"action": "payment.updated", "data": {"id": pid}},
                      headers={"x-signature": "ts=1,v1=errado", "x-request-id": "r0"})
    assert bad.status_code == 401
    mp.approve(pid)
    ok = client.post(f"/api/payments/webhooks/mercadopago?data.id={pid}&type=payment", json={"action": "payment.updated", "data": {"id": pid}},
                     headers=sign(pid))
    assert ok.status_code == 200
    d = client.get(f"/api/orders/{d['public_id']}").json()
    assert d["status"] == "received" and d["payment_status"] == "approved"
    # webhook repetido é ignorado
    dup = client.post(f"/api/payments/webhooks/mercadopago?data.id={pid}&type=payment", json={"action": "payment.updated", "data": {"id": pid}}, headers=sign(pid))
    assert dup.json().get("duplicate")


def test_cartao_recusado_e_nova_tentativa_pix(client, mp):
    mp.next_card_status = "rejected"
    card = {"token": "card-token-123", "payment_method_id": "master", "installments": 1}
    r = post(client, order_body("credit_online", card=card))
    d = r.json()
    assert d["status"] == "awaiting_payment" and d["payment_status"] == "rejected"
    r = client.post(f"/api/orders/{d['public_id']}/payments", json={"payment_method": "pix"})
    assert r.status_code == 200 and r.json()["payment"]["method"] == "pix"


def test_cartao_aprovado(client, mp):
    card = {"token": "card-token-123", "payment_method_id": "visa", "installments": 2}
    r = post(client, order_body("credit_online", card=card))
    assert r.status_code == 400 and "Parcela mínima" in r.json()["detail"]  # R$ 49,80 / 2 < R$ 30
    prod, opt = ids()
    items = [{"product_id": prod["combo-dupla"], "quantity": 1, "option_ids": [opt["Coca-Cola lata"]]}]
    d = post(client, order_body("credit_online", card=card, items=items)).json()
    assert d["status"] == "received" and d["payment"]["installments"] == 2


def test_parcelas_acima_do_limite(client, mp):
    card = {"token": "card-token-123", "payment_method_id": "visa", "installments": 12}
    calls = len(mp.calls)
    r = post(client, order_body("credit_online", card=card))
    assert r.status_code == 400 and "até 3x" in r.json()["detail"]
    assert len(mp.calls) == calls  # nada chegou ao gateway


def test_pix_expirado_cancela(client, mp):
    import asyncio
    from datetime import datetime, timedelta, timezone

    from app.models import Payment
    from app.services.orders import sync_payment

    d = post(client, order_body("pix")).json()
    with SessionLocal() as db:
        p = db.scalar(select(Payment).order_by(Payment.id.desc()))
        p.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
        asyncio.run(sync_payment(db, p))
    d = client.get(f"/api/orders/{d['public_id']}").json()
    assert d["status"] == "cancelled" and d["payment_status"] == "expired"


def test_admin_status_e_estorno(client, mp):
    card = {"token": "card-token-123", "payment_method_id": "visa", "installments": 1}
    d = post(client, order_body("credit_online", card=card)).json()
    pub = d["public_id"]
    assert client.patch(f"/api/admin/orders/{pub}/status", json={"status": "confirmed"}).status_code == 401
    h = {"X-Admin-Key": "admin-teste"}
    for s in ("confirmed", "preparing", "ready", "out_for_delivery", "delivered"):
        r = client.patch(f"/api/admin/orders/{pub}/status", json={"status": s}, headers=h)
        assert r.status_code == 200, r.text
    assert client.patch(f"/api/admin/orders/{pub}/status", json={"status": "preparing"}, headers=h).status_code == 409
    r = client.post(f"/api/admin/orders/{pub}/refund", headers=h)
    assert r.json()["payment_status"] == "refunded"


def test_metodos_desabilitados_sem_credencial(client):
    from app.payments import set_provider
    from app.payments.mercadopago import MercadoPagoProvider

    p = MercadoPagoProvider()
    p.settings = p.settings.model_copy(update={"mp_access_token": ""})
    set_provider(p)
    methods = client.get("/api/store").json()["payment_methods"]
    assert "pix" not in methods and "cash" in methods
    assert post(client, order_body("pix")).status_code == 400
