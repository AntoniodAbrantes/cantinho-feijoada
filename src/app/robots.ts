import type { MetadataRoute } from "next";
import { SITE } from "@/lib/contato";

// /admin e /pedido já têm noindex na própria página; /api não tem página nenhuma.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: `${SITE}/sitemap.xml` };
}
