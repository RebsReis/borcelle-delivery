"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SavedAddress = {
  cep: string; street: string; number: string; complement: string;
  neighborhood: string; city: string; state: string; reference: string;
};

export type RecentOrder = { public_id: string; number: number; total_cents: number; created_at: string };

type ProfileState = {
  name: string;
  phone: string;
  email: string;
  address: SavedAddress | null;
  remember: boolean;
  orders: RecentOrder[];
  consent: "unknown" | "granted" | "denied";
  saveContact: (c: { name: string; phone: string; email: string }) => void;
  saveAddress: (a: SavedAddress) => void;
  setRemember: (v: boolean) => void;
  addOrder: (o: RecentOrder) => void;
  setConsent: (c: "granted" | "denied") => void;
  forget: () => void;
};

/** Dados salvos apenas neste aparelho, com opção de apagar (LGPD). */
export const useProfile = create<ProfileState>()(
  persist(
    (set, get) => ({
      name: "",
      phone: "",
      email: "",
      address: null,
      remember: true,
      orders: [],
      consent: "unknown",
      saveContact: (c) => (get().remember ? set(c) : undefined),
      saveAddress: (address) => (get().remember ? set({ address }) : undefined),
      setRemember: (remember) => set(remember ? { remember } : { remember, name: "", phone: "", email: "", address: null }),
      addOrder: (o) => set((s) => ({ orders: [o, ...s.orders.filter((x) => x.public_id !== o.public_id)].slice(0, 20) })),
      setConsent: (consent) => set({ consent }),
      forget: () => set({ name: "", phone: "", email: "", address: null, orders: [] }),
    }),
    { name: "borcelle-profile", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
