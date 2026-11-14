import type { Metadata } from "next";
import { Providers } from "@/components/shell";

// O app instalável é o sistema; o site público na raiz não tem manifest nem login.
export const metadata: Metadata = {
  title: "Cantinho · gestão",
  description: "Pedidos, custos e lucro do Cantinho da Feijoada",
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, title: "Cantinho", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
};

// Login e Firebase só no sistema: o site público na raiz não carrega nada disso.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
