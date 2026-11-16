"use client";
import { useState } from "react";
import { embalagens as padraoEmbalagens, receitas } from "@/data/estoque";
import { nomeCurto } from "@/lib/estoque";
import { useStore } from "@/lib/store";
import type { PartePote, Produto } from "@/lib/types";
import { Botao, Esqueleto, Estimativa, Painel, Rotulo, cx } from "@/components/ui";
import { Interruptor, estiloCampo } from "@/components/campos";
import { Folha } from "@/components/folha";
import { IconFechar } from "@/components/icons";
import { Titulo } from "@/components/voltar";

const GRUPOS = [
  { v: "feijoada", t: "Feijoadas" },
  { v: "adicional", t: "Adicionais" },
] as const;

export default function Receitas() {
  const { produtos, embalagens, estoque, carregando, lote, avisar } = useStore();
  const [aberto, setAberto] = useState<Produto | null>(null);
  if (carregando) return <Esqueleto className="h-64" />;

  // Antes da carga inicial ainda não há potes no banco: mostra os da lista padrão.
  const potes = embalagens.length ? embalagens : padraoEmbalagens;
  const nome = (id: string) => {
    const e = potes.find((x) => x.id === id);
    return e ? nomeCurto(e) : "pote apagado";
  };
  const receita = (p: Produto) => p.potes ?? receitas[p.id] ?? [];

  const salvar = (p: Produto, potesNovos: PartePote[]) => {
    const antes = p.potes;
    lote([{ caminho: `produtos/${p.id}`, dados: { potes: potesNovos } }]);
    setAberto(null);
    avisar(`Potes de ${p.nome} salvos. Vale pros próximos pedidos.`, antes ? () => lote([{ caminho: `produtos/${p.id}`, dados: { potes: antes } }]) : undefined);
  };

  return (
    <div className="flex flex-col gap-5">
      <Titulo voltar="/admin/mais/estoque">Potes por produto</Titulo>
      <p className="text-creme-2">Cada parte do prato sai num pote. Mudar aqui vale pros pedidos de agora em diante; os antigos ficam como foram baixados. Mais carne ou mais feijão não muda os potes.</p>

      {estoque ? (
        <Painel>
          <Interruptor
            rotulo="1 saco de entrega por pedido"
            ligado={estoque.sacoPorPedido}
            onChange={(v) => {
              lote([{ caminho: "config/estoque", dados: { sacoPorPedido: v } }]);
              avisar(v ? "Saco de entrega volta a sair em todo pedido." : "Saco de entrega não sai mais sozinho.", () => lote([{ caminho: "config/estoque", dados: { sacoPorPedido: !v } }]));
            }}
          />
        </Painel>
      ) : (
        <p className="text-sm text-creme-3">O saco de entrega (1 por pedido) liga quando o estoque começar.</p>
      )}

      {GRUPOS.map((g) => (
        <section key={g.v} className="flex flex-col gap-2">
          <Rotulo>{g.t}</Rotulo>
          <ul className="divide-y divide-linha overflow-hidden rounded-[var(--radius-card)] bg-brasa">
            {produtos
              .filter((p) => p.categoria === g.v)
              .map((p) => {
                const r = receita(p);
                const semPote = r.length === 0 || r.some((x) => !x.embalagemId);
                return (
                  <li key={p.id}>
                    <button onClick={() => setAberto(p)} className="flex min-h-14 w-full flex-col gap-1 px-4 py-3 text-left active:bg-tisna">
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="font-semibold">{p.nome}</span>
                        {semPote && <Estimativa texto="a definir" />}
                      </span>
                      <span className="text-sm text-creme-2">{r.length ? r.map((x) => `${x.parte || "Parte"} ${x.embalagemId ? nome(x.embalagemId) : "sem pote"}`).join(" · ") : "Não usa pote"}</span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      <p className="text-sm text-creme-3">Bebidas não usam pote. A marmita de 3 compartimentos fica no estoque, sem baixa automática por enquanto.</p>

      {aberto && <Editor p={aberto} inicial={receita(aberto)} potes={potes} onSalvar={(x) => salvar(aberto, x)} onFechar={() => setAberto(null)} />}
    </div>
  );
}

function Editor({ p, inicial, potes, onSalvar, onFechar }: { p: Produto; inicial: PartePote[]; potes: { id: string; nome: string; capacidadeMl: number | null }[]; onSalvar: (x: PartePote[]) => void; onFechar: () => void }) {
  const [partes, setPartes] = useState(inicial);
  const mudar = (i: number, m: Partial<PartePote>) => setPartes(partes.map((x, j) => (j === i ? { ...x, ...m } : x)));
  const validas = partes.map((x) => ({ ...x, parte: x.parte.trim() })).filter((x) => x.parte || x.embalagemId);
  return (
    <Folha aberta onFechar={onFechar} titulo={p.nome}>
      <div className="flex max-h-[65dvh] flex-col gap-3 overflow-y-auto pb-1">
        {partes.length === 0 && <p className="text-creme-2">Nenhum pote. Adiciona uma parte se esse item for num pote.</p>}
        {partes.map((x, i) => (
          <div key={i} className="grid grid-cols-[1fr_1.2fr_auto] items-center gap-2">
            <input aria-label={`Parte ${i + 1}`} value={x.parte} onChange={(e) => mudar(i, { parte: e.target.value })} placeholder="Ex.: Arroz" className={estiloCampo} />
            <select aria-label={`Pote da parte ${x.parte || i + 1}`} value={x.embalagemId} onChange={(e) => mudar(i, { embalagemId: e.target.value })} className={cx(estiloCampo, !x.embalagemId && "text-milho")}>
              <option value="">Sem pote</option>
              {potes.map((e) => (
                <option key={e.id} value={e.id}>
                  {nomeCurto(e)}
                </option>
              ))}
            </select>
            <button onClick={() => setPartes(partes.filter((_, j) => j !== i))} aria-label={`Tirar ${x.parte || "parte"}`} className="grid size-12 place-items-center rounded-full text-creme-3 active:bg-tisna">
              <IconFechar className="size-5" />
            </button>
          </div>
        ))}
        <Botao variante="fantasma" onClick={() => setPartes([...partes, { parte: "", embalagemId: "" }])} className="self-start">
          + Adicionar parte
        </Botao>
      </div>
      <Botao variante="principal" onClick={() => onSalvar(validas)} className="mt-4 w-full">
        Salvar
      </Botao>
    </Folha>
  );
}
