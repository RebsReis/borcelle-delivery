import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { api } from "@/lib/api";
import { Providers } from "@/components/Providers";
import { BottomNav, Header } from "@/components/Header";
import { CartDrawer } from "@/components/Cart";
import { ProductSheet } from "@/components/ProductSheet";
import { Logo } from "@/components/Brand";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Borcelle Hamburgueria — Peça online", template: "%s · Borcelle Hamburgueria" },
  description: "Hambúrguer artesanal, smash burgers, combos e porções. Peça online com entrega ou retirada.",
  applicationName: "Borcelle",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Borcelle", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  openGraph: { type: "website", locale: "pt_BR", siteName: "Borcelle Hamburgueria", title: "Borcelle Hamburgueria — Fome de verdade", description: "Hambúrguer artesanal com entrega e retirada." },
};

export const viewport: Viewport = { themeColor: "#D4261B", width: "device-width", initialScale: 1, viewportFit: "cover" };

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [store, menu] = await Promise.all([safe(api.store(30)), safe(api.menu(30))]);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: store?.name ?? "Borcelle Hamburgueria",
    servesCuisine: "Hambúrguer",
    telephone: store?.phone,
    address: store?.address,
    url: SITE,
    hasMenu: `${SITE}/cardapio`,
  };
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </head>
      <body className="min-h-dvh pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] lg:pb-0">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-s3 focus:top-s3 focus:z-[90] focus:rounded-sm focus:bg-ink focus:px-s3 focus:py-s2 focus:text-ink-inverse">Pular para o conteúdo</a>
        <Providers initialStore={store} initialMenu={menu}>
          <Header />
          <main id="conteudo">{children}</main>
          <Footer whatsapp={store?.whatsapp} address={store?.address} />
          <BottomNav />
          <CartDrawer />
          <ProductSheet />
        </Providers>
      </body>
    </html>
  );
}

function Footer({ whatsapp, address }: { whatsapp?: string; address?: string }) {
  return (
    <footer className="bg-surface-dark text-ink-inverse">
      <div className="checkerboard h-3 opacity-30 [--color-text-primary:var(--color-text-inverse)]" aria-hidden="true" />
      <div className="container-app grid gap-s5 py-s7 md:grid-cols-3">
        <div className="[&_*]:!text-ink-inverse"><Logo /><p className="mt-s3 max-w-xs text-sm opacity-80">Hambúrguer artesanal, feito na chapa, sem miséria.</p></div>
        <div className="text-sm">
          <p className="text-label mb-s2 opacity-70">Atendimento</p>
          {whatsapp && <a className="block py-1 underline-offset-4 hover:underline" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener">WhatsApp</a>}
          {address && <p className="py-1 opacity-80">{address}</p>}
        </div>
        <div className="text-sm">
          <p className="text-label mb-s2 opacity-70">Links</p>
          <Link className="block py-1 hover:underline" href="/cardapio">Cardápio</Link>
          <Link className="block py-1 hover:underline" href="/pedidos">Meus pedidos</Link>
          <Link className="block py-1 hover:underline" href="/privacidade">Política de privacidade</Link>
        </div>
      </div>
    </footer>
  );
}
