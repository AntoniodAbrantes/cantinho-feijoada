import { calcularEntrega } from "@/lib/servidor/entrega";

export const runtime = "nodejs";

// Taxa pro pino do cliente, pra mostrar no checkout. Na hora do pedido, /api/pedido calcula de novo.
// Só a taxa: a distância ajudaria a descobrir onde fica a cozinha.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { lat?: unknown; lng?: unknown } | null;
  if (!b || typeof b.lat !== "number" || typeof b.lng !== "number") return Response.json({ erro: "Posição inválida." }, { status: 400 });
  const c = await calcularEntrega({ lat: b.lat, lng: b.lng });
  if (!c) return Response.json({ erro: "A taxa por distância não está ligada." }, { status: 503 });
  return Response.json({ taxa: c.taxa });
}
