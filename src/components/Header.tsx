"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { maskCep, money, time } from "@/lib/format";
import { cartCount, cartSubtotal, useCart, useUi } from "@/store/cart";
import { Logo } from "./Brand";
import { IconBag, IconHome, IconMenu, IconPin, IconReceipt, IconStore, IconUser } from "./icons";
import { SandboxBanner, useData, useHydrated } from "./Providers";
import { AnimatedMoney, CloseButton, Sheet, Spinner } from "./ui";

export function StoreStatus({ className = "" }: { className?: string }) {
  const { store } = useData();
  const fulfillment = useCart((s) => s.fulfillment);
  const location = useCart((s) => s.location);
  if (!store) return <span className={`skeleton h-6 w-32 ${className}`} />;
  const eta = fulfillment === "pickup"
    ? `${store.pickup_eta_minutes} min`
    : location?.served && location.eta_min_minutes
      ? `${location.eta_min_minutes}–${location.eta_max_minutes} min`
      : `${store.delivery_eta_min}–${store.delivery_eta_max} min`;
  return (
    <span className={`inline-flex items-center gap-s2 text-sm font-semibold ${className}`}>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${store.is_open ? "bg-success text-ink-inverse" : "bg-ink text-ink-inverse"}`}>
        <span className={`h-2 w-2 rounded-full ${store.is_open ? "bg-ink-inverse" : "bg-secondary"}`} aria-hidden="true" />
        {store.is_open ? "Aberto" : "Fechado"}
      </span>
      {store.is_open ? (
        <span className="text-ink-muted">{fulfillment === "pickup" ? "Retirada" : "Entrega"} em {eta}</span>
      ) : (
        <span className="text-ink-muted">{store.next_opening ? `Abre às ${time(store.next_opening)}` : store.pause_message || "Pedidos pausados"}</span>
      )}
    </span>
  );
}

export function Header() {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const location = useCart((s) => s.location);
  const fulfillment = useCart((s) => s.fulfillment);
  const openLocation = useUi((s) => s.openLocation);
  const openCart = useUi((s) => s.openCart);
  const router = useRouter();
  const count = hydrated ? cartCount(items) : 0;
  const subtotal = hydrated ? cartSubtotal(items) : 0;

  const onCart = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) openCart(true);
    else router.push("/carrinho");
  };

  const place = !hydrated ? "Onde você está?" : fulfillment === "pickup" ? "Retirar no balcão" : location ? location.neighborhood || maskCep(location.cep) : "Informe seu CEP";

  return (
    <header className="sticky top-0 z-40 bg-bg/95 backdrop-blur-sm">
      <SandboxBanner />
      <div className="container-app flex h-[var(--header-height)] items-center gap-s3 border-b-2 border-line">
        <Link href="/" className="shrink-0" aria-label="Início — Borcelle Hamburgueria"><Logo compact /></Link>

        <div className="hidden min-w-0 flex-col xl:flex">
          <StoreStatus className="whitespace-nowrap" />
        </div>

        <nav aria-label="Principal" className="ml-auto hidden items-center lg:flex [&_a]:whitespace-nowrap [&_a]:px-s2 [&_a]:text-sm">
          <Link href="/cardapio" className="btn-ghost btn">Cardápio</Link>
          <Link href="/cardapio#promocoes" className="btn-ghost btn">Promoções</Link>
          <Link href="/cardapio#combos" className="btn-ghost btn">Combos</Link>
          <Link href="/pedidos" className="btn-ghost btn">Meus pedidos</Link>
        </nav>

        <button onClick={() => openLocation(true)} className="ml-auto flex min-h-11 min-w-0 items-center gap-1 rounded-full px-s2 text-sm font-semibold lg:ml-0"
          aria-label={`Localização: ${place}. Alterar`}>
          {fulfillment === "pickup" ? <IconStore size={20} /> : <IconPin size={20} />}
          <span className="max-w-[110px] truncate md:max-w-[180px]">{place}</span>
        </button>

        <Link href="/conta" className="hidden h-11 w-11 items-center justify-center rounded-full md:flex" aria-label="Minha conta"><IconUser /></Link>

        <button onClick={onCart} className="relative flex min-h-11 items-center gap-s2 rounded-sm bg-primary px-s3 text-ink-inverse shadow-cta"
          aria-label={`Carrinho: ${count} ${count === 1 ? "item" : "itens"}, ${money(subtotal)}`} data-cart-target>
          <IconBag size={22} />
          <span className="hidden font-bold sm:inline"><AnimatedMoney cents={subtotal} /></span>
          {count > 0 && (
            <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1 text-xs font-extrabold text-ink" aria-hidden="true">{count}</span>
          )}
        </button>
      </div>
      <div className="container-app flex h-9 items-center border-b border-line xl:hidden">
        <StoreStatus />
      </div>
      <LocationDialog />
    </header>
  );
}

function LocationDialog() {
  const open = useUi((s) => s.locationOpen);
  const setOpen = useUi((s) => s.openLocation);
  const { store } = useData();
  const { location, setLocation, fulfillment, setFulfillment } = useCart();
  const [cep, setCep] = useState(location?.cep ? maskCep(location.cep) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (cep.replace(/\D/g, "").length !== 8) return setError("Digite os 8 números do CEP.");
    setLoading(true);
    try {
      const r = await api.cep(cep);
      setLocation(r);
      if (r.served) {
        setFulfillment("delivery");
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível consultar o CEP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onClose={() => setOpen(false)} label="Onde você está?">
      <div className="p-s4">
        <div className="mb-s4 flex items-start justify-between gap-s3">
          <h2 className="text-h4">Como você quer receber?</h2>
          <CloseButton onClick={() => setOpen(false)} />
        </div>
        <form onSubmit={check} className="flex flex-col gap-s3">
          <div className="field">
            <label htmlFor="loc-cep">CEP para entrega</label>
            <div className="flex gap-s2">
              <input id="loc-cep" className="input" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000"
                value={cep} onChange={(e) => setCep(maskCep(e.target.value))} aria-invalid={!!error} aria-describedby="loc-err" />
              <button className="btn btn-primary shrink-0" disabled={loading}>{loading ? <Spinner /> : "Consultar"}</button>
            </div>
            {error && <p id="loc-err" className="field-error">{error}</p>}
          </div>
        </form>
        {location && !error && (
          <div className={`mt-s3 rounded-sm p-s3 ${location.served ? "bg-surface" : "bg-secondary/40"}`} role="status">
            {location.served ? (
              <p className="text-sm"><strong>{location.zone_name}</strong> · {location.neighborhood} — taxa {money(location.fee_cents ?? 0)}, {location.eta_min_minutes}–{location.eta_max_minutes} min</p>
            ) : (
              <p className="text-sm font-semibold">Ainda não entregamos em {location.neighborhood || maskCep(location.cep)}. Você pode retirar no balcão.</p>
            )}
          </div>
        )}
        {store?.pickup_enabled && (
          <button className={`btn mt-s4 w-full ${fulfillment === "pickup" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => { setFulfillment("pickup"); setOpen(false); }}>
            <IconStore size={20} /> Vou retirar no balcão
          </button>
        )}
        {store?.address && <p className="mt-s2 text-center text-xs text-ink-muted">{store.address}</p>}
      </div>
    </Sheet>
  );
}

export function BottomNav() {
  const path = usePathname();
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const count = hydrated ? cartCount(items) : 0;
  const subtotal = hydrated ? cartSubtotal(items) : 0;
  const hideBar = path.startsWith("/carrinho") || path.startsWith("/checkout");
  const tabs = [
    { href: "/", label: "Início", icon: IconHome },
    { href: "/cardapio", label: "Cardápio", icon: IconMenu },
    { href: "/pedidos", label: "Pedidos", icon: IconReceipt },
    { href: "/conta", label: "Conta", icon: IconUser },
  ];
  if (path.startsWith("/checkout")) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      {count > 0 && !hideBar && (
        <Link href="/carrinho" className="mx-s3 mb-s2 flex min-h-14 items-center gap-s3 rounded-md bg-primary px-s4 text-ink-inverse shadow-cta">
          <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-ink-inverse px-2 text-sm font-extrabold text-primary">{count}</span>
          <span className="flex-1 font-display text-xl uppercase">Ver pedido</span>
          <AnimatedMoney cents={subtotal} className="font-bold" />
        </Link>
      )}
      <nav aria-label="Navegação inferior" className="grid h-[var(--bottom-nav-height)] grid-cols-4 border-t-2 border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs font-semibold ${active ? "text-primary" : "text-ink-muted"}`}>
              <t.icon size={22} />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
