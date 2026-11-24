"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { create } from "zustand";
import { gsap } from "gsap";
import { IconAlert, IconCheck, IconMinus, IconPlus, IconX } from "./icons";
import { money } from "@/lib/format";

/* ---------------------------------------------------------------- toasts */
type Toast = { id: number; kind: "success" | "error" | "info"; text: string };
type ToastState = { toasts: Toast[]; push: (kind: Toast["kind"], text: string) => void; drop: (id: number) => void };

export const useToast = create<ToastState>()((set) => ({
  toasts: [],
  push: (kind, text) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, kind, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  drop: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (t: string) => useToast.getState().push("success", t),
  error: (t: string) => useToast.getState().push("error", t),
  info: (t: string) => useToast.getState().push("info", t),
};

export function Toaster() {
  const { toasts, drop } = useToast();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(var(--header-height)+8px)] z-[70] flex flex-col items-center gap-s2 px-s3">
      {toasts.map((t) => (
        <div key={t.id} role={t.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex w-full max-w-md items-start gap-s2 rounded-sm px-s3 py-s3 font-semibold shadow-lg animate-[toastIn_.3s_var(--ease-out)] ${
            t.kind === "error" ? "bg-error text-ink-inverse" : t.kind === "success" ? "bg-success text-ink-inverse" : "bg-surface-dark text-ink-inverse"}`}>
          {t.kind === "error" ? <IconAlert size={20} /> : <IconCheck size={20} />}
          <span className="flex-1 text-sm">{t.text}</span>
          <button onClick={() => drop(t.id)} aria-label="Fechar aviso" className="-m-1 p-1"><IconX size={18} /></button>
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(-12px)}}`}</style>
    </div>
  );
}

/* ---------------------------------------------------------------- valor animado */
export function AnimatedMoney({ cents, className = "" }: { cents: number; className?: string }) {
  const [shown, setShown] = useState(cents);
  const ref = useRef({ v: cents });
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(cents); ref.current.v = cents; return; }
    const tw = gsap.to(ref.current, { v: cents, duration: 0.45, ease: "power3.out", onUpdate: () => setShown(Math.round(ref.current.v)) });
    return () => { tw.kill(); };
  }, [cents]);
  return <span className={`tabular-nums ${className}`}>{money(shown)}</span>;
}

/* ---------------------------------------------------------------- quantidade */
export function Stepper({ value, onChange, min = 1, max = 50, label, size = "md" }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; size?: "sm" | "md";
}) {
  const s = size === "sm" ? "h-11 w-11" : "h-12 w-12";
  return (
    <div className="inline-flex items-center rounded-sm border-2 border-ink bg-surface" role="group" aria-label={label}>
      <button type="button" className={`${s} flex items-center justify-center disabled:opacity-40`} onClick={() => onChange(value - 1)}
        disabled={value <= min} aria-label={value - 1 < 1 ? "Remover" : "Diminuir quantidade"}>
        <IconMinus size={18} />
      </button>
      <span className="min-w-7 text-center font-bold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className={`${s} flex items-center justify-center disabled:opacity-40`} onClick={() => onChange(value + 1)}
        disabled={value >= max} aria-label="Aumentar quantidade">
        <IconPlus size={18} />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- modal / bottom sheet */
export function Sheet({ open, onClose, label, children, side = "auto", footer }: {
  open: boolean; onClose: () => void; label: string; children: ReactNode; footer?: ReactNode;
  side?: "auto" | "right";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const last = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    last.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if (panel.current && !reduce) {
      gsap.fromTo(panel.current,
        side === "right" && !mobile ? { x: 60, opacity: 0 } : mobile ? { y: 80, opacity: 0 } : { y: 24, scale: 0.98, opacity: 0 },
        { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.35, ease: "power3.out" });
    }
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea,select,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], end = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
        else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      last.current?.focus?.();
    };
  }, [open, onClose, side]);

  if (!open) return null;
  const pos = side === "right"
    ? "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-none md:w-[440px] md:rounded-none"
    : "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[88vh] md:w-[720px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg";
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-surface-dark/60" onClick={onClose} aria-hidden="true" />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        className={`absolute flex flex-col overflow-hidden bg-bg shadow-lg outline-none ${pos}`}>
        <div className="mx-auto mt-s2 h-1.5 w-12 shrink-0 rounded-full bg-line md:hidden" aria-hidden="true" />
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="shrink-0 border-t-2 border-line bg-surface p-s3 pb-[max(var(--space-3),env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

export function CloseButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} aria-label="Fechar" className={`flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-md ${className}`}>
      <IconX size={22} />
    </button>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-s3 px-s4 py-s7 text-center">
      <p className="font-display text-h4 uppercase">{title}</p>
      <p className="max-w-sm text-ink-muted">{text}</p>
      {action}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-5 w-5 animate-spin rounded-full border-[3px] border-current border-r-transparent ${className}`} aria-hidden="true" />;
}
