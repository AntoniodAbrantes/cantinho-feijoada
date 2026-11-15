import { avaliar, lerAvaliacao } from "@/lib/servidor/avaliacao";
import { Recusa } from "@/lib/servidor/pedido";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const texto = await req.text();
    if (texto.length > 2000) throw new Recusa(413, "Avaliação grande demais.");
    let corpo: unknown;
    try {
      corpo = JSON.parse(texto);
    } catch {
      throw new Recusa(400, "Avaliação em formato inválido.");
    }
    await avaliar(lerAvaliacao(corpo));
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof Recusa) return Response.json({ erro: e.message }, { status: e.status });
    console.error("avaliação falhou", e);
    return Response.json({ erro: "Deu um erro do nosso lado." }, { status: 500 });
  }
}
