// Estoque de potes: contas puras (sem Firestore). Quantidades inteiras; consumo positivo = sai do estoque.
import { conta, type ConfigEstoque, type Embalagem, type Pedido, type Produto, type TipoMovimento } from "./types";

type Mapa = Record<string, number>;
type PedidoPotes = Pick<Pedido, "itens" | "status" | "dia">;

export const NOME_TIPO: Record<TipoMovimento, string> = { venda: "Venda", compra: "Compra", ajuste: "Ajuste", cancelamento: "Cancelamento" };

// Pedido que não conta (novo, cancelado) ou encomenda de dia futuro não tira pote.
const tiraPote = (p: PedidoPotes, hoje: string) => conta(p.status) && p.dia <= hoje;

// O que muda o consumo do pedido. Igual à chave guardada na baixa = já está baixado.
export function chave(p: PedidoPotes | null, hoje: string) {
  if (!p || !tiraPote(p, hoje)) return "";
  const itens: Mapa = {};
  for (const i of p.itens) if (i.qtd > 0) itens[i.produtoId] = (itens[i.produtoId] ?? 0) + i.qtd;
  return Object.keys(itens).sort().map((id) => `${id}:${itens[id]}`).join(",");
}

// Potes que o pedido tira do estoque, pela receita de cada produto e o saco da entrega.
export function consumo(p: PedidoPotes | null, produtos: Pick<Produto, "id" | "potes">[], cfg: ConfigEstoque, hoje: string): Mapa {
  const out: Mapa = {};
  if (!p || !tiraPote(p, hoje)) return out;
  const soma = (id: string, q: number) => id && q && (out[id] = (out[id] ?? 0) + q);
  for (const i of p.itens) for (const parte of produtos.find((x) => x.id === i.produtoId)?.potes ?? []) soma(parte.embalagemId, i.qtd);
  if (cfg.sacoPorPedido) soma(cfg.sacoId, 1);
  return out;
}

// depois − antes, só o que mudou.
export function diferenca(antes: Mapa, depois: Mapa): Mapa {
  const out: Mapa = {};
  for (const id of new Set([...Object.keys(antes), ...Object.keys(depois)])) {
    const d = (depois[id] ?? 0) - (antes[id] ?? 0);
    if (d) out[id] = d;
  }
  return out;
}

export function somar(mapas: Mapa[]): Mapa {
  const out: Mapa = {};
  for (const m of mapas) for (const [id, q] of Object.entries(m)) out[id] = (out[id] ?? 0) + q;
  return out;
}

// Verde, amarelo (até 50% acima do mínimo) e vermelho (abaixo do mínimo ou negativo).
export type Nivel = "ok" | "perto" | "abaixo";
export const nivel = (e: Pick<Embalagem, "quantidade" | "minimo">): Nivel =>
  e.quantidade < 0 || e.quantidade < e.minimo ? "abaixo" : e.quantidade < e.minimo * 1.5 ? "perto" : "ok";

export const abaixoDoMinimo = (lista: Embalagem[]) => lista.filter((e) => nivel(e) === "abaixo");

// Quantos pedidos de um produto ainda cabem no estoque, e qual pote acaba primeiro.
export function daPraMais(produto: Pick<Produto, "id" | "potes">, embalagens: Embalagem[], cfg: ConfigEstoque) {
  const usa = consumo({ itens: [{ produtoId: produto.id, qtd: 1 } as Pedido["itens"][number]], status: "feito", dia: "" }, [produto], cfg, "");
  let n = Infinity;
  let gargalo: Embalagem | null = null;
  for (const [id, q] of Object.entries(usa)) {
    const e = embalagens.find((x) => x.id === id);
    const cabe = Math.floor(Math.max(0, e?.quantidade ?? 0) / q);
    if (cabe < n) [n, gargalo] = [cabe, e ?? null];
  }
  return { n: n === Infinity ? null : n, gargalo };
}

// Potes que ficariam negativos com esse consumo a mais.
export function faltando(mais: Mapa, embalagens: Embalagem[]) {
  return Object.entries(mais)
    .map(([id, q]) => ({ e: embalagens.find((x) => x.id === id), fica: (embalagens.find((x) => x.id === id)?.quantidade ?? 0) - q, q }))
    .filter((x): x is { e: Embalagem; fica: number; q: number } => !!x.e && x.q > 0 && x.fica < 0);
}

export const nomeCurto = (e: Pick<Embalagem, "nome" | "capacidadeMl">) => (e.capacidadeMl ? `${e.capacidadeMl} ml` : e.nome);
export const qtdSinal = (q: number) => (q > 0 ? `+${q}` : q < 0 ? `−${-q}` : "0");

// Produto sem receita no cadastro usa a padrão (carga inicial e telas antes de salvar).
export const comReceita = <T extends Pick<Produto, "id" | "potes">>(produtos: T[], padrao: Record<string, Produto["potes"]>) =>
  produtos.map((p) => ({ ...p, potes: p.potes ?? padrao[p.id] ?? [] }));

// Carga inicial: compra menos o que cada pedido já usou desde cfg.desde.
export function planoCarga(pedidos: Pedido[], produtos: Pick<Produto, "id" | "potes">[], cfg: ConfigEstoque, compra: Mapa, hoje: string) {
  const linhas = pedidos
    .filter((p) => p.dia >= cfg.desde)
    .sort((a, b) => a.criadoEm - b.criadoEm)
    .map((p) => ({ p, potes: consumo(p, produtos, cfg, hoje), chave: chave(p, hoje) }));
  const usado = somar(linhas.map((l) => l.potes));
  const saldo = (id: string) => (compra[id] ?? 0) - (usado[id] ?? 0);
  return { linhas, usado, saldo };
}

const CANAIS = { whatsapp: "WhatsApp", ifood: "iFood", site: "Site" } as const;
export const descPedido = (p: Pick<Pedido, "canal" | "numero" | "cliente">) => [CANAIS[p.canal], p.numero && `nº ${p.numero}`, p.cliente].filter(Boolean).join(" · ");
