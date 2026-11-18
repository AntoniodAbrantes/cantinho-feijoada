// Tempo estimado de entrega: o dono muda no painel, o site mostra na hora (config/tempo).
import type { ModoTempo, TempoEntrega } from "./types";

export const PRESETS: Record<Exclude<ModoTempo, "personalizado">, { t: string; min: number; max: number }> = {
  normal: { t: "Normal", min: 40, max: 60 },
  movimentado: { t: "Movimentado", min: 60, max: 80 },
  lotado: { t: "Lotado", min: 80, max: 100 },
};
export const TEMPO_PADRAO: TempoEntrega = { modo: "normal", ...PRESETS.normal, em: 0 };

export const textoTempo = (t: Pick<TempoEntrega, "min" | "max">) => (t.min === t.max ? `${t.min} min` : `${t.min}–${t.max} min`);

// Movimentado, lotado ou personalizado acima do normal: o site avisa com jeitinho.
export const tempoPuxado = (t: TempoEntrega) => t.modo === "movimentado" || t.modo === "lotado" || (t.modo === "personalizado" && t.max > PRESETS.normal.max);

export function avisoTempo(t: TempoEntrega) {
  if (!tempoPuxado(t)) return null;
  return `Hoje tá ${t.modo === "lotado" ? "lotado" : "movimentado"} por aqui! Seu pedido chega em uns ${textoTempo(t)}.`;
}

export const tempoValido = (min: number, max: number) => Number.isInteger(min) && Number.isInteger(max) && min >= 10 && max >= min && max <= 240;
