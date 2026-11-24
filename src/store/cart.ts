"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CepT, ProductT } from "@/lib/types";
import { uid } from "@/lib/format";

export type CartOption = { id: number; name: string; price_cents: number; group: string; kind: string };
export type CartItem = {
  key: string;
  product_id: number;
  slug: string;
  name: string;
  image_url: string | null;
  category_slug: string;
  base_cents: number;
  options: CartOption[];
  notes: string;
  quantity: number;
};

export const unitCents = (i: CartItem) => i.base_cents + i.options.reduce((s, o) => s + o.price_cents, 0);

type CartState = {
  items: CartItem[];
  coupon: string;
  notes: string;
  fulfillment: "delivery" | "pickup";
  location: CepT | null;
  add: (p: ProductT, options: CartOption[], notes: string, quantity: number) => void;
  replace: (key: string, p: ProductT, options: CartOption[], notes: string, quantity: number) => void;
  setQty: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setCoupon: (c: string) => void;
  setNotes: (n: string) => void;
  setFulfillment: (f: "delivery" | "pickup") => void;
  setLocation: (l: CepT | null) => void;
};

const sameConfig = (a: CartItem, productId: number, options: CartOption[], notes: string) =>
  a.product_id === productId &&
  a.notes === notes &&
  a.options.map((o) => o.id).sort().join(",") === options.map((o) => o.id).sort().join(",");

const build = (p: ProductT, options: CartOption[], notes: string, quantity: number, key = uid()): CartItem => ({
  key,
  product_id: p.id,
  slug: p.slug,
  name: p.name,
  image_url: p.image_url,
  category_slug: p.category_slug,
  base_cents: p.promo_price_cents ?? p.price_cents,
  options,
  notes,
  quantity,
});

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      coupon: "",
      notes: "",
      fulfillment: "delivery",
      location: null,
      add: (p, options, notes, quantity) =>
        set((s) => {
          const found = s.items.find((i) => sameConfig(i, p.id, options, notes));
          if (found) {
            return { items: s.items.map((i) => (i.key === found.key ? { ...i, quantity: Math.min(i.quantity + quantity, 50) } : i)) };
          }
          return { items: [...s.items, build(p, options, notes, quantity)] };
        }),
      replace: (key, p, options, notes, quantity) =>
        set((s) => ({ items: s.items.map((i) => (i.key === key ? build(p, options, notes, quantity, key) : i)) })),
      setQty: (key, quantity) =>
        set((s) => ({
          items: quantity <= 0 ? s.items.filter((i) => i.key !== key) : s.items.map((i) => (i.key === key ? { ...i, quantity: Math.min(quantity, 50) } : i)),
        })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [], coupon: "", notes: "" }),
      setCoupon: (coupon) => set({ coupon }),
      setNotes: (notes) => set({ notes }),
      setFulfillment: (fulfillment) => set({ fulfillment }),
      setLocation: (location) => set({ location }),
    }),
    { name: "borcelle-cart", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((s, i) => s + i.quantity, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((s, i) => s + unitCents(i) * i.quantity, 0);

/** Estado de interface (não persistido) */
type UiState = {
  cartOpen: boolean;
  sheet: { product: ProductT; editKey?: string } | null;
  locationOpen: boolean;
  openCart: (v: boolean) => void;
  openSheet: (product: ProductT, editKey?: string) => void;
  closeSheet: () => void;
  openLocation: (v: boolean) => void;
};

export const useUi = create<UiState>()((set) => ({
  cartOpen: false,
  sheet: null,
  locationOpen: false,
  openCart: (cartOpen) => set({ cartOpen }),
  openSheet: (product, editKey) => set({ sheet: { product, editKey } }),
  closeSheet: () => set({ sheet: null }),
  openLocation: (locationOpen) => set({ locationOpen }),
}));
