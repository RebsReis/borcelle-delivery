import type { Metadata } from "next";
import { Tracking } from "@/components/order/Tracking";

export const metadata: Metadata = { title: "Acompanhar pedido", robots: { index: false } };

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Tracking id={id} />;
}
