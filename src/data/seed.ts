// Dados iniciais (seção 5 do pedido). Fonte única: seed do Firestore e telas de exemplo.
import type { Cenario, Compra, Premissas, Producao, Produto } from "@/lib/types";

const prem = (valor: number, origem = "", estimativa = false) => ({ valor, origem, estimativa });

export const premissas: Premissas = {
  rendimentoG: prem(24000, "3 kg de feijão; falta contar os potes", true),
  maoDeObraKg: prem(1000, "R$ 240 pela produção de 24 kg", true),
  temperos: prem(0, "Zerado; preencher se comprar"),
  gasEnergia: prem(0, "Zerado a pedido"),
  margemDesejadaBp: prem(2000, "Meta do preço mínimo"),
  ifoodComissaoBp: prem(1200, "Plano Básico, entrega própria. Pesquisa de 09/11/2026; confirmar na loja", true),
  ifoodOnlineBp: prem(320, "Pesquisa de 09/11/2026; confirmar na loja", true),
  ifoodBaseComissao: { valor: "liquido", origem: "Confirmar na loja", estimativa: true },
  ifoodMensalidade: prem(11000, "Só acima do limite de vendas no iFood", true),
  ifoodLimiteMensalidade: prem(180000, "Pesquisa de 09/11/2026", true),
  diasVendaMes: prem(13, "Sexta, sábado e domingo"),
  parteIfoodBp: prem(5000, "O resto é WhatsApp", true),
  taxaEntrega: prem(800, "Até 3 km"),
  custoEntrega: prem(300, "Gasolina e entregador", true),
  das: prem(8205, "Confirmar com contador", true),
  divulgacao: prem(0, ""),
  outrosFixos: prem(0, ""),
  limiteMei: prem(8100000, "Regra de 2026"),
  maqDebitoBp: prem(89, "Nubank Tap to Pay"),
  maqCreditoBp: prem(309, "Nubank Tap to Pay, à vista"),
  maqCredito12xBp: prem(1238, "Não recomendado"),
};

const base = { custo: 0, pesoFeijoadaG: 0, embalagem: 0, ativoWhatsapp: true, ativoIfood: true, estimativas: [] as string[] };

export const produtos: Produto[] = [
  { ...base, id: "feijoada-individual", nome: "Feijoada individual", curto: "Individual", categoria: "feijoada", ordem: 1, precoWhatsapp: 3990, precoIfood: 4490, pesoFeijoadaG: 400, embalagem: 506 },
  { ...base, id: "feijoada-2", nome: "Feijoada para 2 pessoas", curto: "Pra 2", categoria: "feijoada", ordem: 2, precoWhatsapp: 7490, precoIfood: 7990, pesoFeijoadaG: 750, embalagem: 669, estimativas: ["embalagem"] },
  { ...base, id: "feijoada-3", nome: "Feijoada para 3 pessoas", curto: "Pra 3", categoria: "feijoada", ordem: 3, precoWhatsapp: 9490, precoIfood: 9990, pesoFeijoadaG: 1000, embalagem: 805, estimativas: ["embalagem"] },
  // Fora do cardápio, só WhatsApp. Peso e embalagem iguais aos da completa: não informados.
  { ...base, id: "simples-individual", nome: "Feijoada simples individual", curto: "Simples 1", categoria: "feijoada", ordem: 4, precoWhatsapp: 3690, precoIfood: 0, ativoIfood: false, pesoFeijoadaG: 400, embalagem: 506, estimativas: ["embalagem"] },
  { ...base, id: "simples-2", nome: "Feijoada simples para 2", curto: "Simples 2", categoria: "feijoada", ordem: 5, precoWhatsapp: 6990, precoIfood: 0, ativoIfood: false, pesoFeijoadaG: 750, embalagem: 669, estimativas: ["embalagem"] },
  { ...base, id: "simples-3", nome: "Feijoada simples para 3", curto: "Simples 3", categoria: "feijoada", ordem: 6, precoWhatsapp: 8790, precoIfood: 0, ativoIfood: false, pesoFeijoadaG: 1000, embalagem: 805, estimativas: ["embalagem"] },
  { ...base, id: "adicional-arroz", nome: "Adicional de arroz", curto: "Arroz", categoria: "adicional", ordem: 10, precoWhatsapp: 700, precoIfood: 800, estimativas: ["custo"] },
  { ...base, id: "adicional-farofa", nome: "Adicional de farofa", curto: "Farofa", categoria: "adicional", ordem: 11, precoWhatsapp: 600, precoIfood: 700, estimativas: ["custo"] },
  { ...base, id: "adicional-couve", nome: "Adicional de couve", curto: "Couve", categoria: "adicional", ordem: 12, precoWhatsapp: 700, precoIfood: 800, estimativas: ["custo"] },
  { ...base, id: "coca-lata", nome: "Coca-Cola lata", curto: "Coca lata", categoria: "bebida", ordem: 20, precoWhatsapp: 600, precoIfood: 700, custo: 377, estoque: 12, estimativas: ["custo"] },
  { ...base, id: "coca-zero-lata", nome: "Coca-Cola zero lata", curto: "Zero lata", categoria: "bebida", ordem: 21, precoWhatsapp: 600, precoIfood: 700, custo: 377, estoque: 12, estimativas: ["custo"] },
  { ...base, id: "coca-1l", nome: "Coca-Cola 1 L", curto: "Coca 1 L", categoria: "bebida", ordem: 22, precoWhatsapp: 1200, precoIfood: 1290, custo: 679, estoque: 6, estimativas: ["custo"] },
  { ...base, id: "coca-zero-1l", nome: "Coca-Cola zero 1 L", curto: "Zero 1 L", categoria: "bebida", ordem: 23, precoWhatsapp: 1200, precoIfood: 1290, custo: 679, estoque: 6, estimativas: ["custo"] },
];

const ins = (nome: string, precoPago: number, pesoPacoteG: number | null, usadoG: number | null, custo: number, obs: string) =>
  ({ nome, precoPago, pesoPacoteG, usadoG, custo, obs });

export const producoes: Producao[] = [
  {
    id: "2026-11-11",
    data: "2026-11-11",
    rendimentoG: 24000,
    rendimentoEstimativa: true,
    insumos: [
      ins("Feijão preto", 999, 1000, 4000, 3996, "4 sacos de 1 kg (um de reserva)"),
      ins("Costela suína", 2976, 1245, 1245, 2976, "3 bandejas"),
      ins("Orelha suína", 3602, 1645, 1645, 3602, "3 bandejas"),
      ins("Pé suíno", 3357, 1533, 1533, 3357, "3 bandejas"),
      ins("Rabo suíno", 2864, 958, 958, 2864, "2 bandejas"),
      ins("Charque", 5657, 1260, 1260, 5657, "3 peças"),
      ins("Linguiça calabresa", 4915, 1450, 1450, 4915, "3 pacotes"),
      ins("Linguiça fininha Sadia", 2695, 614, 614, 2695, "2 pacotes"),
      ins("Linguiça paio", 3380, 740, 740, 3380, "2 pacotes de 370 g"),
      ins("Bacon", 4439, 1385, 1385, 4439, "4 pacotes"),
      ins("Farinha (farofa)", 699, 1000, 1000, 699, "Pacote inteiro no gasto"),
      ins("Manteiga", 2699, 500, 500, 2699, "Pote inteiro no gasto"),
      ins("Alho descascado", 2490, 1000, 1000, 2490, "Pacote inteiro no gasto"),
      ins("Arroz", 589, 1000, 4000, 2356, "4 pacotes presumidos"),
      ins("Ajuste para fechar com a nota", 110, null, null, 110, "Diferença para bater R$ 462,35"),
      ins("Couve", 0, null, null, 0, "Fora da nota; preencher quando souber"),
      ins("Laranja", 0, null, null, 0, "Fora da nota; preencher quando souber"),
    ],
  },
];

export const compras: Compra[] = [
  { id: "2026-11-11-embalagens", data: "2026-11-11", descricao: "Potes e sacos kraft", categoria: "embalagens", valor: 40631, obs: "Já com o desconto da nota" },
  { id: "2026-11-11-bombom", data: "2026-11-11", descricao: "Bombom Serenata de Amor 1 kg", categoria: "mimo", valor: 5669, obs: "Mesma nota das embalagens" },
  { id: "2026-11-11-ingredientes", data: "2026-11-11", descricao: "Carnes, feijão, arroz, farinha, manteiga e alho", categoria: "ingredientes", valor: 46235, obs: "Produção completa do fim de semana" },
  { id: "2026-11-12-divulgacao", data: "2026-11-12", descricao: "Panfletos de agradecimento e adesivos", categoria: "divulgacao", valor: 10000, obs: "" },
  { id: "2026-11-12-coca", data: "2026-11-12", descricao: "Coca-Cola: 4 fardos", categoria: "bebidas", valor: 17200, obs: "24 latas e 12 garrafas de 1 L" },
];

export const cenarios: Cenario[] = [
  { id: "inicio", nome: "Início", ordem: 1, porDia: { "feijoada-individual": 2, "feijoada-2": 3, "feijoada-3": 1 } },
  { id: "meta", nome: "Meta", ordem: 2, porDia: { "feijoada-individual": 4, "feijoada-2": 5, "feijoada-3": 2 } },
  { id: "muito-bom", nome: "Muito bom", ordem: 3, porDia: { "feijoada-individual": 8, "feijoada-2": 10, "feijoada-3": 4 } },
];
