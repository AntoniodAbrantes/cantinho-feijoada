import { custoPorKg, custoProducao } from "./calc";
import type { Canal, FormaPagamento, Premissas, Producao } from "./types";

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
