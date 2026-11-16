// Baixa de potes no emulador, como o admin faz (SDK do navegador, com as regras): npm run test:regras
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import { cargaInicial, configEstoque, receitas } from "@/data/estoque";
import { fazerCarga, sincronizarPotes } from "@/lib/potes";
import type { Pedido, Produto, StatusPedido } from "@/lib/types";

let env: RulesTestEnvironment;
let db: Firestore;
const HOJE = "2026-11-16";

const produtos = Object.keys(receitas).map((id, ordem) => ({ id, nome: id, ordem, categoria: id.startsWith("adicional") ? "adicional" : "feijoada" }) as Produto);
const comPotes = produtos.map((p) => ({ ...p, potes: receitas[p.id] }));
let n = 0;
const pedido = (itens: [string, number][], status: StatusPedido = "entregue", dia = "2026-11-14"): Pedido =>
  ({ id: `p${++n}`, canal: "whatsapp", status, dia, criadoEm: Date.parse(`${dia}T12:00:00-03:00`) + n, cliente: `Cliente ${n}`, itens: itens.map(([produtoId, qtd]) => ({ produtoId, nome: produtoId, qtd })) }) as unknown as Pedido;

// Fecha com a contagem do dono (mesma combinação do teste de unidade).
const vendas = () => [
  pedido([["feijoada-individual", 1]]),
  pedido([["simples-individual", 1]], "entregue", "2026-11-13"),
  pedido([["feijoada-2", 8], ["coca-lata", 2]]),
  pedido([["simples-2", 2]], "entregue", "2026-11-15"),
  pedido([["feijoada-3", 3], ["adicional-farofa", 1]]),
  pedido([["simples-3", 3]], "saiu", "2026-11-15"),
  pedido([["feijoada-3", 5]], "cancelado"),
  pedido([["feijoada-2", 1]], "novo"),
  pedido([["feijoada-3", 10]], "feito", "2026-12-30"), // encomenda
];

const qtd = async (id: string) => (await getDoc(doc(db, "embalagens", id))).get("quantidade");
const gravar = (ps: Pedido[]) => env.withSecurityRulesDisabled(async (c) => {
  for (const { id, ...p } of ps) await setDoc(doc(c.firestore(), "pedidos", id), p);
});
const sinc = (id: string, hoje = HOJE) => sincronizarPotes(db, id, comPotes, configEstoque, hoje);

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-cantinho", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
afterAll(() => env.cleanup());

let ps: Pedido[];
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    for (const { id, ...p } of produtos) await setDoc(doc(c.firestore(), "produtos", id), p);
  });
  db = env.authenticatedContext("dono", { dono: true }).firestore() as unknown as Firestore;
  ps = vendas();
  await gravar(ps);
  await fazerCarga(db, ps, produtos, HOJE);
});

describe("carga inicial", () => {
  it("bate com a contagem, grava receitas e não roda duas vezes", async () => {
    for (const [id, q] of Object.entries(cargaInicial.esperado)) expect([id, await qtd(id)]).toEqual([id, q]);
    expect(await qtd("saco-entrega")).toBe(50 - 6);
    expect((await getDoc(doc(db, "produtos", "feijoada-2"))).get("potes")).toEqual(receitas["feijoada-2"]);
    expect((await getDocs(collection(db, "baixas"))).size).toBe(6);
    await expect(fazerCarga(db, ps, produtos, HOJE)).rejects.toThrow("já começou");
  });

  it("depois da carga, sincronizar de novo não muda nada", async () => {
    for (const p of ps) expect(await sinc(p.id)).toBe(0);
    expect(await qtd("pote-250")).toBe(20);
  });
});

describe("baixa por pedido", () => {
  it("pedido novo dá baixa uma vez só, mesmo sincronizando ao mesmo tempo", async () => {
    const [p] = [pedido([["feijoada-2", 2]], "feito", HOJE)];
    await gravar([p]);
    await Promise.all([sinc(p.id), sinc(p.id), sinc(p.id)]);
    expect(await qtd("pote-750")).toBe(37 - 2);
    expect(await qtd("pote-250")).toBe(20 - 4);
    expect(await qtd("saco-entrega")).toBe(44 - 1);
    const movs = (await getDocs(collection(db, "movimentacoes"))).docs.filter((d) => d.get("pedidoId") === p.id);
    expect(movs.map((d) => [d.get("embalagemId"), d.get("qtd"), d.get("tipo")]).sort()).toEqual([["pote-250", -4, "venda"], ["pote-500", -2, "venda"], ["pote-750", -2, "venda"], ["saco-entrega", -1, "venda"]]);
  });

  it("editar baixa só a diferença; cancelar devolve; reabrir baixa de novo; apagar devolve", async () => {
    const p = pedido([["feijoada-individual", 1]], "feito", HOJE);
    await gravar([p]);
    await sinc(p.id);
    expect(await qtd("pote-500")).toBe(62);
    await updateDoc(doc(db, "pedidos", p.id), { itens: [{ produtoId: "feijoada-individual", nome: "x", qtd: 3 }] });
    await sinc(p.id);
    expect(await qtd("pote-500")).toBe(60);
    expect(await qtd("saco-entrega")).toBe(43); // saco continua 1
    await updateDoc(doc(db, "pedidos", p.id), { status: "cancelado" });
    await sinc(p.id);
    expect(await qtd("pote-500")).toBe(63);
    expect(await qtd("saco-entrega")).toBe(44);
    const tipos = (await getDocs(collection(db, "movimentacoes"))).docs.filter((d) => d.get("pedidoId") === p.id && d.get("embalagemId") === "pote-500").map((d) => d.get("tipo"));
    expect(tipos.sort()).toEqual(["cancelamento", "venda", "venda"]);
    await updateDoc(doc(db, "pedidos", p.id), { status: "feito" });
    await sinc(p.id);
    expect(await qtd("pote-500")).toBe(60);
    await deleteDoc(doc(db, "pedidos", p.id));
    await sinc(p.id);
    expect(await qtd("pote-500")).toBe(63);
    expect(await sinc(p.id)).toBe(0);
  });

  it("mudar a receita não mexe em pedido já baixado", async () => {
    const outra = comPotes.map((x) => (x.id === "feijoada-2" ? { ...x, potes: [{ parte: "Tudo", embalagemId: "marmita-3" }] } : x));
    expect(await sincronizarPotes(db, ps[2].id, outra, configEstoque, HOJE)).toBe(0);
    expect(await qtd("marmita-3")).toBe(10);
  });

  it("encomenda só baixa quando o dia chega", async () => {
    const enc = ps[8];
    expect(await sinc(enc.id)).toBe(0);
    expect(await qtd("pote-1000")).toBe(19);
    await sinc(enc.id, "2026-12-30");
    expect(await qtd("pote-1000")).toBe(9);
  });

  it("pote tirado do estoque não volta por causa de pedido antigo", async () => {
    await deleteDoc(doc(db, "embalagens", "pote-250"));
    await updateDoc(doc(db, "pedidos", ps[2].id), { status: "cancelado" });
    await sinc(ps[2].id);
    expect((await getDoc(doc(db, "embalagens", "pote-250"))).exists()).toBe(false);
    expect(await qtd("pote-500")).toBe(63 + 8);
  });

  it("saldo pode ficar negativo", async () => {
    const p = pedido([["feijoada-3", 30]], "feito", HOJE);
    await gravar([p]);
    await sinc(p.id);
    expect(await qtd("pote-1000")).toBe(19 - 30);
  });
});
