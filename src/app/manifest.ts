import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cantinho da Feijoada",
    short_name: "Cantinho",
    description: "Pedidos, custos e lucro do Cantinho da Feijoada",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#15110F",
    theme_color: "#15110F",
    icons: [
      { src: "/marca/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/marca/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/marca/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
