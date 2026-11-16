// Rota de pedido do site contra o emulador: npm run test:regras
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as seed from "@/data/seed";
import type { DadosCliente } from "@/lib/site";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/server", () => ({ after: () => {} })); // aviso no celular: fora do teste
process.env.NEXT_PUBLIC_EMULADOR = "1";

const host = process.env.FIRESTORE_EMULATOR_HOST;
let POST: (r: Request) => Promise<Response>;
let db: FirebaseFirestore.Firestore;
let criarPedido: typeof import("@/lib/servidor/pedido").criarPedido;

const cliente: DadosCliente = {
  nome: "Maria Souza",
  telefone: "83998244099",
  endereco: { rua: "Av. Cabo Branco", numero: "100", bairro: "Cabo Branco", complemento: "", referencia: "" },
  pagamento: "pix",
  trocoPara: 0,
  obs: "",
};
let ipSeq = 0;
const pedir = (corpo: unknown, ip = `10.0.0.${++ipSeq}`) =>
  POST(new Request("http://localhost/api/pedido", { method: "POST", headers: { "x-forwarded-for": ip }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) }));
const semId = (x: { id: string }) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== "id"));

beforeAll(async () => {
  if (!host) throw new Error("Rode com o emulador: npm run test:regras");
  ({ POST } = await import("@/app/api/pedido/route"));
  db = (await import("@/lib/servidor/admin")).adminDb();
  ({ criarPedido } = await import("@/lib/servidor/pedido"));
});

beforeEach(async () => {
  await fetch(`http://${host}/emulator/v1/projects/demo-cantinho/databases/(default)/documents`, { method: "DELETE" });
  const b = db.batch();
  b.set(db.doc("config/premissas"), seed.premissas);
  b.set(db.doc("config/loja"), { modo: "aberta", horarios: {} });
  for (const p of seed.produtos) b.set(db.doc(`produtos/${p.id}`), semId(p));
  for (const p of seed.producoes) b.set(db.doc(`producoes/${p.id}`), semId(p));
  await b.commit();
});

const pedidosSalvos = async () => (await db.collection("pedidos").get()).docs.map((d) => d.data());

describe("pedido do site", () => {
  it("válido: vira pedido novo do canal site, com rastreio público sem dados pessoais", async () => {
    const r = await pedir({ itens: { "feijoada-2": 1, "coca-lata": 2 }, cliente });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.numero).toBe(1);
    expect(j.rastreio).toMatch(/^[\w-]{32}$/);

    const [p] = await pedidosSalvos();
    expect(p).toMatchObject({ canal: "site", status: "novo", numero: 1, telefone: "83998244099", cliente: "Maria Souza", bairro: "Cabo Branco", taxaEntrega: 0, rastreio: j.rastreio });
    expect(p.itens.map((i: { produtoId: string; preco: number; qtd: number }) => [i.produtoId, i.qtd, i.preco])).toEqual([["feijoada-2", 1, 7490], ["coca-lata", 2, 600]]);
    expect(p.taxas).toMatchObject({ comissaoBp: 0, onlineBp: 0, pagamentoBp: 0 });

    const pub = (await db.doc(`rastreio/${j.rastreio}`).get()).data()!;
    expect(pub).toMatchObject({ numero: 1, status: "novo", nome: "Maria", total: 7490 + 1200 });
    expect(JSON.stringify(pub)).not.toMatch(/99824|Cabo Branco|custo/);

    // Pedido novo não baixa bebida: só no aceite.
    expect((await db.doc("produtos/coca-lata").get()).get("estoque")).toBe(12);
  });

  it("número segue a sequência", async () => {
    await pedir({ itens: { "adicional-arroz": 1 }, cliente });
    const r = await pedir({ itens: { "adicional-arroz": 1 }, cliente: { ...cliente, telefone: "83988887777" } });
    expect((await r.json()).numero).toBe(2);
  });

  it("preço e total adulterados no navegador são ignorados", async () => {
    const r = await pedir({ itens: { "feijoada-3": 1 }, cliente: { ...cliente, total: 100, preco: 1 }, total: 100, precos: { "feijoada-3": 1 } });
    expect(r.status).toBe(200);
    const [p] = await pedidosSalvos();
    expect(p.itens[0].preco).toBe(9490);
    const pub = (await db.doc(`rastreio/${p.rastreio}`).get()).data()!;
    expect(pub.total).toBe(9490);
    // Item com preço embutido no lugar da quantidade: formato inválido.
    expect((await pedir({ itens: { "feijoada-3": { qtd: 1, preco: 1 } }, cliente })).status).toBe(400);
  });

  it("item esgotado, fora do site ou além do estoque é recusado", async () => {
    await db.doc("produtos/feijoada-2").update({ esgotadoSite: true });
    const r = await pedir({ itens: { "feijoada-2": 1 }, cliente });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toMatch(/esgotou/);
    await db.doc("produtos/simples-2").update({ ativoSite: false });
    expect((await pedir({ itens: { "simples-2": 1 }, cliente })).status).toBe(409);
    expect((await pedir({ itens: { "coca-1l": 7 }, cliente })).status).toBe(409);
    expect(await pedidosSalvos()).toHaveLength(0);
  });

  it("panela acaba: pedido novo ainda não aceito já reserva a feijoada", async () => {
    await db.doc("producoes/2026-11-11").update({ rendimentoG: 1000 });
    expect((await pedir({ itens: { "feijoada-2": 1 }, cliente })).status).toBe(200); // 750 g
    const r = await pedir({ itens: { "feijoada-individual": 1 }, cliente: { ...cliente, telefone: "83988887777" } }); // +400 g > 1 kg
    expect(r.status).toBe(409);
  });

  it("dois pedidos ao mesmo tempo pela última feijoada: só um passa", async () => {
    await db.doc("producoes/2026-11-11").update({ rendimentoG: 750 });
    const rs = await Promise.all([
      pedir({ itens: { "feijoada-2": 1 }, cliente }),
      pedir({ itens: { "feijoada-2": 1 }, cliente: { ...cliente, telefone: "83988887777" } }),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await pedidosSalvos()).toHaveLength(1);
  });

  it("loja fechada à mão ou fora do horário recusa", async () => {
    await db.doc("config/loja").set({ modo: "fechada", horarios: {} });
    const r = await pedir({ itens: { "feijoada-2": 1 }, cliente });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toMatch(/fechada/);

    await db.doc("config/loja").set({ modo: "auto", horarios: { sexta: { inicio: "11:00", fim: "14:00" } } });
    const sexta = (h: string) => new Date(`2026-11-13T${h}:00-03:00`).getTime();
    await expect(criarPedido({ "feijoada-2": 1 }, cliente, "1.1.1.1", sexta("15:00"))).rejects.toThrow(/fechada/);
    await expect(criarPedido({ "feijoada-2": 1 }, cliente, "1.1.1.1", sexta("12:00"))).resolves.toMatchObject({ numero: 1 });
  });

  it("agendado: loja fechada aceita faixa válida e o pedido vai pro dia da entrega", async () => {
    await db.doc("config/loja").set({ modo: "auto", horarios: { sexta: { inicio: "11:00", fim: "14:00" } } });
    const segunda = new Date("2026-11-16T10:00:00-03:00").getTime();
    const sexta = (h: string) => new Date(`2026-11-20T${h}:00-03:00`).getTime();
    await expect(criarPedido({ "feijoada-2": 1 }, { ...cliente, agendado: sexta("12:15") }, "1.1.1.1", segunda)).rejects.toThrow(/horário/);
    await expect(criarPedido({ "feijoada-2": 1 }, { ...cliente, agendado: sexta("12:00") }, "1.1.1.1", new Date("2026-11-19T20:30:00-03:00").getTime())).rejects.toThrow(/horário/); // passou das 20h da véspera
    const r = await criarPedido({ "feijoada-2": 1 }, { ...cliente, agendado: sexta("12:00") }, "1.1.1.1", segunda);
    const [p] = await pedidosSalvos();
    expect(p).toMatchObject({ status: "novo", dia: "2026-11-20", fimDeSemana: "2026-11-20", agendadoPara: sexta("12:00"), criadoEm: segunda });
    expect((await db.doc(`rastreio/${r.rastreio}`).get()).get("agendadoPara")).toBe(sexta("12:00"));

    await db.doc("config/loja").set({ modo: "fechada", horarios: { sexta: { inicio: "11:00", fim: "14:00" } } });
    await expect(criarPedido({ "feijoada-2": 1 }, { ...cliente, agendado: sexta("12:30") }, "1.1.1.1", segunda)).rejects.toThrow(/horário/);
    expect((await pedir({ itens: { "feijoada-2": 1 }, cliente: { ...cliente, agendado: "amanhã" } })).status).toBe(400);
  });

  it("campos inválidos", async () => {
    const casos: unknown[] = [
      "não é json",
      { itens: [], cliente },
      { itens: { "feijoada-2": 1 } },
      { itens: {}, cliente },
      { itens: { "feijoada-2": 1.5 }, cliente },
      { itens: { "feijoada-2": -1 }, cliente },
      { itens: { "feijoada-2": 11 }, cliente },
      { itens: { "feijoada-2": 1 }, cliente: { ...cliente, telefone: "8399" } },
      { itens: { "feijoada-2": 1 }, cliente: { ...cliente, nome: "" } },
      { itens: { "feijoada-2": 1 }, cliente: { ...cliente, endereco: { ...cliente.endereco, rua: "" } } },
      { itens: { "feijoada-2": 1 }, cliente: { ...cliente, pagamento: "ifood_online" } },
      { itens: { "feijoada-2": 1 }, cliente: { ...cliente, pagamento: "dinheiro", trocoPara: 1000 } },
      { itens: { "feijoada-2": 1 }, cliente: { ...cliente, obs: "x".repeat(500) } },
      { itens: { "feijoada-2": 1 }, cliente: { ...cliente, nome: { $gt: "" } } },
    ];
    for (const c of casos) {
      const r = await pedir(c);
      expect([400, 409], JSON.stringify(c).slice(0, 80)).toContain(r.status);
    }
    expect((await pedir("x".repeat(20_000))).status).toBe(413);
    expect(await pedidosSalvos()).toHaveLength(0);
  });

  it("excesso de pedidos por telefone e por IP", async () => {
    for (let i = 0; i < 3; i++) expect((await pedir({ itens: { "adicional-arroz": 1 }, cliente })).status).toBe(200);
    expect((await pedir({ itens: { "adicional-arroz": 1 }, cliente })).status).toBe(429);

    for (let i = 0; i < 10; i++)
      expect((await pedir({ itens: { "adicional-farofa": 1 }, cliente: { ...cliente, telefone: `8399000${String(i).padStart(4, "0")}` } }, "200.1.1.1")).status).toBe(200);
    expect((await pedir({ itens: { "adicional-farofa": 1 }, cliente: { ...cliente, telefone: "83977776666" } }, "200.1.1.1")).status).toBe(429);
    expect(await pedidosSalvos()).toHaveLength(13);
  });
});

describe("App Check em produção", () => {
  it("sem chave configurada o site não recebe pedido; sem token, recusa", async () => {
    const { conferirAppCheck } = await import("@/lib/servidor/appcheck");
    process.env.NEXT_PUBLIC_EMULADOR = "0";
    try {
      delete process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      await expect(conferirAppCheck("x")).rejects.toMatchObject({ status: 503 });
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = "chave";
      await expect(conferirAppCheck(null)).rejects.toMatchObject({ status: 403 });
    } finally {
      process.env.NEXT_PUBLIC_EMULADOR = "1";
      delete process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    }
  });

  it("taxa por distância: o servidor calcula pelo pino e ignora a taxa que vem do navegador", async () => {
    const { ENTREGA } = await import("@/data/entrega");
    const config = { ...ENTREGA, origem: { lat: -7.1, lng: -34.84 }, faixas: [{ ateKm: 3, taxa: 0 }, { ateKm: 6, taxa: 800 }] };
    const rota = vi.fn().mockResolvedValue(4.26);
    const local = { lat: -7.13, lng: -34.85 };
    const malandro = { ...cliente, local, taxaEntrega: 0, distanciaKm: 1 } as DadosCliente;
    const r = await criarPedido({ "feijoada-2": 1 }, malandro, "2.2.2.2", Date.now(), config, rota);
    const [p] = await pedidosSalvos();
    expect(p).toMatchObject({ taxaEntrega: 800, distanciaKm: 4.3, local });
    expect((await db.doc(`rastreio/${r.rastreio}`).get()).data()).toMatchObject({ taxaEntrega: 800, total: 7490 + 800 });
    expect((await db.doc(`rastreio/${r.rastreio}`).get()).data()).not.toHaveProperty("local");
  });

  it("taxa por distância: sem pino ou fora da área não grava", async () => {
    const { ENTREGA } = await import("@/data/entrega");
    const config = { ...ENTREGA, origem: { lat: -7.1, lng: -34.84 }, faixas: [{ ateKm: 3, taxa: 0 }] };
    const longe = vi.fn().mockResolvedValue(12);
    await expect(criarPedido({ "feijoada-2": 1 }, cliente, "3.3.3.3", Date.now(), config, longe)).rejects.toThrow(/mapa/);
    await expect(criarPedido({ "feijoada-2": 1 }, { ...cliente, local: { lat: -7.2, lng: -34.86 } }, "3.3.3.3", Date.now(), config, longe)).rejects.toThrow(/fora da nossa área/);
    await expect(criarPedido({ "feijoada-2": 1 }, { ...cliente, local: { lat: -8.05, lng: -34.88 } }, "3.3.3.3", Date.now(), config, longe)).rejects.toThrow(/fora da nossa área/);
    expect(await pedidosSalvos()).toHaveLength(0);
  });

  it("local em formato errado é recusado", async () => {
    const r = await pedir({ itens: { "feijoada-2": 1 }, cliente: { ...cliente, local: { lat: "-7.1", lng: -34.8 } } });
    expect(r.status).toBe(400);
  });

  it("avaliação: só depois de entregue, uma vez, e grava no pedido", async () => {
    const { POST: avaliar } = await import("@/app/api/avaliacao/route");
    const nota = (corpo: unknown) => avaliar(new Request("http://localhost/api/avaliacao", { method: "POST", body: JSON.stringify(corpo) }));
    const j = await (await pedir({ itens: { "feijoada-2": 1 }, cliente })).json();
    expect((await nota({ token: j.rastreio, nota: 5 })).status).toBe(409); // ainda não chegou

    const [ref] = (await db.collection("pedidos").get()).docs.map((d) => d.ref);
    await ref.update({ status: "entregue" });
    await db.doc(`rastreio/${j.rastreio}`).update({ status: "entregue" });
    expect((await nota({ token: j.rastreio, nota: 6 })).status).toBe(400);
    expect((await nota({ token: j.rastreio, nota: 4, comentario: "x".repeat(301) })).status).toBe(400);
    expect((await nota({ token: "x".repeat(32), nota: 5 })).status).toBe(404);

    expect((await nota({ token: j.rastreio, nota: 4, comentario: " Muito boa! " })).status).toBe(200);
    expect((await ref.get()).get("avaliacao")).toMatchObject({ nota: 4, comentario: "Muito boa!" });
    expect((await db.doc(`rastreio/${j.rastreio}`).get()).get("avaliacao")).toEqual({ nota: 4 }); // o comentário fica só com o dono
    expect((await nota({ token: j.rastreio, nota: 1 })).status).toBe(409); // uma vez só
  });
});
