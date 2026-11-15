// Regras do pedido pelo site. As mesmas funções rodam no navegador (para avisar cedo) e na rota do pedido (que decide).
import { baixaEstoque } from "./calc";
import type { EntregaSite, Ponto } from "./entrega";
import type { Categoria, Endereco, FormaPagamento, Loja, Pedido, Produto } from "./types";

// shortcut: limites propostos no plano, ainda a confirmar com o Antonio.
export const LIMITE_ITEM = 10;
export const LIMITE_PEDIDO = 20;

export interface ItemSite {
  id: string;
  nome: string;
  categoria: Categoria;
  preco: number;
  pesoG: number;
  esgotado: boolean;
  livre?: number; // bebida: estoque menos o que está reservado em pedido "novo"
}

export interface DadosSite {
  itens: ItemSite[];
  restaG: number; // feijoada que ainda sai da panela do fim de semana
  taxaEntrega: number; // fixa, das premissas: vale quando entrega.ativo é false
  entrega: EntregaSite;
  loja: Loja;
  aberta: boolean;
}

// Produtos marcados para o site, com o preço do WhatsApp (venda direta, sem comissão).
export function cardapioSite(produtos: Produto[], pedidosFds: Pedido[], restaG: number): ItemSite[] {
  const reservado: Record<string, number> = {};
  for (const p of pedidosFds)
    if (p.status === "novo") for (const [id, q] of Object.entries(baixaEstoque(p.itens))) reservado[id] = (reservado[id] ?? 0) + q;
  return produtos
    .filter((p) => p.ativoSite)
    .sort((a, b) => a.ordem - b.ordem)
    .map((p) => {
      const livre = p.categoria === "bebida" ? Math.max(0, (p.estoque ?? 0) - (reservado[p.id] ?? 0)) : undefined;
      const esgotado = !!p.esgotadoSite || (p.categoria === "feijoada" && restaG < p.pesoFeijoadaG) || livre === 0;
      return { id: p.id, nome: p.nome, categoria: p.categoria, preco: p.precoWhatsapp, pesoG: p.pesoFeijoadaG, esgotado, ...(livre !== undefined && { livre }) };
    });
}

export type Carrinho = Record<string, number>; // produtoId → quantidade

// Primeiro problema do carrinho, ou null.
export function erroCarrinho(qtd: Carrinho, itens: ItemSite[], restaG: number): string | null {
  let n = 0;
  let g = 0;
  for (const [id, q] of Object.entries(qtd)) {
    if (q === 0) continue;
    const i = itens.find((x) => x.id === id);
    if (!i) return "Tem item que saiu do cardápio. Tira ele e tenta de novo.";
    if (!Number.isInteger(q) || q < 0) return "Quantidade inválida.";
    if (i.esgotado) return `${i.nome} esgotou.`;
    if (q > LIMITE_ITEM) return `No site dá pra pedir até ${LIMITE_ITEM} de cada item.`;
    if (i.livre !== undefined && q > i.livre) return `De ${i.nome} só restam ${i.livre}.`;
    n += q;
    g += q * i.pesoG;
  }
  if (!n) return "O carrinho tá vazio.";
  if (n > LIMITE_PEDIDO) return `No site dá pra pedir até ${LIMITE_PEDIDO} itens. Pra mais, chama no WhatsApp.`;
  if (g > restaG) return "Não tem feijoada pra tudo isso. Diminui um pouco.";
  return null;
}

export const subtotal = (qtd: Carrinho, itens: ItemSite[]) =>
  itens.reduce((s, i) => s + (qtd[i.id] ?? 0) * i.preco, 0);

export type PagamentoSite = Exclude<FormaPagamento, "ifood_online">;
export const PAGAMENTOS: { v: PagamentoSite; t: string }[] = [
  { v: "pix", t: "Pix" },
  { v: "dinheiro", t: "Dinheiro" },
  { v: "debito", t: "Débito" },
  { v: "credito", t: "Crédito" },
];
export const NOME_PAGAMENTO = Object.fromEntries(PAGAMENTOS.map((p) => [p.v, p.t])) as Record<PagamentoSite, string>;
export interface DadosCliente {
  nome: string;
  telefone: string; // só dígitos, com DDD
  endereco: Endereco;
  local?: Ponto; // pino no mapa (quando a taxa é por distância)
  pagamento: PagamentoSite;
  trocoPara: number; // 0 = sem troco
  obs: string;
}
export type CampoCliente = "nome" | "telefone" | "rua" | "numero" | "bairro" | "complemento" | "referencia" | "cep" | "cidade" | "pagamento" | "trocoPara" | "obs";

const texto = (v: unknown, max: number) => typeof v === "string" && v.trim().length <= max;

// Erros por campo (vazio = tudo certo). total = itens + entrega, para conferir o troco.
export function errosCliente(d: DadosCliente, total: number): Partial<Record<CampoCliente, string>> {
  const e: Partial<Record<CampoCliente, string>> = {};
  const e2 = d.endereco ?? ({} as Endereco);
  if (!texto(d.nome, 60) || d.nome.trim().length < 2) e.nome = "Diz seu nome pra gente.";
  if (typeof d.telefone !== "string" || !/^[1-9]{2}9?\d{8}$/.test(d.telefone)) e.telefone = "Confere o WhatsApp com DDD.";
  if (!texto(e2.rua, 100) || !e2.rua.trim()) e.rua = "Falta a rua.";
  if (!texto(e2.numero, 10) || !e2.numero.trim()) e.numero = "Falta o número.";
  if (!texto(e2.bairro, 60) || !e2.bairro.trim()) e.bairro = "Falta o bairro.";
  if (!texto(e2.complemento, 60)) e.complemento = "Complemento muito longo.";
  if (!texto(e2.referencia, 100)) e.referencia = "Referência muito longa.";
  if (e2.cep !== undefined && e2.cep !== "" && !/^\d{8}$/.test(e2.cep)) e.cep = "CEP tem 8 números.";
  if (e2.cidade !== undefined && !texto(e2.cidade, 40)) e.cidade = "Cidade muito longa.";
  if (!["pix", "dinheiro", "debito", "credito"].includes(d.pagamento)) e.pagamento = "Escolhe como vai pagar.";
  if (d.pagamento === "dinheiro" && d.trocoPara && (!Number.isInteger(d.trocoPara) || d.trocoPara < total || d.trocoPara > 100000))
    e.trocoPara = "O troco tem que ser pra um valor maior que o total.";
  if (!texto(d.obs, 300)) e.obs = "Recado muito longo (até 300 letras).";
  return e;
}

// (83) 99824-4099 enquanto digita.
export function mascaraTelefone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  const r = d.slice(2);
  const corte = d.length === 11 ? 5 : 4;
  return `(${d.slice(0, 2)}) ${r.length > corte ? `${r.slice(0, corte)}-${r.slice(corte)}` : r}`;
}
