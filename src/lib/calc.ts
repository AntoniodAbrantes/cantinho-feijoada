import type { Canal, FormaPagamento, ItemPedido, PedidoBase, Premissas, Producao, Produto } from "./types";

export const pct = (valor: number, bp: number) => Math.round((valor * bp) / 10000);

export const totalProducao = (p: Producao) => p.insumos.reduce((s, i) => s + i.custo, 0);

// Nota do mercado + temperos e gás/energia das premissas (gastos por produção fora da nota).
export const custoProducao = (p: Producao, prem: Premissas) => totalProducao(p) + prem.temperos.valor + prem.gasEnergia.valor;

// Custo do insumo na produção: preço proporcional ao que foi usado; sem peso, o preço inteiro.
export const custoInsumo = (precoPago: number, pesoPacoteG: number | null, usadoG: number | null) =>
  pesoPacoteG && usadoG ? Math.round((precoPago * usadoG) / pesoPacoteG) : precoPago;

// Sem arredondar: o arredondamento acontece por item.
export const custoPorKg = (total: number, rendimentoG: number) =>
  rendimentoG > 0 ? (total * 1000) / rendimentoG : 0;

export function custoPorcao(produto: Pick<Produto, "pesoFeijoadaG" | "embalagem" | "custo">, custoKg: number, maoDeObraKg: number) {
  if (!produto.pesoFeijoadaG) return { comida: produto.custo, embalagem: 0, maoDeObra: 0, total: produto.custo };
  const comida = Math.round((produto.pesoFeijoadaG * custoKg) / 1000);
  const maoDeObra = Math.round((produto.pesoFeijoadaG * maoDeObraKg) / 1000);
  return { comida, embalagem: produto.embalagem, maoDeObra, total: comida + produto.embalagem + maoDeObra };
}

export const taxasIfoodBp = (p: Premissas) => p.ifoodComissaoBp.valor + p.ifoodOnlineBp.valor;

export function lucroCanal(preco: number, custo: number, canal: Canal, p: Premissas) {
  const taxas = canal === "ifood" ? pct(preco, taxasIfoodBp(p)) : 0;
  const lucro = preco - taxas - custo;
  return { taxas, lucro, margem: preco ? lucro / preco : 0 };
}

export function precoMinimo(custo: number, canal: Canal, p: Premissas) {
  const bp = (canal === "ifood" ? taxasIfoodBp(p) : 0) + p.margemDesejadaBp.valor;
  return bp >= 10000 ? Infinity : Math.ceil(custo / (1 - bp / 10000));
}

export function taxaPagamentoBp(forma: FormaPagamento, p: Premissas) {
  if (forma === "debito") return p.maqDebitoBp.valor;
  if (forma === "credito") return p.maqCreditoBp.valor;
  return 0; // pix, dinheiro; online do iFood já está nas taxas do iFood
}

export function calcPedido(ped: PedidoBase) {
  const bruto = ped.itens.reduce((s, i) => s + i.qtd * i.preco, 0);
  const desconto = Math.min(
    bruto,
    ped.desconto.tipo === "valor" ? ped.desconto.informado : pct(bruto, ped.desconto.informado),
  );
  const liquido = bruto - desconto;
  const cobrado = liquido + ped.taxaEntrega;
  let taxasIfood = 0;
  if (ped.canal === "ifood") {
    taxasIfood = pct(ped.taxas.base === "bruto" ? bruto : liquido, ped.taxas.comissaoBp);
    if (ped.pagamento === "ifood_online") taxasIfood += pct(cobrado, ped.taxas.onlineBp);
  }
  const taxaPagamento = pct(cobrado, ped.taxas.pagamentoBp);
  const custo = ped.itens.reduce((s, i) => s + i.qtd * i.custo, 0) + ped.custoEntrega;
  const recebido = cobrado - taxasIfood - taxaPagamento;
  const lucro = recebido - custo;
  const maoDeObra = ped.itens.reduce((s, i) => s + i.qtd * i.maoDeObra, 0);
  const pesoG = ped.itens.reduce((s, i) => s + i.qtd * i.pesoG, 0);
  return { bruto, desconto, liquido, cobrado, taxasIfood, taxaPagamento, custo, recebido, lucro, margem: cobrado ? lucro / cobrado : 0, maoDeObra, pesoG };
}
export type Totais = ReturnType<typeof calcPedido>;

export const mensalidadeIfood = (vendasIfoodMes: number, p: Premissas) =>
  vendasIfoodMes > p.ifoodLimiteMensalidade.valor ? p.ifoodMensalidade.valor : 0;

// produtoId → unidades a baixar do estoque
export function baixaEstoque(itens: ItemPedido[]) {
  const out: Record<string, number> = {};
  for (const i of itens) if (i.categoria === "bebida" && i.qtd > 0) out[i.produtoId] = (out[i.produtoId] ?? 0) + i.qtd;
  return out;
}

export function itemDoProduto(produto: Produto, canal: Canal, qtd: number, custoKg: number, p: Premissas): ItemPedido {
  const c = custoPorcao(produto, custoKg, p.maoDeObraKg.valor);
  return {
    produtoId: produto.id,
    nome: produto.nome,
    categoria: produto.categoria,
    qtd,
    preco: canal === "ifood" ? produto.precoIfood : produto.precoWhatsapp,
    custo: c.total,
    maoDeObra: c.maoDeObra,
    pesoG: produto.pesoFeijoadaG,
  };
}

// Projeção do mês para um cenário de porções por dia (uma porção por pedido).
export function projecao(porDia: Record<string, number>, produtos: Produto[], custoKg: number, p: Premissas) {
  const dias = p.diasVendaMes.valor;
  const parteIfood = p.parteIfoodBp.valor / 10000;
  let porcoesDia = 0, gDia = 0, fatWhatsapp = 0, fatIfood = 0, embalagens = 0;
  for (const prod of produtos) {
    const n = porDia[prod.id] ?? 0;
    if (!n) continue;
    const mes = n * dias;
    porcoesDia += n;
    gDia += n * prod.pesoFeijoadaG;
    fatWhatsapp += Math.round(mes * (1 - parteIfood) * prod.precoWhatsapp);
    fatIfood += Math.round(mes * parteIfood * prod.precoIfood);
    embalagens += mes * prod.embalagem;
  }
  const gMes = gDia * dias;
  const pedidos = porcoesDia * dias;
  const faturamento = fatWhatsapp + fatIfood;
  const ingredientes = Math.round((gMes * custoKg) / 1000);
  const maoDeObra = Math.round((gMes * p.maoDeObraKg.valor) / 1000);
  const taxasIfood = pct(fatIfood, taxasIfoodBp(p));
  const mensalidade = mensalidadeIfood(fatIfood, p);
  const entregasRecebidas = pedidos * p.taxaEntrega.valor;
  const custoEntregas = pedidos * p.custoEntrega.valor;
  const fixos = p.das.valor + p.divulgacao.valor + p.outrosFixos.valor + mensalidade;
  const receita = faturamento + entregasRecebidas;
  const variaveis = ingredientes + embalagens + maoDeObra + taxasIfood + custoEntregas;
  const lucro = receita - variaveis - fixos;
  const lucroPorPedido = pedidos ? (receita - variaveis) / pedidos : 0;
  const pedidosEmpate = lucroPorPedido > 0 ? Math.ceil(fixos / lucroPorPedido) : Infinity;
  return {
    porcoesDia, gDia, gMes, producoes: p.rendimentoG.valor ? gMes / p.rendimentoG.valor : 0, pedidos,
    fatWhatsapp, fatIfood, faturamento, ingredientes, embalagens, maoDeObra, taxasIfood, mensalidade,
    entregasRecebidas, custoEntregas, das: p.das.valor, divulgacao: p.divulgacao.valor, outrosFixos: p.outrosFixos.valor,
    receita, lucro, margem: receita ? lucro / receita : 0, familia: lucro + maoDeObra,
    receita12: receita * 12, cabeMei: receita * 12 <= p.limiteMei.valor,
    pedidosEmpate, pedidosEmpateDia: pedidosEmpate / dias,
  };
}
