"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { dbSite } from "@/lib/firebase-site";
import { TEMPO_PADRAO, avisoTempo, textoTempo } from "@/lib/tempo";
import type { TempoEntrega } from "@/lib/types";

// Tempo de entrega ao vivo: o dono muda no painel e aparece aqui sem recarregar.
export function useTempo(inicial: TempoEntrega = TEMPO_PADRAO) {
  const [t, setT] = useState(inicial);
  useEffect(() => onSnapshot(doc(dbSite(), "config", "tempo"), (s) => setT((s.data() as TempoEntrega | undefined) ?? TEMPO_PADRAO), () => {}), []);
  return t;
}

// "Chega em uns 40–60 min", com o aviso simpático quando tá movimentado.
export function TempoEstimado({ tempo, depois }: { tempo: TempoEntrega; depois?: boolean }) {
  const aviso = avisoTempo(tempo);
  if (aviso) return <p role="status" className="rounded-[var(--radius-card)] border border-milho px-4 py-3 text-lg leading-snug text-milho">{aviso}</p>;
  return (
    <p className="flex items-baseline justify-between gap-3 rounded-[var(--radius-card)] bg-brasa px-4 py-3">
      <span className="text-lg text-creme-2">{depois ? "Chega em uns" : "Entrega em"}</span>
      <span className="num font-display text-[28px] leading-none text-milho">{textoTempo(tempo)}</span>
    </p>
  );
}
