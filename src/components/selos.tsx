"use client";
import { useState } from "react";
import { Folha } from "./folha";
import { cx } from "./ui";
import { brl } from "@/lib/format";
import { fraseCartao, nomePremio, type Cartao } from "@/lib/fidelidade";

// Cada selo cai num ângulo: parece carimbado à mão.
const GIRO = [-8, 5, -3, 9, -6, 4, -9, 7, -4, 6];

// Cartão de papel do Selo do Cantinho. `carimba`: índice do selo que entra agora, com animação.
export function CartaoSelos({ selos, meta, carimba, className }: { selos: number; meta: number; carimba?: number; className?: string }) {
  const cheios = Math.min(selos, meta);
  return (
    <div
      role="img"
      aria-label={`Cartão de selos: ${cheios} de ${meta}`}
      className={cx("relative -rotate-1 rounded-[var(--radius-card)] bg-creme px-4 pb-4 pt-3 text-carvao shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)]", carimba !== undefined && "animate-impacto [animation-delay:300ms]", className)}
    >
      {/* Recortes de cartão de verdade, nas laterais */}
      <span aria-hidden className="absolute -left-2 top-1/2 size-4 -translate-y-1/2 rounded-full bg-carvao" />
      <span aria-hidden className="absolute -right-2 top-1/2 size-4 -translate-y-1/2 rounded-full bg-carvao" />
      <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-carvao/30 pb-2">
        <span className="font-display text-xl uppercase leading-none tracking-wide">Selo do Cantinho</span>
        <span className="num font-display text-lg leading-none text-carvao/60">
          {cheios}/{meta}
        </span>
      </div>
      <ol className="mt-3 grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(meta, 5)}, minmax(0, 1fr))` }}>
        {Array.from({ length: meta }, (_, i) => (
          <li key={i} className={cx("grid aspect-square place-items-center rounded-full", i >= cheios && "border-2 border-dashed border-carvao/30")}>
            {i < cheios ? (
              // eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca
              <img
                src="/marca/cantinho-simbolo.svg"
                alt=""
                className={cx("size-full opacity-[0.92]", i === carimba && "animate-carimbo")}
                style={{ transform: `rotate(${GIRO[i % GIRO.length]}deg)`, ["--giro" as string]: `${GIRO[i % GIRO.length]}deg` }}
              />
            ) : (
              <span className="num font-display text-lg text-carvao/25">{i + 1}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

// Confete discreto nas cores da casa. Some sozinho; com "reduzir movimento" nem aparece.
export function Confete() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden motion-reduce:hidden">
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className={cx("absolute top-0 block h-2.5 w-1.5 animate-confete rounded-[1px]", i % 3 === 0 ? "bg-creme" : "bg-milho")}
          style={{ left: `${6 + ((i * 37) % 88)}%`, animationDelay: `${(i % 5) * 90}ms`, ["--dx" as string]: `${((i * 23) % 40) - 20}px`, ["--rot" as string]: `${(i % 2 ? 1 : -1) * (120 + i * 15)}deg` }}
        />
      ))}
    </span>
  );
}

export function ComoFunciona({ meta }: { meta: number }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="self-start text-base font-semibold text-creme-2 underline underline-offset-4">
        Como funciona?
      </button>
      <Folha aberta={aberto} onFechar={() => setAberto(false)} titulo="Selo do Cantinho">
        <ol className="mb-5 flex flex-col gap-3 text-xl leading-snug text-creme-2">
          <li>1. Cada pedido entregue com feijoada vale 1 selo, pelo seu WhatsApp.</li>
          <li>2. Juntou {meta}? A próxima feijoada é presente da casa, no tamanho que você costuma pedir.</li>
          <li>3. Quer maior? Paga só a diferença. Pedido do iFood não conta.</li>
        </ol>
        <button type="button" onClick={() => setAberto(false)} className="min-h-12 w-full rounded-[var(--radius-ctl)] bg-tisna font-semibold uppercase tracking-wide active:bg-linha">
          Entendi
        </button>
      </Folha>
    </>
  );
}

type Escolha = { usar: boolean; escolhidoId: string };

// Cartão + frase + prêmio liberado (com troca de tamanho). Mesmo bloco no site e no pedido manual do sistema.
export function BlocoSelos({ c, escolha, onEscolha, comoFunciona = true }: { c: Pick<Cartao, "selos" | "meta" | "liberados" | "premio" | "trocas" | "aCaminho">; escolha?: Escolha; onEscolha?: (e: Escolha) => void; comoFunciona?: boolean }) {
  const liberado = c.liberados > 0 && !!c.premio;
  return (
    <section aria-label="Selo do Cantinho" className="relative flex flex-col gap-3">
      {liberado && <Confete />}
      <CartaoSelos selos={c.selos} meta={c.meta} />
      <p className="text-xl leading-snug">
        <span className="num font-display text-2xl text-milho">
          {Math.min(c.selos, c.meta)} de {c.meta} selos
        </span>{" "}
        · {fraseCartao(c)}
      </p>
      {c.aCaminho > 0 && !liberado && <p className="text-creme-3">{c.aCaminho === 1 ? "Tem 1 selo a caminho" : `Tem ${c.aCaminho} selos a caminho`}: vale quando o pedido for entregue.</p>}
      {liberado && escolha && onEscolha && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border-2 border-milho bg-brasa p-4">
          <p className="font-display text-[28px] uppercase leading-none text-milho">Seu presente tá liberado! 🎉</p>
          {escolha.usar ? (
            <>
              <p className="text-lg text-creme-2">
                Uma {nomePremio(c.premio!.nome)} grátis já entrou no pedido.
              </p>
              {c.trocas.length > 0 && (
                <div role="radiogroup" aria-label="Tamanho do presente" className="flex flex-col gap-2">
                  {[{ id: c.premio!.id, nome: c.premio!.nome, diferenca: 0 }, ...c.trocas].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={escolha.escolhidoId === t.id}
                      onClick={() => onEscolha({ usar: true, escolhidoId: t.id })}
                      className={cx(
                        "flex min-h-12 items-center justify-between gap-3 rounded-[var(--radius-ctl)] border px-4 text-left text-lg font-semibold",
                        escolha.escolhidoId === t.id ? "border-creme bg-creme text-carvao" : "border-linha text-creme-2 active:bg-tisna",
                      )}
                    >
                      <span>{t.diferenca ? `Quer ${nomePremio(t.nome).replace(/^feijoada /, "")}?` : `Fica com a ${nomePremio(t.nome)}`}</span>
                      <span className="num">{t.diferenca ? `Só + ${brl(t.diferenca)}` : "Grátis"}</span>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => onEscolha({ ...escolha, usar: false })} className="self-start font-semibold text-creme-2 underline underline-offset-4">
                Guardar pra depois
              </button>
            </>
          ) : (
            <>
              <p className="text-lg text-creme-2">Guardado. Ele continua esperando por você no próximo pedido.</p>
              <button type="button" onClick={() => onEscolha({ ...escolha, usar: true })} className="self-start font-semibold text-milho underline underline-offset-4">
                Usar agora
              </button>
            </>
          )}
        </div>
      )}
      {comoFunciona && <ComoFunciona meta={c.meta} />}
    </section>
  );
}
