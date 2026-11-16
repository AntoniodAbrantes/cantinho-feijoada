// Estoque de potes no Firestore: baixa por pedido (transação) e carga inicial.
import { collection, doc, increment, runTransaction, type Firestore } from "firebase/firestore";
import { cargaInicial, configEstoque, embalagens, receitas } from "@/data/estoque";
import { chave, consumo, descPedido, diferenca, planoCarga } from "./estoque";
import { diaLocal } from "./format";
import type { Baixa, ConfigEstoque, Pedido, Produto } from "./types";

// Lê o pedido e a baixa dele no servidor e aplica só a diferença. Rodar de novo (ou em dois aparelhos
// ao mesmo tempo) não baixa duas vezes: a transação repete se alguém mexeu no meio, e a chave igual encerra.
export function sincronizarPotes(db: Firestore, pedidoId: string, produtos: Pick<Produto, "id" | "potes">[], cfg: ConfigEstoque, hoje = diaLocal()) {
  return runTransaction(db, async (t) => {
    const bRef = doc(db, "baixas", pedidoId);
    const ps = await t.get(doc(db, "pedidos", pedidoId));
    const bs = await t.get(bRef);
    const p = ps.exists() ? (ps.data() as Pedido) : null;
    const vale = p && p.dia >= cfg.desde ? p : null;
    const k = chave(vale, hoje);
    const b = bs.exists() ? (bs.data() as Omit<Baixa, "id">) : null;
    if (b ? b.chave === k : !k) return 0;

    const alvo = consumo(vale, produtos, cfg, hoje);
    const d = diferenca(b?.potes ?? {}, alvo);
    // Pote tirado do estoque: não volta a existir por causa de pedido antigo.
    const existe = new Set<string>();
    for (const id of Object.keys(d)) if ((await t.get(doc(db, "embalagens", id))).exists()) existe.add(id);
    const em = Date.now();
    const motivo = !b?.chave ? "" : !k ? (p ? " · cancelado" : "") : " · pedido editado";
    for (const [id, q] of Object.entries(d)) {
      if (!existe.has(id)) continue;
      t.set(doc(db, "embalagens", id), { quantidade: increment(-q) }, { merge: true });
      t.set(doc(collection(db, "movimentacoes")), {
        em, dia: diaLocal(em), embalagemId: id, qtd: -q, pedidoId,
        tipo: q > 0 || k ? "venda" : "cancelamento",
        obs: (p ? descPedido(p) : "Pedido apagado") + motivo,
      });
    }
    t.set(bRef, { potes: alvo, chave: k, em });
    return Object.keys(d).length;
  });
}

const EM_COMPRA = Date.parse(`${cargaInicial.dia}T12:00:00-03:00`);

// Uma vez só: cria os potes, as receitas que faltam, a compra de 11/11 e as baixas dos pedidos desde 13/11.
export function fazerCarga(db: Firestore, pedidos: Pedido[], produtos: Produto[], hoje = diaLocal()) {
  return runTransaction(db, async (t) => {
    const cfgRef = doc(db, "config", "estoque");
    if ((await t.get(cfgRef)).exists()) throw new Error("O estoque de potes já começou.");
    const comRec = produtos.map((p) => ({ ...p, potes: p.potes ?? receitas[p.id] }));
    const plano = planoCarga(pedidos, comRec, configEstoque, cargaInicial.compra, hoje);
    const agora = Date.now();

    for (const { id, ...e } of embalagens) t.set(doc(db, "embalagens", id), { ...e, quantidade: plano.saldo(id) });
    for (const p of comRec) if (!produtos.find((x) => x.id === p.id)!.potes && p.potes) t.update(doc(db, "produtos", p.id), { potes: p.potes });
    for (const [id, q] of Object.entries(cargaInicial.compra))
      t.set(doc(collection(db, "movimentacoes")), { em: EM_COMPRA, dia: cargaInicial.dia, embalagemId: id, qtd: q, tipo: "compra", pedidoId: null, obs: "Carga inicial" });
    for (const l of plano.linhas) {
      if (!l.chave) continue;
      for (const [id, q] of Object.entries(l.potes))
        t.set(doc(collection(db, "movimentacoes")), { em: l.p.criadoEm, dia: diaLocal(l.p.criadoEm), embalagemId: id, qtd: -q, tipo: "venda", pedidoId: l.p.id, obs: `${descPedido(l.p)} · carga inicial` });
      t.set(doc(db, "baixas", l.p.id), { potes: l.potes, chave: l.chave, em: agora });
    }
    t.set(cfgRef, configEstoque);
  });
}
