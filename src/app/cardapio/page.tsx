import type { Metadata } from "next";
import { Menu } from "@/components/Menu";

export const metadata: Metadata = { title: "Cardápio", description: "Hambúrgueres artesanais, smash, combos, porções, bebidas e sobremesas." };

export default function CardapioPage() {
  return <Menu heading={false} />;
}
