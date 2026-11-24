"use client";

import { useRouter } from "next/navigation";
import { CartContents } from "@/components/Cart";

export default function CarrinhoPage() {
  const router = useRouter();
  return (
    <div className="container-app max-w-2xl py-s5 pb-s8">
      <h1 className="text-h2 mb-s4">Seu pedido</h1>
      <CartContents onCheckout={() => router.push("/checkout")} />
    </div>
  );
}
