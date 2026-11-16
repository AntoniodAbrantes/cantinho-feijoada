import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { brl } from "@/lib/format";
import { textoHorario } from "@/lib/loja";
import { conferirAppCheck } from "@/lib/servidor/appcheck";
import { Recusa, criarPedido, lerCorpo } from "@/lib/servidor/pedido";
import { avisarCelulares } from "@/lib/servidor/push";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const texto = await req.text();
    if (texto.length > 10_000) throw new Recusa(413, "Pedido grande demais.");
    let corpo: unknown;
    try {
      corpo = JSON.parse(texto);
    } catch {
      throw new Recusa(400, "Pedido em formato inválido.");
    }
    const { itens, cliente } = lerCorpo(corpo);
    await conferirAppCheck(req.headers.get("x-firebase-appcheck"));
    // Na Vercel o primeiro endereço do x-forwarded-for é o do cliente.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "desconhecido";
    const r = await criarPedido(itens, cliente, ip);
    revalidatePath("/"); // o "esgotou" do site atualiza na hora
    // Depois da resposta: o cliente não espera o aviso chegar no celular do dono.
    after(() => avisarCelulares({ titulo: `Pedido novo nº ${r.numero}`, corpo: `${cliente.nome.split(" ")[0]} · ${brl(r.total)}${cliente.agendado ? ` · agendado: ${textoHorario(cliente.agendado)}` : ""}`, tag: r.id }).catch((e) => console.error("push", e)));
    return Response.json({ numero: r.numero, rastreio: r.rastreio });
  } catch (e) {
    if (e instanceof Recusa) {
      // Sem dados do cliente no log: só o motivo e, se faltou token, o erro que o navegador teve.
      const falha = req.headers.get("x-appcheck-falha");
      console.warn("pedido recusado", e.status, e.message, falha ? `token: ${decodeURIComponent(falha).slice(0, 200)}` : "");
      return Response.json({ erro: e.message }, { status: e.status });
    }
    console.error("pedido do site falhou", e);
    return Response.json({ erro: "Deu um erro do nosso lado." }, { status: 500 });
  }
}
