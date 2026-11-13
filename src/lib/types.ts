// Dinheiro em centavos, percentuais em pontos-base (1% = 100), pesos em gramas.

export type Canal = "whatsapp" | "ifood";
export type Categoria = "feijoada" | "adicional" | "bebida";
export type FormaPagamento = "pix" | "dinheiro" | "debito" | "credito" | "ifood_online";
export type StatusPedido = "feito" | "entregue" | "cancelado";

export interface Produto {
  id: string;
  nome: string;
  curto: string; // rótulo do botão no lançamento
  categoria: Categoria;
  ordem: number;
  precoWhatsapp: number;
  precoIfood: number;
  ativoWhatsapp: boolean;
  ativoIfood: boolean;
  custo: number; // adicional e bebida; feijoada usa peso × custo/kg
  pesoFeijoadaG: number;
  embalagem: number;
  estoque?: number; // só bebida
  estimativas: string[]; // campos marcados "a confirmar"
}

export interface Premissa<T = number> {
  valor: T;
  origem: string;
  estimativa: boolean;
}

export interface Premissas {
  rendimentoG: Premissa;
  maoDeObraKg: Premissa;
  temperos: Premissa;
  gasEnergia: Premissa;
  margemDesejadaBp: Premissa;
  ifoodComissaoBp: Premissa;
  ifoodOnlineBp: Premissa;
  ifoodBaseComissao: Premissa<"liquido" | "bruto">;
  ifoodMensalidade: Premissa;
  ifoodLimiteMensalidade: Premissa;
  diasVendaMes: Premissa;
  parteIfoodBp: Premissa;
  taxaEntrega: Premissa;
  custoEntrega: Premissa;
  das: Premissa;
  divulgacao: Premissa;
  outrosFixos: Premissa;
  limiteMei: Premissa;
  maqDebitoBp: Premissa;
  maqCreditoBp: Premissa;
  maqCredito12xBp: Premissa;
}

export interface Insumo {
  nome: string;
  precoPago: number;
  pesoPacoteG: number | null;
  usadoG: number | null;
  custo: number;
  obs: string;
}

export interface Producao {
  id: string;
  data: string; // aaaa-mm-dd
  rendimentoG: number;
  rendimentoEstimativa: boolean;
  insumos: Insumo[];
}

export interface ItemPedido {
  produtoId: string;
  nome: string;
  categoria: Categoria;
  qtd: number;
  preco: number;
  custo: number; // unitário, já com embalagem e mão de obra
  maoDeObra: number; // unitário, para "fica com a família"
  pesoG: number; // feijoada por unidade
}

export interface Desconto {
  tipo: "valor" | "pct";
  informado: number; // centavos ou pontos-base
  motivo: string;
}

export interface TaxasCongeladas {
  comissaoBp: number;
  onlineBp: number;
  base: "liquido" | "bruto";
  pagamentoBp: number;
}

export interface PedidoBase {
  canal: Canal;
  itens: ItemPedido[];
  desconto: Desconto;
  taxaEntrega: number;
  custoEntrega: number;
  pagamento: FormaPagamento;
  taxas: TaxasCongeladas;
}

export interface Pedido extends PedidoBase {
  id: string;
  criadoEm: number; // epoch ms
  dia: string;
  fimDeSemana: string;
  cliente: string;
  bairro: string;
  status: StatusPedido;
  obs: string;
  producaoId: string;
}

export type CategoriaCompra =
  | "ingredientes"
  | "embalagens"
  | "bebidas"
  | "divulgacao"
  | "mimo"
  | "outros";

export interface Compra {
  id: string;
  data: string;
  descricao: string;
  categoria: CategoriaCompra;
  valor: number;
  obs: string;
}

export interface Cenario {
  id: string;
  nome: string;
  ordem: number;
  porDia: Record<string, number>; // produtoId → porções por dia
}
