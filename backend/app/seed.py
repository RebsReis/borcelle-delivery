"""Dados demonstrativos. Uso: python -m app.seed  (só insere se o banco estiver vazio)

Preços, regiões, CEPs e cupons abaixo são exemplos para testar o sistema.
Ajuste tudo pelo painel administrativo (fase 2) ou diretamente aqui.
"""
from __future__ import annotations

from datetime import time

from sqlalchemy import select

from app.db import SessionLocal
from app.models import (
    BusinessHours,
    Category,
    Coupon,
    CouponKind,
    DeliveryZone,
    Option,
    OptionGroup,
    OptionGroupKind,
    Product,
    ProductBadge,
    ProductOptionGroup,
    StoreSettings,
)

CATEGORIES = [
    ("combos", "Combos"),
    ("artesanais", "Hambúrgueres artesanais"),
    ("smash", "Smash Burgers"),
    ("especiais", "Hambúrgueres especiais"),
    ("porcoes", "Porções e acompanhamentos"),
    ("bebidas", "Bebidas"),
    ("sobremesas", "Sobremesas"),
]

GROUPS = {
    "ponto": ("Ponto da carne", OptionGroupKind.single, 1, 1, [("Mal passado", 0), ("Ao ponto", 0, True), ("Bem passado", 0)]),
    "remover": ("Retirar ingredientes", OptionGroupKind.remove, 0, 6, [("Sem cebola", 0), ("Sem picles", 0), ("Sem tomate", 0), ("Sem alface", 0), ("Sem molho da casa", 0), ("Sem queijo", 0)]),
    "adicionais": ("Adicionais", OptionGroupKind.multiple, 0, 5, [("Bacon extra", 590), ("Cheddar extra", 490), ("Carne extra (180 g)", 1290), ("Ovo", 390), ("Cebola caramelizada", 390)]),
    "molhos": ("Molhos extras", OptionGroupKind.multiple, 0, 2, [("Maionese verde", 290), ("Barbecue", 290), ("Cheddar cremoso", 390), ("Chipotle", 290)]),
    "acompanhamento": ("Acompanhamento", OptionGroupKind.single, 0, 1, [("Batata rústica pequena", 990), ("Onion rings pequena", 1190)]),
    "bebida": ("Bebida", OptionGroupKind.single, 0, 1, [("Refrigerante lata", 690), ("Suco natural 400 ml", 990), ("Água mineral", 450)]),
    "combo_batata": ("Acompanhamento do combo", OptionGroupKind.single, 1, 1, [("Batata rústica", 0, True), ("Onion rings", 200)]),
    "combo_bebida": ("Bebida do combo", OptionGroupKind.single, 1, 1, [("Coca-Cola lata", 0, True), ("Coca-Cola Zero lata", 0), ("Guaraná lata", 0), ("Suco natural", 300)]),
    "sabor_refri": ("Sabor", OptionGroupKind.single, 1, 1, [("Coca-Cola", 0, True), ("Coca-Cola Zero", 0), ("Guaraná", 0), ("Fanta Laranja", 0)]),
    "sabor_suco": ("Sabor", OptionGroupKind.single, 1, 1, [("Laranja", 0, True), ("Limão", 0), ("Maracujá", 0), ("Abacaxi com hortelã", 0)]),
    "molho_porcao": ("Molho para acompanhar", OptionGroupKind.multiple, 0, 2, [("Maionese da casa", 0), ("Barbecue", 290), ("Cheddar cremoso", 390)]),
}

BURGER = ["ponto", "remover", "adicionais", "molhos", "acompanhamento", "bebida"]
SMASH = ["remover", "adicionais", "molhos", "acompanhamento", "bebida"]
COMBO = ["ponto", "remover", "combo_batata", "combo_bebida", "adicionais"]

# slug, categoria, nome, descrição, ingredientes, preço, promo, selo, grupos, extras
PRODUCTS = [
    ("combo-double-bacon", "combos", "Combo Double Bacon", "Double Bacon + acompanhamento + bebida.", ["Double Bacon", "Batata rústica ou onion rings", "Bebida lata"], 5490, 4990, ProductBadge.best_seller, COMBO, {"is_featured": True}),
    ("combo-classic-smash", "combos", "Combo Classic Smash", "Classic Smash + acompanhamento + bebida.", ["Classic Smash", "Batata rústica ou onion rings", "Bebida lata"], 4290, None, None, ["remover", "combo_batata", "combo_bebida", "adicionais"], {}),
    ("combo-dupla", "combos", "Combo Dupla Borcelle", "Dois artesanais à escolha da casa, batata grande e duas bebidas.", ["2 Classic Burger", "Batata rústica grande", "2 bebidas lata"], 8990, 7990, None, ["remover", "combo_bebida"], {"is_featured": True}),
    ("double-bacon", "artesanais", "Double Bacon", "Dois blends de 150 g, cheddar duplo, bacon crocante e maionese da casa no brioche.", ["Pão brioche", "2 blends 150 g", "Cheddar", "Bacon", "Maionese da casa"], 3890, None, ProductBadge.best_seller, BURGER, {"is_featured": True, "is_recommended": True}),
    ("classic-burger", "artesanais", "Classic Burger", "Blend de 180 g, queijo prato, alface, tomate, cebola roxa e picles.", ["Pão brioche", "Blend 180 g", "Queijo prato", "Alface", "Tomate", "Cebola roxa", "Picles"], 2990, None, None, BURGER, {}),
    ("cheddar-melt", "artesanais", "Cheddar Melt", "Blend de 180 g afogado em cheddar cremoso com cebola caramelizada.", ["Pão australiano", "Blend 180 g", "Cheddar cremoso", "Cebola caramelizada"], 3490, None, ProductBadge.new, BURGER, {"is_recommended": True}),
    ("salada-burger", "artesanais", "Salada Burger", "Blend de 180 g, queijo, muita salada e maionese verde.", ["Pão brioche", "Blend 180 g", "Queijo prato", "Alface", "Tomate", "Maionese verde"], 3190, None, None, BURGER, {}),
    ("classic-smash", "smash", "Classic Smash", "Smash de 90 g na chapa bem quente, cheddar e cebola na chapa.", ["Pão de batata", "Smash 90 g", "Cheddar", "Cebola na chapa", "Molho da casa"], 2490, None, ProductBadge.best_seller, SMASH, {"is_recommended": True}),
    ("double-smash", "smash", "Double Smash", "Dois smash de 90 g, cheddar duplo e picles.", ["Pão de batata", "2 smash 90 g", "Cheddar duplo", "Picles", "Molho da casa"], 3290, 2890, None, SMASH, {}),
    ("smash-onion", "smash", "Smash Onion", "Smash de 90 g com cebola prensada na carne e queijo prato.", ["Pão de batata", "Smash 90 g com cebola", "Queijo prato", "Mostarda"], 2790, None, None, SMASH, {}),
    ("borcelle-supreme", "especiais", "Borcelle Supreme", "Blend de 200 g, queijo coalho maçaricado, bacon, cebola crispy e barbecue.", ["Pão brioche", "Blend 200 g", "Queijo coalho", "Bacon", "Cebola crispy", "Barbecue"], 4490, None, ProductBadge.new, BURGER, {"is_featured": True}),
    ("bbq-ranch", "especiais", "BBQ Ranch", "Costela desfiada, cheddar, molho ranch e barbecue defumado.", ["Pão australiano", "Costela desfiada 150 g", "Cheddar", "Molho ranch", "Barbecue"], 3990, None, None, ["remover", "adicionais", "molhos", "acompanhamento", "bebida"], {}),
    ("veggie-grao", "especiais", "Veggie Grão", "Burger de grão-de-bico, queijo, rúcula e maionese de ervas.", ["Pão integral", "Burger de grão-de-bico", "Queijo prato", "Rúcula", "Maionese de ervas"], 3290, None, None, ["remover", "molhos", "acompanhamento", "bebida"], {"is_available": False}),
    ("batata-rustica", "porcoes", "Batata Rústica", "Batata com casca, alecrim e flor de sal. Serve 2.", ["Batata", "Alecrim", "Flor de sal"], 1890, None, ProductBadge.best_seller, ["molho_porcao"], {"is_recommended": True}),
    ("onion-rings", "porcoes", "Onion Rings", "Anéis de cebola empanados e crocantes. Serve 2.", ["Cebola", "Empanamento crocante"], 2190, None, None, ["molho_porcao"], {}),
    ("batata-cheddar-bacon", "porcoes", "Batata Cheddar & Bacon", "Batata rústica coberta com cheddar cremoso e bacon.", ["Batata", "Cheddar cremoso", "Bacon"], 2690, 2390, None, [], {}),
    ("refrigerante-lata", "bebidas", "Refrigerante lata", "350 ml, bem gelado.", [], 690, None, None, ["sabor_refri"], {"is_recommended": True}),
    ("suco-natural", "bebidas", "Suco natural", "400 ml, feito na hora.", [], 990, None, None, ["sabor_suco"], {}),
    ("agua-mineral", "bebidas", "Água mineral", "500 ml, com ou sem gás.", [], 450, None, None, [], {}),
    ("brownie-sorvete", "sobremesas", "Brownie com sorvete", "Brownie de chocolate meio amargo com sorvete de creme.", ["Brownie", "Sorvete de creme", "Calda de chocolate"], 1890, None, None, [], {}),
    ("milkshake-ovomaltine", "sobremesas", "Milkshake Ovomaltine", "500 ml de sorvete batido com Ovomaltine crocante.", ["Sorvete de creme", "Ovomaltine", "Chantilly"], 2290, None, ProductBadge.new, [], {}),
    ("petit-gateau", "sobremesas", "Petit gâteau", "Bolinho de chocolate com recheio cremoso e sorvete.", ["Bolo de chocolate", "Sorvete de creme"], 1990, None, None, [], {}),
]

COMBO_OF = {"double-bacon": "combo-double-bacon", "classic-smash": "combo-classic-smash"}


def run() -> None:
    db = SessionLocal()
    try:
        if db.scalar(select(Category).limit(1)):
            print("Banco já possui dados. Nada a fazer.")
            return
        db.add(
            StoreSettings(
                id=1,
                name="Borcelle Hamburgueria",
                phone="1234567890",
                whatsapp="5512934567890",
                address="Endereço de demonstração — configure no painel",
                prep_time_minutes=25,
                pickup_eta_minutes=20,
                min_order_cents=2000,
            )
        )
        cats = {}
        for pos, (slug, name) in enumerate(CATEGORIES):
            cats[slug] = Category(slug=slug, name=name, position=pos)
            db.add(cats[slug])
        groups = {}
        for code, (name, kind, mn, mx, opts) in GROUPS.items():
            g = OptionGroup(code=code, name=name, kind=kind, min_select=mn, max_select=mx)
            for i, o in enumerate(opts):
                g.options.append(Option(name=o[0], price_cents=o[1], is_default=len(o) > 2 and o[2], position=i))
            groups[code] = g
            db.add(g)
        db.flush()
        products = {}
        for pos, (slug, cat, name, desc, ingr, price, promo, badge, gcodes, extra) in enumerate(PRODUCTS):
            p = Product(
                slug=slug, category=cats[cat], name=name, description=desc, ingredients=ingr,
                price_cents=price, promo_price_cents=promo, badge=badge, position=pos, **extra,
            )
            for i, code in enumerate(gcodes):
                p.option_links.append(ProductOptionGroup(group=groups[code], position=i))
            products[slug] = p
            db.add(p)
        db.flush()
        for burger, combo in COMBO_OF.items():
            products[burger].combo_product_id = products[combo].id

        # Seg-qui 11h-23h30; sex e sáb 11h-01h; dom 12h-23h
        for wd in range(7):
            if wd in (4, 5):
                db.add(BusinessHours(weekday=wd, opens_at=time(11), closes_at=time(1)))
            elif wd == 6:
                db.add(BusinessHours(weekday=wd, opens_at=time(12), closes_at=time(23)))
            else:
                db.add(BusinessHours(weekday=wd, opens_at=time(11), closes_at=time(23, 30)))

        # Faixas de CEP de exemplo (São José dos Campos/SP)
        db.add_all([
            DeliveryZone(name="Centro", cep_start=12209000, cep_end=12219999, fee_cents=500, eta_min_minutes=25, eta_max_minutes=40, free_shipping_over_cents=8000),
            DeliveryZone(name="Zona Sul", cep_start=12220000, cep_end=12239999, fee_cents=700, eta_min_minutes=35, eta_max_minutes=50),
            DeliveryZone(name="Zona Oeste", cep_start=12240000, cep_end=12248999, fee_cents=900, eta_min_minutes=40, eta_max_minutes=60, min_order_cents=4000),
        ])
        db.add_all([
            Coupon(code="BEMVINDO10", description="10% off no primeiro pedido", kind=CouponKind.percent, value=10, min_order_cents=4000),
            Coupon(code="FRETEGRATIS", description="Frete grátis acima de R$ 60", kind=CouponKind.free_shipping, value=0, min_order_cents=6000),
            Coupon(code="BORCELLE5", description="R$ 5 de desconto", kind=CouponKind.fixed, value=500, min_order_cents=3000, max_uses=100),
        ])
        db.commit()
        print(f"Seed concluído: {len(PRODUCTS)} produtos, {len(GROUPS)} grupos de opções.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
