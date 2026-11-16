// Estoque de potes: itens, receitas e a carga inicial (compra de 11/11/2026).
import type { ConfigEstoque, Embalagem, PartePote } from "@/lib/types";

const pote = (ml: number, ordem: number, minimo = 15): Embalagem => ({ id: `pote-${ml}`, nome: `Pote ${ml} ml`, capacidadeMl: ml, quantidade: 0, minimo, custo: null, ordem });

export const embalagens: Embalagem[] = [
  pote(250, 1, 30),
  pote(500, 2),
  pote(750, 3),
  pote(1000, 4),
  { id: "marmita-3", nome: "Marmita 3 compartimentos", capacidadeMl: null, quantidade: 0, minimo: 15, custo: null, ordem: 5 },
  { id: "saco-entrega", nome: "Saco de entrega", capacidadeMl: null, quantidade: 0, minimo: 15, custo: null, ordem: 6 },
];

// null = parte sem pote no estoque (100 ml e 145 ml saíram do controle).
const r = (feijoada: number, arroz: number | null, couve: number | null, farofa: number | null): PartePote[] => [
  { parte: "Feijoada", embalagemId: `pote-${feijoada}` },
  ...(arroz ? [{ parte: "Arroz", embalagemId: `pote-${arroz}` }] : []),
  ...(couve ? [{ parte: "Couve", embalagemId: `pote-${couve}` }] : []),
  ...(farofa ? [{ parte: "Farofa", embalagemId: `pote-${farofa}` }] : []),
];

// Produto sem receita no cadastro recebe esta na carga inicial. Bebida não usa pote.
export const receitas: Record<string, PartePote[]> = {
  "feijoada-individual": r(500, 250, null, null),
  "feijoada-2": r(750, 500, 250, 250),
  "feijoada-3": r(1000, 750, 250, 250),
  "simples-individual": r(500, null, null, null),
  "simples-2": r(750, null, 250, null),
  "simples-3": r(1000, null, 250, null),
  // Adicionais: sem pote até o dono definir.
  "adicional-arroz": [{ parte: "Arroz", embalagemId: "" }],
  "adicional-farofa": [{ parte: "Farofa", embalagemId: "" }],
  "adicional-couve": [{ parte: "Couve", embalagemId: "" }],
};

export const configEstoque: ConfigEstoque = { sacoPorPedido: true, sacoId: "saco-entrega", desde: "2026-11-13" };

export const cargaInicial = {
  dia: "2026-11-11",
  compra: { "pote-250": 48, "pote-500": 73, "pote-750": 50, "pote-1000": 25, "marmita-3": 10, "saco-entrega": 50 } as Record<string, number>,
  // Contagem do dono depois dos pedidos de 13 a 15/11 (saco não foi contado).
  esperado: { "pote-250": 20, "pote-500": 63, "pote-750": 37, "pote-1000": 19, "marmita-3": 10 } as Record<string, number>,
};
