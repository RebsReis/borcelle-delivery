"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { OrderT } from "@/lib/types";
import { useProfile } from "@/store/profile";
import { useHydrated } from "@/components/Providers";
import { EmptyState } from "@/components/ui";
import { IconChevron } from "@/components/icons";

const LABEL: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento", received: "Recebido", confirmed: "Confirmado", preparing: "Em preparação",
  ready: "Pronto", out_for_delivery: "A caminho", delivered: "Entregue", cancelled: "Cancelado",
};

export default function PedidosPage() {
  const hydrated = useHydrated();
  const orders = useProfile((s) => s.orders);
  const [live, setLive] = useState<Record<string, OrderT>>({});
  useEffect(() => {
    if (!hydrated) return;
    orders.slice(0, 10).forEach((o) => api.order(o.public_id).then((d) => setLive((s) => ({ ...s, [o.public_id]: d }))).catch(() => {}));
  }, [hydrated, orders]);

  return (
    <div className="container-app max-w-2xl py-s5 pb-s8">
      <h1 className="text-h2 mb-s2">Meus pedidos</h1>
      <p className="mb-s4 text-sm text-ink-muted">Pedidos feitos neste aparelho.</p>
      {!hydrated ? <div className="skeleton h-24 w-full" /> : orders.length === 0 ? (
        <EmptyState title="Nenhum pedido ainda" text="Quando você pedir, ele aparece aqui para acompanhar." action={<Link href="/cardapio" className="btn btn-primary">Fazer meu pedido</Link>} />
      ) : (
        <ul className="flex flex-col gap-s2">
          {orders.map((o) => {
            const d = live[o.public_id];
            return (
              <li key={o.public_id}>
                <Link href={`/pedido/${o.public_id}`} className="flex items-center gap-s3 rounded-md bg-surface p-s4 shadow-sm">
                  <span className="flex-1">
                    <strong className="block">Pedido #{o.number}</strong>
                    <span className="text-sm text-ink-muted">{new Date(o.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {money(o.total_cents)}</span>
                  </span>
                  {d ? <span className={`rounded-full px-s2 py-1 text-xs font-bold uppercase ${d.status === "cancelled" ? "bg-error text-ink-inverse" : d.status === "delivered" ? "bg-line" : "bg-accent text-ink"}`}>{LABEL[d.status]}</span> : <span className="skeleton h-6 w-20" />}
                  <IconChevron size={20} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
