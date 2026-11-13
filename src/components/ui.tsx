"use client";
import type { Canal } from "@/lib/types";
import { brl } from "@/lib/format";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

/* Botões: 48 px no mínimo. "principal" é a única ação amarela da tela. */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "principal" | "secundario" | "fantasma" | "perigo" };
export function Botao({ variante = "secundario", className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-ctl)] px-5 text-lg font-semibold uppercase tracking-wide transition-[transform,background-color] duration-150 active:scale-[0.97] disabled:opacity-40",
        variante === "principal" && "bg-milho text-carvao active:bg-milho-2",
        variante === "secundario" && "bg-tisna text-creme active:bg-linha",
        variante === "fantasma" && "text-creme-2 active:bg-tisna",
        variante === "perigo" && "bg-prejuizo/15 text-prejuizo active:bg-prejuizo/25",
        className,
      )}
    />
  );
}

/* Canal: sempre a mesma cor e etiqueta no app inteiro. */
export const CANAL = {
  whatsapp: { nome: "WhatsApp", sigla: "Zap", cor: "text-zap", fundo: "bg-zap", borda: "border-zap" },
  ifood: { nome: "iFood", sigla: "iFood", cor: "text-ifood", fundo: "bg-ifood", borda: "border-ifood" },
} as const;

export function EtiquetaCanal({ canal, curta }: { canal: Canal; curta?: boolean }) {
  const c = CANAL[canal];
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider", c.cor)}>
      <span className={cx("size-2 rounded-full", c.fundo)} aria-hidden />
      {curta ? c.sigla : c.nome}
    </span>
  );
}

/* Marcador de estimativa a confirmar: amarelo em todo lugar. */
export function Estimativa({ texto = "a confirmar" }: { texto?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-milho/50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-milho">
      <span aria-hidden>≈</span> {texto}
    </span>
  );
}

/* Rótulo de seção: pequeno, espaçado. */
export function Rotulo({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cx("text-sm font-semibold uppercase tracking-[0.14em] text-creme-3", className)}>{children}</h2>;
}

/* Valor em R$ com animação curta quando muda. */
export function Dinheiro({ valor, className, sinal }: { valor: number; className?: string; sinal?: boolean }) {
  return (
    <span key={valor} className={cx("num inline-block animate-tick", sinal && (valor < 0 ? "text-prejuizo" : "text-lucro"), className)}>
      {brl(valor)}
    </span>
  );
}

export function Painel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cx("rounded-[var(--radius-card)] bg-brasa p-4", className)}>{children}</section>;
}

/* Linha de indicador secundário: rótulo à esquerda, valor à direita. */
export function Linha({ rotulo, children, nota }: { rotulo: React.ReactNode; children: React.ReactNode; nota?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-linha/70 py-2.5 last:border-0">
      <span className="text-creme-2">{rotulo}</span>
      <span className="shrink-0 whitespace-nowrap text-right font-semibold">
        {children}
        {nota && <span className="block whitespace-normal text-sm font-normal text-creme-3">{nota}</span>}
      </span>
    </div>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cx("animate-brilho rounded-xl bg-tisna", className)} aria-hidden />;
}

export function Vazio({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="font-display text-2xl uppercase">{titulo}</p>
      {texto && <p className="text-creme-2">{texto}</p>}
      {acao}
    </div>
  );
}

/* Chips de escolha única (período, pagamento, tipo de desconto). */
export function Chips<T extends string>({ opcoes, valor, onChange, rotulo }: { opcoes: { v: T; t: string }[]; valor: T; onChange: (v: T) => void; rotulo: string }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-2">
      {opcoes.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={valor === o.v}
          onClick={() => onChange(o.v)}
          className={cx(
            "min-h-12 rounded-full border px-4 text-base font-semibold transition-colors duration-150",
            valor === o.v ? "border-creme bg-creme text-carvao" : "border-linha text-creme-2 active:bg-tisna",
          )}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

/* Marca: símbolo nos cabeçalhos (pequeno); selo completo com nome só em tamanho grande (login). */
export function Selo({ tamanho = 40, completo }: { tamanho?: number; completo?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático, sem otimização
    <img
      src={completo ? "/marca/cantinho-selo.svg" : "/marca/cantinho-simbolo.svg"}
      width={tamanho}
      height={tamanho}
      alt="Cantinho da Feijoada"
      className="shrink-0"
    />
  );
}
