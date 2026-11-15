// Nota do cliente depois da entrega. Quem tem o token do acompanhamento avalia, uma vez, só pedido entregue.
import { adminDb } from "./admin";
import { Recusa } from "./pedido";

export function lerAvaliacao(corpo: unknown) {
  const b = corpo as { token?: unknown; nota?: unknown; comentario?: unknown } | null;
  if (!b || typeof b.token !== "string" || !/^[\w-]{32}$/.test(b.token)) throw new Recusa(400, "Link de pedido inválido.");
  if (typeof b.nota !== "number" || !Number.isInteger(b.nota) || b.nota < 1 || b.nota > 5) throw new Recusa(400, "Escolhe de 1 a 5 estrelas.");
  const comentario = b.comentario === undefined ? "" : b.comentario;
  if (typeof comentario !== "string" || comentario.length > 300) throw new Recusa(400, "Comentário muito longo (até 300 letras).");
  return { token: b.token, nota: b.nota, comentario: comentario.trim() };
}

export async function avaliar({ token, nota, comentario }: ReturnType<typeof lerAvaliacao>, agora = Date.now()) {
  const db = adminDb();
  const rastreio = db.doc(`rastreio/${token}`);
  await db.runTransaction(async (t) => {
    const [r, pedidos] = await Promise.all([t.get(rastreio), t.get(db.collection("pedidos").where("rastreio", "==", token).limit(1))]);
    if (!r.exists || pedidos.empty) throw new Recusa(404, "Não achei esse pedido.");
    if (r.get("status") !== "entregue") throw new Recusa(409, "Dá pra avaliar quando o pedido chegar.");
    if (r.get("avaliacao")) throw new Recusa(409, "Esse pedido já foi avaliado. Valeu!");
    t.update(rastreio, { avaliacao: { nota } });
    t.update(pedidos.docs[0].ref, { avaliacao: { nota, comentario, em: agora } });
  });
}
