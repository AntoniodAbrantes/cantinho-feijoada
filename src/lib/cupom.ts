// Cupom de desconto: contas puras. O site avisa cedo; a rota do pedido decide, na transação.
import { brl, dataBr } from "./format";
import type { Cupom, Desconto, Pedido } from "./types";

export const normalizarCupom = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20);

// Usos que valem: pedido com o cupom que não foi cancelado.
export const usosDoCupom = (pedidos: Pick<Pedido, "cupom" | "status">[], codigo: string) => pedidos.filter((p) => p.cupom === codigo && p.status !== "cancelado").length;

export interface Contexto {
  hoje: string; // aaaa-mm-dd em Fortaleza
  itens: number; // soma dos itens, em centavos
  usos: number; // de todo mundo
  usosDoTelefone: number;
  comPresente: boolean;
}

// Primeiro motivo pra recusar, no tom da casa. null = vale.
export function erroCupom(c: Cupom | null | undefined, x: Contexto): string | null {
  if (!c || !c.ativo) return "Esse cupom não existe. Confere as letras?";
  if (c.validoAte && x.hoje > c.validoAte) return `Esse cupom venceu em ${dataBr(c.validoAte)}.`;
  if (c.limiteUsos && x.usos >= c.limiteUsos) return "Esse cupom já esgotou. Fica pra próxima, visse?";
  if (c.umPorTelefone && x.usosDoTelefone > 0) return "Você já usou esse cupom nesse WhatsApp.";
  if (c.minimo && x.itens < c.minimo) return `Esse cupom vale em pedidos a partir de ${brl(c.minimo)} em itens.`;
  if (x.comPresente) return "O cupom não junta com o presente do Selo do Cantinho. Escolhe um dos dois.";
  return null;
}

export const descontoDoCupom = (c: Pick<Cupom, "id" | "tipo" | "valor">): Desconto => ({ tipo: c.tipo, informado: c.valor, motivo: `Cupom ${c.id}` });

export const textoCupom = (c: Pick<Cupom, "tipo" | "valor">) => (c.tipo === "pct" ? `${(c.valor / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% nos itens` : `${brl(c.valor)} nos itens`);
