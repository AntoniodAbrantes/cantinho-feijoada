"use client";
import { useId } from "react";
import { Chips, cx } from "./ui";
import type { Tipo } from "@/lib/meta";

const base =
  "min-h-12 w-full rounded-[var(--radius-ctl)] border border-linha bg-carvao px-3 text-lg text-creme placeholder:text-creme-3 focus:border-milho focus:outline-none";

export function Campo({ rotulo, children, className }: { rotulo: string; children: (id: string) => React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-semibold uppercase tracking-wider text-creme-3">
        {rotulo}
      </label>
      {children(id)}
    </div>
  );
}

export function Texto({ rotulo, valor, onChange, placeholder, className }: { rotulo: string; valor: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <Campo rotulo={rotulo} className={className}>
      {(id) => <input id={id} value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />}
    </Campo>
  );
}

// Máscara de caixa registradora: cada dígito entra pela direita. Valor inteiro (centavos, pontos-base, gramas).
export function Valor({ rotulo, valor, onChange, sufixo, prefixo = "R$", casas = 2, className }: { rotulo: string; valor: number; onChange: (v: number) => void; sufixo?: string; prefixo?: string; casas?: number; className?: string }) {
  const txt = (valor / 10 ** casas).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return (
    <Campo rotulo={rotulo} className={className}>
      {(id) => (
        <div className={cx(base, "flex items-center gap-2 focus-within:border-milho")}>
          {prefixo && <span className="text-creme-3">{prefixo}</span>}
          <input
            id={id}
            inputMode="numeric"
            value={txt}
            onChange={(e) => onChange(Math.min(99999999, Number(e.target.value.replace(/\D/g, "")) || 0))}
            onFocus={(e) => e.target.select()}
            className="num w-full min-w-0 bg-transparent text-right focus:outline-none"
          />
          {sufixo && <span className="text-creme-3">{sufixo}</span>}
        </div>
      )}
    </Campo>
  );
}

export function CampoTipo({ tipo, rotulo, valor, onChange, className }: { tipo: Tipo; rotulo: string; valor: number | string; onChange: (v: number | string) => void; className?: string }) {
  if (tipo === "base")
    return (
      <div className={cx("flex flex-col gap-2", className)}>
        <span className="text-sm font-semibold uppercase tracking-wider text-creme-3">{rotulo}</span>
        <Chips rotulo={rotulo} valor={valor as string} onChange={onChange} opcoes={[{ v: "liquido", t: "Líquido" }, { v: "bruto", t: "Bruto" }]} />
      </div>
    );
  const p = { dinheiro: { prefixo: "R$", casas: 2 }, pct: { prefixo: "", sufixo: "%", casas: 2 }, peso: { prefixo: "", sufixo: "kg", casas: 3 }, inteiro: { prefixo: "", casas: 0 } }[tipo];
  return <Valor rotulo={rotulo} valor={valor as number} onChange={onChange} className={className} {...p} />;
}

export function Interruptor({ rotulo, ligado, onChange, destaque }: { rotulo: string; ligado: boolean; onChange: (v: boolean) => void; destaque?: boolean }) {
  return (
    <button role="switch" aria-checked={ligado} onClick={() => onChange(!ligado)} className="flex min-h-12 w-full items-center justify-between gap-3 text-left">
      <span className={cx("font-semibold", destaque && ligado ? "text-milho" : "text-creme-2")}>{rotulo}</span>
      <span className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150", ligado ? (destaque ? "bg-milho" : "bg-creme") : "bg-linha")}>
        <span className={cx("absolute top-1 size-5 rounded-full bg-carvao transition-[left] duration-150", ligado ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}
