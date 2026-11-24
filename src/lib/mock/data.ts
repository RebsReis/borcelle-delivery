/**
 * Dados do protótipo. Tudo aqui é demonstrativo: troque nomes, preços,
 * fotos (image_url), regiões e cupons à vontade.
 */
import type { CategoryT, OptionGroupT, ProductT, StoreT } from "../types";

export const STORE: StoreT = {
  name: "Borcelle Hamburgueria",
  phone: "1234567890",
  whatsapp: "5512934567890",
  address: "Rua da Hamburgueria, 100 — Centro (endereço de demonstração)",
  is_open: true,
  is_paused: false,
  pause_message: "",
  next_opening: null,
  prep_time_minutes: 25,
  pickup_eta_minutes: 20,
  delivery_eta_min: 25,
  delivery_eta_max: 50,
  min_order_cents: 2000,
  accept_scheduled: true,
  delivery_enabled: true,
  pickup_enabled: true,
  payment_methods: ["pix", "credit_online", "debit_online", "card_on_delivery", "cash"],
  max_installments: 3,
  payments_environment: "prototype",
  mp_public_key: "",
};

export const MIN_INSTALLMENT_CENTS = 3000;

const CATEGORIES_RAW: [string, string][] = [
  ["combos", "Combos"],
  ["artesanais", "Hambúrgueres artesanais"],
  ["smash", "Smash Burgers"],
  ["especiais", "Hambúrgueres especiais"],
  ["porcoes", "Porções e acompanhamentos"],
  ["bebidas", "Bebidas"],
  ["sobremesas", "Sobremesas"],
];

type O = [string, number, boolean?];
const GROUPS_RAW: Record<string, [string, OptionGroupT["kind"], number, number, O[]]> = {
  ponto: ["Ponto da carne", "single", 1, 1, [["Mal passado", 0], ["Ao ponto", 0, true], ["Bem passado", 0]]],
  remover: ["Retirar ingredientes", "remove", 0, 6, [["Sem cebola", 0], ["Sem picles", 0], ["Sem tomate", 0], ["Sem alface", 0], ["Sem molho da casa", 0], ["Sem queijo", 0]]],
  adicionais: ["Adicionais", "multiple", 0, 5, [["Bacon extra", 590], ["Cheddar extra", 490], ["Carne extra (180 g)", 1290], ["Ovo", 390], ["Cebola caramelizada", 390]]],
  molhos: ["Molhos extras", "multiple", 0, 2, [["Maionese verde", 290], ["Barbecue", 290], ["Cheddar cremoso", 390], ["Chipotle", 290]]],
  acompanhamento: ["Acompanhamento", "single", 0, 1, [["Batata rústica pequena", 990], ["Onion rings pequena", 1190]]],
  bebida: ["Bebida", "single", 0, 1, [["Refrigerante lata", 690], ["Suco natural 400 ml", 990], ["Água mineral", 450]]],
  combo_batata: ["Acompanhamento do combo", "single", 1, 1, [["Batata rústica", 0, true], ["Onion rings", 200]]],
  combo_bebida: ["Bebida do combo", "single", 1, 1, [["Coca-Cola lata", 0, true], ["Coca-Cola Zero lata", 0], ["Guaraná lata", 0], ["Suco natural", 300]]],
  sabor_refri: ["Sabor", "single", 1, 1, [["Coca-Cola", 0, true], ["Coca-Cola Zero", 0], ["Guaraná", 0], ["Fanta Laranja", 0]]],
  sabor_suco: ["Sabor", "single", 1, 1, [["Laranja", 0, true], ["Limão", 0], ["Maracujá", 0], ["Abacaxi com hortelã", 0]]],
  molho_porcao: ["Molho para acompanhar", "multiple", 0, 2, [["Maionese da casa", 0], ["Barbecue", 290], ["Cheddar cremoso", 390]]],
};

const BURGER = ["ponto", "remover", "adicionais", "molhos", "acompanhamento", "bebida"];
const SMASH = ["remover", "adicionais", "molhos", "acompanhamento", "bebida"];
const COMBO = ["ponto", "remover", "combo_batata", "combo_bebida", "adicionais"];

type P = {
  slug: string; cat: string; name: string; desc: string; ingredients: string[]; price: number; promo?: number;
  badge?: "best_seller" | "new"; groups: string[]; featured?: boolean; recommended?: boolean; available?: boolean; combo?: string;
  image?: string;
};

const PRODUCTS_RAW: P[] = [
  { slug: "combo-double-bacon", cat: "combos", name: "Combo Double Bacon", desc: "Double Bacon + acompanhamento + bebida.", ingredients: ["Double Bacon", "Batata rústica ou onion rings", "Bebida lata"], price: 5490, promo: 4990, badge: "best_seller", groups: COMBO, featured: true },
  { slug: "combo-classic-smash", cat: "combos", name: "Combo Classic Smash", desc: "Classic Smash + acompanhamento + bebida.", ingredients: ["Classic Smash", "Batata rústica ou onion rings", "Bebida lata"], price: 4290, groups: ["remover", "combo_batata", "combo_bebida", "adicionais"] },
  { slug: "combo-dupla", cat: "combos", name: "Combo Dupla Borcelle", desc: "Dois artesanais da casa, batata grande e duas bebidas.", ingredients: ["2 Classic Burger", "Batata rústica grande", "2 bebidas lata"], price: 8990, promo: 7990, groups: ["remover", "combo_bebida"], featured: true },
  { slug: "double-bacon", cat: "artesanais", name: "Double Bacon", desc: "Dois blends de 150 g, cheddar duplo, bacon crocante e maionese da casa no brioche.", ingredients: ["Pão brioche", "2 blends 150 g", "Cheddar", "Bacon", "Maionese da casa"], price: 3890, badge: "best_seller", groups: BURGER, featured: true, recommended: true, combo: "combo-double-bacon" },
  { slug: "classic-burger", cat: "artesanais", name: "Classic Burger", desc: "Blend de 180 g, queijo prato, alface, tomate, cebola roxa e picles.", ingredients: ["Pão brioche", "Blend 180 g", "Queijo prato", "Alface", "Tomate", "Cebola roxa", "Picles"], price: 2990, groups: BURGER },
  { slug: "cheddar-melt", cat: "artesanais", name: "Cheddar Melt", desc: "Blend de 180 g afogado em cheddar cremoso com cebola caramelizada.", ingredients: ["Pão australiano", "Blend 180 g", "Cheddar cremoso", "Cebola caramelizada"], price: 3490, badge: "new", groups: BURGER, recommended: true },
  { slug: "salada-burger", cat: "artesanais", name: "Salada Burger", desc: "Blend de 180 g, queijo, muita salada e maionese verde.", ingredients: ["Pão brioche", "Blend 180 g", "Queijo prato", "Alface", "Tomate", "Maionese verde"], price: 3190, groups: BURGER },
  { slug: "classic-smash", cat: "smash", name: "Classic Smash", desc: "Smash de 90 g na chapa bem quente, cheddar e cebola na chapa.", ingredients: ["Pão de batata", "Smash 90 g", "Cheddar", "Cebola na chapa", "Molho da casa"], price: 2490, badge: "best_seller", groups: SMASH, recommended: true, combo: "combo-classic-smash" },
  { slug: "double-smash", cat: "smash", name: "Double Smash", desc: "Dois smash de 90 g, cheddar duplo e picles.", ingredients: ["Pão de batata", "2 smash 90 g", "Cheddar duplo", "Picles", "Molho da casa"], price: 3290, promo: 2890, groups: SMASH },
  { slug: "smash-onion", cat: "smash", name: "Smash Onion", desc: "Smash de 90 g com cebola prensada na carne e queijo prato.", ingredients: ["Pão de batata", "Smash 90 g com cebola", "Queijo prato", "Mostarda"], price: 2790, groups: SMASH },
  { slug: "borcelle-supreme", cat: "especiais", name: "Borcelle Supreme", desc: "Blend de 200 g, queijo coalho maçaricado, bacon, cebola crispy e barbecue.", ingredients: ["Pão brioche", "Blend 200 g", "Queijo coalho", "Bacon", "Cebola crispy", "Barbecue"], price: 4490, badge: "new", groups: BURGER, featured: true },
  { slug: "bbq-ranch", cat: "especiais", name: "BBQ Ranch", desc: "Costela desfiada, cheddar, molho ranch e barbecue defumado.", ingredients: ["Pão australiano", "Costela desfiada 150 g", "Cheddar", "Molho ranch", "Barbecue"], price: 3990, groups: ["remover", "adicionais", "molhos", "acompanhamento", "bebida"] },
  { slug: "veggie-grao", cat: "especiais", name: "Veggie Grão", desc: "Burger de grão-de-bico, queijo, rúcula e maionese de ervas.", ingredients: ["Pão integral", "Burger de grão-de-bico", "Queijo prato", "Rúcula", "Maionese de ervas"], price: 3290, groups: ["remover", "molhos", "acompanhamento", "bebida"], available: false },
  { slug: "batata-rustica", cat: "porcoes", name: "Batata Rústica", desc: "Batata com casca, alecrim e flor de sal. Serve 2.", ingredients: ["Batata", "Alecrim", "Flor de sal"], price: 1890, badge: "best_seller", groups: ["molho_porcao"], recommended: true },
  { slug: "onion-rings", cat: "porcoes", name: "Onion Rings", desc: "Anéis de cebola empanados e crocantes. Serve 2.", ingredients: ["Cebola", "Empanamento crocante"], price: 2190, groups: ["molho_porcao"] },
  { slug: "batata-cheddar-bacon", cat: "porcoes", name: "Batata Cheddar & Bacon", desc: "Batata rústica coberta com cheddar cremoso e bacon.", ingredients: ["Batata", "Cheddar cremoso", "Bacon"], price: 2690, promo: 2390, groups: [] },
  { slug: "refrigerante-lata", cat: "bebidas", name: "Refrigerante lata", desc: "350 ml, bem gelado.", ingredients: [], price: 690, groups: ["sabor_refri"], recommended: true },
  { slug: "suco-natural", cat: "bebidas", name: "Suco natural", desc: "400 ml, feito na hora.", ingredients: [], price: 990, groups: ["sabor_suco"] },
  { slug: "agua-mineral", cat: "bebidas", name: "Água mineral", desc: "500 ml, com ou sem gás.", ingredients: [], price: 450, groups: [] },
  { slug: "brownie-sorvete", cat: "sobremesas", name: "Brownie com sorvete", desc: "Brownie de chocolate meio amargo com sorvete de creme.", ingredients: ["Brownie", "Sorvete de creme", "Calda de chocolate"], price: 1890, groups: [] },
  { slug: "milkshake-ovomaltine", cat: "sobremesas", name: "Milkshake Ovomaltine", desc: "500 ml de sorvete batido com Ovomaltine crocante.", ingredients: ["Sorvete de creme", "Ovomaltine", "Chantilly"], price: 2290, badge: "new", groups: [] },
  { slug: "petit-gateau", cat: "sobremesas", name: "Petit gâteau", desc: "Bolinho de chocolate com recheio cremoso e sorvete.", ingredients: ["Bolo de chocolate", "Sorvete de creme"], price: 1990, groups: [] },
];

// ---- montagem com ids estáveis
let optionId = 1;
export const GROUPS: Record<string, OptionGroupT> = Object.fromEntries(
  Object.entries(GROUPS_RAW).map(([code, [name, kind, min, max, opts]], i) => [
    code,
    {
      id: i + 1, code, name, kind, min_select: min, max_select: max,
      options: opts.map(([n, price, def]) => ({ id: optionId++, name: n, price_cents: price, is_available: true, is_default: !!def })),
    },
  ]),
);

export const CATEGORIES: CategoryT[] = CATEGORIES_RAW.map(([slug, name], i) => ({ id: i + 1, slug, name }));

const ids = Object.fromEntries(PRODUCTS_RAW.map((p, i) => [p.slug, i + 1]));

export const PRODUCTS: ProductT[] = PRODUCTS_RAW.map((p, i) => ({
  id: i + 1,
  slug: p.slug,
  name: p.name,
  description: p.desc,
  ingredients: p.ingredients,
  price_cents: p.price,
  promo_price_cents: p.promo ?? null,
  image_url: p.image ?? null,
  badge: p.badge ?? null,
  is_available: p.available ?? true,
  is_featured: !!p.featured,
  is_recommended: !!p.recommended,
  combo_product_id: p.combo ? ids[p.combo] : null,
  category_slug: p.cat,
  option_groups: p.groups.map((g) => GROUPS[g]),
}));

/** Regiões de entrega por faixa de CEP (8 dígitos). */
export const ZONES = [
  { name: "São Paulo — Centro e Zona Oeste", start: 1000000, end: 5999999, fee: 790, eta: [35, 55], min: 0, freeOver: 9000 },
  { name: "São Paulo — Zona Leste", start: 8000000, end: 8499999, fee: 590, eta: [25, 45], min: 0, freeOver: 8000 },
  { name: "São José dos Campos — Centro", start: 12209000, end: 12219999, fee: 500, eta: [25, 40], min: 0, freeOver: 8000 },
  { name: "São José dos Campos — Sul e Oeste", start: 12220000, end: 12248999, fee: 800, eta: [35, 55], min: 4000, freeOver: null },
];

export const COUPONS: Record<string, { kind: "percent" | "fixed" | "free_shipping"; value: number; min: number; description: string }> = {
  BEMVINDO10: { kind: "percent", value: 10, min: 4000, description: "10% off no primeiro pedido" },
  FRETEGRATIS: { kind: "free_shipping", value: 0, min: 6000, description: "Frete grátis acima de R$ 60" },
  BORCELLE5: { kind: "fixed", value: 500, min: 3000, description: "R$ 5 de desconto" },
};
