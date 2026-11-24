"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { api, ApiError } from "@/lib/api";
import { maskPhone, money, time } from "@/lib/format";
import { track } from "@/lib/analytics";
import type { OrderStatusT, OrderT } from "@/lib/types";
import { IconAlert, IconChat, IconCheck, IconCopy, IconPix } from "../icons";
import { EmptyState, Spinner, toast } from "../ui";

const DELIVERY_STEPS: { key: OrderStatusT; label: string }[] = [
  { key: "awaiting_payment", label: "Aguardando pagamento" },
  { key: "received", label: "Pedido recebido" },
  { key: "confirmed", label: "Pedido confirmado" },
  { key: "preparing", label: "Em preparação" },
  { key: "ready", label: "Pedido pronto" },
  { key: "out_for_delivery", label: "Saiu para entrega" },
  { key: "delivered", label: "Pedido entregue" },
];

const PAYMENT_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento", in_process: "Pagamento em análise", approved: "Pagamento aprovado",
  rejected: "Pagamento recusado", cancelled: "Pagamento cancelado", refunded: "Pagamento estornado",
  expired: "PIX expirado", on_delivery: "Pagar na entrega",
};

function stepsFor(o: OrderT) {
  return DELIVERY_STEPS.map((s) => {
    if (o.fulfillment === "pickup" && s.key === "out_for_delivery") return { ...s, label: "Disponível para retirada" };
    if (o.fulfillment === "pickup" && s.key === "delivered") return { ...s, label: "Pedido retirado" };
    if (s.key === "awaiting_payment" && o.payment_status === "on_delivery") return { ...s, label: o.fulfillment === "pickup" ? "Pagamento no balcão" : "Pagamento na entrega" };
    return s;
  });
}

export function Tracking({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderT | null>(null);
  const [error, setError] = useState("");
  const fresh = useSearchParams().get("novo") === "1";

  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let alive = true;
    const load = () => api.order(id).then((o) => alive && setOrder(o)).catch((e) => alive && setError(e instanceof ApiError ? e.message : "Erro ao carregar pedido"));
    // Retorno do Checkout Pro / reabertura: confere o pagamento no provedor
    api.syncOrder(id).then((o) => alive && setOrder(o)).catch(load);
    const startPolling = () => { if (!poll) poll = setInterval(load, 8000); };
    if ("EventSource" in window) {
      es = new EventSource(api.eventsUrl(id));
      es.addEventListener("order", (ev) => { try { setOrder(JSON.parse((ev as MessageEvent).data)); } catch {} });
      es.onerror = () => { es?.close(); startPolling(); };
    } else startPolling();
    return () => { alive = false; es?.close(); if (poll) clearInterval(poll); };
  }, [id]);

  // Compra registrada uma única vez, só após confirmação válida
  useEffect(() => {
    if (!order) return;
    const valid = order.payment_status === "approved" || (order.payment_status === "on_delivery" && order.status !== "cancelled");
    if (valid) track.purchase(order.public_id, order.total_cents, order.items.map((i) => ({ item_id: i.product_name, item_name: i.product_name, price: i.unit_total_cents / 100, quantity: i.quantity })), order.delivery_fee_cents);
  }, [order]);

  if (error && !order) return <EmptyState title="Pedido não encontrado" text={error} action={<Link href="/" className="btn btn-primary">Voltar ao início</Link>} />;
  if (!order) return <div className="container-app max-w-3xl py-s6"><div className="skeleton mb-s3 h-16 w-2/3" /><div className="skeleton h-72 w-full" /></div>;

  const steps = stepsFor(order);
  const idx = order.status === "cancelled" ? -1 : steps.findIndex((s) => s.key === order.status);
  const paidLater = order.payment_status === "on_delivery";
  const pixOpen = order.payment?.method === "pix" && ["pending"].includes(order.payment.status) && order.status === "awaiting_payment";
  const canRetry = order.status === "awaiting_payment" && order.payment && ["rejected", "expired", "cancelled"].includes(order.payment.status);
  const wa = order.store_whatsapp ? `https://wa.me/${order.store_whatsapp}?text=${encodeURIComponent(`Olá! Sobre o pedido #${order.number}`)}` : null;

  return (
    <div className="container-app grid max-w-5xl gap-s5 py-s5 pb-s8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-s4">
        {fresh && order.status !== "cancelled" && <Confirmation number={order.number} />}
        <div>
          <p className="text-label text-ink-muted">Pedido #{order.number}</p>
          <h1 className="text-h2">{order.status === "cancelled" ? "Pedido cancelado" : steps[Math.max(idx, 0)].label}</h1>
          {order.eta_at && order.status !== "cancelled" && order.status !== "delivered" && (
            <p className="mt-s1 font-semibold">{order.scheduled_for ? "Agendado para" : "Previsão"}: {time(order.scheduled_for ?? order.eta_at)}</p>
          )}
          <p className={`mt-s2 inline-flex rounded-full px-s3 py-1 text-xs font-bold uppercase ${order.payment_status === "approved" ? "bg-success text-ink-inverse" : ["rejected", "expired", "cancelled"].includes(order.payment_status) ? "bg-error text-ink-inverse" : "bg-accent text-ink"}`}>
            {PAYMENT_LABEL[order.payment_status] ?? order.payment_status}
          </p>
          {order.payments_environment === "sandbox" && <p className="mt-s2 text-xs font-bold text-ink-muted">AMBIENTE DE TESTES — nenhuma cobrança real.</p>}
        </div>

        {pixOpen && <PixPanel order={order} onChange={setOrder} />}
        {canRetry && <Retry order={order} onChange={setOrder} />}
        {order.payment?.method === "wallet" && order.status === "awaiting_payment" && order.payment.redirect_url && (
          <a className="btn btn-primary" href={order.payment.redirect_url}>Pagar no Mercado Pago</a>
        )}

        {order.status !== "cancelled" ? (
          <ol className="relative flex flex-col gap-0 rounded-md bg-surface p-s4" aria-label="Andamento do pedido">
            {steps.map((s, i) => {
              if (paidLater && s.key === "awaiting_payment") return null;
              const done = i < idx || order.status === "delivered";
              const current = i === idx && order.status !== "delivered";
              const at = order.history.find((h) => h.status === s.key)?.created_at;
              return (
                <li key={s.key} className="relative flex gap-s3 pb-s4 last:pb-0" aria-current={current ? "step" : undefined}>
                  {i < steps.length - 1 && <span className={`absolute left-[15px] top-8 h-[calc(100%-24px)] w-0.5 ${done ? "bg-primary" : "bg-line"}`} aria-hidden="true" />}
                  <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-primary bg-primary text-ink-inverse" : current ? "border-primary bg-surface text-primary" : "border-line bg-surface text-ink-muted"}`}>
                    {done ? <IconCheck size={16} /> : current ? <span className="h-3 w-3 animate-pulse rounded-full bg-primary" /> : <span className="h-2 w-2 rounded-full bg-line" />}
                  </span>
                  <span className="pt-1">
                    <span className={`block font-semibold ${!done && !current ? "text-ink-muted" : ""}`}>{s.label}</span>
                    {at && <span className="text-xs text-ink-muted">{time(at)}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rounded-md bg-surface p-s4">{order.history.at(-1)?.note || "Este pedido foi cancelado."} Se precisar, fale com a gente.</p>
        )}

        {wa && <a href={wa} target="_blank" rel="noopener" className="btn btn-secondary"><IconChat size={20} /> Falar no WhatsApp</a>}
      </div>

      <aside className="flex flex-col gap-s3">
        <section className="rounded-md bg-surface p-s4">
          <h2 className="font-body text-sm font-bold normal-case tracking-normal">Resumo</h2>
          <ul className="mt-s2 flex flex-col gap-s2 text-sm">
            {order.items.map((i, n) => (
              <li key={n} className="flex justify-between gap-s2">
                <span><strong>{i.quantity}× {i.product_name}</strong>{i.options.length > 0 && <span className="block text-ink-muted">{i.options.map((o) => o.option_name).join(" · ")}</span>}</span>
                <span className="tabular-nums">{money(i.line_total_cents)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-s3 flex flex-col gap-1 border-t-2 border-line pt-s2 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(order.subtotal_cents)}</dd></div>
            <div className="flex justify-between"><dt>Entrega</dt><dd>{order.delivery_fee_cents ? money(order.delivery_fee_cents) : "Grátis"}</dd></div>
            {order.discount_cents > 0 && <div className="flex justify-between text-success"><dt>Desconto</dt><dd>− {money(order.discount_cents)}</dd></div>}
            <div className="flex justify-between text-base font-extrabold"><dt>Total</dt><dd>{money(order.total_cents)}</dd></div>
            {order.change_for_cents && <div className="flex justify-between text-ink-muted"><dt>Troco para</dt><dd>{money(order.change_for_cents)}</dd></div>}
          </dl>
        </section>
        <section className="rounded-md bg-surface p-s4 text-sm">
          <h2 className="font-body text-sm font-bold normal-case tracking-normal">{order.fulfillment === "pickup" ? "Retirada no balcão" : "Endereço de entrega"}</h2>
          {order.address ? <p className="mt-1">{order.address.street}, {order.address.number}{order.address.complement ? ` · ${order.address.complement}` : ""}<br />{order.address.neighborhood} — {order.address.city}/{order.address.state}</p> : <p className="mt-1">Retire com o número do pedido.</p>}
          <p className="mt-s2 text-ink-muted">{order.customer_name} · {maskPhone(order.customer_phone)}</p>
        </section>
      </aside>
    </div>
  );
}

function Confirmation({ number }: { number: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.timeline()
      .from(ref.current, { scale: 1.4, rotate: -8, opacity: 0, duration: 0.5, ease: "back.out(2)" })
      .from(ref.current.querySelector("svg"), { scale: 0, duration: 0.4, ease: "back.out(3)" }, "-=0.2");
  }, []);
  return (
    <div ref={ref} className="ticket flex items-center gap-s3 bg-primary px-s5 py-s4 text-ink-inverse" role="status">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-inverse text-primary"><IconCheck size={28} /></span>
      <span><span className="font-display grunge block text-h4 uppercase leading-none">Pedido enviado!</span><span className="text-sm">Número #{number}. Acompanhe por aqui.</span></span>
    </div>
  );
}

function PixPanel({ order, onChange }: { order: OrderT; onChange: (o: OrderT) => void }) {
  const p = order.payment!;
  const [left, setLeft] = useState(0);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (!p.expires_at) return;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(p.expires_at!).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [p.expires_at]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(p.pix_qr_code ?? ""); toast.success("Código PIX copiado"); }
    catch { toast.error("Não foi possível copiar. Selecione o código e copie manualmente."); }
  };
  const check = async () => {
    setChecking(true);
    try { onChange(await api.syncOrder(order.public_id)); } catch {} finally { setChecking(false); }
  };
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <section className="rounded-md border-2 border-ink bg-surface p-s4" aria-labelledby="pix-title">
      <div className="flex items-center justify-between gap-s2">
        <h2 id="pix-title" className="text-h4 flex items-center gap-s2"><IconPix /> Pague com PIX</h2>
        {p.expires_at && <span className={`rounded-full px-s3 py-1 text-sm font-bold tabular-nums ${left < 120 ? "bg-error text-ink-inverse" : "bg-accent text-ink"}`} aria-live="off">{left > 0 ? `${mm}:${ss}` : "Expirado"}</span>}
      </div>
      <p className="mt-s1 text-sm text-ink-muted">Abra o app do seu banco, escolha PIX e escaneie o código ou use o copia e cola. A confirmação é automática.</p>
      <div className="mt-s3 flex flex-col items-center gap-s3 sm:flex-row sm:items-start">
        {p.pix_qr_code_base64 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/png;base64,${p.pix_qr_code_base64}`} alt="QR Code PIX" width={200} height={200} className="h-[200px] w-[200px] rounded-sm bg-ink-inverse p-s2" />
        )}
        <div className="flex w-full min-w-0 flex-col gap-s2">
          <label htmlFor="pix-code" className="text-sm font-semibold">PIX copia e cola</label>
          <textarea id="pix-code" readOnly value={p.pix_qr_code ?? ""} className="input min-h-24 break-all font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <button className="btn btn-primary" onClick={copy}><IconCopy size={20} /> Copiar código</button>
          <button className="btn btn-ghost" onClick={check} disabled={checking}>{checking ? <Spinner /> : "Já paguei, verificar"}</button>
        </div>
      </div>
      <p className="mt-s3 text-center text-lg font-extrabold">{money(p.amount_cents)}</p>
    </section>
  );
}

function Retry({ order, onChange }: { order: OrderT; onChange: (o: OrderT) => void }) {
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try { onChange(await api.retryPayment(order.public_id, { payment_method: "pix" })); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Não foi possível gerar novo pagamento."); }
    finally { setBusy(false); }
  };
  return (
    <section className="rounded-md bg-error p-s4 text-ink-inverse" role="alert">
      <p className="flex items-center gap-s2 font-bold"><IconAlert /> {order.payment?.status === "expired" ? "O PIX expirou." : "O pagamento não foi aprovado."}</p>
      {order.payment?.status_detail && order.payment.status !== "expired" && <p className="mt-1 text-sm opacity-90">Motivo informado: {order.payment.status_detail}</p>}
      <button className="btn mt-s3 w-full bg-ink-inverse text-error" onClick={retry} disabled={busy}>{busy ? <Spinner /> : "Pagar com PIX"}</button>
    </section>
  );
}
