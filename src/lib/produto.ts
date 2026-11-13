import { novoId, type Op } from "./store";
import type { Produto } from "./types";

// Grava o produto e, se o preço mudou, registra no histórico (produtos/{id}/historicoPreco).
export function opsProduto(antes: Produto | undefined, depois: Produto): Op[] {
  // Estoque só muda por pedido ou entrada de bebida (increment); editar o produto não pode sobrescrever.
  const { id, estoque, ...dados } = depois;
  const ops: Op[] = [{ caminho: `produtos/${id}`, dados: antes ? dados : { ...dados, ...(estoque !== undefined && { estoque }) } }];
  if (antes && (antes.precoWhatsapp !== depois.precoWhatsapp || antes.precoIfood !== depois.precoIfood))
    ops.push({
      caminho: `produtos/${id}/historicoPreco/${novoId(`produtos/${id}/historicoPreco`)}`,
      dados: { em: Date.now(), antes: { whatsapp: antes.precoWhatsapp, ifood: antes.precoIfood }, depois: { whatsapp: depois.precoWhatsapp, ifood: depois.precoIfood } },
    });
  return ops;
}
