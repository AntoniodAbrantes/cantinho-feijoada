"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, increment, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { fb } from "@/lib/firebase";
import { NOME_TIPO, consumo, daPraMais, nivel, nomeCurto, qtdSinal, somar, type Nivel } from "@/lib/estoque";
import { brl, dataBr, diaLocal, fimDeSemana, horaLocal, nomeDia } from "@/lib/format";
import { novoId, useStore } from "@/lib/store";
import { conta, ehSimples, type Embalagem, type Movimento, type TipoMovimento } from "@/lib/types";
import { Botao, Chips, Esqueleto, Painel, Rotulo, Vazio, cx } from "@/components/ui";
import { Campo, Interruptor, Texto, Valor, estiloCampo } from "@/components/campos";
import { Confirmar, Folha } from "@/components/folha";
import { FiltroPeriodo, usePeriodo } from "@/components/periodo";
import { Titulo } from "@/components/voltar";
import { IconSeta } from "@/components/icons";

const COR: Record<Nivel, { texto: string; barra: string; rotulo: string }> = {
  ok: { texto: "text-creme", barra: "bg-lucro", rotulo: "tranquilo" },
  perto: { texto: "text-milho", barra: "bg-milho", rotulo: "perto do mínimo" },
  abaixo: { texto: "text-prejuizo", barra: "bg-prejuizo", rotulo: "abaixo do mínimo" },
};

export default function Estoque() {
  const { embalagens, produtos, pedidos, estoque, carregando } = useStore();
  const [compra, setCompra] = useState<string | null>(null); // id do pote já escolhido ("" = escolher)
  const [ajuste, setAjuste] = useState<string | null>(null);
  const [editar, setEditar] = useState<Embalagem | null>(null);
  const hoje = diaLocal();

  // Encomenda de dia futuro só baixa quando o dia chega; até lá, mostra o que ela vai levar.
  const reservado = useMemo(
    () => (estoque ? somar(pedidos.filter((p) => p.dia > hoje && conta(p.status)).map((p) => consumo(p, produtos, estoque, p.dia))) : {}),
    [pedidos, produtos, estoque, hoje],
  );

  if (carregando)
    return (
      <div className="flex flex-col gap-4" aria-busy aria-label="Carregando">
        <Esqueleto className="h-10 w-56" />
        <Esqueleto className="h-36" />
        <Esqueleto className="h-64" />
      </div>
    );

  if (!estoque)
    return (
      <div className="flex flex-col gap-5">
        <Titulo>Estoque de potes</Titulo>
        <Painel>
          <Vazio
            titulo="O estoque ainda não começou"
            texto="Primeiro entra a compra de 11/11. Depois eu dou baixa nos pedidos de 13 a 15/11 e você confere com a sua contagem antes de salvar."
            acao={
              <Link href="/admin/mais/estoque/inicio">
                <Botao variante="principal">Começar o estoque</Botao>
              </Link>
            }
          />
        </Painel>
      </div>
    );

  const tamanhos = produtos.filter((p) => p.categoria === "feijoada" && !ehSimples(p));
  const contas = tamanhos.map((p) => ({ p, ...daPraMais(p, embalagens, estoque) }));
  const pior = contas.filter((c) => c.n !== null).sort((a, b) => a.n! - b.n!)[0];

  return (
    <div className="flex flex-col gap-6">
      <Titulo>Estoque de potes</Titulo>

      <Painel className="flex flex-col gap-4">
        <Rotulo>Dá pra mais</Rotulo>
        <div className="grid grid-cols-3 divide-x divide-linha">
          {contas.map(({ p, n, gargalo }, i) => (
            <div key={p.id} className={cx("flex min-w-0 flex-col", i > 0 && "pl-3", i < contas.length - 1 && "pr-3")}>
              <span className={cx("num font-display text-[44px] leading-none", n === 0 ? "text-prejuizo" : n !== null && n < 5 ? "text-milho" : "text-creme")}>{n ?? "—"}</span>
              <span className="mt-1 font-semibold">{p.curto === "Individual" ? (n === 1 ? "individual" : "individuais") : p.curto.toLowerCase()}</span>
              <span className="text-sm text-creme-3">{n === null ? "sem receita" : gargalo ? `acaba o ${nomeCurto(gargalo)}` : ""}</span>
            </div>
          ))}
        </div>
        {pior?.gargalo && (
          <p className="border-t border-linha pt-3 text-creme-2">
            Gargalo: <span className="font-semibold text-creme">{pior.gargalo.nome}</span>, com {pior.gargalo.quantidade}. Conta pelo pote que acaba primeiro{estoque.sacoPorPedido ? ", com 1 saco por pedido" : ""}.
          </p>
        )}
      </Painel>

      <div className="grid grid-cols-2 gap-3">
        <Botao variante="principal" onClick={() => setCompra("")}>
          Registrar compra
        </Botao>
        <Botao onClick={() => setAjuste("")}>Ajustar estoque</Botao>
      </div>

      <ul className="grid grid-cols-2 gap-3">
        {embalagens.map((e) => (
          <li key={e.id}>
            <CartaoPote e={e} reservado={reservado[e.id] ?? 0} onClick={() => setEditar(e)} />
          </li>
        ))}
      </ul>

      <Link href="/admin/mais/estoque/receitas" className="flex min-h-16 items-center gap-3 rounded-[var(--radius-card)] bg-brasa px-4 py-3 active:bg-tisna">
        <span className="flex-1">
          <span className="block text-lg font-semibold">Potes por produto</span>
          <span className="block text-sm text-creme-3">Quais potes cada item do cardápio leva{estoque.sacoPorPedido ? " · saco de entrega ligado" : " · saco de entrega desligado"}</span>
        </span>
        <IconSeta className="size-5 text-creme-3" />
      </Link>

      <Historico />

      {compra !== null && <RegistrarCompra inicial={compra} onFechar={() => setCompra(null)} />}
      {ajuste !== null && <AjustarEstoque inicial={ajuste} onFechar={() => setAjuste(null)} />}
      {editar && (
        <EditarPote
          e={editar}
          onFechar={() => setEditar(null)}
          onCompra={() => (setEditar(null), setCompra(editar.id))}
          onAjuste={() => (setEditar(null), setAjuste(editar.id))}
        />
      )}
    </div>
  );
}

function CartaoPote({ e, reservado, onClick }: { e: Embalagem; reservado: number; onClick: () => void }) {
  const nv = nivel(e);
  // Barra cheia = o dobro do mínimo; o risco marca o mínimo.
  const cheio = Math.max(1, e.minimo * 2);
  return (
    <button onClick={onClick} className={cx("flex h-full w-full flex-col gap-2 rounded-[var(--radius-card)] bg-brasa p-4 text-left active:bg-tisna", nv === "abaixo" && "ring-2 ring-prejuizo")}>
      <span className="font-semibold leading-tight">{nomeCurto(e)}</span>
      <span className={cx("num font-display text-[40px] leading-none", COR[nv].texto)}>{e.quantidade}</span>
      <span className="relative h-2 rounded-full bg-tisna" role="progressbar" aria-label={`${e.nome}: ${e.quantidade}, mínimo ${e.minimo}, ${COR[nv].rotulo}`} aria-valuenow={e.quantidade} aria-valuemin={0} aria-valuemax={cheio}>
        <span className={cx("absolute inset-y-0 left-0 rounded-full transition-[width] duration-200", COR[nv].barra)} style={{ width: `${Math.min(100, (Math.max(0, e.quantidade) / cheio) * 100)}%` }} />
        {e.minimo > 0 && <span className="absolute -inset-y-1 left-1/2 w-0.5 rounded-full bg-creme-3" aria-hidden />}
      </span>
      <span className="text-sm text-creme-3">
        mínimo {e.minimo}
        {e.custo !== null && ` · ${brl(e.custo)}/un`}
      </span>
      {reservado > 0 && <span className="text-sm text-milho">{reservado} pra encomendas</span>}
    </button>
  );
}

// Potes como chips: são poucos, um toque escolhe.
function EscolherPote({ valor, onChange }: { valor: string; onChange: (id: string) => void }) {
  const { embalagens } = useStore();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold uppercase tracking-wider text-creme-3">Pote</span>
      <Chips rotulo="Pote" valor={valor} onChange={onChange} opcoes={embalagens.map((e) => ({ v: e.id, t: nomeCurto(e) }))} />
    </div>
  );
}

const meioDia = (dia: string) => Date.parse(`${dia}T12:00:00-03:00`);

function RegistrarCompra({ inicial, onFechar }: { inicial: string; onFechar: () => void }) {
  const { embalagens, lote, avisar } = useStore();
  const hoje = diaLocal();
  const [id, setId] = useState(inicial);
  const [qtd, setQtd] = useState(0);
  const [valor, setValor] = useState(0);
  const [dia, setDia] = useState(hoje);
  const [caixa, setCaixa] = useState(true);
  const e = embalagens.find((x) => x.id === id);
  const custo = valor && qtd ? Math.round(valor / qtd) : null;
  const diaOk = /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia <= hoje;

  const salvar = () => {
    if (!e) return;
    const em = dia === hoje ? Date.now() : meioDia(dia);
    lote([
      { caminho: `embalagens/${e.id}`, dados: { quantidade: increment(qtd), ...(custo !== null && { custo }) } },
      { caminho: `movimentacoes/${novoId("movimentacoes")}`, dados: { em, dia, embalagemId: e.id, qtd, tipo: "compra", pedidoId: null, obs: valor ? `Pago ${brl(valor)}` : "" } },
      ...(valor && caixa ? [{ caminho: `compras/${novoId("compras")}`, dados: { data: dia, descricao: `${e.nome}: ${qtd} un`, categoria: "embalagens", valor, obs: "Lançado pelo estoque de potes" } }] : []),
    ]);
    avisar(`${nomeCurto(e)}: +${qtd} no estoque.${valor && caixa ? ` ${brl(valor)} no caixa.` : ""}`);
    onFechar();
  };

  return (
    <Folha aberta onFechar={onFechar} titulo="Registrar compra">
      <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto pb-1">
        <EscolherPote valor={id} onChange={setId} />
        <Valor rotulo="Quantos chegaram" valor={qtd} onChange={setQtd} prefixo="" casas={0} />
        <Valor rotulo="Valor pago (opcional)" valor={valor} onChange={setValor} />
        <Campo rotulo="Data da compra">{(cid) => <input id={cid} type="date" value={dia} max={hoje} onChange={(x) => setDia(x.target.value)} className={estiloCampo} />}</Campo>
        {valor > 0 && <Interruptor rotulo="Lançar no caixa também" ligado={caixa} onChange={setCaixa} />}
        {e && qtd > 0 && (
          <p className="text-creme-2">
            {nomeCurto(e)} vai de <span className="num">{e.quantidade}</span> pra <span className="num font-semibold text-creme">{e.quantidade + qtd}</span>.
            {custo !== null && ` Custo por unidade: ${brl(custo)}.`}
          </p>
        )}
      </div>
      <Botao variante="principal" onClick={salvar} disabled={!e || !qtd || !diaOk} className="mt-4 w-full">
        Somar ao estoque
      </Botao>
    </Folha>
  );
}

const MOTIVOS = ["Contagem", "Quebrou", "Perdeu", "Outro"] as const;
type Motivo = (typeof MOTIVOS)[number];

function AjustarEstoque({ inicial, onFechar }: { inicial: string; onFechar: () => void }) {
  const { embalagens, lote, avisar } = useStore();
  const [id, setId] = useState(inicial);
  const e = embalagens.find((x) => x.id === id);
  const [real, setReal] = useState(Math.max(0, e?.quantidade ?? 0));
  const [motivo, setMotivo] = useState<Motivo>("Contagem");
  const [detalhe, setDetalhe] = useState("");
  const dif = e ? real - e.quantidade : 0;
  const escolher = (x: string) => {
    setId(x);
    setReal(Math.max(0, embalagens.find((y) => y.id === x)?.quantidade ?? 0));
  };

  const salvar = () => {
    if (!e) return;
    const em = Date.now();
    lote([
      { caminho: `embalagens/${e.id}`, dados: { quantidade: real } },
      { caminho: `movimentacoes/${novoId("movimentacoes")}`, dados: { em, dia: diaLocal(em), embalagemId: e.id, qtd: dif, tipo: "ajuste", pedidoId: null, obs: [motivo, detalhe.trim()].filter(Boolean).join(" · ") } },
    ]);
    avisar(`${nomeCurto(e)}: estoque acertado pra ${real} (${qtdSinal(dif)}).`, () =>
      lote([
        { caminho: `embalagens/${e.id}`, dados: { quantidade: increment(-dif) } },
        { caminho: `movimentacoes/${novoId("movimentacoes")}`, dados: { em: Date.now(), dia: diaLocal(), embalagemId: e.id, qtd: -dif, tipo: "ajuste", pedidoId: null, obs: "Desfeito" } },
      ]),
    );
    onFechar();
  };

  return (
    <Folha aberta onFechar={onFechar} titulo="Ajustar estoque">
      <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto pb-1">
        <EscolherPote valor={id} onChange={escolher} />
        {e && (
          <>
            <p className="text-creme-2">
              No sistema: <span className={cx("num font-semibold", e.quantidade < 0 ? "text-prejuizo" : "text-creme")}>{e.quantidade}</span>
            </p>
            <Valor rotulo="Quantos tem de verdade" valor={real} onChange={setReal} prefixo="" casas={0} />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold uppercase tracking-wider text-creme-3">Motivo</span>
              <Chips rotulo="Motivo" valor={motivo} onChange={setMotivo} opcoes={MOTIVOS.map((v) => ({ v, t: v }))} />
            </div>
            <Texto rotulo={motivo === "Outro" ? "O que houve" : "Detalhe (opcional)"} valor={detalhe} onChange={setDetalhe} placeholder="Ex.: caiu a pilha de potes" />
            {dif !== 0 && <p className={cx("num text-lg font-semibold", dif < 0 ? "text-prejuizo" : "text-lucro")}>Diferença: {qtdSinal(dif)}</p>}
          </>
        )}
      </div>
      <Botao variante="principal" onClick={salvar} disabled={!e || dif === 0 || (motivo === "Outro" && !detalhe.trim())} className="mt-4 w-full">
        Acertar estoque
      </Botao>
    </Folha>
  );
}

function EditarPote({ e, onFechar, onCompra, onAjuste }: { e: Embalagem; onFechar: () => void; onCompra: () => void; onAjuste: () => void }) {
  const { produtos, lote, avisar } = useStore();
  const [tirar, setTirar] = useState(false);
  const [nome, setNome] = useState(e.nome);
  const [minimo, setMinimo] = useState(e.minimo);
  const [custo, setCusto] = useState(e.custo ?? 0);
  const usam = produtos.filter((p) => p.potes?.some((x) => x.embalagemId === e.id));
  const salvar = () => {
    lote([{ caminho: `embalagens/${e.id}`, dados: { nome: nome.trim() || e.nome, minimo, custo: custo || null } }]);
    avisar(`${nomeCurto(e)}: mínimo ${minimo}${custo ? `, ${brl(custo)}/un` : ""}.`);
    onFechar();
  };
  return (
    <Folha aberta onFechar={onFechar} titulo={e.nome}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Botao onClick={onCompra}>Compra</Botao>
          <Botao onClick={onAjuste}>Ajuste</Botao>
        </div>
        <Texto rotulo="Nome" valor={nome} onChange={setNome} />
        <div className="grid grid-cols-2 gap-3">
          <Valor rotulo="Mínimo (alerta)" valor={minimo} onChange={setMinimo} prefixo="" casas={0} />
          <Valor rotulo="Custo por unidade" valor={custo} onChange={setCusto} />
        </div>
        <p className="text-sm text-creme-3">Custo zerado fica como não informado. A compra com valor pago atualiza sozinha.</p>
        <Botao variante="principal" onClick={salvar}>
          Salvar
        </Botao>
        <Botao variante="perigo" onClick={() => setTirar(true)}>
          Tirar do estoque
        </Botao>
      </div>
      <Confirmar
        aberta={tirar}
        titulo={`Tirar o ${nomeCurto(e)}?`}
        texto={`Ele some do estoque e das receitas${usam.length ? ` (${usam.map((p) => p.nome).join(", ")})` : ""}. Os pedidos não dão mais baixa nele. O histórico fica.`}
        acao="Tirar"
        onSim={() => {
          lote([{ caminho: `embalagens/${e.id}`, apagar: true }, ...usam.map((p) => ({ caminho: `produtos/${p.id}`, dados: { potes: p.potes!.filter((x) => x.embalagemId !== e.id) } }))]);
          avisar(`${e.nome} saiu do estoque.`);
          onFechar();
        }}
        onNao={() => setTirar(false)}
      />
    </Folha>
  );
}

const TIPOS: { v: TipoMovimento | "todos"; t: string }[] = [{ v: "todos", t: "Todos" }, ...(Object.keys(NOME_TIPO) as TipoMovimento[]).map((v) => ({ v, t: NOME_TIPO[v] }))];

// Lê só o período escolhido: movimentação cresce com cada pedido.
function Historico() {
  const { embalagens } = useStore();
  const per = usePeriodo("fds");
  const [pote, setPote] = useState("todos");
  const [tipo, setTipo] = useState<TipoMovimento | "todos">("todos");
  const [lista, setLista] = useState<Movimento[] | null>(null);
  const [mostrar, setMostrar] = useState(50);
  const inicio = per.periodo === "hoje" ? per.hoje : per.periodo === "fds" ? fimDeSemana(per.hoje) : per.periodo === "mes" ? `${per.hoje.slice(0, 7)}-01` : per.de;

  useEffect(() => {
    setLista(null);
    return onSnapshot(query(collection(fb().db, "movimentacoes"), where("dia", ">=", inicio), orderBy("dia", "desc")), (s) =>
      setLista(s.docs.map((d) => ({ ...(d.data() as Omit<Movimento, "id">), id: d.id })).sort((a, b) => b.em - a.em)),
    );
  }, [inicio]);

  const filtrada = (lista ?? []).filter((m) => per.dentro(m.dia) && (pote === "todos" || m.embalagemId === pote) && (tipo === "todos" || m.tipo === tipo));
  const saiu = filtrada.reduce((s, m) => s + (m.qtd < 0 ? -m.qtd : 0), 0);
  const entrou = filtrada.reduce((s, m) => s + (m.qtd > 0 ? m.qtd : 0), 0);
  const nome = (id: string) => {
    const e = embalagens.find((x) => x.id === id);
    return e ? nomeCurto(e) : id;
  };

  return (
    <section className="flex flex-col gap-3">
      <Rotulo>Movimentações</Rotulo>
      <FiltroPeriodo p={per} />
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Pote">
          {(id) => (
            <select id={id} value={pote} onChange={(e) => setPote(e.target.value)} className={estiloCampo}>
              <option value="todos">Todos</option>
              {embalagens.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Tipo">
          {(id) => (
            <select id={id} value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimento | "todos")} className={estiloCampo}>
              {TIPOS.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.t}
                </option>
              ))}
            </select>
          )}
        </Campo>
      </div>
      {lista === null ? (
        <Esqueleto className="h-40" />
      ) : filtrada.length === 0 ? (
        <Painel>
          <Vazio titulo="Nada nesse filtro" texto="Troca o período, o pote ou o tipo." />
        </Painel>
      ) : (
        <>
          <p className="text-creme-2">
            {filtrada.length} {filtrada.length === 1 ? "movimento" : "movimentos"} · saíram <span className="num font-semibold text-creme">{saiu}</span> · entraram <span className="num font-semibold text-lucro">{entrou}</span>
          </p>
          <ul className="divide-y divide-linha overflow-hidden rounded-[var(--radius-card)] bg-brasa">
            {filtrada.slice(0, mostrar).map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {nome(m.embalagemId)} <span className="text-sm font-normal text-creme-3">· {NOME_TIPO[m.tipo]}</span>
                  </span>
                  <span className="block truncate text-sm text-creme-3">
                    {nomeDia(m.dia).slice(0, 3)} {dataBr(m.dia).slice(0, 5)}
                    {m.dia === diaLocal(m.em) && ` ${horaLocal(m.em)}`}
                    {m.obs && ` · ${m.obs}`}
                  </span>
                </span>
                <span className={cx("num shrink-0 text-xl font-semibold", m.qtd > 0 ? "text-lucro" : "text-creme")}>{qtdSinal(m.qtd)}</span>
              </li>
            ))}
          </ul>
          {filtrada.length > mostrar && (
            <Botao variante="fantasma" onClick={() => setMostrar(mostrar + 100)}>
              Mostrar mais ({filtrada.length - mostrar})
            </Botao>
          )}
        </>
      )}
    </section>
  );
}
