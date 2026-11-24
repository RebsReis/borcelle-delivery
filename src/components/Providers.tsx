"use client";

import Link from "next/link";
import Script from "next/script";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { api } from "@/lib/api";
import type { MenuT, StoreT } from "@/lib/types";
import { GTM_ID, META_PIXEL_ID } from "@/lib/analytics";
import { useProfile } from "@/store/profile";
import { Toaster } from "./ui";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, useGSAP);

type Ctx = { store: StoreT | null; menu: MenuT | null; menuError: boolean; reloadMenu: () => void };
const DataCtx = createContext<Ctx>({ store: null, menu: null, menuError: false, reloadMenu: () => {} });
export const useData = () => useContext(DataCtx);

export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

export function Providers({ children, initialStore, initialMenu }: { children: ReactNode; initialStore: StoreT | null; initialMenu: MenuT | null }) {
  const [store, setStore] = useState(initialStore);
  const [menu, setMenu] = useState(initialMenu);
  const [menuError, setMenuError] = useState(false);

  const reloadMenu = () => {
    setMenuError(false);
    api.menu().then(setMenu).catch(() => setMenuError(true));
  };

  useEffect(() => {
    if (!initialMenu) reloadMenu();
    const load = () => api.store().then(setStore).catch(() => {});
    load(); // status aberto/fechado sempre atualizado no navegador
    const t = setInterval(load, 60_000);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DataCtx.Provider value={{ store, menu, menuError, reloadMenu }}>
      {children}
      <Toaster />
      <Consent />
    </DataCtx.Provider>
  );
}

/** Banner LGPD: scripts de medição só carregam após o aceite. */
function Consent() {
  const hydrated = useHydrated();
  const { consent, setConsent } = useProfile();
  if (!hydrated) return null;
  return (
    <>
      {consent === "granted" && GTM_ID && (
        <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}</Script>
      )}
      {consent === "granted" && META_PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}</Script>
      )}
      {consent === "unknown" && (
        <div role="dialog" aria-label="Privacidade" className="fixed inset-x-s3 bottom-[calc(var(--bottom-nav-height)+12px)] z-[55] mx-auto max-w-xl rounded-md bg-surface-dark p-s4 text-ink-inverse shadow-lg md:bottom-s4">
          <p className="text-sm">
            Usamos cookies de medição para melhorar sua experiência e nossas ofertas. Você escolhe.{" "}
            <Link href="/privacidade" className="font-semibold underline">Política de privacidade</Link>
          </p>
          <div className="mt-s3 flex gap-s2">
            <button className="btn btn-primary flex-1" onClick={() => setConsent("granted")}>Aceitar</button>
            <button className="btn flex-1 text-ink-inverse shadow-[inset_0_0_0_2px_var(--color-text-inverse)]" onClick={() => setConsent("denied")}>Recusar</button>
          </div>
        </div>
      )}
    </>
  );
}

export function SandboxBanner() {
  return (
    <div className="bg-accent text-ink">
      <p className="container-app py-s1 text-center text-xs font-bold">
        PROTÓTIPO<span className="hidden sm:inline"> — cardápio, pedidos e pagamentos são simulados, nada é cobrado</span>
      </p>
    </div>
  );
}
