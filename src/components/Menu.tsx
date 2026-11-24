"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { ProductT } from "@/lib/types";
import { money } from "@/lib/format";
import { track } from "@/lib/analytics";
import { flyToCart } from "@/lib/motion";
import { cartCount, useCart, useUi } from "@/store/cart";
import { ProductImage } from "./Brand";
import { IconPlus, IconSearch, IconX } from "./icons";
import { useData, useHydrated } from "./Providers";
import { EmptyState, Stepper, toast } from "./ui";

type Section = { slug: string; name: string; products: ProductT[] };

export const isSimple = (p: ProductT) => p.option_groups.every((g) => g.min_select === 0);

export function useSections(query: string): Section[] {
  const { menu } = useData();
  return useMemo(() => {
    if (!menu) return [];
    const q = query.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const match = (p: ProductT) => !q || norm(`${p.name} ${p.description} ${p.ingredients.join(" ")}`).includes(q);
    const list = menu.products.filter(match);
    const sections: Section[] = [
      { slug: "mais-vendidos", name: "Mais vendidos", products: list.filter((p) => p.badge === "best_seller") },
      { slug: "promocoes", name: "Promoções", products: list.filter((p) => p.promo_price_cents !== null) },
      ...menu.categories.map((c) => ({ slug: c.slug, name: c.name, products: list.filter((p) => p.category_slug === c.slug) })),
    ];
    return sections.filter((s) => s.products.length > 0);
  }, [menu, query]);
}

export function Menu({ heading = true }: { heading?: boolean }) {
  const { menu, menuError, reloadMenu, store } = useData();
  const [query, setQuery] = useState("");
  const sections = useSections(query);
  const [active, setActive] = useState<string>("");
  const navRef = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);

  // Scrollspy: destaca a categoria visível
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.slug)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  useEffect(() => {
    const chip = navRef.current?.querySelector<HTMLElement>(`[data-slug="${active}"]`);
    chip?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ScrollTrigger.batch("[data-card]", {
      start: "top 92%",
      once: true,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 32 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "expo.out", overwrite: true }),
    });
    gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) =>
      gsap.from(el, { yPercent: 100, opacity: 0, duration: 0.7, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } }));
  }, { scope: root, dependencies: [sections.length, !!menu] });

  const go = (slug: string) => {
    const el = document.getElementById(slug);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setActive(slug);
  };

  const recommended = (menu?.products ?? []).filter((p) => p.is_recommended && p.is_available).slice(0, 6);

  return (
    <section ref={root} id="cardapio" className="pb-s8" aria-labelledby="menu-title">
      <div className="container-app pt-s6">
        {heading && (
          <div className="mb-s4 overflow-hidden">
            <h2 id="menu-title" data-reveal className="text-h2">O cardápio</h2>
          </div>
        )}
        {!heading && <h1 id="menu-title" className="text-h2 mb-s3">Cardápio</h1>}
        {store && !store.is_open && (
          <p className="mb-s4 rounded-sm bg-surface-dark px-s3 py-s3 text-sm font-semibold text-ink-inverse" role="status">
            Estamos fechados agora. {store.accept_scheduled ? "Monte seu pedido e agende para quando abrirmos." : "Volte no nosso horário de funcionamento."}
          </p>
        )}
        <label className="relative block">
          <span className="sr-only">Buscar no cardápio</span>
          <IconSearch className="pointer-events-none absolute left-s3 top-1/2 -translate-y-1/2 text-ink-muted" size={20} />
          <input type="search" className="input pl-11" placeholder="Buscar hambúrguer, bacon, batata…" value={query}
            onChange={(e) => setQuery(e.target.value)} enterKeyHint="search" />
          {query && (
            <button className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center" onClick={() => setQuery("")} aria-label="Limpar busca">
              <IconX size={18} />
            </button>
          )}
        </label>
      </div>

      <div className="sticky top-[calc(var(--header-height)+36px)] z-30 mt-s3 border-y-2 border-line bg-bg/95 backdrop-blur-sm lg:top-[var(--header-height)]">
        <div ref={navRef} className="container-app no-scrollbar flex gap-s2 overflow-x-auto py-s2" role="navigation" aria-label="Categorias">
          {!menu && Array.from({ length: 6 }).map((_, i) => <span key={i} className="skeleton h-11 w-32 shrink-0 rounded-full" />)}
          {sections.map((s) => (
            <button key={s.slug} data-slug={s.slug} className="chip" aria-current={active === s.slug ? "true" : undefined} onClick={() => go(s.slug)}>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="container-app">
        {menuError && <EmptyState title="Cardápio indisponível" text="Não conseguimos carregar o cardápio agora." action={<button className="btn btn-primary" onClick={reloadMenu}>Tentar de novo</button>} />}
        {!menu && !menuError && <MenuSkeleton />}
        {menu && sections.length === 0 && (
          <EmptyState title="Nada por aqui" text={`Não encontramos “${query}”. Tente outro ingrediente ou nome.`} action={<button className="btn btn-secondary" onClick={() => setQuery("")}>Limpar busca</button>} />
        )}

        {menu && !query && recommended.length > 0 && (
          <div className="mt-s6">
            <h3 className="text-h4 mb-s3">Recomendados pra você</h3>
            <div className="no-scrollbar -mx-[var(--container-padding)] flex snap-x gap-s3 overflow-x-auto px-[var(--container-padding)] pb-s2">
              {recommended.map((p) => <div key={p.id} className="w-[220px] shrink-0 snap-start"><ProductCard product={p} compact /></div>)}
            </div>
          </div>
        )}

        {sections.map((s) => (
          <section key={s.slug} id={s.slug} className="scroll-mt-[150px] pt-s6" aria-labelledby={`h-${s.slug}`}>
            <div className="mb-s3 overflow-hidden"><h3 id={`h-${s.slug}`} data-reveal className="text-h3">{s.name}</h3></div>
            <div className="grid grid-cols-1 gap-s3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {s.products.map((p) => <ProductCard key={`${s.slug}-${p.id}`} product={p} />)}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function MenuSkeleton() {
  return (
    <div className="mt-s6 grid grid-cols-1 gap-s3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Carregando cardápio">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-s3 rounded-md bg-surface p-s3 sm:flex-col">
          <div className="skeleton aspect-square w-28 shrink-0 sm:w-full" />
          <div className="flex flex-1 flex-col gap-s2"><div className="skeleton h-6 w-3/4" /><div className="skeleton h-4 w-full" /><div className="skeleton h-5 w-1/3" /></div>
        </div>
      ))}
    </div>
  );
}

export function Price({ p, className = "" }: { p: ProductT; className?: string }) {
  return p.promo_price_cents !== null ? (
    <span className={`flex items-baseline gap-s2 ${className}`}>
      <strong className="text-lg text-primary">{money(p.promo_price_cents)}</strong>
      <s className="text-sm text-ink-muted">{money(p.price_cents)}</s>
    </span>
  ) : (
    <strong className={`text-lg ${className}`}>{money(p.price_cents)}</strong>
  );
}

export function Badge({ badge }: { badge: ProductT["badge"] }) {
  if (!badge) return null;
  return (
    <span className={`ticket text-label absolute left-s2 top-s2 z-10 px-s3 py-1 ${badge === "best_seller" ? "bg-primary text-ink-inverse" : "bg-accent text-ink"}`}>
      {badge === "best_seller" ? "Mais vendido" : "Novidade"}
    </span>
  );
}

export function ProductCard({ product: p, compact = false }: { product: ProductT; compact?: boolean }) {
  const hydrated = useHydrated();
  const openSheet = useUi((s) => s.openSheet);
  const { add, items, setQty } = useCart();
  const simple = isSimple(p);
  const inCart = hydrated && simple ? items.find((i) => i.product_id === p.id && i.options.length === 0 && !i.notes) : undefined;
  const btn = useRef<HTMLButtonElement>(null);

  const quickAdd = () => {
    if (!simple) return openSheet(p);
    add(p, [], "", 1);
    flyToCart(btn.current);
    track.addToCart({ item_id: p.id, item_name: p.name, price: (p.promo_price_cents ?? p.price_cents) / 100, quantity: 1, item_category: p.category_slug });
    toast.success(`${p.name} adicionado`);
  };

  return (
    <article data-card className={`group relative flex overflow-hidden rounded-md bg-surface shadow-sm transition-shadow duration-normal hover:shadow-lg ${compact ? "flex-col" : "flex-row sm:flex-col"} ${!p.is_available ? "opacity-70" : ""}`}>
      <button className={`relative shrink-0 overflow-hidden text-left ${compact ? "w-full" : "w-32 sm:w-full"}`} onClick={() => openSheet(p)} aria-label={`Ver detalhes de ${p.name}`}>
        <Badge badge={p.badge} />
        <ProductImage src={p.image_url} alt={p.name} className="aspect-square w-full transition-transform duration-[400ms] ease-out group-hover:scale-105" />
        {!p.is_available && <span className="absolute inset-x-0 bottom-0 bg-surface-dark/85 py-1 text-center text-xs font-bold uppercase text-ink-inverse">Indisponível</span>}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-s1 p-s3">
        <h4 className="font-display text-xl uppercase leading-tight">
          <button onClick={() => openSheet(p)} className="text-left hover:text-primary">{p.name}</button>
        </h4>
        {!compact && <p className="line-clamp-2 text-sm text-ink-muted">{p.description}</p>}
        <div className={`mt-auto flex items-center justify-between gap-s2 pt-s2 ${compact ? "flex-wrap" : ""}`}>
          <Price p={p} />
          {p.is_available && (inCart ? (
            <Stepper size="sm" label={`Quantidade de ${p.name}`} value={inCart.quantity} min={0} onChange={(v) => setQty(inCart.key, v)} />
          ) : (
            <button ref={btn} onClick={quickAdd} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-primary text-ink-inverse shadow-cta transition-transform duration-fast hover:scale-[1.04] active:scale-[.97]"
              aria-label={simple ? `Adicionar ${p.name} ao carrinho` : `Personalizar e adicionar ${p.name}`}>
              <IconPlus size={22} />
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

export function useCartCount() {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  return hydrated ? cartCount(items) : 0;
}
