import type { MetadataRoute } from "next";
import { SITE } from "@/lib/contato";

// O site público é uma página só; sistema e acompanhamento de pedido ficam de fora.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE}/`, changeFrequency: "weekly", priority: 1 }];
}
