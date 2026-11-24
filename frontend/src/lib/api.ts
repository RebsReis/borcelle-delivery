import type { CepT, MenuT, OrderT, QuoteT, StoreT } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SERVER_API_URL = process.env.API_INTERNAL_URL ?? API_URL;

export class ApiError extends Error {
  constructor(message: string, public status: number, public field?: string) {
    super(message);
  }
}

function base() {
  return typeof window === "undefined" ? SERVER_API_URL : API_URL;
}

async function request<T>(path: string, init?: RequestInit & { revalidate?: number }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...(init?.revalidate !== undefined ? { next: { revalidate: init.revalidate } } : { cache: "no-store" }),
    });
  } catch {
    throw new ApiError("Sem conexão com o servidor. Verifique sua internet.", 0);
  }
  if (!res.ok) {
    let detail = "Algo deu errado. Tente novamente.";
    let field: string | undefined;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      field = body.field;
    } catch {}
    throw new ApiError(detail, res.status, field);
  }
  return res.json() as Promise<T>;
}

export const api = {
  store: (revalidate?: number) => request<StoreT>("/api/store", { revalidate }),
  slots: () => request<{ slots: string[] }>("/api/store/slots"),
  menu: (revalidate?: number) => request<MenuT>("/api/menu", { revalidate }),
  cep: (cep: string) => request<CepT>(`/api/delivery/cep/${cep.replace(/\D/g, "")}`),
  quote: (body: unknown) => request<QuoteT>("/api/cart/quote", { method: "POST", body: JSON.stringify(body) }),
  createOrder: (body: unknown, idempotencyKey: string) =>
    request<OrderT>("/api/orders", { method: "POST", body: JSON.stringify(body), headers: { "Idempotency-Key": idempotencyKey } }),
  order: (id: string) => request<OrderT>(`/api/orders/${id}`),
  syncOrder: (id: string) => request<OrderT>(`/api/orders/${id}/sync`, { method: "POST" }),
  retryPayment: (id: string, body: unknown) =>
    request<OrderT>(`/api/orders/${id}/payments`, { method: "POST", body: JSON.stringify(body) }),
  eventsUrl: (id: string) => `${API_URL}/api/orders/${id}/events`,
};
