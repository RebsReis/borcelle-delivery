import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Borcelle Hamburgueria",
    short_name: "Borcelle",
    description: "Peça seu hambúrguer artesanal online.",
    start_url: "/",
    display: "standalone",
    background_color: "#F2E3D0",
    theme_color: "#D4261B",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
