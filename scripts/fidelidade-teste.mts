// Clientes de teste do Selo do Cantinho, só no emulador: npm run fidelidade:teste
// Cada um tem 5 pedidos entregues (ou o caso pedido no teste). Rodar de novo apaga e recria os mesmos.
import * as seed from "../src/data/seed";
import { itemDoProduto, custoPorKg, custoProducao } from "../src/lib/calc";
import { cartao, itemPremio } from "../src/lib/fidelidade";
import { diaLocal, fimDeSemana } from "../src/lib/format";
import { taxasDoMomento } from "../src/lib/pedido";
import type { Pedido, StatusPedido } from "../src/lib/types";
import { db, noEmulador } from "./admin.mts";

if (!noEmulador) throw new Error("Clientes de teste só no emulador.");

const prem = seed.premissas;
const prod = seed.producoes[0];
const custoKg = custoPorKg(custoProducao(prod, prem), prod.rendimentoG);
const produto = (id: string) => seed.produtos.find((p) => p.id === id)!;
const DIA = 86_400_000;
let n = 0;

function pedido(cliente: string, telefone: string, itens: [string, number][], status: StatusPedido = "entregue"): Omit<Pedido, "id"> {
  const criadoEm = Date.now() - (30 - n++) * DIA; // um por dia, no passado
  const dia = diaLocal(criadoEm);
  return {
    canal: "whatsapp", itens: itens.map(([id, q]) => itemDoProduto(produto(id), "whatsapp", q, custoKg, prem)),
    desconto: { tipo: "valor", informado: 0, motivo: "" }, taxaEntrega: prem.taxaEntrega.valor, custoEntrega: prem.custoEntrega.valor,
    pagamento: "pix", taxas: taxasDoMomento("whatsapp", "pix", prem),
    criadoEm, dia, fimDeSemana: fimDeSemana(dia), cliente, bairro: "Manaíra", status, obs: "teste fidelidade", producaoId: prod.id, telefone, semPote: false,
  };
}
const vezes = (k: number, itens: [string, number][]) => Array.from({ length: k }, () => itens);

const clientes: { nome: string; tel: string; pedidos: [string, number][][]; cancelado?: [string, number][]; resgate?: string }[] = [
  { nome: "Ana Teste (só individual)", tel: "83991110001", pedidos: vezes(5, [["feijoada-individual", 1]]) },
  { nome: "Bruno Teste (só para 2)", tel: "83991110002", pedidos: vezes(5, [["feijoada-2", 1]]) },
  { nome: "Carla Teste (só para 3)", tel: "83991110003", pedidos: vezes(5, [["feijoada-3", 1], ["coca-lata", 2]]) },
  { nome: "Davi Teste (misturou)", tel: "83991110004", pedidos: [[["feijoada-3", 1]], [["feijoada-2", 1]], ...vezes(3, [["feijoada-individual", 1]])] },
  { nome: "Elis Teste (4 + 1 cancelado)", tel: "83991110005", pedidos: vezes(4, [["feijoada-2", 1]]), cancelado: [["feijoada-2", 1]] },
  { nome: "Fábio Teste (resgatou e trocou)", tel: "83991110006", pedidos: vezes(5, [["feijoada-individual", 1]]), resgate: "feijoada-2" },
];

// Apaga tudo desses números (inclusive pedidos de teste feitos pelo site) e recria.
const b = db.batch();
for (const c of clientes) for (const d of (await db.collection("pedidos").where("telefone", "==", c.tel).get()).docs) b.delete(d.ref);
for (const c of clientes) {
  const feitos = c.pedidos.map((itens) => pedido(c.nome, c.tel, itens));
  if (c.cancelado) feitos.push(pedido(c.nome, c.tel, c.cancelado, "cancelado"));
  if (c.resgate) {
    const r = itemPremio(cartao(feitos, [], seed.produtos, { ativo: true, meta: 5, regra: "menor" }), c.resgate, seed.produtos, "whatsapp", custoKg, prem)!;
    const p = pedido(c.nome, c.tel, [["coca-lata", 1]]);
    feitos.push({ ...p, itens: [...p.itens, r.item], fidelidade: r.resgate });
  }
  for (const p of feitos) b.set(db.collection("pedidos").doc(), p);
  b.delete(db.doc(`fidelidade/${c.tel}`));
}
await b.commit();

for (const c of clientes) {
  const ps = (await db.collection("pedidos").where("telefone", "==", c.tel).get()).docs.map((d) => d.data() as Pedido);
  const r = cartao(ps, [], seed.produtos, { ativo: true, meta: 5, regra: "menor" });
  console.log(`${c.nome.padEnd(34)} ${c.tel}  ${r.selos}/${r.meta} selos  ${r.liberados ? `PRESENTE: ${r.premio!.nome}` : "sem presente"}${r.resgates ? `  (${r.resgates} resgate)` : ""}`);
}
