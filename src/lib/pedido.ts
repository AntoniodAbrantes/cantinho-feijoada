import { calcPedido, custoPorKg, custoProducao } from "./calc";
import { diaLocal, fimDeSemana, somaDias } from "./format";
import { conta, type Canal, type FormaPagamento, type Pedido, type Premissas, type Producao, type StatusPedido } from "./types";

export function producaoDoDia(producoes: Producao[], dia: string, prem: Premissas) {
  const p = [...producoes].sort((a, b) => b.data.localeCompare(a.data)).find((x) => x.data <= dia);
  return p ? { producao: p, custo: custoProducao(p, prem), custoKg: custoPorKg(custoProducao(p, prem), p.rendimentoG) } : null;
}

export function taxasDoMomento(canal: Canal, pagamento: FormaPagamento, p: Premissas) {
  return {
    comissaoBp: canal === "ifood" ? p.ifoodComissaoBp.valor : 0,
    onlineBp: canal === "ifood" ? p.ifoodOnlineBp.valor : 0,
    base: p.ifoodBaseComissao.valor,
    pagamentoBp: pagamento === "debito" ? p.maqDebitoBp.valor : pagamento === "credito" ? p.maqCreditoBp.valor : 0,
  };
}

// Panela do fim de semana do dia: produção que vale até o domingo e quanto já saiu dela.
// O painel conta só pedido aceito; o site passa a contar também o "novo", que já reserva a feijoada.
export function panela(producoes: Producao[], pedidos: Pedido[], prem: Premissas, dia: string, contar: (s: StatusPedido) => boolean = conta) {
  const fds = fimDeSemana(dia);
  const prod = producaoDoDia(producoes, somaDias(fds, 2), prem);
  if (!prod) return null;
  const vendido = pedidos.filter((p) => p.fimDeSemana === fds && contar(p.status)).reduce((s, p) => s + calcPedido(p).pesoG, 0);
  const total = prod.producao.rendimentoG;
  return { ...prod, total, vendido, resta: Math.max(0, total - vendido) };
}

// Encomenda (lançada antes do dia da entrega) avisa a partir das 8h da véspera, até alguém marcar "visto".
export function lembretes(pedidos: Pedido[], agora = Date.now()) {
  const hoje = diaLocal(agora);
  return pedidos
    .filter((p) => p.status === "feito" && !p.lembreteVistoEm && p.dia >= hoje && p.dia > diaLocal(p.criadoEm) && agora >= Date.parse(`${somaDias(p.dia, -1)}T08:00:00-03:00`))
    .sort((a, b) => a.dia.localeCompare(b.dia) || (a.agendadoPara ?? 0) - (b.agendadoPara ?? 0));
}
