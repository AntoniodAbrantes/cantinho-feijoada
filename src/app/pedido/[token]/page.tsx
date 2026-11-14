import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Acompanhar } from "@/components/site/acompanhar";

export const metadata: Metadata = { title: "Seu pedido · Cantinho da Feijoada", robots: { index: false, follow: false } };

export default async function Pedido({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{32}$/.test(token)) notFound(); // formato do token gerado na rota de pedido
  return <Acompanhar token={token} />;
}
