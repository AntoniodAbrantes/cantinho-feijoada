// Pedido do site: o navegador manda só quantidades e dados de entrega; preço, total, estoque e loja aberta
// são conferidos aqui, numa transação, a partir do que está no sistema.
import { createHash, randomBytes } from "node:crypto";
import { adminDb } from "./admin";
import { calcPedido, itemDoProduto } from "../calc";
import { diaLocal, fimDeSemana } from "../format";
import { lojaAberta } from "../loja";
import { panela, taxasDoMomento } from "../pedido";
import { cardapioSite, erroCarrinho, errosCliente, type Carrinho, type DadosCliente } from "../site";
import type { Loja, Pedido, Premissas, Producao, Produto } from "../types";

// shortcut: limites propostos no plano, ainda a confirmar com o Antonio.
export const LIMITE_TELEFONE_HORA = 3;
export const LIMITE_IP_HORA = 10;

export class Recusa extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

const ehTexto = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;

// Formato do corpo antes de gastar leitura no banco. Campo a mais é ignorado (inclusive preço e total).
export function lerCorpo(corpo: unknown): { itens: Carrinho; cliente: DadosCliente } {
  const b = corpo as { itens?: unknown; cliente?: Record<string, unknown> } | null;
  const invalido = new Recusa(400, "Pedido em formato inválido. Recarrega a página e tenta de novo.");
  if (!b || typeof b.itens !== "object" || b.itens === null || Array.isArray(b.itens) || typeof b.cliente !== "object" || b.cliente === null) throw invalido;
  const pares = Object.entries(b.itens);
  if (pares.length > 30 || pares.some(([id, q]) => !ehTexto(id, 60) || typeof q !== "number")) throw invalido;
  const c = b.cliente;
  const e = (c.endereco ?? {}) as Record<string, unknown>;
  const campos = [c.nome, c.telefone, c.pagamento, c.obs, e.rua, e.numero, e.bairro, e.complemento, e.referencia];
  if (campos.some((v) => !ehTexto(v, 400)) || typeof c.trocoPara !== "number") throw invalido;
  const t = (v: unknown) => (v as string).trim();
  return {
    itens: Object.fromEntries(pares) as Carrinho,
    cliente: {
      nome: t(c.nome),
      telefone: c.telefone as string,
      pagamento: c.pagamento as DadosCliente["pagamento"],
      trocoPara: c.trocoPara,
      obs: t(c.obs),
      endereco: { rua: t(e.rua), numero: t(e.numero), bairro: t(e.bairro), complemento: t(e.complemento), referencia: t(e.referencia) },
    },
  };
}

const hash = (v: string) => createHash("sha256").update(v).digest("hex").slice(0, 32);
const lista = <T>(s: FirebaseFirestore.QuerySnapshot) => s.docs.map((d) => ({ ...d.data(), id: d.id }) as T);

export async function criarPedido(itens: Carrinho, cliente: DadosCliente, ip: string, agora = Date.now()) {
  const db = adminDb();
  const dia = diaLocal(agora);
  const fds = fimDeSemana(dia);
  const hora = Math.floor(agora / 3_600_000);
  const limTel = db.doc(`limites/tel-${hash(cliente.telefone)}`);
  const limIp = db.doc(`limites/ip-${hash(ip)}`);
  const contador = db.doc("config/contador");

  return db.runTransaction(async (t) => {
    const [lojaS, premS, prodS, producoesS, pedidosS, telS, ipS, contS] = await Promise.all([
      t.get(db.doc("config/loja")),
      t.get(db.doc("config/premissas")),
      t.get(db.collection("produtos")),
      t.get(db.collection("producoes").orderBy("data", "desc").limit(10)),
      t.get(db.collection("pedidos").where("fimDeSemana", "==", fds)),
      t.get(limTel),
      t.get(limIp),
      t.get(contador),
    ]);

    const loja = lojaS.data() as Loja | undefined;
    if (!loja || !lojaAberta(loja, agora)) throw new Recusa(409, "A loja tá fechada agora.");

    const usado = (s: FirebaseFirestore.DocumentSnapshot) => (s.get("hora") === hora ? (s.get("n") as number) : 0);
    if (usado(telS) >= LIMITE_TELEFONE_HORA) throw new Recusa(429, "Já chegaram vários pedidos desse WhatsApp. Fala com a gente no WhatsApp.");
    if (usado(ipS) >= LIMITE_IP_HORA) throw new Recusa(429, "Muitos pedidos daqui em pouco tempo. Fala com a gente no WhatsApp.");

    const prem = premS.data() as Premissas;
    const produtos = lista<Produto>(prodS);
    const producoes = lista<Producao>(producoesS);
    const pedidos = lista<Pedido>(pedidosS);
    const ativos = pedidos.filter((p) => p.status !== "cancelado");
    const pan = panela(producoes, ativos, prem, dia, () => true);
    const restaG = pan?.resta ?? 0;
    const cardapio = cardapioSite(produtos, ativos, restaG);
    const erro = erroCarrinho(itens, cardapio, restaG);
    if (erro) throw new Recusa(409, erro);

    const linhas = cardapio
      .filter((i) => itens[i.id] > 0)
      .map((i) => itemDoProduto(produtos.find((p) => p.id === i.id)!, "site", itens[i.id], pan?.custoKg ?? 0, prem));
    const base = {
      canal: "site" as const,
      itens: linhas,
      desconto: { tipo: "valor" as const, informado: 0, motivo: "" },
      taxaEntrega: prem.taxaEntrega.valor,
      custoEntrega: prem.custoEntrega.valor,
      pagamento: cliente.pagamento,
      taxas: taxasDoMomento("site", cliente.pagamento, prem),
    };
    const total = calcPedido(base).cobrado;
    const errosDados = errosCliente(cliente, total);
    const primeiro = Object.values(errosDados)[0];
    if (primeiro) throw new Recusa(400, primeiro);

    const numero = ((contS.get("pedidos") as number | undefined) ?? 0) + 1;
    const rastreio = randomBytes(24).toString("base64url"); // 192 bits: não dá pra adivinhar
    const ref = db.collection("pedidos").doc();
    const trocoPara = cliente.pagamento === "dinheiro" ? cliente.trocoPara : 0;
    const pedido: Omit<Pedido, "id"> = {
      ...base,
      criadoEm: agora,
      dia,
      fimDeSemana: fds,
      cliente: cliente.nome,
      bairro: cliente.endereco.bairro,
      status: "novo",
      obs: cliente.obs,
      producaoId: pan?.producao.id ?? "",
      numero,
      telefone: cliente.telefone,
      endereco: cliente.endereco,
      trocoPara,
      rastreio,
    };
    // O que o cliente vê na página de acompanhamento: sem custo, lucro, telefone nem endereço.
    const publico = {
      numero,
      criadoEm: agora,
      status: "novo",
      nome: cliente.nome.split(" ")[0],
      itens: linhas.map((i) => ({ nome: i.nome, qtd: i.qtd, preco: i.preco })),
      taxaEntrega: base.taxaEntrega,
      total,
      pagamento: cliente.pagamento,
      trocoPara,
    };

    t.create(ref, pedido);
    t.create(db.doc(`rastreio/${rastreio}`), publico);
    t.set(contador, { pedidos: numero }, { merge: true });
    t.set(limTel, { hora, n: usado(telS) + 1 });
    t.set(limIp, { hora, n: usado(ipS) + 1 });
    return { id: ref.id, numero, rastreio, total };
  });
}
