import { calcPedido } from "./calc";
import type { Canal, Pedido } from "./types";

const ZERO = { pedidos: 0, bruto: 0, desconto: 0, liquido: 0, taxaEntrega: 0, cobrado: 0, taxasIfood: 0, taxaPagamento: 0, custo: 0, recebido: 0, lucro: 0, maoDeObra: 0, pesoG: 0 };
export type Resumo = typeof ZERO & { margem: number; ticket: number; pctDesconto: number };

export function resumo(pedidos: Pedido[]): Resumo {
  const r = { ...ZERO };
  for (const p of pedidos) {
    if (p.status === "cancelado") continue;
    const t = calcPedido(p);
    r.pedidos++;
    r.taxaEntrega += p.taxaEntrega;
    for (const k of ["bruto", "desconto", "liquido", "cobrado", "taxasIfood", "taxaPagamento", "custo", "recebido", "lucro", "maoDeObra", "pesoG"] as const) r[k] += t[k];
  }
  return {
    ...r,
    margem: r.cobrado ? r.lucro / r.cobrado : 0,
    ticket: r.pedidos ? Math.round(r.cobrado / r.pedidos) : 0,
    pctDesconto: r.bruto ? r.desconto / r.bruto : 0,
  };
}

export const porCanal = (pedidos: Pedido[]): Record<Canal, Resumo> => ({
  whatsapp: resumo(pedidos.filter((p) => p.canal === "whatsapp")),
  ifood: resumo(pedidos.filter((p) => p.canal === "ifood")),
});

export function porProduto(pedidos: Pedido[]) {
  const m = new Map<string, { nome: string; qtd: number; valor: number }>();
  for (const p of pedidos) {
    if (p.status === "cancelado") continue;
    for (const i of p.itens) {
      const x = m.get(i.produtoId) ?? { nome: i.nome, qtd: 0, valor: 0 };
      x.qtd += i.qtd;
      x.valor += i.qtd * i.preco;
      m.set(i.produtoId, x);
    }
  }
  return [...m.entries()].map(([id, x]) => ({ id, ...x })).sort((a, b) => b.qtd - a.qtd);
}

export function porDia(pedidos: Pedido[]) {
  const m = new Map<string, { cobrado: number; pedidos: number }>();
  for (const p of pedidos) {
    if (p.status === "cancelado") continue;
    const x = m.get(p.dia) ?? { cobrado: 0, pedidos: 0 };
    x.cobrado += calcPedido(p).cobrado;
    x.pedidos++;
    m.set(p.dia, x);
  }
  return [...m.entries()].map(([dia, x]) => ({ dia, ...x })).sort((a, b) => a.dia.localeCompare(b.dia));
}
