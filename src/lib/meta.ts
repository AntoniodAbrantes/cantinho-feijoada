import { bpFmt, brl, kg } from "./format";
import type { Premissas } from "./types";

export type Tipo = "dinheiro" | "pct" | "peso" | "inteiro" | "base";

export const PREMISSAS: { grupo: string; itens: { chave: keyof Premissas; rotulo: string; tipo: Tipo }[] }[] = [
  {
    grupo: "Produção",
    itens: [
      { chave: "rendimentoG", rotulo: "Rendimento da produção", tipo: "peso" },
      { chave: "maoDeObraKg", rotulo: "Mão de obra por kg", tipo: "dinheiro" },
      { chave: "temperos", rotulo: "Temperos e gastos fora da nota (por produção)", tipo: "dinheiro" },
      { chave: "gasEnergia", rotulo: "Gás e energia (por produção)", tipo: "dinheiro" },
      { chave: "margemDesejadaBp", rotulo: "Margem de lucro desejada", tipo: "pct" },
    ],
  },
  {
    grupo: "iFood",
    itens: [
      { chave: "ifoodComissaoBp", rotulo: "Comissão", tipo: "pct" },
      { chave: "ifoodOnlineBp", rotulo: "Taxa de pagamento online", tipo: "pct" },
      { chave: "ifoodBaseComissao", rotulo: "Comissão incide sobre", tipo: "base" },
      { chave: "ifoodMensalidade", rotulo: "Mensalidade", tipo: "dinheiro" },
      { chave: "ifoodLimiteMensalidade", rotulo: "Vendas a partir das quais tem mensalidade", tipo: "dinheiro" },
      { chave: "parteIfoodBp", rotulo: "Parte das vendas pelo iFood (projeção)", tipo: "pct" },
    ],
  },
  {
    grupo: "Vendas e entrega",
    itens: [
      { chave: "diasVendaMes", rotulo: "Dias de venda por mês", tipo: "inteiro" },
      { chave: "taxaEntrega", rotulo: "Taxa de entrega cobrada", tipo: "dinheiro" },
      { chave: "custoEntrega", rotulo: "Custo por entrega", tipo: "dinheiro" },
    ],
  },
  {
    grupo: "Custos fixos do mês",
    itens: [
      { chave: "das", rotulo: "DAS do MEI", tipo: "dinheiro" },
      { chave: "divulgacao", rotulo: "Divulgação e anúncios", tipo: "dinheiro" },
      { chave: "outrosFixos", rotulo: "Outros custos fixos", tipo: "dinheiro" },
      { chave: "limiteMei", rotulo: "Limite anual do MEI", tipo: "dinheiro" },
    ],
  },
  {
    grupo: "Maquininha",
    itens: [
      { chave: "maqDebitoBp", rotulo: "Débito", tipo: "pct" },
      { chave: "maqCreditoBp", rotulo: "Crédito à vista", tipo: "pct" },
      { chave: "maqCredito12xBp", rotulo: "Crédito 12x (não recomendado)", tipo: "pct" },
    ],
  },
];

export function mostrar(tipo: Tipo, v: number | string) {
  if (tipo === "base") return v === "bruto" ? "Valor bruto dos itens" : "Valor líquido dos itens";
  const n = v as number;
  return tipo === "dinheiro" ? brl(n) : tipo === "pct" ? bpFmt(n) : tipo === "peso" ? kg(n) : String(n);
}
