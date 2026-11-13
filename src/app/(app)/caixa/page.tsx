"use client";
import { useState } from "react";
import { increment } from "firebase/firestore";
import { lucroCanal } from "@/lib/calc";
import { baixarCsv } from "@/lib/csv";
import { brl, dataBr, diaLocal, nomeDia, pctFmt, reais } from "@/lib/format";
import { resumo } from "@/lib/painel";
import { novoId, useStore } from "@/lib/store";
import type { CategoriaCompra, Compra, Produto } from "@/lib/types";
import { Botao, Chips, Dinheiro, Esqueleto, Estimativa, EtiquetaCanal, Painel, Rotulo, Vazio } from "@/components/ui";
import { Campo, Interruptor, Texto, Valor } from "@/components/campos";
import { Confirmar, Folha } from "@/components/folha";

const CATEGORIAS: { v: CategoriaCompra; t: string }[] = [
  { v: "ingredientes", t: "Ingredientes" },
  { v: "embalagens", t: "Embalagens" },
  { v: "bebidas", t: "Bebidas" },
  { v: "divulgacao", t: "Divulgação" },
  { v: "mimo", t: "Mimo ao cliente" },
  { v: "outros", t: "Outros" },
];
const NOME_CAT = Object.fromEntries(CATEGORIAS.map((c) => [c.v, c.t]));

export default function Caixa() {
  const { pedidos, compras, carregando } = useStore();
  const [aba, setAba] = useState<"compras" | "bebidas">("compras");
  if (carregando)
    return (
      <div className="flex flex-col gap-4" aria-busy aria-label="Carregando">
        <Esqueleto className="h-20 w-60" />
        <Esqueleto className="h-64" />
      </div>
    );
  const recebido = resumo(pedidos).recebido;
  const gasto = compras.reduce((s, c) => s + c.valor, 0);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl uppercase">Caixa</h1>
      <section>
        <Rotulo>Saldo do caixa</Rotulo>
        <Dinheiro valor={recebido - gasto} className={`font-display text-[56px] leading-none ${recebido < gasto ? "text-prejuizo" : "text-milho"}`} />
        <p className="mt-1 text-creme-2">
          {brl(recebido)} recebidos nas vendas (já sem taxas) − {brl(gasto)} em compras
        </p>
      </section>
      <Chips rotulo="Seção" valor={aba} onChange={setAba} opcoes={[{ v: "compras", t: "Compras" }, { v: "bebidas", t: "Bebidas" }]} />
      {aba === "compras" ? <Compras /> : <Bebidas />}
    </div>
  );
}

function Compras() {
  const { compras, lote, avisar } = useStore();
  const [aberta, setAberta] = useState<Compra | null>(null);
  const total = compras.reduce((s, c) => s + c.valor, 0);
  const porCat = CATEGORIAS.map((c) => ({ ...c, valor: compras.filter((x) => x.categoria === c.v).reduce((s, x) => s + x.valor, 0) })).filter((c) => c.valor).sort((a, b) => b.valor - a.valor);
  const dias = [...new Set(compras.map((c) => c.data))];

  const salvar = (c: Compra) => {
    const { id, ...dados } = c;
    lote([{ caminho: `compras/${id || novoId("compras")}`, dados }]);
    setAberta(null);
    avisar(`${c.descricao}: ${brl(c.valor)} lançado.`);
  };

  return (
    <>
      <div className="flex gap-3">
        <Botao variante="principal" className="flex-1" onClick={() => setAberta({ id: "", data: diaLocal(), descricao: "", categoria: "ingredientes", valor: 0, obs: "" })}>
          Lançar compra
        </Botao>
        {compras.length > 0 && (
          <Botao variante="fantasma" onClick={() => baixarCsv("compras.csv", compras.map((c) => ({ data: dataBr(c.data), descricao: c.descricao, categoria: NOME_CAT[c.categoria], valor: reais(c.valor), obs: c.obs })))}>
            CSV
          </Botao>
        )}
      </div>
      {compras.length === 0 ? (
        <Vazio titulo="Nenhuma compra lançada" texto="Tudo que sai do bolso entra aqui: nota do mercado, embalagem, panfleto." />
      ) : (
        <>
          <Painel>
            <Rotulo className="mb-3">Pra onde foi o dinheiro · {brl(total)}</Rotulo>
            <ul className="flex flex-col gap-3">
              {porCat.map((c) => (
                <li key={c.v}>
                  <div className="flex justify-between gap-3 text-creme-2">
                    <span>{c.t}</span>
                    <span className="num font-semibold text-creme">{brl(c.valor)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-tisna">
                    <div className="h-full rounded-full bg-creme-2" style={{ width: `${(c.valor / porCat[0].valor) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Painel>
          {dias.map((d) => (
            <section key={d} className="flex flex-col gap-2">
              <Rotulo>{nomeDia(d)}, {dataBr(d)}</Rotulo>
              <ul className="divide-y divide-linha overflow-hidden rounded-[var(--radius-card)] bg-brasa">
                {compras.filter((c) => c.data === d).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setAberta(c)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-tisna">
                      <span className="flex-1">
                        <span className="block">{c.descricao}</span>
                        <span className="block text-sm text-creme-3">{[NOME_CAT[c.categoria], c.obs].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="num font-semibold">{brl(c.valor)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
      {aberta && <EditorCompra inicial={aberta} onSalvar={salvar} onFechar={() => setAberta(null)} />}
    </>
  );
}

const campoData = "min-h-12 w-full rounded-[var(--radius-ctl)] border border-linha bg-carvao px-3 text-lg text-creme focus:border-milho focus:outline-none";

function EditorCompra({ inicial, onSalvar, onFechar }: { inicial: Compra; onSalvar: (c: Compra) => void; onFechar: () => void }) {
  const { lote, avisar } = useStore();
  const [c, setC] = useState(inicial);
  const [apagar, setApagar] = useState(false);
  return (
    <>
      <Folha aberta={!apagar} onFechar={onFechar} titulo={inicial.id ? "Compra" : "Nova compra"}>
        <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto pb-1">
          <Texto rotulo="O que foi comprado" valor={c.descricao} onChange={(descricao) => setC({ ...c, descricao })} />
          <div className="grid grid-cols-2 gap-3">
            <Valor rotulo="Valor" valor={c.valor} onChange={(valor) => setC({ ...c, valor })} />
            <Campo rotulo="Data">{(id) => <input id={id} type="date" value={c.data} onChange={(e) => setC({ ...c, data: e.target.value })} className={campoData} />}</Campo>
          </div>
          <Chips rotulo="Categoria" valor={c.categoria} onChange={(categoria) => setC({ ...c, categoria })} opcoes={CATEGORIAS} />
          {c.categoria === "bebidas" && !inicial.id && <p className="text-sm text-creme-3">Depois dá entrada nas latas e garrafas na aba Bebidas, pro estoque bater.</p>}
          <Texto rotulo="Observação" valor={c.obs} onChange={(obs) => setC({ ...c, obs })} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {inicial.id ? <Botao variante="perigo" onClick={() => setApagar(true)}>Apagar</Botao> : <span />}
          <Botao variante="principal" onClick={() => onSalvar({ ...c, descricao: c.descricao.trim() })} disabled={!c.descricao.trim() || !c.valor}>
            Salvar
          </Botao>
        </div>
      </Folha>
      <Confirmar
        aberta={apagar}
        titulo="Apagar compra?"
        texto={`${c.descricao} (${brl(inicial.valor)}) sai do caixa.`}
        acao="Apagar"
        onNao={() => setApagar(false)}
        onSim={() => {
          lote([{ caminho: `compras/${inicial.id}`, apagar: true }]);
          onFechar();
          avisar("Compra apagada.");
        }}
      />
    </>
  );
}

function Bebidas() {
  const { produtos, premissas, lote, avisar } = useStore();
  const [aberta, setAberta] = useState<Produto | null>(null);
  const bebidas = produtos.filter((p) => p.categoria === "bebida");
  const custoEstoque = bebidas.reduce((s, b) => s + (b.estoque ?? 0) * b.custo, 0);
  const seVender = (canal: "whatsapp" | "ifood") =>
    bebidas.reduce((s, b) => s + (b.estoque ?? 0) * lucroCanal(canal === "ifood" ? b.precoIfood : b.precoWhatsapp, b.custo, canal, premissas).lucro, 0);

  return (
    <>
      <Painel className="flex flex-col gap-1">
        <Rotulo>Estoque parado</Rotulo>
        <p className="font-display text-3xl">{brl(custoEstoque)}</p>
        <p className="text-creme-2">
          Vendendo tudo dá <span className="text-zap">{brl(seVender("whatsapp"))}</span> de lucro no WhatsApp ou <span className="text-ifood">{brl(seVender("ifood"))}</span> no iFood.
        </p>
      </Painel>
      <ul className="flex flex-col gap-3">
        {bebidas.map((b) => (
          <li key={b.id}>
            <Painel className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{b.nome}</p>
                  <p className="text-creme-2">
                    custa {brl(b.custo)}/un {b.estimativas.includes("custo") && <Estimativa />}
                  </p>
                </div>
                <p className="text-right">
                  <span className={`num block font-display text-3xl ${(b.estoque ?? 0) <= 2 ? "text-prejuizo" : ""}`}>{b.estoque ?? 0}</span>
                  <span className="text-sm text-creme-3">no estoque</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-linha pt-3">
                {(["whatsapp", "ifood"] as const).map((k) => {
                  const preco = k === "ifood" ? b.precoIfood : b.precoWhatsapp;
                  const r = lucroCanal(preco, b.custo, k, premissas);
                  return (
                    <div key={k}>
                      <EtiquetaCanal canal={k} />
                      <p className="num">{brl(preco)}</p>
                      <p className="text-sm text-creme-2">
                        lucro <Dinheiro valor={r.lucro} sinal /> · {pctFmt(r.margem)}
                      </p>
                    </div>
                  );
                })}
              </div>
              <Botao onClick={() => setAberta(b)}>Entrada ou contagem</Botao>
            </Painel>
          </li>
        ))}
      </ul>
      {aberta && (
        <Entrada
          b={aberta}
          onFechar={() => setAberta(null)}
          onSalvar={(qtd, contagem, custo, estimativa) => {
            const est = estimativa ? [...new Set([...aberta.estimativas, "custo"])] : aberta.estimativas.filter((x) => x !== "custo");
            lote([{ caminho: `produtos/${aberta.id}`, dados: { estoque: contagem ? qtd : increment(qtd), custo, estimativas: est } }]);
            avisar(contagem ? `${aberta.nome}: estoque acertado pra ${qtd}.` : `${aberta.nome}: +${qtd} no estoque.`);
            setAberta(null);
          }}
        />
      )}
    </>
  );
}

function Entrada({ b, onSalvar, onFechar }: { b: Produto; onSalvar: (qtd: number, contagem: boolean, custo: number, estimativa: boolean) => void; onFechar: () => void }) {
  const [modo, setModo] = useState<"entrada" | "contagem">("entrada");
  const [qtd, setQtd] = useState(0);
  const [custo, setCusto] = useState(b.custo);
  const [estimativa, setEstimativa] = useState(b.estimativas.includes("custo"));
  return (
    <Folha aberta onFechar={onFechar} titulo={b.nome}>
      <div className="flex flex-col gap-4">
        <Chips rotulo="Tipo" valor={modo} onChange={setModo} opcoes={[{ v: "entrada", t: "Chegou mais" }, { v: "contagem", t: "Contei o estoque" }]} />
        <Valor rotulo={modo === "entrada" ? "Unidades que chegaram" : "Quantas tem agora"} valor={qtd} onChange={setQtd} prefixo="" casas={0} />
        <Valor rotulo="Custo por unidade" valor={custo} onChange={setCusto} />
        <Interruptor rotulo="Custo é estimativa" ligado={estimativa} onChange={setEstimativa} destaque />
        <Botao variante="principal" onClick={() => onSalvar(qtd, modo === "contagem", custo, estimativa)} disabled={modo === "entrada" && !qtd}>
          Salvar
        </Botao>
      </div>
    </Folha>
  );
}
