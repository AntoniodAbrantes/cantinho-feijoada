"use client";
import { useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { fb } from "@/lib/firebase";
import { dataBr, diaLocal, horaLocal, nomeDia } from "@/lib/format";
import { novoId, useStore } from "@/lib/store";
import { PRESETS, textoTempo, tempoValido } from "@/lib/tempo";
import type { ModoTempo, TempoEntrega } from "@/lib/types";
import { Botao, Chips, cx } from "./ui";
import { Campo, estiloCampo } from "./campos";
import { Folha } from "./folha";

type Mudanca = Omit<TempoEntrega, "em"> & { em: number; dia: string; hora: string };
const NOME: Record<ModoTempo, string> = { ...Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, v.t])), personalizado: "Personalizado" } as Record<ModoTempo, string>;

// Topo do painel: muda o tempo de entrega que o site mostra, na hora. Cada mudança vai pro histórico.
export function ControleTempo() {
  const { tempo, lote, avisar } = useStore();
  const [editar, setEditar] = useState(false);
  const [min, setMin] = useState(String(tempo.min));
  const [max, setMax] = useState(String(tempo.max));
  const [historico, setHistorico] = useState<Mudanca[] | null>(null);

  const gravar = (t: Omit<TempoEntrega, "em">) => {
    const em = Date.now();
    const antes = tempo;
    lote([
      { caminho: "config/tempo", dados: { ...t, em } },
      { caminho: `tempoHistorico/${novoId("tempoHistorico")}`, dados: { ...t, em, dia: diaLocal(em), hora: horaLocal(em) } },
    ]);
    avisar(`Site mostrando: entrega em ${textoTempo(t)}.`, () => lote([{ caminho: "config/tempo", dados: antes }]));
  };
  const escolher = (modo: ModoTempo) => {
    if (modo === "personalizado") {
      setMin(String(tempo.min));
      setMax(String(tempo.max));
      return setEditar(true);
    }
    gravar({ modo, min: PRESETS[modo].min, max: PRESETS[modo].max });
  };
  const verHistorico = async () => {
    setHistorico([]);
    const s = await getDocs(query(collection(fb().db, "tempoHistorico"), orderBy("em", "desc"), limit(60)));
    setHistorico(s.docs.map((d) => d.data() as Mudanca));
  };
  const n = [Number(min), Number(max)] as const;

  return (
    <section aria-label="Tempo de entrega" className="flex flex-col gap-3 rounded-[var(--radius-card)] border-2 border-milho p-4 lg:col-span-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-semibold uppercase tracking-wider text-creme-2">Entrega em</span>
          <span className="num font-display text-[40px] leading-none text-milho">{textoTempo(tempo)}</span>
        </p>
        <button onClick={verHistorico} className="shrink-0 text-sm font-semibold text-creme-3 underline underline-offset-4">
          Histórico
        </button>
      </div>
      <Chips rotulo="Tempo de entrega" valor={tempo.modo} onChange={escolher} opcoes={(Object.keys(NOME) as ModoTempo[]).map((v) => ({ v, t: NOME[v] }))} />
      <p className="text-sm text-creme-3">O site mostra na hora, sem o cliente recarregar.{tempo.em ? ` Mudou às ${horaLocal(tempo.em)}.` : ""}</p>

      <Folha aberta={editar} onFechar={() => setEditar(false)} titulo="Tempo personalizado">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="De (min)">{(id) => <input id={id} type="number" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} className={estiloCampo} />}</Campo>
            <Campo rotulo="Até (min)">{(id) => <input id={id} type="number" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} className={estiloCampo} />}</Campo>
          </div>
          {!tempoValido(...n) && <p className="text-sm text-prejuizo">De 10 a 240 min, e o &ldquo;até&rdquo; maior ou igual ao &ldquo;de&rdquo;.</p>}
          <Botao
            variante="principal"
            disabled={!tempoValido(...n)}
            onClick={() => {
              setEditar(false);
              gravar({ modo: "personalizado", min: n[0], max: n[1] });
            }}
          >
            Mostrar {tempoValido(...n) ? textoTempo({ min: n[0], max: n[1] }) : ""} no site
          </Botao>
        </div>
      </Folha>

      <Folha aberta={historico !== null} onFechar={() => setHistorico(null)} titulo="Quando o tempo mudou">
        <ul className="flex max-h-[60dvh] flex-col divide-y divide-linha overflow-y-auto">
          {historico?.length === 0 && <li className="py-3 text-creme-3">Nenhuma mudança ainda.</li>}
          {historico?.map((h) => (
            <li key={h.em} className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="capitalize text-creme-2">
                {nomeDia(h.dia)}, {dataBr(h.dia).slice(0, 5)} · <span className="num">{h.hora}</span>
              </span>
              <span className={cx("num font-semibold", h.modo === "lotado" ? "text-prejuizo" : h.modo === "movimentado" ? "text-milho" : "text-creme")}>
                {NOME[h.modo]} · {textoTempo(h)}
              </span>
            </li>
          ))}
        </ul>
      </Folha>
    </section>
  );
}
