// Pedidos de exemplo: só para o emulador e para as telas de teste. Nunca em produção.
import * as seed from "./seed";
import { itemDoProduto } from "@/lib/calc";
import { diaLocal, fimDeSemana } from "@/lib/format";
import { producaoDoDia, taxasDoMomento } from "@/lib/pedido";
import type { Canal, FormaPagamento, Pedido } from "@/lib/types";

export function exemplos(): Pedido[] {
  const hoje = diaLocal();
  const prod = (id: string) => seed.produtos.find((p) => p.id === id)!;
  const pr = producaoDoDia(seed.producoes, hoje, seed.premissas)!;
  const lista: [Canal, [string, number][], number, FormaPagamento, number][] = [
    ["whatsapp", [["feijoada-2", 1], ["coca-1l", 1]], 0, "pix", 11],
    ["ifood", [["feijoada-individual", 2]], 0, "ifood_online", 11.3],
    ["whatsapp", [["feijoada-individual", 1], ["coca-lata", 1]], 0, "dinheiro", 11.6],
    ["ifood", [["feijoada-3", 1], ["adicional-farofa", 1]], 1000, "ifood_online", 12],
    ["whatsapp", [["feijoada-2", 1]], 500, "pix", 12.2],
    ["whatsapp", [["feijoada-3", 1], ["coca-zero-1l", 1]], 0, "credito", 12.5],
    ["ifood", [["feijoada-individual", 1], ["coca-zero-lata", 1]], 0, "ifood_online", 12.8],
  ];
  return lista.map(([canal, itens, desconto, pagamento, hora], i) => ({
    id: `ex${i}`,
    criadoEm: new Date(`${hoje}T${String(Math.floor(hora)).padStart(2, "0")}:${String(Math.round((hora % 1) * 60)).padStart(2, "0")}:00-03:00`).getTime(),
    dia: hoje,
    fimDeSemana: fimDeSemana(hoje),
    canal,
    itens: itens.map(([id, q]) => itemDoProduto(prod(id), canal, q, pr.custoKg, seed.premissas)),
    desconto: { tipo: canal === "ifood" ? "pct" : "valor", informado: desconto, motivo: desconto ? (canal === "ifood" ? "Promoção do iFood" : "Cliente fiel") : "" },
    taxaEntrega: 800,
    custoEntrega: 300,
    pagamento,
    taxas: taxasDoMomento(canal, pagamento, seed.premissas),
    cliente: "",
    bairro: "",
    status: i < 4 ? "entregue" : "feito",
    obs: "",
    producaoId: pr.producao.id,
  }));
}
