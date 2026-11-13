"use client";
import { useState } from "react";
import { diaLocal, fimDeSemana } from "@/lib/format";
import { Chips } from "./ui";

export type Periodo = "hoje" | "fds" | "mes" | "livre";
export const NOME_PERIODO: Record<Periodo, string> = { hoje: "hoje", fds: "no fim de semana", mes: "no mês", livre: "no período" };

export function usePeriodo(inicial: Periodo = "hoje") {
  const hoje = diaLocal();
  const [periodo, setPeriodo] = useState<Periodo>(inicial);
  const [de, setDe] = useState(fimDeSemana(hoje));
  const [ate, setAte] = useState(hoje);
  const dentro = (dia: string) =>
    periodo === "hoje" ? dia === hoje : periodo === "fds" ? fimDeSemana(dia) === fimDeSemana(hoje) : periodo === "mes" ? dia.slice(0, 7) === hoje.slice(0, 7) : dia >= de && dia <= ate;
  return { hoje, periodo, setPeriodo, de, setDe, ate, setAte, dentro };
}

export function FiltroPeriodo({ p }: { p: ReturnType<typeof usePeriodo> }) {
  return (
    <div className="flex flex-col gap-3">
      <Chips
        rotulo="Período"
        valor={p.periodo}
        onChange={p.setPeriodo}
        opcoes={[
          { v: "hoje", t: "Hoje" },
          { v: "fds", t: "Fim de semana" },
          { v: "mes", t: "Mês" },
          { v: "livre", t: "Período" },
        ]}
      />
      {p.periodo === "livre" && (
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["De", p.de, p.setDe],
              ["Até", p.ate, p.setAte],
            ] as const
          ).map(([rot, v, set]) => (
            <label key={rot} className="flex flex-col gap-1 text-sm font-semibold uppercase tracking-wider text-creme-3">
              {rot}
              <input type="date" value={v} onChange={(e) => set(e.target.value)} className="min-h-12 rounded-[var(--radius-ctl)] border border-linha bg-carvao px-3 text-lg normal-case tracking-normal text-creme" />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
