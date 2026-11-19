"use client";
import { useState } from "react";
import { calcPedido } from "@/lib/calc";
import { normalizarCupom, textoCupom, usosDoCupom } from "@/lib/cupom";
import { brl, dataBr, diaLocal } from "@/lib/format";
import { useStore } from "@/lib/store";
import { conta, type Cupom } from "@/lib/types";
import { Botao, Chips, Esqueleto, Vazio, cx } from "@/components/ui";
import { Campo, Interruptor, Valor, estiloCampo } from "@/components/campos";
import { Confirmar, Folha } from "@/components/folha";
import { Titulo } from "@/components/voltar";

const novo = (): Cupom => ({ id: "", tipo: "pct", valor: 1000, ativo: true, umPorTelefone: true, criadoEm: 0 });

export default function Cupons() {
  const { cupons, pedidos, carregando } = useStore();
  const [aberto, setAberto] = useState<Cupom | null>(null);
  if (carregando)
    return (
      <div className="flex flex-col gap-4" aria-busy aria-label="Carregando">
        <Esqueleto className="h-10 w-48" />
        <Esqueleto className="h-40" />
      </div>
    );
  const hoje = diaLocal();
  const lista = [...cupons].sort((a, b) => Number(b.ativo) - Number(a.ativo) || b.criadoEm - a.criadoEm);
  return (
    <div className="flex flex-col gap-5">
      <Titulo acao={<Botao variante="principal" onClick={() => setAberto(novo())}>Novo cupom</Botao>}>Cupons</Titulo>
      {lista.length === 0 ? (
        <Vazio titulo="Nenhum cupom ainda" texto="Cria um código (ex.: FEIJAO10) e manda pros clientes. Eles digitam no site, na hora de revisar o pedido." />
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((c) => {
            const usados = pedidos.filter((p) => p.cupom === c.id && conta(p.status));
            const usos = usosDoCupom(pedidos, c.id);
            const vencido = !!c.validoAte && hoje > c.validoAte;
            const esgotado = !!c.limiteUsos && usos >= c.limiteUsos;
            const situacao = !c.ativo ? "Pausado" : vencido ? "Vencido" : esgotado ? "Esgotado" : "Valendo";
            return (
              <li key={c.id}>
                <button onClick={() => setAberto(c)} className={cx("flex w-full flex-col gap-1 rounded-[var(--radius-card)] bg-brasa p-4 text-left active:bg-tisna", situacao !== "Valendo" && "opacity-60")}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-2xl uppercase leading-none">{c.id}</span>
                    <span className={cx("text-sm font-bold uppercase tracking-wider", situacao === "Valendo" ? "text-lucro" : "text-creme-3")}>{situacao}</span>
                  </span>
                  <span className="text-creme-2">{[textoCupom(c), c.minimo && `mínimo ${brl(c.minimo)}`, c.validoAte && `até ${dataBr(c.validoAte)}`, c.umPorTelefone && "1 por WhatsApp"].filter(Boolean).join(" · ")}</span>
                  <span className="text-sm text-creme-3">
                    {usos}
                    {c.limiteUsos ? ` de ${c.limiteUsos}` : ""} {usos === 1 ? "uso" : "usos"}
                    {usados.length > 0 && ` · ${brl(usados.reduce((s, p) => s + calcPedido(p).desconto, 0))} de desconto dado`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {aberto && <Editor inicial={aberto} usos={usosDoCupom(pedidos, aberto.id)} onFechar={() => setAberto(null)} />}
    </div>
  );
}

function Editor({ inicial, usos, onFechar }: { inicial: Cupom; usos: number; onFechar: () => void }) {
  const { cupons, lote, avisar } = useStore();
  const [c, setC] = useState(inicial);
  const [apagar, setApagar] = useState(false);
  const criando = !inicial.id;
  const repetido = criando && cupons.some((x) => x.id === c.id);
  const erro = !c.id ? "Dá um código pro cupom." : repetido ? "Já existe um cupom com esse código." : !c.valor ? "Diz quanto de desconto." : c.tipo === "pct" && c.valor > 10000 ? "Desconto de no máximo 100%." : "";

  const salvar = () => {
    const { id, ...dados } = { ...c, criadoEm: c.criadoEm || Date.now() };
    // Apaga e grava: set com merge não remove regra desligada (validade, limite, mínimo).
    lote([{ caminho: `cupons/${id}`, apagar: true }, { caminho: `cupons/${id}`, dados: Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== undefined)) }]);
    avisar(criando ? `Cupom ${id} criado.` : `Cupom ${id} salvo.`);
    onFechar();
  };
  const regra = <K extends "validoAte" | "limiteUsos" | "minimo">(k: K, ligado: boolean, padrao: Cupom[K]) => setC({ ...c, [k]: ligado ? padrao : undefined });

  return (
    <>
      <Folha aberta={!apagar} onFechar={onFechar} titulo={criando ? "Novo cupom" : `Cupom ${inicial.id}`}>
        <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto pb-1">
          {criando ? (
            <Campo rotulo="Código">
              {(id) => <input id={id} value={c.id} onChange={(e) => setC({ ...c, id: normalizarCupom(e.target.value) })} autoCapitalize="characters" placeholder="FEIJAO10" className={cx(estiloCampo, "uppercase")} />}
            </Campo>
          ) : (
            <p className="text-creme-2">{usos === 1 ? "1 uso" : `${usos} usos`} até agora. O código não muda; pra outro código, cria outro cupom.</p>
          )}
          <Interruptor rotulo="Cupom valendo" ligado={c.ativo} onChange={(ativo) => setC({ ...c, ativo })} destaque />
          <div className="flex items-end gap-3">
            <Chips rotulo="Tipo de desconto" valor={c.tipo} onChange={(tipo) => setC({ ...c, tipo, valor: 1000 })} opcoes={[{ v: "pct", t: "%" }, { v: "valor", t: "R$" }]} />
            <Valor rotulo={c.tipo === "pct" ? "Percentual nos itens" : "Valor nos itens"} valor={c.valor} prefixo={c.tipo === "valor" ? "R$" : ""} sufixo={c.tipo === "pct" ? "%" : undefined} onChange={(valor) => setC({ ...c, valor })} className="flex-1" />
          </div>
          <p className="-mt-2 text-sm text-creme-3">Vale só nos itens; a entrega fica de fora. Não junta com o presente do Selo do Cantinho.</p>

          <div className="flex flex-col gap-3 border-t border-linha pt-4">
            <Interruptor rotulo="Uma vez por WhatsApp" ligado={c.umPorTelefone} onChange={(umPorTelefone) => setC({ ...c, umPorTelefone })} />
            <Interruptor rotulo="Tem validade" ligado={c.validoAte !== undefined} onChange={(v) => regra("validoAte", v, diaLocal())} />
            {c.validoAte !== undefined && (
              <Campo rotulo="Vale até (o dia todo)">{(id) => <input id={id} type="date" value={c.validoAte} onChange={(e) => setC({ ...c, validoAte: e.target.value || diaLocal() })} className={estiloCampo} />}</Campo>
            )}
            <Interruptor rotulo="Limite de usos" ligado={c.limiteUsos !== undefined} onChange={(v) => regra("limiteUsos", v, 20)} />
            {c.limiteUsos !== undefined && (
              <Campo rotulo="Quantos pedidos podem usar">
                {(id) => <input id={id} type="number" inputMode="numeric" min={1} value={c.limiteUsos || ""} onChange={(e) => setC({ ...c, limiteUsos: Math.max(1, Math.floor(Number(e.target.value)) || 1) })} className={estiloCampo} />}
              </Campo>
            )}
            <Interruptor rotulo="Pedido mínimo" ligado={c.minimo !== undefined} onChange={(v) => regra("minimo", v, 7000)} />
            {c.minimo !== undefined && <Valor rotulo="Mínimo em itens" valor={c.minimo} onChange={(minimo) => setC({ ...c, minimo })} />}
          </div>
          {erro && <p className="font-semibold text-prejuizo">{erro}</p>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {!criando && usos === 0 ? <Botao variante="perigo" onClick={() => setApagar(true)}>Apagar</Botao> : <span />}
          <Botao variante="principal" onClick={salvar} disabled={!!erro}>
            Salvar
          </Botao>
        </div>
      </Folha>
      <Confirmar
        aberta={apagar}
        titulo={`Apagar ${inicial.id}?`}
        texto="Ninguém usou ainda. Some da lista e o código deixa de valer no site."
        acao="Apagar"
        onNao={() => setApagar(false)}
        onSim={() => {
          lote([{ caminho: `cupons/${inicial.id}`, apagar: true }]);
          avisar(`Cupom ${inicial.id} apagado.`);
          onFechar();
        }}
      />
    </>
  );
}
