// Pedido do site: o navegador manda só quantidades e dados de entrega; preço, total, estoque e loja aberta
// são conferidos aqui, numa transação, a partir do que está no sistema.
import { createHash, randomBytes } from "node:crypto";
import { adminDb } from "./admin";
import { ENTREGA } from "@/data/entrega";
import { calcularEntrega, rotaOsrm, type Config, type Rota } from "./entrega";
import { calcPedido, itemDoProduto } from "../calc";
import { descontoDoCupom, erroCupom, normalizarCupom, usosDoCupom } from "../cupom";
import { FIDELIDADE_PADRAO, cartao, itemPremio, normalizarTelefone, tamanhoDoPedido } from "../fidelidade";
import { diaLocal, fimDeSemana } from "../format";
import { horariosAgenda, lojaAberta } from "../loja";
import { panela, taxasDoMomento } from "../pedido";
import type { Ponto } from "../entrega";
import { cardapioSite, erroCarrinho, errosCliente, type Carrinho, type DadosCliente } from "../site";
import type { AjusteSelo, ConfigFidelidade, Cupom, Loja, Pedido, Premissas, Producao, Produto } from "../types";

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
  if ([e.cep, e.cidade].some((v) => v !== undefined && !ehTexto(v, 400))) throw invalido;
  const l = c.local as Record<string, unknown> | undefined;
  if (l !== undefined && (typeof l !== "object" || l === null || typeof l.lat !== "number" || typeof l.lng !== "number")) throw invalido;
  if (c.agendado !== undefined && !Number.isSafeInteger(c.agendado)) throw invalido;
  const pr = c.premio as Record<string, unknown> | undefined;
  if (pr !== undefined && (typeof pr !== "object" || pr === null || !ehTexto(pr.escolhidoId, 60))) throw invalido;
  if (c.cupom !== undefined && !ehTexto(c.cupom, 40)) throw invalido;
  const cupom = c.cupom ? normalizarCupom(c.cupom as string) : "";
  const t = (v: unknown) => (v as string).trim();
  return {
    itens: Object.fromEntries(pares) as Carrinho,
    cliente: {
      nome: t(c.nome),
      telefone: normalizarTelefone(c.telefone as string),
      pagamento: c.pagamento as DadosCliente["pagamento"],
      trocoPara: c.trocoPara,
      obs: t(c.obs),
      endereco: {
        rua: t(e.rua), numero: t(e.numero), bairro: t(e.bairro), complemento: t(e.complemento), referencia: t(e.referencia),
        ...(e.cep !== undefined && { cep: t(e.cep) }),
        ...(e.cidade !== undefined && { cidade: t(e.cidade) }),
      },
      ...(l && { local: { lat: l.lat as number, lng: l.lng as number } }),
      ...(c.agendado !== undefined && { agendado: c.agendado as number }),
      ...(pr && { premio: { escolhidoId: pr.escolhidoId as string } }),
      ...(cupom && { cupom }),
    },
  };
}

export const hash = (v: string) => createHash("sha256").update(v).digest("hex").slice(0, 32);
const lista = <T>(s: FirebaseFirestore.QuerySnapshot) => s.docs.map((d) => ({ ...d.data(), id: d.id }) as T);

// Taxa por distância: calculada aqui, antes da transação (chama o OSRM). Fora da área não grava.
export const FORA_DA_AREA = "Esse endereço fica fora da nossa área de entrega. Combina com a gente pelo WhatsApp.";
async function entregaDoPedido(local: Ponto | undefined, config: Config, rota: Rota) {
  if (!config.origem) return null; // sem origem: taxa fixa das premissas
  if (!local) throw new Recusa(400, "Marca no mapa onde é a entrega.");
  const c = (await calcularEntrega(local, config, rota))!;
  if (c.taxa === null) throw new Recusa(409, FORA_DA_AREA);
  return { km: c.km, taxa: c.taxa };
}

export async function criarPedido(itens: Carrinho, cliente: DadosCliente, ip: string, agora = Date.now(), config: Config = ENTREGA, rota: Rota = rotaOsrm) {
  const db = adminDb();
  const agendado = cliente.agendado;
  const dia = diaLocal(agendado ?? agora); // agendado: entra na panela e nas vendas do dia da entrega
  const fds = fimDeSemana(dia);
  const hora = Math.floor(agora / 3_600_000);
  const limTel = db.doc(`limites/tel-${hash(cliente.telefone)}`);
  const limIp = db.doc(`limites/ip-${hash(ip)}`);
  const contador = db.doc("config/contador");
  const entrega = await entregaDoPedido(cliente.local, config, rota);
  const codigo = cliente.cupom;

  return db.runTransaction(async (t) => {
    const [lojaS, premS, prodS, producoesS, pedidosS, telS, ipS, contS, fidS, cliS, doTelS] = await Promise.all([
      t.get(db.doc("config/loja")),
      t.get(db.doc("config/premissas")),
      t.get(db.collection("produtos")),
      t.get(db.collection("producoes").orderBy("data", "desc").limit(10)),
      t.get(db.collection("pedidos").where("fimDeSemana", "==", fds)),
      t.get(limTel),
      t.get(limIp),
      t.get(contador),
      t.get(db.doc("config/fidelidade")),
      t.get(db.doc(`fidelidade/${cliente.telefone}`)),
      t.get(db.collection("pedidos").where("telefone", "==", cliente.telefone)),
    ]);
    // Cupom: o cadastro e os usos de todo mundo, lidos na transação (dois pedidos juntos não passam do limite).
    const [cupomS, usosS] = codigo ? await Promise.all([t.get(db.doc(`cupons/${codigo}`)), t.get(db.collection("pedidos").where("cupom", "==", codigo))]) : [null, null];

    const loja = lojaS.data() as Loja | undefined;
    if (!loja) throw new Recusa(409, "A loja tá fechada agora.");
    if (agendado !== undefined) {
      if (!horariosAgenda(loja, agora).some((h) => h.inicio === agendado)) throw new Recusa(409, "Esse horário não dá mais pra agendar. Escolhe outro.");
    } else if (!lojaAberta(loja, agora)) throw new Recusa(409, "A loja tá fechada agora.");

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

    // Selo do Cantinho: o presente só entra se o cartão (lido aqui, na transação) tiver prêmio liberado.
    const fid = (fidS.data() as ConfigFidelidade | undefined) ?? FIDELIDADE_PADRAO;
    const card = cartao(lista<Pedido>(doTelS), (cliS.get("ajustes") as AjusteSelo[] | undefined) ?? [], produtos, fid);
    const brinde = cliente.premio ? fid.ativo && itemPremio(card, cliente.premio.escolhidoId, produtos, "site", pan?.custoKg ?? 0, prem) : null;
    if (cliente.premio && !brinde) throw new Recusa(409, "Esse presente não tá mais disponível. Volta um passo e confere.");
    // O presente também sai da panela: entra na conta do estoque como mais uma unidade.
    const comBrinde = brinde ? { ...itens, [brinde.item.produtoId]: (itens[brinde.item.produtoId] ?? 0) + 1 } : itens;
    const erro = erroCarrinho(comBrinde, cardapio, restaG);
    if (erro) throw new Recusa(409, erro);

    let desconto: Pedido["desconto"] = { tipo: "valor", informado: 0, motivo: "" };
    if (codigo) {
      const c = cupomS?.exists ? ({ ...cupomS.data(), id: cupomS.id } as Cupom) : null;
      const usos = usosS!.docs.map((d) => d.data() as Pedido);
      const itensPagos = cardapio.reduce((s, i) => s + (itens[i.id] ?? 0) * i.preco, 0);
      const e = erroCupom(c, { hoje: diaLocal(agora), itens: itensPagos, usos: usosDoCupom(usos, codigo), usosDoTelefone: usosDoCupom(lista<Pedido>(doTelS), codigo), comPresente: !!brinde });
      if (e) throw new Recusa(409, e);
      desconto = descontoDoCupom(c!);
    }

    const linhas = cardapio
      .filter((i) => itens[i.id] > 0)
      .map((i) => itemDoProduto(produtos.find((p) => p.id === i.id)!, "site", itens[i.id], pan?.custoKg ?? 0, prem));
    if (brinde) linhas.push(brinde.item);
    const base = {
      canal: "site" as const,
      itens: linhas,
      desconto,
      taxaEntrega: entrega ? entrega.taxa : prem.taxaEntrega.valor,
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
      ...(entrega && { local: cliente.local, distanciaKm: entrega.km }),
      ...(agendado !== undefined && { agendadoPara: agendado }),
      trocoPara,
      rastreio,
      ...(brinde && { fidelidade: brinde.resgate }),
      ...(codigo && { cupom: codigo }),
    };
    // O que o cliente vê na página de acompanhamento: sem custo, lucro, telefone nem endereço.
    const publico = {
      numero,
      criadoEm: agora,
      status: "novo",
      nome: cliente.nome.split(" ")[0],
      itens: linhas.map((i) => ({ nome: i.nome, qtd: i.qtd, preco: i.preco })),
      taxaEntrega: base.taxaEntrega,
      ...(codigo && { cupom: codigo, desconto: calcPedido(base).desconto }),
      total,
      pagamento: cliente.pagamento,
      trocoPara,
      ...(agendado !== undefined && { agendadoPara: agendado }),
      // Cartão de selos da confirmação: quantos tinha e se este pedido carimba mais um (vale quando for entregue).
      ...(fid.ativo && { selo: { antes: brinde ? 0 : card.selos, meta: card.meta, resgate: !!brinde, ganha: !brinde && tamanhoDoPedido({ itens: linhas }) > 0 } }),
    };

    t.create(ref, pedido);
    t.create(db.doc(`rastreio/${rastreio}`), publico);
    t.set(contador, { pedidos: numero }, { merge: true });
    t.set(limTel, { hora, n: usado(telS) + 1 });
    t.set(limIp, { hora, n: usado(ipS) + 1 });
    return { id: ref.id, numero, rastreio, total };
  });
}
