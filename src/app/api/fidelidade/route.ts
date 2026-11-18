import { consultarSelos, lerConsulta } from "@/lib/servidor/fidelidade";
import { Recusa } from "@/lib/servidor/pedido";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const texto = await req.text();
    if (texto.length > 500) throw new Recusa(413, "Consulta grande demais.");
    let corpo: unknown;
    try {
      corpo = JSON.parse(texto);
    } catch {
      throw new Recusa(400, "Consulta em formato inválido.");
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "desconhecido";
    return Response.json(await consultarSelos(lerConsulta(corpo), ip));
  } catch (e) {
    if (e instanceof Recusa) return Response.json({ erro: e.message }, { status: e.status });
    console.error("consulta de selos falhou", e);
    return Response.json({ erro: "Deu um erro do nosso lado." }, { status: 500 });
  }
}
