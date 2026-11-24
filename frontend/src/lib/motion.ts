"use client";

import { gsap } from "gsap";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Animação "voar até o carrinho" a partir do elemento clicado. */
export function flyToCart(from: Element | null) {
  if (!from || reduced()) return bumpCart();
  const target = document.querySelector("[data-cart-target]") ?? document.querySelector("[data-cartbar]");
  if (!target) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dot = document.createElement("div");
  dot.setAttribute("aria-hidden", "true");
  Object.assign(dot.style, {
    position: "fixed", left: `${a.left + a.width / 2 - 14}px`, top: `${a.top + a.height / 2 - 14}px`,
    width: "28px", height: "28px", borderRadius: "9999px", background: "var(--color-primary)",
    zIndex: "80", pointerEvents: "none", boxShadow: "var(--shadow-cta)",
  });
  document.body.appendChild(dot);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  gsap.timeline({ onComplete: () => { dot.remove(); bumpCart(); } })
    .to(dot, { x: dx, duration: 0.6, ease: "power1.inOut" }, 0)
    .to(dot, { y: dy, duration: 0.6, ease: "back.in(1.4)" }, 0)
    .to(dot, { scale: 0.4, opacity: 0.6, duration: 0.6 }, 0);
}

export function bumpCart() {
  const el = document.querySelector("[data-cart-target]");
  if (!el || reduced()) return;
  gsap.fromTo(el, { scale: 1 }, { scale: 1.12, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" });
}
