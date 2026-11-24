"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OptionGroupT, ProductT } from "@/lib/types";
import { money } from "@/lib/format";
import { track } from "@/lib/analytics";
import { flyToCart } from "@/lib/motion";
import { type CartOption, useCart, useUi } from "@/store/cart";
import { ProductImage } from "./Brand";
import { IconCheck } from "./icons";
import { Badge, Price } from "./Menu";
import { useData } from "./Providers";
import { AnimatedMoney, CloseButton, Sheet, Stepper, toast } from "./ui";

function groupHint(g: OptionGroupT) {
  if (g.kind === "remove") return "Opcional";
  if (g.min_select > 0 && g.min_select === g.max_select) return g.max_select === 1 ? "Obrigatório · escolha 1" : `Obrigatório · escolha ${g.max_select}`;
  if (g.min_select > 0) return `Obrigatório · ${g.min_select} a ${g.max_select}`;
  return g.max_select === 1 ? "Opcional · até 1" : `Opcional · até ${g.max_select}`;
}

export function ProductSheet() {
  const sheet = useUi((s) => s.sheet);
  const close = useUi((s) => s.closeSheet);
  return <Sheet open={!!sheet} onClose={close} label={sheet?.product.name ?? "Produto"}>{sheet && <Body key={sheet.product.id + (sheet.editKey ?? "")} product={sheet.product} editKey={sheet.editKey} />}</Sheet>;
}

function Body({ product: p, editKey }: { product: ProductT; editKey?: string }) {
  const close = useUi((s) => s.closeSheet);
  const openSheet = useUi((s) => s.openSheet);
  const { items, add, replace } = useCart();
  const { menu, store } = useData();
  const editing = editKey ? items.find((i) => i.key === editKey) : undefined;

  const [selected, setSelected] = useState<Set<number>>(() => {
    if (editing) return new Set(editing.options.map((o) => o.id));
    return new Set(p.option_groups.flatMap((g) => g.options.filter((o) => o.is_default && o.is_available).map((o) => o.id)));
  });
  const [qty, setQty] = useState(editing?.quantity ?? 1);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [tried, setTried] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    track.viewItem({ item_id: p.id, item_name: p.name, price: (p.promo_price_cents ?? p.price_cents) / 100, quantity: 1, item_category: p.category_slug });
  }, [p]);

  const toggle = (g: OptionGroupT, id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const inGroup = g.options.filter((o) => next.has(o.id)).map((o) => o.id);
      if (next.has(id)) {
        if (g.max_select === 1 && g.min_select === 1) return prev; // rádio obrigatório não desmarca
        next.delete(id);
      } else if (g.max_select === 1) {
        inGroup.forEach((x) => next.delete(x));
        next.add(id);
      } else if (inGroup.length < g.max_select) {
        next.add(id);
      } else {
        toast.info(`Máximo de ${g.max_select} em ${g.name.toLowerCase()}.`);
      }
      return next;
    });
  };

  const chosen: CartOption[] = useMemo(
    () => p.option_groups.flatMap((g) => g.options.filter((o) => selected.has(o.id)).map((o) => ({ id: o.id, name: o.name, price_cents: o.price_cents, group: g.name, kind: g.kind }))),
    [p, selected],
  );
  const missing = p.option_groups.filter((g) => g.options.filter((o) => selected.has(o.id)).length < g.min_select);
  const unit = (p.promo_price_cents ?? p.price_cents) + chosen.reduce((s, o) => s + o.price_cents, 0);
  const combo = p.combo_product_id ? menu?.products.find((x) => x.id === p.combo_product_id && x.is_available) : undefined;

  const submit = () => {
    setTried(true);
    if (!p.is_available) return;
    if (missing.length) {
      document.getElementById(`g-${missing[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (editing) {
      replace(editing.key, p, chosen, notes.trim(), qty);
      toast.success("Item atualizado");
    } else {
      add(p, chosen, notes.trim(), qty);
      flyToCart(btn.current);
      track.addToCart({ item_id: p.id, item_name: p.name, price: unit / 100, quantity: qty, item_category: p.category_slug });
      toast.success(`${p.name} adicionado ao pedido`);
    }
    close();
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="relative md:grid md:grid-cols-2">
        <div className="relative">
          <Badge badge={p.badge} />
          <ProductImage src={p.image_url} alt={p.name} priority sizes="(max-width: 768px) 100vw, 360px" className="aspect-[4/3] w-full md:aspect-square md:h-full" />
        </div>
        <CloseButton onClick={close} className="absolute right-s3 top-s3 z-10" />
        <div className="p-s4">
          <h2 className="text-h3">{p.name}</h2>
          <p className="mt-s2 text-ink-muted">{p.description}</p>
          {p.ingredients.length > 0 && (
            <ul className="mt-s3 flex flex-wrap gap-s1" aria-label="Ingredientes">
              {p.ingredients.map((i) => <li key={i} className="rounded-full bg-secondary/50 px-s2 py-0.5 text-xs font-semibold">{i}</li>)}
            </ul>
          )}
          <Price p={p} className="mt-s3" />
          {!p.is_available && <p className="mt-s3 rounded-sm bg-surface-dark px-s3 py-s2 text-sm font-semibold text-ink-inverse">Indisponível no momento.</p>}
          {combo && !editing && (
            <button className="mt-s3 flex w-full items-center justify-between gap-s2 rounded-sm border-2 border-dashed border-primary px-s3 py-s2 text-left"
              onClick={() => openSheet(combo)}>
              <span><strong className="block text-primary">Transforme em combo</strong><span className="text-sm text-ink-muted">Com acompanhamento e bebida por {money(combo.promo_price_cents ?? combo.price_cents)}</span></span>
              <span className="text-label text-primary">Ver</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-s4 px-s4 pb-s4">
        {p.option_groups.map((g) => {
          const count = g.options.filter((o) => selected.has(o.id)).length;
          const err = tried && count < g.min_select;
          return (
            <fieldset key={g.id} id={`g-${g.id}`} className="rounded-md bg-surface" aria-describedby={`gh-${g.id}`}>
              <legend className="sr-only">{g.name}</legend>
              <div className={`flex items-center justify-between gap-s2 rounded-t-md px-s3 py-s2 ${err ? "bg-error text-ink-inverse" : "bg-secondary/40"}`}>
                <span className="font-bold">{g.name}</span>
                <span id={`gh-${g.id}`} className="text-xs font-semibold">{err ? "Escolha uma opção" : groupHint(g)} {g.max_select > 1 && `· ${count}/${g.max_select}`}</span>
              </div>
              <ul>
                {g.options.map((o) => {
                  const on = selected.has(o.id);
                  const radio = g.max_select === 1;
                  return (
                    <li key={o.id} className="border-t border-line first:border-t-0">
                      <button type="button" role={radio ? "radio" : "checkbox"} aria-checked={on} disabled={!o.is_available}
                        onClick={() => toggle(g, o.id)} className="flex min-h-12 w-full items-center gap-s3 px-s3 py-s2 text-left disabled:opacity-50">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center border-2 border-ink ${radio ? "rounded-full" : "rounded-sm"} ${on ? "bg-ink text-ink-inverse" : ""}`}>
                          {on && <IconCheck size={16} />}
                        </span>
                        <span className="flex-1">{o.name}{!o.is_available && " (esgotado)"}</span>
                        {o.price_cents > 0 && <span className="text-sm font-semibold">+ {money(o.price_cents)}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}

        <div className="field">
          <label htmlFor="item-notes">Alguma observação?</label>
          <textarea id="item-notes" className="input min-h-20" maxLength={200} placeholder="Ex.: cortar ao meio, molho à parte"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
          <span className="self-end text-xs text-ink-muted">{notes.length}/200</span>
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto flex items-center gap-s3 border-t-2 border-line bg-surface p-s3 pb-[max(var(--space-3),env(safe-area-inset-bottom))]">
        <Stepper value={qty} onChange={setQty} label="Quantidade" />
        <button ref={btn} className="btn btn-primary flex-1 whitespace-nowrap px-s3" onClick={submit} disabled={!p.is_available || (store ? false : false)}>
          <span>{editing ? "Salvar" : <><span className="sm:hidden">Adicionar</span><span className="hidden sm:inline">Adicionar ao pedido</span></>}</span>
          <span aria-hidden="true">—</span>
          <AnimatedMoney cents={unit * qty} />
        </button>
      </div>
    </div>
  );
}
