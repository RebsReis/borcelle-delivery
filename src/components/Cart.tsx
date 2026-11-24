"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { money } from "@/lib/format";
import { track } from "@/lib/analytics";
import { useQuote } from "@/lib/useQuote";
import type { ProductT, QuoteT } from "@/lib/types";
import { type CartItem, unitCents, useCart, useUi } from "@/store/cart";
import { ProductImage } from "./Brand";
import { IconAlert, IconEdit, IconPlus, IconTag, IconTrash } from "./icons";
import { useData, useHydrated } from "./Providers";
import { AnimatedMoney, CloseButton, EmptyState, Sheet, Spinner, Stepper, toast } from "./ui";

const BURGER_CATS = ["artesanais", "smash", "especiais"];

function useUpsells(items: CartItem[]) {
  const { menu } = useData();
  if (!menu || !items.length) return [];
  const bySlug = (s: string) => menu.products.find((p) => p.slug === s && p.is_available);
  const cats = new Set(items.map((i) => i.category_slug));
  const out: { text: string; product: ProductT; editKey?: string }[] = [];
  const burger = items.find((i) => BURGER_CATS.includes(i.category_slug));
  if (burger) {
    const p = menu.products.find((x) => x.id === burger.product_id);
    const combo = p?.combo_product_id ? menu.products.find((x) => x.id === p.combo_product_id && x.is_available) : undefined;
    if (combo) out.push({ text: "Transforme seu hambúrguer em um combo", product: combo });
  }
  if (!cats.has("porcoes") && !cats.has("combos")) {
    const fries = bySlug("batata-rustica");
    if (fries) out.push({ text: "Que tal adicionar uma batata frita?", product: fries });
  }
  if (!cats.has("bebidas") && !cats.has("combos")) {
    const drink = bySlug("refrigerante-lata");
    if (drink) out.push({ text: "Complete seu pedido com uma bebida", product: drink });
  }
  if (burger && !burger.options.some((o) => o.name.toLowerCase().includes("bacon"))) {
    const p = menu.products.find((x) => x.id === burger.product_id);
    if (p?.option_groups.some((g) => g.options.some((o) => o.name.toLowerCase().includes("bacon")))) {
      out.push({ text: `Adicione bacon extra no ${burger.name}`, product: p, editKey: burger.key });
    }
  }
  return out.slice(0, 2);
}

export function CartContents({ onCheckout, onContinue, compact = false }: { onCheckout: () => void; onContinue?: () => void; compact?: boolean }) {
  const hydrated = useHydrated();
  const { items, setQty, remove, coupon, setCoupon, notes, setNotes, fulfillment } = useCart();
  const openSheet = useUi((s) => s.openSheet);
  const openLocation = useUi((s) => s.openLocation);
  const location = useCart((s) => s.location);
  const { menu, store } = useData();
  const { quote, loading, error } = useQuote();
  const upsells = useUpsells(items);
  const [code, setCode] = useState(coupon);

  if (!hydrated) return <div className="p-s4"><div className="skeleton h-24 w-full" /></div>;
  if (!items.length) {
    return <EmptyState title="Seu pedido está vazio" text="Escolha seus favoritos no cardápio. A fome agradece." action={<Link href="/cardapio" onClick={onContinue} className="btn btn-primary">Ver cardápio</Link>} />;
  }

  const edit = (i: CartItem) => {
    const p = menu?.products.find((x) => x.id === i.product_id);
    if (p) openSheet(p, i.key);
  };
  const applyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCoupon(code.trim().toUpperCase());
  };
  const changeQty = (i: CartItem, v: number) => {
    if (v < i.quantity) track.removeFromCart({ item_id: i.product_id, item_name: i.name, price: unitCents(i) / 100, quantity: i.quantity - v });
    setQty(i.key, v);
  };

  const couponOk = coupon && quote?.coupon_code;
  const couponMsg = coupon && quote ? quote.coupon_message : null;
  const blocking = quote?.errors ?? [];
  const needsCep = fulfillment === "delivery" && !location;

  return (
    <div className="flex flex-col gap-s4">
      <ul className="flex flex-col divide-y-2 divide-line rounded-md bg-surface">
        {items.map((i) => (
          <li key={i.key} className="flex gap-s3 p-s3">
            <ProductImage src={i.image_url} alt={i.name} className="h-16 w-16 shrink-0 rounded-sm" sizes="64px" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-s2">
                <p className="font-bold leading-tight">{i.name}</p>
                <p className="shrink-0 font-bold tabular-nums">{money(unitCents(i) * i.quantity)}</p>
              </div>
              {i.options.length > 0 && (
                <p className="mt-0.5 text-sm text-ink-muted">
                  {i.options.map((o) => (o.price_cents ? `${o.name} (+${money(o.price_cents)})` : o.name)).join(" · ")}
                </p>
              )}
              {i.notes && <p className="mt-0.5 text-sm italic text-ink-muted">“{i.notes}”</p>}
              <div className="mt-s2 flex items-center gap-s2">
                <Stepper size="sm" value={i.quantity} min={1} onChange={(v) => changeQty(i, v)} label={`Quantidade de ${i.name}`} />
                <button className="flex h-11 w-11 items-center justify-center rounded-sm" onClick={() => edit(i)} aria-label={`Editar ${i.name}`}><IconEdit size={20} /></button>
                <button className="flex h-11 w-11 items-center justify-center rounded-sm text-error" aria-label={`Remover ${i.name}`}
                  onClick={() => { remove(i.key); track.removeFromCart({ item_id: i.product_id, item_name: i.name, price: unitCents(i) / 100, quantity: i.quantity }); toast.info(`${i.name} removido`); }}>
                  <IconTrash size={20} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {upsells.length > 0 && (
        <div className="flex flex-col gap-s2">
          {upsells.map((u) => (
            <button key={u.text} onClick={() => openSheet(u.product, u.editKey)}
              className="flex items-center gap-s3 rounded-md border-2 border-dashed border-primary bg-surface p-s3 text-left">
              <ProductImage src={u.product.image_url} alt={u.product.name} className="h-12 w-12 shrink-0 rounded-sm" sizes="48px" />
              <span className="flex-1"><strong className="block text-sm">{u.text}</strong>
                {!u.editKey && <span className="text-sm text-ink-muted">{u.product.name} · {money(u.product.promo_price_cents ?? u.product.price_cents)}</span>}</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-primary text-ink-inverse"><IconPlus size={20} /></span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={applyCoupon} className="field">
        <label htmlFor="coupon">Cupom de desconto</label>
        <div className="flex gap-s2">
          <div className="relative flex-1">
            <IconTag size={18} className="pointer-events-none absolute left-s3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input id="coupon" className="input pl-10 uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Digite o código"
              autoCapitalize="characters" aria-invalid={!!coupon && !!quote && !quote.coupon_code} aria-describedby="coupon-msg" />
          </div>
          {couponOk ? (
            <button type="button" className="btn btn-secondary" onClick={() => { setCoupon(""); setCode(""); }}>Remover</button>
          ) : (
            <button className="btn btn-secondary" disabled={!code.trim()}>Aplicar</button>
          )}
        </div>
        {couponMsg && <p id="coupon-msg" className={couponOk ? "text-sm font-semibold text-success" : "field-error"}>{couponMsg}</p>}
      </form>

      {!compact && (
        <div className="field">
          <label htmlFor="order-notes">Observações do pedido</label>
          <textarea id="order-notes" className="input min-h-20" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: interfone com defeito, ligar ao chegar" />
        </div>
      )}

      <Totals quote={quote} loading={loading} />

      {needsCep && (
        <button className="flex items-center gap-s2 rounded-sm bg-secondary/50 p-s3 text-left text-sm font-semibold" onClick={() => openLocation(true)}>
          <IconAlert size={20} /> Informe seu CEP para calcular a entrega (ou escolha retirada).
        </button>
      )}
      {(blocking.length > 0 || error) && (
        <ul className="flex flex-col gap-1" role="alert">
          {[...blocking, error].filter(Boolean).map((e) => <li key={e} className="field-error flex items-center gap-1"><IconAlert size={16} /> {e}</li>)}
        </ul>
      )}

      <button className="btn btn-primary w-full" onClick={() => {
        track.beginCheckout(items.map((i) => ({ item_id: i.product_id, item_name: i.name, price: unitCents(i) / 100, quantity: i.quantity })));
        onCheckout();
      }} disabled={loading || !quote || blocking.length > 0 || !store}>
        {loading ? <Spinner /> : "Avançar para o checkout"}
      </button>
      <Link href="/cardapio" onClick={onContinue} className="btn btn-ghost w-full">Continuar comprando</Link>
    </div>
  );
}

export function Totals({ quote, loading }: { quote: QuoteT | null; loading?: boolean }) {
  const fulfillment = useCart((s) => s.fulfillment);
  if (!quote) return <div className="skeleton h-28 w-full" />;
  return (
    <dl className={`flex flex-col gap-s1 rounded-md bg-surface p-s3 text-sm transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
      <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{money(quote.subtotal_cents)}</dd></div>
      <div className="flex justify-between">
        <dt>{fulfillment === "pickup" ? "Retirada" : "Taxa de entrega"}</dt>
        <dd className="tabular-nums">{fulfillment === "pickup" ? "Grátis" : quote.delivery_served === null ? "—" : quote.delivery_fee_cents === 0 ? "Grátis" : money(quote.delivery_fee_cents)}</dd>
      </div>
      {quote.discount_cents > 0 && (
        <div className="flex justify-between text-success"><dt>Desconto {quote.coupon_code && `(${quote.coupon_code})`}</dt><dd className="tabular-nums">− {money(quote.discount_cents)}</dd></div>
      )}
      <div className="mt-s1 flex items-baseline justify-between border-t-2 border-line pt-s2">
        <dt className="font-display text-xl uppercase">Total</dt>
        <dd className="text-xl font-extrabold"><AnimatedMoney cents={quote.total_cents} /></dd>
      </div>
    </dl>
  );
}

/** Painel lateral no desktop */
export function CartDrawer() {
  const open = useUi((s) => s.cartOpen);
  const setOpen = useUi((s) => s.openCart);
  const router = useRouter();
  return (
    <Sheet open={open} onClose={() => setOpen(false)} label="Seu pedido" side="right">
      <div className="p-s4">
        <div className="mb-s4 flex items-center justify-between">
          <h2 className="text-h3">Seu pedido</h2>
          <CloseButton onClick={() => setOpen(false)} />
        </div>
        <CartContents onCheckout={() => { setOpen(false); router.push("/checkout"); }} onContinue={() => setOpen(false)} />
      </div>
    </Sheet>
  );
}
