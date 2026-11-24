import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { Hero, Marquee } from "@/components/Hero";
import { Menu } from "@/components/Menu";
import { IconArrow } from "@/components/icons";

function heroImage(): string | null {
  for (const f of ["hero.webp", "hero.avif", "hero.png"]) {
    if (fs.existsSync(path.join(process.cwd(), "public", "images", f))) return `/images/${f}`;
  }
  return null;
}

export default function Home() {
  return (
    <>
      <Hero heroImage={heroImage()} />
      <Marquee />
      <Menu />
      <section className="relative overflow-hidden bg-primary text-ink-inverse">
        <div className="bg-type grunge absolute -bottom-10 left-0 !text-ink-inverse !opacity-10" aria-hidden="true">BORCELLE</div>
        <div className="container-app relative py-[var(--section-padding)] text-center">
          <h2 className="text-h1 grunge">Não passe vontade.</h2>
          <p className="mx-auto mt-s3 max-w-md text-[length:var(--font-size-body-lg)]">Seu próximo hambúrguer está a um clique de distância.</p>
          <Link href="#cardapio" className="btn mt-s5 bg-ink-inverse text-primary shadow-lg">Pedir agora <IconArrow size={20} /></Link>
        </div>
      </section>
    </>
  );
}
