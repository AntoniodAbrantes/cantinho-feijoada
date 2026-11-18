"use client";
import { useMemo } from "react";
import { brl } from "@/lib/format";
import { cartao, nomePremio, normalizarTelefone, telefoneValido } from "@/lib/fidelidade";
import { useStore } from "@/lib/store";
import type { Pedido, Resgate } from "@/lib/types";
import { CartaoSelos } from "./selos";

// Cartão do cliente pelo WhatsApp, com os pedidos que já estão no sistema. null = sem número ou programa pausado.
export function useCartao(telefone?: string) {
  const { pedidos, fidelidade, produtos, cfgFidelidade } = useStore();
  const tel = telefone ? normalizarTelefone(telefone) : "";
  return useMemo(() => {
    if (!cfgFidelidade.ativo || !telefoneValido(tel)) return null;
    const dele = pedidos.filter((p) => p.telefone && normalizarTelefone(p.telefone) === tel);
    return cartao(dele, fidelidade.find((f) => f.id === tel)?.ajustes ?? [], produtos, cfgFidelidade);
  }, [tel, pedidos, fidelidade, produtos, cfgFidelidade]);
}

export const textoResgate = (r: Resgate) =>
  r.troca ? `Ganhou ${nomePremio(r.premioNome)}, trocou por ${nomePremio(r.escolhidoNome)} (+ ${brl(r.troca)})` : `Ganhou ${nomePremio(r.premioNome)}`;

// No pedido (ao vivo e detalhe): o resgate, ou os selos do cliente com destaque se tem presente esperando.
export function SelosDoPedido({ p }: { p: Pedido }) {
  const c = useCartao(p.canal === "ifood" ? undefined : p.telefone);
  if (p.fidelidade)
    return (
      <p className="rounded-[var(--radius-ctl)] border-2 border-milho px-3 py-2 font-semibold text-milho">
        Resgate de fidelidade · {textoResgate(p.fidelidade)}
      </p>
    );
  if (!c) return null;
  const liberado = c.liberados > 0 && c.premio;
  return (
    <div className="flex flex-col gap-2">
      {liberado && (
        <p role="status" className="rounded-[var(--radius-ctl)] bg-milho px-3 py-2 font-display text-lg uppercase text-carvao">
          Presente liberado: {nomePremio(c.premio!.nome)}
        </p>
      )}
      <CartaoSelos selos={c.selos} meta={c.meta} className="max-w-xs" />
      <p className="text-sm text-creme-3">
        {Math.min(c.selos, c.meta)} de {c.meta} selos{c.aCaminho ? ` · ${c.aCaminho} a caminho (contam na entrega)` : ""}
      </p>
    </div>
  );
}
