"use client";
import { useState } from "react";
import { igual } from "@/lib/format";
import { DIAS_LOJA, NOME_DIA, lojaAberta, textoFechado } from "@/lib/loja";
import { useLoja, useStore } from "@/lib/store";
import type { Loja } from "@/lib/types";
import { Botao, Chips, Esqueleto, Painel, cx } from "@/components/ui";
import { Campo, Interruptor, estiloCampo } from "@/components/campos";
import { Titulo } from "@/components/voltar";

const MODOS: { v: Loja["modo"]; t: string }[] = [
  { v: "auto", t: "Pelo horário" },
  { v: "aberta", t: "Aberta" },
  { v: "fechada", t: "Fechada" },
];

export default function LojaPage() {
  const loja = useLoja();
  if (!loja)
    return (
      <div className="flex flex-col gap-4" aria-busy aria-label="Carregando">
        <Esqueleto className="h-10 w-48" />
        <Esqueleto className="h-40" />
      </div>
    );
  return <Editar loja={loja} />;
}

function Editar({ loja }: { loja: Loja }) {
  const { lote, avisar } = useStore();
  const [horarios, setHorarios] = useState(loja.horarios);
  const aberta = lojaAberta(loja);
  const invalido = Object.values(horarios).some((h) => !h || !h.inicio || !h.fim || h.inicio >= h.fim);

  // Apaga e grava de novo no mesmo lote: set com merge não remove dia desligado.
  const gravar = (l: Loja) => lote([{ caminho: "config/loja", apagar: true }, { caminho: "config/loja", dados: l }]);
  const mudarModo = (modo: Loja["modo"]) => {
    gravar({ ...loja, modo });
    avisar(modo === "auto" ? "Loja abre e fecha pelo horário." : `Loja ${modo} no site.`, () => gravar(loja));
  };
  const salvarHorarios = () => {
    gravar({ ...loja, horarios });
    avisar("Horários salvos.");
  };
  const dia = (d: (typeof DIAS_LOJA)[number], h?: { inicio: string; fim: string }) => {
    const n = { ...horarios };
    if (h) n[d] = h;
    else delete n[d];
    setHorarios(n);
  };

  return (
    <div className="flex flex-col gap-5">
      <Titulo>Loja no site</Titulo>

      <Painel className="flex flex-col gap-4">
        <p className={cx("flex items-center gap-2 font-display text-2xl uppercase", aberta ? "text-lucro" : "text-creme-2")}>
          <span className={cx("size-3 rounded-full", aberta ? "bg-lucro" : "bg-creme-3")} aria-hidden />
          {aberta ? "Aberta agora" : "Fechada agora"}
        </p>
        {!aberta && <p className="text-creme-2">O cliente vê: “{textoFechado(loja)}”</p>}
        <Chips rotulo="Loja" opcoes={MODOS} valor={loja.modo} onChange={mudarModo} />
        <p className="text-sm text-creme-3">
          {loja.modo === "auto"
            ? "Abre e fecha sozinha nos horários abaixo."
            : `Fica ${loja.modo} até você mudar. Volta pro horário com “Pelo horário”.`}{" "}
          O site leva até 30 segundos pra mostrar a mudança; o envio do pedido confere na hora.
        </p>
      </Painel>

      <Painel className="flex flex-col gap-4">
        <h2 className="font-display text-xl uppercase">Horários</h2>
        {DIAS_LOJA.map((d) => {
          const h = horarios[d];
          return (
            <div key={d} className="flex flex-col gap-2 border-b border-linha pb-4 last:border-0 last:pb-0">
              <Interruptor rotulo={NOME_DIA[d][0].toUpperCase() + NOME_DIA[d].slice(1)} ligado={!!h} onChange={(v) => dia(d, v ? { inicio: "", fim: "" } : undefined)} destaque />
              {h && (
                <div className="grid grid-cols-2 gap-3">
                  <Campo rotulo="Abre">{(id) => <input id={id} type="time" value={h.inicio} onChange={(e) => dia(d, { ...h, inicio: e.target.value })} className={estiloCampo} />}</Campo>
                  <Campo rotulo="Fecha">{(id) => <input id={id} type="time" value={h.fim} onChange={(e) => dia(d, { ...h, fim: e.target.value })} className={estiloCampo} />}</Campo>
                </div>
              )}
              {h && h.inicio && h.fim && h.inicio >= h.fim && <p className="text-sm text-prejuizo">O fechamento tem que ser depois da abertura.</p>}
            </div>
          );
        })}
        {loja.modo === "auto" && Object.keys(horarios).length === 0 && <p className="text-milho">Sem nenhum horário, o site fica fechado.</p>}
        <Botao variante="principal" onClick={salvarHorarios} disabled={invalido || igual(horarios, loja.horarios)}>
          Salvar horários
        </Botao>
      </Painel>
    </div>
  );
}
