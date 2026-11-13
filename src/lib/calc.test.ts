import { describe, expect, it } from "vitest";
import { baixaEstoque, calcPedido, projecao, custoInsumo, custoPorKg, custoProducao, custoPorcao, itemDoProduto, lucroCanal, mensalidadeIfood, precoMinimo, totalProducao } from "./calc";
import { cenarios, premissas as p, producoes, produtos } from "@/data/seed";
import type { PedidoBase } from "./types";

const prod = (id: string) => produtos.find((x) => x.id === id)!;
const custoKg = custoPorKg(totalProducao(producoes[0]), producoes[0].rendimentoG);
const taxas = { comissaoBp: 1200, onlineBp: 320, base: "liquido" as const, pagamentoBp: 0 };

describe("custo e preço", () => {
  it("produção de 11/11 fecha com a nota e dá R$ 19,26/kg", () => {
    expect(totalProducao(producoes[0])).toBe(46235);
    expect(Math.round(custoKg)).toBe(1926);
  });

  it("custo de cada insumo sai do preço × usado ÷ pacote", () => {
    for (const i of producoes[0].insumos) expect(custoInsumo(i.precoPago, i.pesoPacoteG, i.usadoG), i.nome).toBe(i.custo);
  });

  it("temperos e gás entram no custo da produção", () => {
    const prem = { ...p, temperos: { ...p.temperos, valor: 1000 }, gasEnergia: { ...p.gasEnergia, valor: 500 } };
    expect(custoProducao(producoes[0], prem)).toBe(46235 + 1500);
  });

  it("individual custa R$ 16,77 (7,71 + 5,06 + 4,00)", () => {
    expect(custoPorcao(prod("feijoada-individual"), custoKg, p.maoDeObraKg.valor)).toEqual({ comida: 771, embalagem: 506, maoDeObra: 400, total: 1677 });
  });

  it("lucro da individual: 23,13 no WhatsApp e 21,31 no iFood", () => {
    expect(lucroCanal(3990, 1677, "whatsapp", p).lucro).toBe(2313);
    const ifood = lucroCanal(4490, 1677, "ifood", p);
    expect(ifood.taxas).toBe(682);
    expect(ifood.lucro).toBe(2131);
  });

  it("preço mínimo por canal", () => {
    expect(precoMinimo(1677, "whatsapp", p)).toBe(2097); // 1677 / 0,80
    expect(precoMinimo(1677, "ifood", p)).toBe(2588); // 1677 / 0,648
  });

  it("mensalidade do iFood só acima do limite", () => {
    expect(mensalidadeIfood(180000, p)).toBe(0);
    expect(mensalidadeIfood(180001, p)).toBe(11000);
  });
});

describe("pedido", () => {
  const ind = (canal: "whatsapp" | "ifood", qtd = 1) => itemDoProduto(prod("feijoada-individual"), canal, qtd, custoKg, p);
  const ped = (o: Partial<PedidoBase>): PedidoBase => ({
    canal: "whatsapp", itens: [ind("whatsapp", 2)], desconto: { tipo: "valor", informado: 0, motivo: "" },
    taxaEntrega: 800, custoEntrega: 300, pagamento: "pix", taxas, ...o,
  });

  it("desconto em R$", () => {
    const t = calcPedido(ped({ desconto: { tipo: "valor", informado: 500, motivo: "cliente fiel" } }));
    expect(t).toMatchObject({ bruto: 7980, desconto: 500, liquido: 7480, taxasIfood: 0, custo: 3654 });
    expect(t.lucro).toBe(7480 + 800 - 3654);
  });

  it("desconto em % vira R$", () => {
    expect(calcPedido(ped({ desconto: { tipo: "pct", informado: 1000, motivo: "" } })).desconto).toBe(798);
  });

  it("desconto nunca passa do bruto", () => {
    expect(calcPedido(ped({ desconto: { tipo: "valor", informado: 99999, motivo: "" } })).liquido).toBe(0);
  });

  it("iFood com desconto: comissão sobre o líquido, online sobre o cobrado", () => {
    const t = calcPedido(ped({ canal: "ifood", itens: [ind("ifood")], desconto: { tipo: "valor", informado: 490, motivo: "" }, pagamento: "ifood_online" }));
    // líquido 4000; comissão 12% = 480; online 3,2% de 4800 = 154
    expect(t.taxasIfood).toBe(480 + 154);
    expect(t.lucro).toBe(4800 - 634 - (1677 + 300));
  });

  it("iFood com comissão sobre o bruto", () => {
    const t = calcPedido(ped({ canal: "ifood", itens: [ind("ifood")], desconto: { tipo: "valor", informado: 490, motivo: "" }, pagamento: "dinheiro", taxas: { ...taxas, base: "bruto" } }));
    expect(t.taxasIfood).toBe(539); // 12% de 4490, sem online
  });

  it("WhatsApp não tem taxa do iFood; maquininha incide sobre o cobrado", () => {
    const t = calcPedido(ped({ pagamento: "credito", taxas: { ...taxas, pagamentoBp: 309 } }));
    expect(t.taxasIfood).toBe(0);
    expect(t.taxaPagamento).toBe(271); // 3,09% de 8780 = 271,30
  });

  it("baixa de estoque só das bebidas", () => {
    const itens = [ind("whatsapp", 2), itemDoProduto(prod("coca-lata"), "whatsapp", 3, custoKg, p), itemDoProduto(prod("coca-lata"), "whatsapp", 1, custoKg, p)];
    expect(baixaEstoque(itens)).toEqual({ "coca-lata": 4 });
  });
});

describe("projeção", () => {
  const inicio = projecao(cenarios[0].porDia, produtos, custoKg, p);

  it("cenário Início: kg, produções e pedidos", () => {
    expect(inicio.gDia).toBe(2 * 400 + 3 * 750 + 1 * 1000); // 4,05 kg por dia
    expect(inicio.pedidos).toBe(6 * 13);
    expect(inicio.producoes).toBeCloseTo((4050 * 13) / 24000);
  });

  it("faturamento dividido pela parte do iFood", () => {
    // 50%: metade das porções a preço de cada canal
    expect(inicio.fatWhatsapp).toBe(Math.round(26 * 0.5 * 3990) + Math.round(39 * 0.5 * 7490) + Math.round(13 * 0.5 * 9490));
    expect(inicio.fatIfood).toBe(Math.round(26 * 0.5 * 4490) + Math.round(39 * 0.5 * 7990) + Math.round(13 * 0.5 * 9990));
  });

  it("lucro fecha com as parcelas e mensalidade só acima do limite", () => {
    const x = inicio;
    expect(x.mensalidade).toBe(x.fatIfood > 180000 ? 11000 : 0);
    expect(x.lucro).toBe(x.receita - x.ingredientes - x.embalagens - x.maoDeObra - x.taxasIfood - x.custoEntregas - x.das - x.divulgacao - x.outrosFixos - x.mensalidade);
    expect(x.familia).toBe(x.lucro + x.maoDeObra);
  });

  it("limite do MEI: cenário Muito bom em 12 meses", () => {
    const mb = projecao(cenarios[2].porDia, produtos, custoKg, p);
    expect(mb.cabeMei).toBe(mb.receita12 <= 8100000);
  });
});
