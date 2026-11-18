// Selo do Cantinho: contas puras (sem Firestore). Rodam no sistema, na consulta do site e na rota do pedido (que decide).
// Os selos saem dos próprios pedidos: entregue conta, cancelado deixa de contar, resgate gasta `meta` selos.
import { itemDoProduto } from "./calc";
import { ehSimples, type AjusteSelo, type Canal, type ConfigFidelidade, type ItemPedido, type Pedido, type Premissas, type Produto, type Resgate } from "./types";

export const FIDELIDADE_PADRAO: ConfigFidelidade = { ativo: true, meta: 5, regra: "menor" };

// Só dígitos, com DDD, sem o 55 nem 0 na frente. Celular antigo de 8 dígitos ganha o 9.
export function normalizarTelefone(v: string) {
  let d = v.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  d = d.replace(/^0+/, "");
  if (d.length === 10 && /[6-9]/.test(d[2])) d = `${d.slice(0, 2)}9${d.slice(2)}`;
  return d;
}
export const telefoneValido = (d: string) => /^[1-9]{2}9\d{8}$/.test(d);

type PedidoSelo = Pick<Pedido, "canal" | "status" | "itens" | "fidelidade" | "criadoEm">;

// Tamanho do pedido = peso da maior feijoada paga nele (0 = sem feijoada).
export const tamanhoDoPedido = (p: Pick<Pedido, "itens">) =>
  Math.max(0, ...p.itens.filter((i) => i.categoria === "feijoada" && i.qtd > 0 && !i.brinde).map((i) => i.pesoG));

const doCanal = (c: Canal) => c === "site" || c === "whatsapp";
export const valeSelo = (p: PedidoSelo) => doCanal(p.canal) && p.status === "entregue" && !p.fidelidade && tamanhoDoPedido(p) > 0;
// Selo a caminho: pedido que vai contar quando for entregue.
const aCaminho = (p: PedidoSelo) => doCanal(p.canal) && ["novo", "feito", "saiu"].includes(p.status) && !p.fidelidade && tamanhoDoPedido(p) > 0;
const resgatou = (p: PedidoSelo) => !!p.fidelidade && p.status !== "cancelado";

type Tamanho = Pick<Produto, "id" | "nome" | "precoWhatsapp" | "pesoFeijoadaG">;
// Prêmio é sempre a completa, do menor tamanho pro maior.
export const tamanhosPremio = <T extends Tamanho & Pick<Produto, "categoria">>(produtos: T[]) =>
  produtos.filter((p) => p.categoria === "feijoada" && !ehSimples(p) && p.pesoFeijoadaG > 0).sort((a, b) => a.pesoFeijoadaG - b.pesoFeijoadaG);

export interface Troca {
  id: string;
  nome: string;
  diferenca: number; // preço do site do maior − do ganho
}

export function cartao(pedidos: PedidoSelo[], ajustes: AjusteSelo[], produtos: (Tamanho & Pick<Produto, "categoria">)[], cfg: ConfigFidelidade) {
  const validos = pedidos.filter(valeSelo).sort((a, b) => a.criadoEm - b.criadoEm);
  const resgates = pedidos.filter(resgatou).length;
  const saldo = Math.max(0, validos.length + ajustes.reduce((s, a) => s + a.qtd, 0) - resgates * cfg.meta);
  const liberados = Math.floor(saldo / cfg.meta);
  const selos = liberados ? cfg.meta : saldo;
  // Prêmio pelos pedidos que estão no cartão agora (os mais recentes).
  const noCartao = validos.slice(validos.length - Math.min(selos, validos.length)).map(tamanhoDoPedido);
  const tamanhos = tamanhosPremio(produtos);
  const alvo = noCartao.length ? (cfg.regra === "maior" ? Math.max(...noCartao) : Math.min(...noCartao)) : 0;
  const premio = tamanhos.filter((t) => t.pesoFeijoadaG <= alvo).at(-1) ?? tamanhos[0] ?? null;
  const trocas: Troca[] = premio ? tamanhos.filter((t) => t.pesoFeijoadaG > premio.pesoFeijoadaG).map((t) => ({ id: t.id, nome: t.nome, diferenca: t.precoWhatsapp - premio.precoWhatsapp })) : [];
  return {
    selos,
    meta: cfg.meta,
    liberados,
    premio: premio && { id: premio.id, nome: premio.nome }, // o que ganha (ou vai ganhar) com o cartão de agora
    trocas,
    aCaminho: pedidos.filter(aCaminho).length,
    validos: validos.length,
    resgates,
  };
}
export type Cartao = ReturnType<typeof cartao>;

// Linha do presente no pedido: R$ 0 (ou a diferença da troca), com o custo real do tamanho levado.
export function itemPremio(c: Cartao, escolhidoId: string, produtos: Produto[], canal: Canal, custoKg: number, prem: Premissas): { item: ItemPedido; resgate: Resgate } | null {
  if (!c.liberados || !c.premio) return null;
  const troca = escolhidoId === c.premio.id ? 0 : c.trocas.find((t) => t.id === escolhidoId)?.diferenca;
  const prod = produtos.find((p) => p.id === escolhidoId);
  if (troca === undefined || !prod) return null;
  const item = { ...itemDoProduto(prod, canal, 1, custoKg, prem), nome: `${prod.nome} (presente)`, preco: troca, brinde: true };
  return { item, resgate: { premioId: c.premio.id, premioNome: c.premio.nome, escolhidoId: prod.id, escolhidoNome: prod.nome, troca } };
}

const NUM = ["", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];
// Nome do prêmio no meio da frase: "feijoada para 2", "feijoada individual".
export const nomePremio = (nome: string) => nome.replace(/^Feijoada/, "feijoada").replace(/ pessoas$/, "");

// Frase do cartão, no tom da casa.
export function fraseCartao(c: Pick<Cartao, "selos" | "meta" | "liberados" | "premio">) {
  const premio = c.premio ? nomePremio(c.premio.nome) : "feijoada";
  if (c.liberados) return `Cartão completo! Uma ${premio} por conta da casa.`;
  if (!c.selos) return "Seu primeiro selo começa hoje!";
  const falta = c.meta - c.selos;
  if (falta === 1) return `Tá quase, visse? Falta 1 selo pra sua ${premio} de presente!`;
  return `${falta <= 2 ? "Tá quase, visse? " : ""}Faltam ${NUM[falta] ?? falta} selos pra ganhar uma ${premio}!`;
}
