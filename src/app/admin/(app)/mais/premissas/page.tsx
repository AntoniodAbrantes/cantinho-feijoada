"use client";
import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { fb } from "@/lib/firebase";
import { dataBr, diaLocal, horaLocal, igual } from "@/lib/format";
import { PREMISSAS, mostrar, type Tipo } from "@/lib/meta";
import { novoId, useStore } from "@/lib/store";
import type { Premissa, Premissas } from "@/lib/types";
import { Botao, Esqueleto, Estimativa, Painel, Rotulo } from "@/components/ui";
import { CampoTipo, Interruptor, Texto } from "@/components/campos";
import { Folha } from "@/components/folha";
import { Titulo } from "@/components/voltar";

type Hist = { id: string; chave: keyof Premissas; antes: Premissa<number | string>; depois: Premissa<number | string>; em: number };
const META = Object.fromEntries(PREMISSAS.flatMap((g) => g.itens.map((i) => [i.chave, i])));

export default function PremissasPage() {
  const { premissas, carregando, lote, avisar } = useStore();
  const [editando, setEditando] = useState<keyof Premissas | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);

  useEffect(
    () => onSnapshot(query(collection(fb().db, "premissasHistorico"), orderBy("em", "desc"), limit(20)), (s) => setHist(s.docs.map((d) => ({ ...(d.data() as Omit<Hist, "id">), id: d.id })))),
    [],
  );

  if (carregando)
    return (
      <div className="flex flex-col gap-4" aria-busy aria-label="Carregando">
        <Esqueleto className="h-10 w-48" />
        <Esqueleto className="h-64" />
        <Esqueleto className="h-48" />
      </div>
    );

  const aConfirmar = Object.values(premissas).filter((x) => x.estimativa).length;

  const salvar = (chave: keyof Premissas, depois: Premissa<number | string>) => {
    const antes = premissas[chave];
    if (igual(antes, depois)) return setEditando(null);
    lote([
      { caminho: "config/premissas", dados: { [chave]: depois } },
      { caminho: `premissasHistorico/${novoId("premissasHistorico")}`, dados: { chave, antes, depois, em: Date.now() } },
    ]);
    setEditando(null);
    avisar(`${META[chave].rotulo}: ${mostrar(META[chave].tipo, depois.valor)}`, () => lote([{ caminho: "config/premissas", dados: { [chave]: antes } }]));
  };

  return (
    <div className="flex flex-col gap-6">
      <Titulo>Premissas</Titulo>
      <p className="-mt-2 text-creme-2">
        {aConfirmar ? (
          <>
            <span className="font-display text-2xl text-milho">{aConfirmar}</span> valores ainda são estimativa. Confirmando, as contas ficam certas.
          </>
        ) : (
          "Tudo confirmado. As contas estão com os valores de verdade."
        )}
      </p>

      {PREMISSAS.map((g) => (
        <section key={g.grupo} className="flex flex-col gap-2">
          <Rotulo>{g.grupo}</Rotulo>
          <ul className="divide-y divide-linha overflow-hidden rounded-[var(--radius-card)] bg-brasa">
            {g.itens.map((i) => {
              const x = premissas[i.chave] as Premissa<number | string>;
              return (
                <li key={i.chave}>
                  <button onClick={() => setEditando(i.chave)} className="flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left active:bg-tisna">
                    <span className="flex-1">
                      <span className="block">{i.rotulo}</span>
                      {x.origem && <span className="block text-sm text-creme-3">{x.origem}</span>}
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="num font-semibold">{mostrar(i.tipo, x.valor)}</span>
                      {x.estimativa && <Estimativa />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {hist.length > 0 && (
        <section className="flex flex-col gap-2">
          <Rotulo>Últimas mudanças</Rotulo>
          <Painel>
            <ul className="flex flex-col gap-2 text-creme-2">
              {hist.map((h) => {
                const m = META[h.chave];
                return (
                  <li key={h.id}>
                    <span className="text-sm text-creme-3">
                      {dataBr(diaLocal(h.em))} {horaLocal(h.em)} ·{" "}
                    </span>
                    {m?.rotulo ?? h.chave}: {m ? mostrar(m.tipo, h.antes.valor) : ""} → <span className="text-creme">{m ? mostrar(m.tipo, h.depois.valor) : ""}</span>
                    {h.antes.estimativa && !h.depois.estimativa && <span className="text-lucro"> · confirmado</span>}
                  </li>
                );
              })}
            </ul>
          </Painel>
        </section>
      )}

      {editando && <Editor chave={editando} tipo={META[editando].tipo} rotulo={META[editando].rotulo} atual={premissas[editando] as Premissa<number | string>} onSalvar={salvar} onFechar={() => setEditando(null)} />}
    </div>
  );
}

function Editor({ chave, tipo, rotulo, atual, onSalvar, onFechar }: { chave: keyof Premissas; tipo: Tipo; rotulo: string; atual: Premissa<number | string>; onSalvar: (c: keyof Premissas, p: Premissa<number | string>) => void; onFechar: () => void }) {
  const [v, setV] = useState(atual);
  return (
    <Folha aberta onFechar={onFechar} titulo={rotulo}>
      <div className="flex flex-col gap-4">
        <CampoTipo tipo={tipo} rotulo="Valor" valor={v.valor} onChange={(valor) => setV({ ...v, valor })} />
        <Texto rotulo="De onde veio" valor={v.origem} onChange={(origem) => setV({ ...v, origem })} placeholder="Ex.: confirmado na loja em 20/11" />
        <Interruptor rotulo="Estimativa a confirmar" ligado={v.estimativa} onChange={(estimativa) => setV({ ...v, estimativa })} destaque />
        <Botao variante="principal" onClick={() => onSalvar(chave, v)}>
          Salvar
        </Botao>
      </div>
    </Folha>
  );
}
