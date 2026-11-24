/**
 * API SIMULADA DO PROTÓTIPO.
 *
 * Tudo roda no navegador: cardápio e regras vêm de lib/mock/data.ts e os
 * pedidos ficam no localStorage. Nenhum pagamento é processado de verdade.
 * O formato das respostas é o mesmo de uma API real, então dá para trocar
 * este arquivo por chamadas HTTP quando houver um backend.
 */
import type { CepT, MenuT, OrderStatusT, OrderT, PaymentMethodT, QuoteItemT, QuoteT, StoreT } from "./types";
import { CATEGORIES, COUPONS, MIN_INSTALLMENT_CENTS, PRODUCTS, STORE, ZONES } from "./mock/data";

export class ApiError extends Error {
  constructor(message: string, public status: number, public field?: string) {
    super(message);
  }
}

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;

/* ------------------------------------------------------------------ loja */

function store(): StoreT {
  return { ...STORE };
}

function slots(): string[] {
  const out: string[] = [];
  const t = new Date(Date.now() + 45 * 60000);
  t.setMinutes(t.getMinutes() < 30 ? 30 : 60, 0, 0);
  for (let i = 0; out.length < 40 && i < 200; i++, t.setMinutes(t.getMinutes() + 30)) {
    const h = t.getHours() + t.getMinutes() / 60;
    if (h >= 11.5 && h <= 23) out.push(t.toISOString());
  }
  return out;
}

/* ------------------------------------------------------------------ CEP */

function findZone(cep: string) {
  const n = parseInt(cep, 10);
  return ZONES.find((z) => n >= z.start && n <= z.end) ?? null;
}

async function cep(raw: string): Promise<CepT> {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) throw new ApiError("CEP inválido. Use 8 dígitos.", 422);
  let addr = { street: "", neighborhood: "", city: "", state: "" };
  try {
    // ViaCEP é público e aceita chamadas do navegador
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: ctrl.signal });
    clearTimeout(t);
    const d = await r.json();
    if (d.erro) throw new ApiError("CEP não encontrado.", 404);
    addr = { street: d.logradouro ?? "", neighborhood: d.bairro ?? "", city: d.localidade ?? "", state: d.uf ?? "" };
  } catch (e) {
    if (e instanceof ApiError && !findZone(digits)) throw e;
  }
  const z = findZone(digits);
  return {
    cep: digits, ...addr, served: !!z, zone_name: z?.name ?? null, fee_cents: z?.fee ?? null,
    eta_min_minutes: z?.eta[0] ?? null, eta_max_minutes: z?.eta[1] ?? null,
    min_order_cents: z?.min ?? null, free_shipping_over_cents: z?.freeOver ?? null,
  };
}

/* ------------------------------------------------------------------ preços */

type CartIn = { product_id: number; quantity: number; option_ids?: number[]; notes?: string };
type QuoteIn = { items: CartIn[]; coupon_code?: string | null; fulfillment: "delivery" | "pickup"; cep?: string | null };

function priceCart(body: QuoteIn, strict: boolean): QuoteT & { zone: (typeof ZONES)[number] | null } {
  const errors: string[] = [];
  const items: QuoteItemT[] = [];
  body.items.forEach((it, index) => {
    const p = PRODUCTS.find((x) => x.id === it.product_id);
    try {
      if (!p) throw new Error("Um dos produtos não existe mais no cardápio.");
      if (!p.is_available) throw new Error(`${p.name} está indisponível no momento.`);
      const chosen = [...new Set(it.option_ids ?? [])].map((oid) => {
        const g = p.option_groups.find((g) => g.options.some((o) => o.id === oid));
        if (!g) throw new Error(`Opção inválida para ${p.name}.`);
        return { g, o: g.options.find((o) => o.id === oid)! };
      });
      for (const g of p.option_groups) {
        const n = chosen.filter((c) => c.g.id === g.id).length;
        if (n < g.min_select) throw new Error(`${p.name}: escolha ${g.name.toLowerCase()}.`);
        if (n > g.max_select) throw new Error(`${p.name}: máximo de ${g.max_select} em ${g.name.toLowerCase()}.`);
      }
      const base = p.promo_price_cents ?? p.price_cents;
      const unit = base + chosen.reduce((s, c) => s + c.o.price_cents, 0);
      items.push({
        index, product_id: p.id, name: p.name, quantity: it.quantity, unit_base_cents: base, unit_total_cents: unit,
        line_total_cents: unit * it.quantity, notes: (it.notes ?? "").trim(),
        options: chosen.map(({ g, o }) => ({ option_id: o.id, group_name: g.name, group_kind: g.kind, name: o.name, price_cents: o.price_cents })),
      });
    } catch (e) {
      if (strict) throw new ApiError((e as Error).message, 400);
      errors.push((e as Error).message);
    }
  });
  const subtotal = items.reduce((s, i) => s + i.line_total_cents, 0);

  let fee = 0;
  let served: boolean | null = null;
  let zone: (typeof ZONES)[number] | null = null;
  let minOrder = STORE.min_order_cents;
  if (body.fulfillment === "delivery") {
    if (body.cep) {
      zone = findZone(body.cep.replace(/\D/g, ""));
      served = !!zone;
      if (!zone) errors.push("Ainda não entregamos neste CEP. Você pode retirar no balcão.");
      else {
        fee = zone.freeOver !== null && subtotal >= zone.freeOver ? 0 : zone.fee;
        minOrder = Math.max(minOrder, zone.min);
      }
    } else if (strict) throw new ApiError("Informe o endereço de entrega.", 400);
  }

  let discount = 0;
  let couponCode: string | null = null;
  let couponMessage: string | null = null;
  if (body.coupon_code) {
    const code = body.coupon_code.trim().toUpperCase();
    const c = COUPONS[code];
    if (!c) couponMessage = "Cupom inválido.";
    else if (subtotal < c.min) couponMessage = `Cupom válido para pedidos a partir de ${brl(c.min)}`;
    else {
      couponCode = code;
      couponMessage = c.description;
      discount = c.kind === "percent" ? Math.round((subtotal * c.value) / 100) : c.kind === "fixed" ? Math.min(c.value, subtotal) : fee;
    }
    if (!couponCode && strict) throw new ApiError(couponMessage!, 400);
  }
  if (items.length && subtotal < minOrder) errors.push(`Pedido mínimo de ${brl(minOrder)}`);
  if (strict && errors.length) throw new ApiError(errors[0], 400);

  return {
    items, subtotal_cents: subtotal, delivery_fee_cents: fee, discount_cents: discount,
    total_cents: Math.max(subtotal + fee - discount, 0), coupon_code: couponCode, coupon_message: couponMessage,
    delivery_served: served, min_order_cents: minOrder, errors, zone,
  };
}

/* ------------------------------------------------------------------ pedidos */

type Stored = OrderT & { _idem: string; _paid_at: number | null; _created: number; _card_fail?: boolean };
const KEY = "borcelle-proto-orders";
const FLOW: { status: OrderStatusT; after: number }[] = [
  { status: "received", after: 0 },
  { status: "confirmed", after: 15 },
  { status: "preparing", after: 35 },
  { status: "ready", after: 70 },
  { status: "out_for_delivery", after: 95 },
  { status: "delivered", after: 140 },
];

const load = (): Record<string, Stored> => {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
};
const save = (all: Record<string, Stored>) => localStorage.setItem(KEY, JSON.stringify(all));

function fakePix(id: string, total: number) {
  const amount = (total / 100).toFixed(2);
  return `00020126580014BR.GOV.BCB.PIX0136prototipo-borcelle-${id}5204000053039865406${amount}5802BR5920BORCELLE PROTOTIPO6009SAO PAULO62070503***6304ABCD`;
}

/** Avança o pedido no tempo: simula a cozinha e a entrega. */
function advance(o: Stored): Stored {
  const now = Date.now();
  const p = o.payment;
  if (o.status === "awaiting_payment" && p?.method === "pix" && p.status === "pending" && p.expires_at && new Date(p.expires_at).getTime() < now) {
    p.status = "expired";
    o.payment_status = "expired";
    o.status = "cancelled";
    o.history.push({ status: "cancelled", note: "PIX expirado sem pagamento", created_at: new Date().toISOString() });
  }
  if (o._paid_at && o.status !== "cancelled") {
    const elapsed = (now - o._paid_at) / 1000;
    const done = FLOW.filter((f) => elapsed >= f.after);
    o.history = o.history.filter((h) => h.status === "awaiting_payment");
    for (const f of done) o.history.push({ status: f.status, note: "", created_at: new Date(o._paid_at + f.after * 1000).toISOString() });
    o.status = done[done.length - 1].status;
  }
  return o;
}

function markPaid(o: Stored) {
  o._paid_at = Date.now();
  const eta = o.scheduled_for ? new Date(o.scheduled_for).getTime() : o._paid_at + (o.fulfillment === "pickup" ? STORE.pickup_eta_minutes : 45) * 60000;
  o.eta_at = new Date(eta).toISOString();
}

function publicOut(o: Stored): OrderT {
  const { _idem, _paid_at, _created, _card_fail, ...rest } = o;
  void _idem; void _paid_at; void _created; void _card_fail;
  return JSON.parse(JSON.stringify(rest));
}

type CardIn = { last_four: string; installments: number; brand: string };
type OrderIn = {
  customer: { name: string; phone: string; email: string };
  fulfillment: "delivery" | "pickup";
  scheduled_for: string | null;
  address: Record<string, string> | null;
  items: CartIn[];
  coupon_code: string | null;
  notes: string;
  payment_method: PaymentMethodT;
  change_for_cents: number | null;
  card: CardIn | null;
  expected_total_cents: number;
};

function charge(o: Stored, method: PaymentMethodT, card: CardIn | null) {
  const base = { method, amount_cents: o.total_cents, installments: card?.installments ?? 1, pix_qr_code: null, pix_qr_code_base64: null, redirect_url: null, expires_at: null };
  if (method === "pix") {
    o.payment = { ...base, status: "pending", status_detail: "", pix_qr_code: fakePix(o.public_id, o.total_cents), expires_at: new Date(Date.now() + 15 * 60000).toISOString() };
    o.payment_status = "pending";
  } else if (method === "credit_online" || method === "debit_online") {
    // Protótipo: cartão terminado em 0002 simula recusa
    const fail = card?.last_four === "0002";
    o.payment = { ...base, status: fail ? "rejected" : "approved", status_detail: fail ? "Saldo insuficiente (simulado)" : "" };
    o.payment_status = o.payment.status;
    if (!fail) {
      markPaid(o);
      o.history = [];
    }
  }
  o.payment_method = method;
}

async function createOrder(body: OrderIn, idem: string): Promise<OrderT> {
  await wait(700);
  const all = load();
  const existing = Object.values(all).find((o) => o._idem === idem);
  if (existing) return publicOut(advance(existing));

  if (body.card && body.payment_method === "credit_online" && body.card.installments > STORE.max_installments) {
    throw new ApiError(`Parcelamento em até ${STORE.max_installments}x.`, 400);
  }
  const q = priceCart({ items: body.items, coupon_code: body.coupon_code, fulfillment: body.fulfillment, cep: body.address?.cep }, true);
  if (body.expected_total_cents !== q.total_cents) throw new ApiError("Os valores do pedido mudaram. Revise o total antes de confirmar.", 409);
  if (body.card && body.card.installments > 1 && q.total_cents / body.card.installments < MIN_INSTALLMENT_CENTS) {
    throw new ApiError(`Parcela mínima de ${brl(MIN_INSTALLMENT_CENTS)}`, 400);
  }
  if (body.payment_method === "cash" && body.change_for_cents !== null && body.change_for_cents < q.total_cents) {
    throw new ApiError("O valor para troco precisa ser maior que o total.", 400);
  }

  const number = 1000 + Object.keys(all).length + 1;
  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const online = ["pix", "credit_online", "debit_online"].includes(body.payment_method);
  const o: Stored = {
    _idem: idem, _paid_at: null, _created: Date.now(),
    public_id: id, number, status: online ? "awaiting_payment" : "received",
    payment_status: online ? "pending" : "on_delivery", payment_method: body.payment_method,
    fulfillment: body.fulfillment, customer_name: body.customer.name, customer_phone: body.customer.phone,
    address: body.fulfillment === "delivery" ? body.address : null, scheduled_for: body.scheduled_for, eta_at: null,
    subtotal_cents: q.subtotal_cents, delivery_fee_cents: q.delivery_fee_cents, discount_cents: q.discount_cents,
    total_cents: q.total_cents, coupon_code: q.coupon_code, change_for_cents: body.payment_method === "cash" ? body.change_for_cents : null,
    notes: body.notes, created_at: new Date().toISOString(),
    items: q.items.map((i) => ({
      product_name: i.name, quantity: i.quantity, unit_total_cents: i.unit_total_cents, line_total_cents: i.line_total_cents, notes: i.notes,
      options: i.options.map((op) => ({ group_name: op.group_name, group_kind: op.group_kind, option_name: op.name, price_cents: op.price_cents })),
    })),
    history: online ? [{ status: "awaiting_payment", note: "", created_at: new Date().toISOString() }] : [],
    payment: null, store_whatsapp: STORE.whatsapp, payments_environment: "prototype",
  };
  if (!online) markPaid(o);
  else charge(o, body.payment_method, body.card);
  all[id] = advance(o);
  save(all);
  return publicOut(all[id]);
}

async function order(id: string): Promise<OrderT> {
  const all = load();
  const o = all[id];
  if (!o) throw new ApiError("Pedido não encontrado neste aparelho.", 404);
  all[id] = advance(o);
  save(all);
  return publicOut(all[id]);
}

async function retryPayment(id: string, body: { payment_method: PaymentMethodT }): Promise<OrderT> {
  await wait(500);
  const all = load();
  const o = all[id];
  if (!o) throw new ApiError("Pedido não encontrado.", 404);
  if (o.status === "cancelled") {
    o.status = "awaiting_payment";
    o.history = [{ status: "awaiting_payment", note: "", created_at: new Date().toISOString() }];
  }
  charge(o, body.payment_method, null);
  save(all);
  return publicOut(o);
}

/** Só no protótipo: confirma o PIX como se o banco tivesse avisado. */
async function simulatePixPaid(id: string): Promise<OrderT> {
  await wait(600);
  const all = load();
  const o = all[id];
  if (!o?.payment) throw new ApiError("Pedido não encontrado.", 404);
  o.payment.status = "approved";
  o.payment_status = "approved";
  o.history = [];
  markPaid(o);
  all[id] = advance(o);
  save(all);
  return publicOut(all[id]);
}

export const api = {
  store: async (_revalidate?: number) => store(),
  slots: async () => ({ slots: slots() }),
  menu: async (_revalidate?: number): Promise<MenuT> => ({ categories: CATEGORIES, products: PRODUCTS }),
  cep,
  quote: async (body: unknown): Promise<QuoteT> => {
    await wait(120);
    const { zone, ...q } = priceCart(body as QuoteIn, false);
    void zone;
    return q;
  },
  createOrder: (body: unknown, idempotencyKey: string) => createOrder(body as OrderIn, idempotencyKey),
  order,
  syncOrder: order,
  retryPayment: (id: string, body: unknown) => retryPayment(id, body as { payment_method: PaymentMethodT }),
  simulatePixPaid,
};
