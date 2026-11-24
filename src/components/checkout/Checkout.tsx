"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { gsap } from "gsap";
import { api, ApiError } from "@/lib/api";
import { dayLabel, maskCep, maskPhone, money, parseMoney, time, uid } from "@/lib/format";
import { track } from "@/lib/analytics";
import { useQuote } from "@/lib/useQuote";
import type { CepT, PaymentMethodT } from "@/lib/types";
import { unitCents, useCart } from "@/store/cart";
import { useProfile } from "@/store/profile";
import { Totals } from "../Cart";
import { IconAlert, IconBack, IconBike, IconCard, IconCash, IconCheck, IconClock, IconPix, IconStore, IconWallet } from "../icons";
import { useData, useHydrated } from "../Providers";
import { EmptyState, Spinner, toast } from "../ui";
import { DemoCard, type CardData } from "./DemoCard";
import { MIN_INSTALLMENT_CENTS } from "@/lib/mock/data";

const STEPS = ["Identificação", "Entrega", "Endereço", "Pagamento", "Revisão"] as const;

const contactSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome").refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  phone: z.string().refine((v) => { const d = v.replace(/\D/g, ""); return d.length === 10 || d.length === 11; }, "Telefone com DDD"),
  email: z.email("E-mail inválido"),
});
type Contact = z.infer<typeof contactSchema>;

const addressSchema = z.object({
  cep: z.string().refine((v) => v.replace(/\D/g, "").length === 8, "CEP com 8 números"),
  street: z.string().trim().min(2, "Informe a rua"),
  number: z.string().trim().min(1, "Informe o número"),
  complement: z.string().max(100).optional().default(""),
  neighborhood: z.string().trim().min(2, "Informe o bairro"),
  city: z.string().trim().min(2, "Informe a cidade"),
  state: z.string().trim().length(2, "UF com 2 letras"),
  reference: z.string().max(200).optional().default(""),
});
type AddressForm = z.input<typeof addressSchema>;

const METHOD_INFO: Record<PaymentMethodT, { label: string; hint: string; icon: typeof IconPix }> = {
  pix: { label: "PIX", hint: "Aprovação na hora · QR Code ou copia e cola", icon: IconPix },
  credit_online: { label: "Cartão de crédito", hint: "Pague agora, com segurança", icon: IconCard },
  debit_online: { label: "Cartão de débito", hint: "Pague agora, online", icon: IconCard },
  card_on_delivery: { label: "Cartão na entrega", hint: "Crédito ou débito na maquininha", icon: IconCard },
  cash: { label: "Dinheiro", hint: "Pague na entrega ou retirada", icon: IconCash },
  wallet: { label: "Mercado Pago", hint: "Saldo e carteira Mercado Pago", icon: IconWallet },
};

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <p id={`${id}-err`} className="field-error">{error}</p>}
    </div>
  );
}

export function Checkout() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { store } = useData();
  const cart = useCart();
  const profile = useProfile();
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState<Contact | null>(null);
  const [when, setWhen] = useState<"now" | "scheduled">("now");
  const [slot, setSlot] = useState<string>("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [address, setAddress] = useState<AddressForm | null>(null);
  const [zone, setZone] = useState<CepT | null>(cart.location);
  const [method, setMethod] = useState<PaymentMethodT | null>(null);
  const [card, setCard] = useState<CardData | null>(null);
  const [needChange, setNeedChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [notifyWa, setNotifyWa] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  const cepForQuote = cart.fulfillment === "delivery" ? (address?.cep ? address.cep.replace(/\D/g, "") : zone?.cep ?? null) : null;
  const { quote, loading: quoting } = useQuote(cepForQuote);

  const closed = store ? !store.is_open : false;
  useEffect(() => { if (closed) setWhen("scheduled"); }, [closed]);
  useEffect(() => {
    if (when === "scheduled" && slots === null) api.slots().then((r) => setSlots(r.slots)).catch(() => setSlots([]));
  }, [when, slots]);

  // Transição suave entre etapas
  useEffect(() => {
    if (!panel.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(panel.current, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.35, ease: "power3.out" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const contactForm = useForm<Contact>({ resolver: zodResolver(contactSchema), mode: "onTouched" });
  const addressForm = useForm<AddressForm>({ resolver: zodResolver(addressSchema), mode: "onTouched" });

  useEffect(() => {
    if (!hydrated) return;
    contactForm.reset({ name: profile.name, phone: maskPhone(profile.phone), email: profile.email });
    const saved = profile.address;
    addressForm.reset(saved ?? { cep: cart.location ? maskCep(cart.location.cep) : "", street: cart.location?.street ?? "", neighborhood: cart.location?.neighborhood ?? "", city: cart.location?.city ?? "", state: cart.location?.state ?? "", number: "", complement: "", reference: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const items = useMemo(() => cart.items.map((i) => ({ item_id: i.product_id, item_name: i.name, price: unitCents(i) / 100, quantity: i.quantity })), [cart.items]);

  if (!hydrated || !store) return <div className="container-app max-w-2xl py-s6"><div className="skeleton h-64 w-full" /></div>;
  if (!cart.items.length) {
    return <EmptyState title="Carrinho vazio" text="Adicione produtos antes de finalizar." action={<Link className="btn btn-primary" href="/cardapio">Ver cardápio</Link>} />;
  }
  if (closed && !store.accept_scheduled) {
    return <EmptyState title="Estamos fechados" text={store.pause_message || "Volte no nosso horário de funcionamento. Seu carrinho fica salvo."} action={<Link className="btn btn-secondary" href="/">Voltar</Link>} />;
  }

  const pickup = cart.fulfillment === "pickup";
  const visibleSteps = pickup ? [0, 1, 3, 4] : [0, 1, 2, 3, 4];
  const pos = visibleSteps.indexOf(step);
  const next = () => setStep(visibleSteps[Math.min(pos + 1, visibleSteps.length - 1)]);
  const back = () => (pos === 0 ? router.push("/carrinho") : setStep(visibleSteps[pos - 1]));

  /* --------------------------------------------------------- etapa 1 */
  const submitContact = contactForm.handleSubmit((v) => {
    const c = { ...v, phone: v.phone.replace(/\D/g, ""), name: v.name.trim().replace(/\s+/g, " ") };
    setContact(c);
    profile.saveContact(c);
    next();
  });

  /* --------------------------------------------------------- etapa 3 */
  const lookupCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const r = await api.cep(digits);
      setZone(r);
      cart.setLocation(r);
      if (r.street) addressForm.setValue("street", r.street, { shouldValidate: true });
      if (r.neighborhood) addressForm.setValue("neighborhood", r.neighborhood, { shouldValidate: true });
      if (r.city) addressForm.setValue("city", r.city, { shouldValidate: true });
      if (r.state) addressForm.setValue("state", r.state, { shouldValidate: true });
      if (r.street) document.getElementById("a-number")?.focus();
    } catch (e) {
      setZone(null);
      addressForm.setError("cep", { message: e instanceof ApiError ? e.message : "Não foi possível consultar o CEP" });
    }
  };
  const submitAddress = addressForm.handleSubmit((v) => {
    if (!zone || zone.cep !== v.cep.replace(/\D/g, "")) {
      lookupCep(v.cep);
      return toast.error("Confirme o CEP para validarmos a área de entrega.");
    }
    if (!zone.served) return addressForm.setError("cep", { message: "Ainda não entregamos neste CEP. Escolha retirada no balcão." });
    setAddress(v);
    profile.saveAddress({ ...(v as Required<AddressForm>), complement: v.complement ?? "", reference: v.reference ?? "" });
    next();
  });

  /* --------------------------------------------------------- etapa 4 */
  const online = method === "pix" || method === "credit_online" || method === "debit_online" || method === "wallet";
  const totalCents = quote?.total_cents ?? 0;
  const changeCents = parseMoney(changeFor);
  const paymentReady = method && (method !== "credit_online" && method !== "debit_online" ? true : !!card) &&
    (method !== "cash" || !needChange || changeCents > totalCents);
  const methods = store.payment_methods;

  /* --------------------------------------------------------- confirmar */
  const confirm = async () => {
    if (submitting || !contact || !method || !quote) return;
    setSubmitting(true);
    setSubmitError("");
    const sig = JSON.stringify([cart.items.map((i) => [i.product_id, i.quantity, i.options.map((o) => o.id)]), method, quote.total_cents]);
    let key = sessionStorage.getItem("borcelle-idem");
    if (!key || sessionStorage.getItem("borcelle-idem-sig") !== sig) {
      key = uid();
      sessionStorage.setItem("borcelle-idem", key);
      sessionStorage.setItem("borcelle-idem-sig", sig);
    }
    const body = {
      customer: contact,
      fulfillment: cart.fulfillment,
      scheduled_for: when === "scheduled" ? slot : null,
      address: pickup ? null : { ...address, cep: address!.cep.replace(/\D/g, ""), state: address!.state.toUpperCase() },
      items: cart.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, option_ids: i.options.map((o) => o.id), notes: i.notes })),
      coupon_code: cart.coupon || null,
      notes: cart.notes,
      payment_method: method,
      change_for_cents: method === "cash" && needChange ? changeCents : null,
      card: card ? { ...card } : null,
      marketing_consent: profile.consent === "granted",
      notify_whatsapp: notifyWa,
      expected_total_cents: quote.total_cents,
    };
    try {
      const order = await api.createOrder(body, key);
      sessionStorage.removeItem("borcelle-idem");
      profile.addOrder({ public_id: order.public_id, number: order.number, total_cents: order.total_cents, created_at: order.created_at });
      cart.clear();
      if (order.payment_method === "wallet" && order.payment?.redirect_url) {
        window.location.href = order.payment.redirect_url;
        return;
      }
      router.replace(`/pedido/${order.public_id}?novo=1`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível enviar o pedido.";
      setSubmitError(msg);
      if (e instanceof ApiError && e.status === 409) sessionStorage.removeItem("borcelle-idem");
      setSubmitting(false);
    }
  };

  const etaText = when === "scheduled" && slot
    ? `${dayLabel(slot)}, ${time(slot)}`
    : pickup ? `Pronto em ~${store.pickup_eta_minutes} min` : zone?.eta_min_minutes ? `${zone.eta_min_minutes}–${zone.eta_max_minutes} min` : `${store.delivery_eta_min}–${store.delivery_eta_max} min`;

  return (
    <div className="container-app grid max-w-6xl gap-s5 py-s5 pb-s8 lg:grid-cols-[1fr_380px]">
      <div>
        <button onClick={back} className="btn-ghost btn -ml-s3 mb-s2"><IconBack size={20} /> Voltar</button>
        <ol className="mb-s5 flex gap-s1" aria-label="Etapas do checkout">
          {visibleSteps.map((s, i) => (
            <li key={s} className="flex-1" aria-current={s === step ? "step" : undefined}>
              <span className={`block h-1.5 rounded-full transition-colors duration-normal ${i <= pos ? "bg-primary" : "bg-line"}`} />
              <span className={`mt-1 hidden text-xs font-semibold sm:block ${i === pos ? "text-ink" : "text-ink-muted"}`}>{STEPS[s]}</span>
            </li>
          ))}
        </ol>
        <p className="text-label text-ink-muted sm:hidden">Etapa {pos + 1} de {visibleSteps.length}</p>

        <div ref={panel}>
          {step === 0 && (
            <form onSubmit={submitContact} noValidate className="flex flex-col gap-s4">
              <h1 className="text-h3">Quem vai receber?</h1>
              <p className="-mt-s2 text-sm text-ink-muted">Sem cadastro: só precisamos disso para falar sobre seu pedido.</p>
              <Field id="c-name" label="Nome completo" error={contactForm.formState.errors.name?.message}>
                <input id="c-name" className="input" autoComplete="name" aria-invalid={!!contactForm.formState.errors.name} aria-describedby="c-name-err" {...contactForm.register("name")} />
              </Field>
              <Field id="c-phone" label="Telefone / WhatsApp" error={contactForm.formState.errors.phone?.message}>
                <input id="c-phone" className="input" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(12) 99999-9999"
                  aria-invalid={!!contactForm.formState.errors.phone} aria-describedby="c-phone-err"
                  {...contactForm.register("phone", { onChange: (e) => contactForm.setValue("phone", maskPhone(e.target.value)) })} />
              </Field>
              <Field id="c-email" label="E-mail" error={contactForm.formState.errors.email?.message}>
                <input id="c-email" className="input" type="email" inputMode="email" autoComplete="email" aria-invalid={!!contactForm.formState.errors.email} aria-describedby="c-email-err" {...contactForm.register("email")} />
              </Field>
              <label className="flex min-h-11 items-center gap-s2 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-[var(--color-primary)]" checked={profile.remember} onChange={(e) => profile.setRemember(e.target.checked)} />
                Lembrar meus dados neste aparelho
              </label>
              <button className="btn btn-primary">Continuar</button>
            </form>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-s4">
              <h1 className="text-h3">Como você quer receber?</h1>
              <div className="grid gap-s3 sm:grid-cols-2" role="radiogroup" aria-label="Modalidade">
                {store.delivery_enabled && (
                  <Choice on={!pickup} onClick={() => cart.setFulfillment("delivery")} icon={<IconBike />} title="Delivery" text={`${store.delivery_eta_min}–${store.delivery_eta_max} min · taxa conforme região`} />
                )}
                {store.pickup_enabled && (
                  <Choice on={pickup} onClick={() => cart.setFulfillment("pickup")} icon={<IconStore />} title="Retirar no balcão" text={`Pronto em ~${store.pickup_eta_minutes} min · sem taxa`} />
                )}
              </div>
              <h2 className="text-h4 mt-s2">Quando?</h2>
              <div className="grid gap-s3 sm:grid-cols-2" role="radiogroup" aria-label="Quando">
                <Choice on={when === "now"} disabled={closed} onClick={() => setWhen("now")} icon={<IconClock />} title="Agora" text={closed ? "Estamos fechados neste momento" : "O quanto antes"} />
                {store.accept_scheduled && <Choice on={when === "scheduled"} onClick={() => setWhen("scheduled")} icon={<IconClock />} title="Agendar" text="Escolha um horário" />}
              </div>
              {when === "scheduled" && (
                <div className="field">
                  <label htmlFor="slot">Horário</label>
                  {slots === null ? <div className="skeleton h-12 w-full" /> : slots.length === 0 ? (
                    <p className="field-error">Sem horários disponíveis para agendamento.</p>
                  ) : (
                    <select id="slot" className="input" value={slot} onChange={(e) => setSlot(e.target.value)}>
                      <option value="">Selecione…</option>
                      {slots.map((s) => <option key={s} value={s}>{dayLabel(s)} · {time(s)}</option>)}
                    </select>
                  )}
                </div>
              )}
              <button className="btn btn-primary" disabled={when === "scheduled" && !slot} onClick={next}>Continuar</button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={submitAddress} noValidate className="flex flex-col gap-s4">
              <h1 className="text-h3">Onde entregamos?</h1>
              <Field id="a-cep" label="CEP" error={addressForm.formState.errors.cep?.message}>
                <input id="a-cep" className="input" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" aria-invalid={!!addressForm.formState.errors.cep} aria-describedby="a-cep-err"
                  {...addressForm.register("cep", { onChange: (e) => { const v = maskCep(e.target.value); addressForm.setValue("cep", v); if (v.length === 9) lookupCep(v); } })} />
              </Field>
              {zone && zone.cep === addressForm.watch("cep")?.replace(/\D/g, "") && (
                <p className={`-mt-s2 rounded-sm px-s3 py-s2 text-sm font-semibold ${zone.served ? "bg-success text-ink-inverse" : "bg-error text-ink-inverse"}`} role="status">
                  {zone.served ? `Entregamos aqui · ${zone.zone_name} · taxa ${money(zone.fee_cents ?? 0)} · ${zone.eta_min_minutes}–${zone.eta_max_minutes} min` : "Ainda não entregamos neste CEP. Volte e escolha retirada."}
                </p>
              )}
              <div className="grid grid-cols-[1fr_120px] gap-s3">
                <Field id="a-street" label="Rua" error={addressForm.formState.errors.street?.message}>
                  <input id="a-street" className="input" autoComplete="address-line1" {...addressForm.register("street")} aria-invalid={!!addressForm.formState.errors.street} />
                </Field>
                <Field id="a-number" label="Número" error={addressForm.formState.errors.number?.message}>
                  <input id="a-number" className="input" inputMode="numeric" {...addressForm.register("number")} aria-invalid={!!addressForm.formState.errors.number} />
                </Field>
              </div>
              <Field id="a-comp" label="Complemento (opcional)"><input id="a-comp" className="input" autoComplete="address-line2" placeholder="Apto, bloco" {...addressForm.register("complement")} /></Field>
              <Field id="a-nb" label="Bairro" error={addressForm.formState.errors.neighborhood?.message}>
                <input id="a-nb" className="input" {...addressForm.register("neighborhood")} aria-invalid={!!addressForm.formState.errors.neighborhood} />
              </Field>
              <div className="grid grid-cols-[1fr_90px] gap-s3">
                <Field id="a-city" label="Cidade" error={addressForm.formState.errors.city?.message}>
                  <input id="a-city" className="input" autoComplete="address-level2" {...addressForm.register("city")} aria-invalid={!!addressForm.formState.errors.city} />
                </Field>
                <Field id="a-uf" label="Estado" error={addressForm.formState.errors.state?.message}>
                  <input id="a-uf" className="input uppercase" maxLength={2} autoComplete="address-level1" {...addressForm.register("state")} aria-invalid={!!addressForm.formState.errors.state} />
                </Field>
              </div>
              <Field id="a-ref" label="Ponto de referência (opcional)"><input id="a-ref" className="input" placeholder="Ex.: em frente à padaria" {...addressForm.register("reference")} /></Field>
              <button className="btn btn-primary">Continuar</button>
            </form>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-s4">
              <h1 className="text-h3">Como você quer pagar?</h1>
              <p className="rounded-sm bg-accent px-s3 py-s2 text-sm font-semibold text-ink">
                Protótipo: os pagamentos são simulados e nada é cobrado.
              </p>
              <div className="flex flex-col gap-s2" role="radiogroup" aria-label="Forma de pagamento">
                {methods.map((m) => {
                  const I = METHOD_INFO[m].icon;
                  return (
                    <Choice key={m} on={method === m} onClick={() => { setMethod(m); setCard(null); track.addPaymentInfo(m, items); }}
                      icon={<I />} title={METHOD_INFO[m].label + (m === "card_on_delivery" && pickup ? " (no balcão)" : "")} text={METHOD_INFO[m].hint} />
                  );
                })}
              </div>
              {(method === "credit_online" || method === "debit_online") && contact && (
                card ? (
                  <div className="flex items-center justify-between rounded-sm bg-success px-s3 py-s3 text-ink-inverse">
                    <span className="flex items-center gap-s2 font-semibold"><IconCheck /> {card.brand} final {card.last_four}{card.installments > 1 ? ` · ${card.installments}x` : ""}</span>
                    <button className="text-sm font-bold underline" onClick={() => setCard(null)}>Trocar</button>
                  </div>
                ) : (
                  <DemoCard key={method} amountCents={totalCents} type={method === "credit_online" ? "credit" : "debit"}
                    maxInstallments={store.max_installments} minInstallmentCents={MIN_INSTALLMENT_CENTS} onReady={(d) => { setCard(d); next(); }} />
                )
              )}
              {method === "cash" && (
                <div className="flex flex-col gap-s3 rounded-md bg-surface p-s3">
                  <label className="flex min-h-11 items-center gap-s2 font-semibold">
                    <input type="checkbox" className="h-5 w-5 accent-[var(--color-primary)]" checked={needChange} onChange={(e) => setNeedChange(e.target.checked)} />
                    Vou precisar de troco
                  </label>
                  {needChange && (
                    <Field id="change" label="Troco para quanto?" error={changeCents > 0 && changeCents <= totalCents ? `Precisa ser maior que ${money(totalCents)}` : undefined}>
                      <input id="change" className="input" inputMode="numeric" value={changeCents ? money(changeCents) : ""} placeholder="R$ 100,00"
                        onChange={(e) => setChangeFor(e.target.value)} aria-invalid={changeCents > 0 && changeCents <= totalCents} />
                      {changeCents > totalCents && <p className="text-sm font-semibold text-success">Seu troco: {money(changeCents - totalCents)}</p>}
                    </Field>
                  )}
                </div>
              )}
              {method !== "credit_online" && method !== "debit_online" && (
                <button className="btn btn-primary" disabled={!paymentReady} onClick={next}>Revisar pedido</button>
              )}
            </div>
          )}

          {step === 4 && contact && method && (
            <div className="flex flex-col gap-s4">
              <h1 className="text-h3">Confira e confirme</h1>
              <Review title="Itens" onEdit={() => router.push("/carrinho")}>
                <ul className="flex flex-col gap-s2">
                  {cart.items.map((i) => (
                    <li key={i.key} className="flex justify-between gap-s3 text-sm">
                      <span><strong>{i.quantity}× {i.name}</strong>
                        {i.options.length > 0 && <span className="block text-ink-muted">{i.options.map((o) => o.name).join(" · ")}</span>}
                        {i.notes && <span className="block italic text-ink-muted">“{i.notes}”</span>}</span>
                      <span className="tabular-nums">{money(unitCents(i) * i.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </Review>
              <Review title={pickup ? "Retirada" : "Entrega"} onEdit={() => setStep(pickup ? 1 : 2)}>
                <p className="text-sm">{pickup ? store.address : `${address?.street}, ${address?.number}${address?.complement ? ` · ${address.complement}` : ""} — ${address?.neighborhood}, ${address?.city}/${address?.state}`}</p>
                <p className="mt-1 text-sm font-semibold">{when === "scheduled" ? "Agendado: " : "Previsão: "}{etaText}</p>
              </Review>
              <Review title="Contato" onEdit={() => setStep(0)}>
                <p className="text-sm">{contact.name} · {maskPhone(contact.phone)} · {contact.email}</p>
              </Review>
              <Review title="Pagamento" onEdit={() => setStep(3)}>
                <p className="text-sm">{METHOD_INFO[method].label}{card ? ` · ${card.brand} final ${card.last_four}` : ""}{card && card.installments > 1 ? ` em ${card.installments}x` : ""}
                  {method === "cash" && needChange ? ` · troco para ${money(changeCents)} (troco ${money(changeCents - totalCents)})` : method === "cash" ? " · sem troco" : ""}</p>
                {online && <p className="mt-1 text-xs text-ink-muted">{method === "pix" ? "O QR Code aparece na próxima tela." : method === "wallet" ? "Você será levado ao Mercado Pago para pagar." : "A cobrança é feita ao confirmar."}</p>}
              </Review>
              <label className="flex min-h-11 items-start gap-s2 text-sm">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]" checked={notifyWa} onChange={(e) => setNotifyWa(e.target.checked)} />
                Quero receber atualizações do pedido pelo WhatsApp
              </label>
              {submitError && <p role="alert" className="flex items-center gap-s2 rounded-sm bg-error px-s3 py-s3 text-sm font-semibold text-ink-inverse"><IconAlert size={20} /> {submitError}</p>}
              <button className="btn btn-primary min-h-14 text-lg" onClick={confirm} disabled={submitting || quoting || !quote || (quote?.errors.length ?? 0) > 0}>
                {submitting ? <><Spinner /> Enviando pedido…</> : <>Confirmar meu pedido · {money(totalCents)}</>}
              </button>
              <p className="text-center text-xs text-ink-muted">Ao confirmar, você concorda com nossa <Link href="/privacidade" className="underline">política de privacidade</Link>.</p>
            </div>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-[calc(var(--header-height)+24px)] lg:self-start">
        <h2 className="text-h4 mb-s3">Resumo</h2>
        <Totals quote={quote} loading={quoting} />
        {quote?.errors.map((e) => <p key={e} className="field-error mt-s2">{e}</p>)}
      </aside>
    </div>
  );
}

function Choice({ on, onClick, icon, title, text, disabled }: { on: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string; disabled?: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} disabled={disabled}
      className={`flex min-h-16 items-center gap-s3 rounded-md border-2 p-s3 text-left transition-colors duration-fast disabled:opacity-50 ${on ? "border-primary bg-surface shadow-md" : "border-line bg-surface"}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${on ? "bg-primary text-ink-inverse" : "bg-secondary/50"}`}>{icon}</span>
      <span className="flex-1"><strong className="block">{title}</strong><span className="text-sm text-ink-muted">{text}</span></span>
      <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${on ? "border-primary bg-primary text-ink-inverse" : "border-line"}`}>{on && <IconCheck size={14} />}</span>
    </button>
  );
}

function Review({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-md bg-surface p-s3">
      <div className="mb-s2 flex items-center justify-between">
        <h3 className="font-body text-sm font-bold normal-case tracking-normal">{title}</h3>
        <button className="min-h-11 px-s2 text-sm font-bold text-primary underline-offset-4 hover:underline" onClick={onEdit}>Alterar</button>
      </div>
      {children}
    </section>
  );
}
