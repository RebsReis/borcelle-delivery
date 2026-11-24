"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { QuoteT } from "./types";
import { useCart } from "@/store/cart";

/** Cotação calculada pelo servidor (preços, taxa, cupom). Atualiza ao mudar o carrinho. */
export function useQuote(cepOverride?: string | null) {
  const { items, coupon, fulfillment, location } = useCart();
  const [quote, setQuote] = useState<QuoteT | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cep = cepOverride ?? (fulfillment === "delivery" ? location?.cep ?? null : null);
  const key = JSON.stringify([items.map((i) => [i.product_id, i.quantity, i.options.map((o) => o.id), i.notes]), coupon, fulfillment, cep]);

  useEffect(() => {
    if (!items.length) { setQuote(null); return; }
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      api.quote({
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, option_ids: i.options.map((o) => o.id), notes: i.notes })),
        coupon_code: coupon || null,
        fulfillment,
        cep,
      })
        .then((q) => { if (alive) { setQuote(q); setError(""); } })
        .catch((e) => { if (alive) setError(e.message); })
        .finally(() => { if (alive) setLoading(false); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { quote, loading, error };
}
