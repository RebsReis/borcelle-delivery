"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { money } from "@/lib/format";
import { useCart, useUi } from "@/store/cart";
import { BurgerArt } from "./Brand";
import { IconArrow, IconBike, IconClock, IconStore } from "./icons";
import { useData } from "./Providers";

export function Hero({ heroImage }: { heroImage: string | null }) {
  const root = useRef<HTMLElement>(null);
  const { store, menu } = useData();
  const openSheet = useUi((s) => s.openSheet);
  const setFulfillment = useCart((s) => s.setFulfillment);
  const offer = menu?.products.find((p) => p.is_featured && p.promo_price_cents && p.is_available);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add({ reduce: "(prefers-reduced-motion: reduce)", mobile: "(max-width: 767px)" }, (ctx) => {
      const { reduce, mobile } = ctx.conditions as { reduce: boolean; mobile: boolean };
      if (reduce) {
        gsap.from("[data-hero]", { opacity: 0, duration: 0.15 });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from("[data-hero='bgtype']", { opacity: 0, y: 40, duration: 0.6 }, 0.15)
        .from("[data-hero='line'] > span", { yPercent: 110, duration: 0.8, stagger: 0.08 }, 0.25)
        .from("[data-hero='burger']", { opacity: 0, scale: 0.92, x: mobile ? 20 : 60, duration: 1 }, 0.35)
        .from("[data-hero='ticket']", { opacity: 0, scale: 1.3, rotate: -8, duration: 0.5, ease: "back.out(2)" }, 0.75)
        .from("[data-hero='copy']", { opacity: 0, y: 32, duration: 0.6, stagger: 0.08 }, 0.65);
      if (!mobile) {
        gsap.to("[data-hero='bgtype']", {
          yPercent: -15, ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
        });
        gsap.to("[data-hero='burger']", {
          yPercent: 8, ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
        });
      }
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <section ref={root} className="relative overflow-hidden" aria-labelledby="hero-title">
      <div className="container-app relative grid grid-cols-1 items-center gap-s3 pb-s5 pt-s3 md:min-h-[620px] md:grid-cols-12 md:gap-s4 md:py-s7">
        {/* Tipografia gigante ao fundo */}
        <div data-hero="bgtype" aria-hidden="true"
          className="bg-type grunge absolute -left-4 top-1/2 hidden -translate-y-1/2 md:block">HAMBURGUER</div>
        <div data-hero="bgtype" aria-hidden="true" className="bg-type grunge absolute -left-2 top-s2 text-[150px] md:hidden">BURGER</div>

        <div className="relative z-10 order-2 md:order-1 md:col-span-6 lg:col-span-5">
          <p data-hero="copy" className="text-label mb-s2 text-primary">Hamburgueria artesanal · Delivery</p>
          <h1 id="hero-title" className="text-display grunge">
            <span data-hero="line" className="block overflow-hidden"><span className="block">Fome de</span></span>
            <span data-hero="line" className="block overflow-hidden text-primary"><span className="block">verdade.</span></span>
          </h1>
          <p data-hero="copy" className="mt-s3 max-w-md text-[length:var(--font-size-body-lg)] text-ink-muted">
            Hambúrguer artesanal, ingredientes selecionados e muito sabor.
          </p>
          <div data-hero="copy" className="mt-s4 grid grid-cols-2 gap-s2 sm:flex [&_.btn]:px-s3 sm:[&_.btn]:px-s5">
            <Link href="#cardapio" className="btn btn-primary">Fazer meu pedido <IconArrow size={20} /></Link>
            <Link href="/cardapio" className="btn btn-secondary">Ver cardápio</Link>
          </div>
          {store && (
            <ul data-hero="copy" className="mt-s4 flex flex-wrap gap-x-s4 gap-y-s2 text-sm font-semibold">
              {store.delivery_enabled && <li className="inline-flex items-center gap-1"><IconBike size={18} /> Entrega {store.delivery_eta_min}–{store.delivery_eta_max} min</li>}
              {store.pickup_enabled && (
                <li><button className="inline-flex min-h-11 items-center gap-1 underline-offset-4 hover:underline" onClick={() => setFulfillment("pickup")}>
                  <IconStore size={18} /> Retirada em {store.pickup_eta_minutes} min</button></li>
              )}
              {store.min_order_cents > 0 && <li className="inline-flex items-center gap-1"><IconClock size={18} /> Pedido mínimo {money(store.min_order_cents)}</li>}
            </ul>
          )}
        </div>

        <div className="relative order-1 -mx-[var(--container-padding)] h-[230px] overflow-hidden md:order-2 md:col-span-6 md:mx-0 md:h-auto md:overflow-visible lg:col-span-7">
          <div data-hero="burger" className="relative ml-[22%] w-[95%] md:ml-0 md:w-auto md:-mr-[18%]">
            {heroImage ? (
              <Image src={heroImage} alt="Double Bacon com cheddar derretido" width={1200} height={900} priority
                sizes="(max-width: 768px) 100vw, 60vw" className="h-auto w-full drop-shadow-[0_30px_40px_rgba(50,27,19,.3)]" />
            ) : (
              <BurgerArt className="h-auto w-full max-w-[720px] drop-shadow-[0_30px_40px_rgba(50,27,19,.25)]" />
            )}
          </div>
          {offer && (
            <button data-hero="ticket" onClick={() => openSheet(offer)}
              className="ticket absolute bottom-s3 right-[var(--container-padding)] z-10 bg-primary px-s4 py-s2 text-left text-ink-inverse shadow-cta md:bottom-[8%] md:left-[4%] md:right-auto md:px-s5 md:py-s3"
              aria-label={`Oferta: ${offer.name} por ${money(offer.promo_price_cents!)}`}>
              <span className="text-label hidden opacity-90 md:block">Oferta da casa</span>
              <span className="font-display block text-2xl uppercase leading-none md:text-h4">Peça já</span>
              <span className="mt-1 block text-xs font-semibold md:text-sm"><span className="hidden md:inline">{offer.name} · </span><s className="opacity-70">{money(offer.price_cents)}</s> <strong>{money(offer.promo_price_cents!)}</strong></span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function Marquee() {
  const words = ["Artesanal", "Suculento", "Original", "Feito na chapa", "Sem miséria"];
  const row = [...words, ...words, ...words];
  return (
    <div className="relative bg-primary text-ink-inverse" aria-hidden="true">
      <div className="checkerboard h-2 opacity-90" />
      <div className="marquee">
        <div className="marquee-track font-display text-2xl uppercase">
          {[...row, ...row].map((w, i) => (
            <span key={i} className="flex items-center gap-s5">{w}<span className="text-accent">✦</span></span>
          ))}
        </div>
      </div>
      <div className="checkerboard h-2 opacity-90" />
    </div>
  );
}
