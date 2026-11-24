"use client";

/**
 * Eventos de conversão para GA4 (via GTM/dataLayer) e Meta Pixel.
 * Nada é enviado sem consentimento. A compra é registrada uma única vez por pedido
 * e só após confirmação válida (pagamento aprovado ou pedido pago na entrega recebido).
 * O event_id da compra é o public_id do pedido, o mesmo usado pela Conversions API
 * no backend, para a Meta deduplicar.
 */
import { useProfile } from "@/store/profile";

type Item = { item_id: string | number; item_name: string; price: number; quantity: number; item_category?: string };

declare global {
  interface Window {
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
  }
}

const allowed = () => typeof window !== "undefined" && useProfile.getState().consent === "granted";

function push(event: string, params: Record<string, unknown>, meta?: { name: string; data: Record<string, unknown>; eventID?: string }) {
  if (!allowed()) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ event, ecommerce: params });
  if (meta && window.fbq) window.fbq("track", meta.name, meta.data, meta.eventID ? { eventID: meta.eventID } : undefined);
}

const value = (items: Item[]) => items.reduce((s, i) => s + i.price * i.quantity, 0);

export const track = {
  viewItem: (item: Item) =>
    push("view_item", { currency: "BRL", value: item.price, items: [item] }, { name: "ViewContent", data: { content_ids: [item.item_id], content_type: "product", value: item.price, currency: "BRL" } }),
  addToCart: (item: Item) =>
    push("add_to_cart", { currency: "BRL", value: value([item]), items: [item] }, { name: "AddToCart", data: { content_ids: [item.item_id], content_type: "product", value: value([item]), currency: "BRL" } }),
  removeFromCart: (item: Item) => push("remove_from_cart", { currency: "BRL", value: value([item]), items: [item] }),
  beginCheckout: (items: Item[]) =>
    push("begin_checkout", { currency: "BRL", value: value(items), items }, { name: "InitiateCheckout", data: { value: value(items), currency: "BRL", num_items: items.length } }),
  addPaymentInfo: (method: string, items: Item[]) =>
    push("add_payment_info", { currency: "BRL", value: value(items), payment_type: method, items }, { name: "AddPaymentInfo", data: { value: value(items), currency: "BRL" } }),
  purchase: (orderId: string, totalCents: number, items: Item[], shippingCents: number) => {
    if (!allowed()) return;
    const key = "borcelle-tracked";
    const done: string[] = JSON.parse(localStorage.getItem(key) || "[]");
    if (done.includes(orderId)) return;
    push(
      "purchase",
      { transaction_id: orderId, currency: "BRL", value: totalCents / 100, shipping: shippingCents / 100, items },
      { name: "Purchase", data: { value: totalCents / 100, currency: "BRL", content_type: "product" }, eventID: orderId },
    );
    localStorage.setItem(key, JSON.stringify([...done, orderId].slice(-50)));
  },
};

export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "";
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
