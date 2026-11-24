"use client";

import Link from "next/link";
import { useProfile } from "@/store/profile";
import { useHydrated } from "@/components/Providers";
import { maskCep, maskPhone } from "@/lib/format";
import { toast } from "@/components/ui";

export default function ContaPage() {
  const hydrated = useHydrated();
  const p = useProfile();
  if (!hydrated) return <div className="container-app max-w-2xl py-s6"><div className="skeleton h-40 w-full" /></div>;
  return (
    <div className="container-app flex max-w-2xl flex-col gap-s4 py-s5 pb-s8">
      <h1 className="text-h2">Minha conta</h1>
      <p className="text-sm text-ink-muted">Você pode pedir sem cadastro. Os dados abaixo ficam salvos só neste aparelho para agilizar o próximo pedido.</p>
      <section className="rounded-md bg-surface p-s4">
        <h2 className="font-body text-sm font-bold normal-case tracking-normal">Contato</h2>
        {p.name ? <p className="mt-1">{p.name}<br />{maskPhone(p.phone)}<br />{p.email}</p> : <p className="mt-1 text-ink-muted">Nenhum dado salvo.</p>}
      </section>
      <section className="rounded-md bg-surface p-s4">
        <h2 className="font-body text-sm font-bold normal-case tracking-normal">Endereço</h2>
        {p.address ? <p className="mt-1">{p.address.street}, {p.address.number} — {p.address.neighborhood}<br />{p.address.city}/{p.address.state} · {maskCep(p.address.cep)}</p> : <p className="mt-1 text-ink-muted">Nenhum endereço salvo.</p>}
      </section>
      <section className="rounded-md bg-surface p-s4">
        <h2 className="font-body text-sm font-bold normal-case tracking-normal">Privacidade</h2>
        <label className="mt-s2 flex min-h-11 items-center gap-s2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-[var(--color-primary)]" checked={p.remember} onChange={(e) => p.setRemember(e.target.checked)} />
          Lembrar meus dados neste aparelho
        </label>
        <label className="flex min-h-11 items-center gap-s2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-[var(--color-primary)]" checked={p.consent === "granted"} onChange={(e) => p.setConsent(e.target.checked ? "granted" : "denied")} />
          Permitir cookies de medição (Google e Meta)
        </label>
        <button className="btn btn-secondary mt-s3 w-full" onClick={() => { p.forget(); toast.success("Dados apagados deste aparelho"); }}>Apagar meus dados deste aparelho</button>
      </section>
      <Link href="/pedidos" className="btn btn-primary">Ver meus pedidos</Link>
    </div>
  );
}
