export type OptionT = { id: number; name: string; price_cents: number; is_available: boolean; is_default: boolean };
export type OptionGroupT = {
  id: number; code: string; name: string; kind: "single" | "multiple" | "remove";
  min_select: number; max_select: number; options: OptionT[];
};
export type ProductT = {
  id: number; slug: string; name: string; description: string; ingredients: string[];
  price_cents: number; promo_price_cents: number | null; image_url: string | null;
  badge: "best_seller" | "new" | null; is_available: boolean; is_featured: boolean; is_recommended: boolean;
  combo_product_id: number | null; category_slug: string; option_groups: OptionGroupT[];
};
export type CategoryT = { id: number; slug: string; name: string };
export type MenuT = { categories: CategoryT[]; products: ProductT[] };

export type PaymentMethodT = "pix" | "credit_online" | "debit_online" | "card_on_delivery" | "cash" | "wallet";

export type StoreT = {
  name: string; phone: string; whatsapp: string; address: string;
  is_open: boolean; is_paused: boolean; pause_message: string; next_opening: string | null;
  prep_time_minutes: number; pickup_eta_minutes: number; delivery_eta_min: number; delivery_eta_max: number;
  min_order_cents: number; accept_scheduled: boolean; delivery_enabled: boolean; pickup_enabled: boolean;
  payment_methods: PaymentMethodT[]; max_installments: number;
  payments_environment: "unconfigured" | "sandbox" | "production" | "prototype"; mp_public_key: string;
};

export type CepT = {
  cep: string; street: string; neighborhood: string; city: string; state: string; served: boolean;
  zone_name: string | null; fee_cents: number | null; eta_min_minutes: number | null; eta_max_minutes: number | null;
  min_order_cents: number | null; free_shipping_over_cents: number | null;
};

export type QuoteItemT = {
  index: number; product_id: number; name: string; quantity: number; unit_base_cents: number;
  unit_total_cents: number; line_total_cents: number; notes: string;
  options: { option_id: number; group_name: string; group_kind: string; name: string; price_cents: number }[];
};
export type QuoteT = {
  items: QuoteItemT[]; subtotal_cents: number; delivery_fee_cents: number; discount_cents: number; total_cents: number;
  coupon_code: string | null; coupon_message: string | null; delivery_served: boolean | null; min_order_cents: number; errors: string[];
};

export type OrderStatusT =
  | "awaiting_payment" | "received" | "confirmed" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";

export type OrderT = {
  public_id: string; number: number; status: OrderStatusT; payment_status: string; payment_method: PaymentMethodT;
  fulfillment: "delivery" | "pickup"; customer_name: string; customer_phone: string;
  address: Record<string, string> | null; scheduled_for: string | null; eta_at: string | null;
  subtotal_cents: number; delivery_fee_cents: number; discount_cents: number; total_cents: number;
  coupon_code: string | null; change_for_cents: number | null; notes: string; created_at: string;
  items: { product_name: string; quantity: number; unit_total_cents: number; line_total_cents: number; notes: string;
    options: { group_name: string; group_kind: string; option_name: string; price_cents: number }[] }[];
  history: { status: OrderStatusT; note: string; created_at: string }[];
  payment: { method: PaymentMethodT; status: string; status_detail: string; amount_cents: number; installments: number;
    pix_qr_code: string | null; pix_qr_code_base64: string | null; redirect_url: string | null; expires_at: string | null } | null;
  store_whatsapp: string; payments_environment: string;
};
