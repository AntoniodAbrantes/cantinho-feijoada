// Dinheiro em centavos, percentuais em pontos-base (1% = 100), pesos em gramas.

export type Canal = "whatsapp" | "ifood" | "site";
export type Categoria = "feijoada" | "adicional" | "bebida";
export type FormaPagamento = "pix" | "dinheiro" | "debito" | "credito" | "ifood_online";
// "novo": pedido do site esperando aceite (fora do faturamento e do estoque). Aceitar = virar "feito".
export type StatusPedido = "novo" | "feito" | "saiu" | "entregue" | "cancelado";

// Só "novo" e "cancelado" não contam: não entram nos totais nem baixam bebida.
export const conta = (s: StatusPedido) => s !== "novo" && s !== "cancelado";

// Feijoada simples (sem arroz e farofa): mesmos tamanhos da completa, ids "simples-*".
export const ehSimples = (p: { id: string }) => p.id.startsWith("simples");

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
  ativoSite?: boolean; // site usa o preço do WhatsApp; ausente = fora do site
  esgotadoSite?: boolean; // marcado à mão
  custo: number; // adicional e bebida; feijoada usa peso × custo/kg
  pesoFeijoadaG: number;
  embalagem: number;
  estoque?: number; // só bebida
  potes?: PartePote[]; // receita de embalagens: o que sai do estoque de potes por unidade vendida
  estimativas: string[]; // campos marcados "a confirmar"
}

// Uma parte do produto e o pote em que ela vai. embalagemId "" = sem pote (ainda não definido).
export interface PartePote {
  parte: string;
  embalagemId: string;
}

// Potes e sacos. A quantidade pode ficar negativa (vendeu sem ter dado entrada): aparece em vermelho.
export interface Embalagem {
  id: string;
  nome: string;
  capacidadeMl: number | null;
  quantidade: number;
  minimo: number; // abaixo disso, alerta no painel
  custo: number | null; // unitário, da última compra; null = não informado
  ordem: number;
}

export type TipoMovimento = "venda" | "compra" | "ajuste" | "cancelamento";

export interface Movimento {
  id: string;
  em: number; // epoch ms
  dia: string;
  embalagemId: string;
  qtd: number; // + entrou, − saiu
  tipo: TipoMovimento;
  pedidoId: string | null;
  obs: string;
}

// config/estoque. Sem documento = estoque de potes ainda não começou: nada dá baixa.
export interface ConfigEstoque {
  sacoPorPedido: boolean;
  sacoId: string;
  desde: string; // pedidos deste dia em diante dão baixa
}

// baixas/{pedidoId}: o que o pedido já tirou do estoque. Mesma chave = nada a fazer (nunca baixa duas vezes).
export interface Baixa {
  id: string;
  potes: Record<string, number>;
  chave: string;
  em: number;
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
  embalagem?: number; // unitário, já dentro do custo; sai do custo se o pedido não usou pote
  brinde?: boolean; // feijoada de presente da fidelidade: preço = só a diferença da troca de tamanho
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
  semPote?: boolean; // "Usou pote?" = Não: nenhum pote sai do estoque nem entra no custo
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
  // Pedidos do site
  numero?: number; // sequencial, para falar com o cliente
  telefone?: string; // só dígitos, com DDD
  endereco?: Endereco;
  local?: { lat: number; lng: number }; // pino do cliente no mapa
  distanciaKm?: number; // rota de carro da cozinha até o pino (ou linha reta × 1,3)
  trocoPara?: number;
  rastreio?: string; // id de rastreio/{token}: o que o cliente vê
  aceitoEm?: number;
  previsaoEm?: number; // hora prevista de chegada, escolhida no aceite
  agendadoPara?: number; // pedido do site agendado: começo da faixa de 30 min
  avaliacao?: Avaliacao;
  motivoRecusa?: string;
  // Encomenda: lembrete da véspera (disparado e visto ficam salvos pra não repetir)
  lembreteEm?: number;
  lembreteVistoEm?: number;
  fidelidade?: Resgate; // pedido que resgatou o presente do Selo do Cantinho (não ganha selo)
}

// Selo do Cantinho: a cada `meta` pedidos entregues, uma feijoada de presente.
// "menor": o menor tamanho entre os pedidos do cartão; "maior": o maior.
export interface ConfigFidelidade {
  ativo: boolean;
  meta: number;
  regra: "menor" | "maior";
}

// O que o pedido de resgate guarda: o prêmio ganho, o que o cliente levou e quanto pagou na troca.
export interface Resgate {
  premioId: string;
  premioNome: string;
  escolhidoId: string;
  escolhidoNome: string;
  troca: number; // centavos; 0 = levou o tamanho ganho
}

// fidelidade/{telefone}: ajustes manuais de selo (+ ou −), com motivo.
export interface AjusteSelo {
  em: number;
  qtd: number;
  motivo: string;
}
export interface ClienteFidelidade {
  id: string; // telefone normalizado
  ajustes: AjusteSelo[];
}

// config/tempo: tempo estimado de entrega que o site mostra. Histórico em tempoHistorico.
export type ModoTempo = "normal" | "movimentado" | "lotado" | "personalizado";
export interface TempoEntrega {
  modo: ModoTempo;
  min: number; // minutos
  max: number;
  em: number;
}

// Nota do cliente do site depois da entrega.
export interface Avaliacao {
  nota: number; // 1 a 5
  comentario: string;
  em: number;
}

export interface Endereco {
  rua: string;
  numero: string;
  bairro: string;
  complemento: string;
  referencia: string;
  cep?: string; // só dígitos
  cidade?: string;
}

// config/loja. Horário "hh:mm" no fuso de Fortaleza; dia sem horário = fechado.
export type DiaLoja = "sexta" | "sabado" | "domingo";
export interface Loja {
  modo: "auto" | "aberta" | "fechada";
  horarios: Partial<Record<DiaLoja, { inicio: string; fim: string }>>;
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
