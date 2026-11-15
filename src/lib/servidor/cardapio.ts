import { adminDb } from "./admin";
import { entregaSite } from "./entrega";
import { diaLocal, fimDeSemana } from "../format";
import { lojaAberta } from "../loja";
import { panela } from "../pedido";
import { cardapioSite, type DadosSite } from "../site";
import type { Loja, Pedido, Premissas, Producao, Produto } from "../types";

const FECHADA: Loja = { modo: "fechada", horarios: {} };
const lista = <T>(s: FirebaseFirestore.QuerySnapshot) => s.docs.map((d) => ({ ...d.data(), id: d.id }) as T);

// Tudo o que o site precisa para mostrar o cardápio e conferir o pedido, lido direto do sistema.
export async function carregarSite(agora = Date.now()): Promise<DadosSite> {
  const db = adminDb();
  const hoje = diaLocal(agora);
  const [produtos, premissas, loja, producoes, pedidos] = await Promise.all([
    db.collection("produtos").get().then((s) => lista<Produto>(s)),
    db.doc("config/premissas").get().then((s) => s.data() as Premissas),
    db.doc("config/loja").get().then((s) => (s.data() as Loja | undefined) ?? FECHADA),
    db.collection("producoes").orderBy("data", "desc").limit(10).get().then((s) => lista<Producao>(s)),
    db.collection("pedidos").where("fimDeSemana", "==", fimDeSemana(hoje)).get().then((s) => lista<Pedido>(s)),
  ]);
  // Pedido novo, ainda não aceito, já reserva feijoada: não dá pra vender a mesma panela duas vezes.
  const restaG = panela(producoes, pedidos, premissas, hoje, (s) => s !== "cancelado")?.resta ?? 0;
  return {
    itens: cardapioSite(produtos, pedidos.filter((p) => p.status !== "cancelado"), restaG),
    restaG,
    taxaEntrega: premissas.taxaEntrega.valor,
    entrega: entregaSite(),
    loja,
    aberta: lojaAberta(loja, agora),
  };
}
