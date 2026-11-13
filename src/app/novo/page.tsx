"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { calcPedido, itemDoProduto } from "@/lib/calc";
import { brl, dataBr, diaLocal, fimDeSemana, nomeDia, reais } from "@/lib/format";
import { producaoDoDia, taxasDoMomento } from "@/lib/pedido";
import { useStore } from "@/lib/store";
import { ehSimples, type Canal, type Categoria, type Desconto, type FormaPagamento, type Produto } from "@/lib/types";
import { Botao, CANAL, Chips, Dinheiro, Esqueleto, Rotulo, Selo, cx } from "@/components/ui";
import { Texto, Valor } from "@/components/campos";
import { IconFechar, IconMenos, IconSeta } from "@/components/icons";

const PAGAMENTOS: { v: FormaPagamento; t: string }[] = [
  { v: "pix", t: "Pix" },
  { v: "dinheiro", t: "Dinheiro" },
  { v: "debito", t: "Débito" },
  { v: "credito", t: "Crédito" },
  { v: "ifood_online", t: "Online iFood" },
];
const MOTIVOS = ["Cupom", "Promoção do iFood", "Cliente fiel", "Cortesia"];
const pagamentoPadrao = (c: Canal): FormaPagamento => (c === "ifood" ? "ifood_online" : "pix");
const semDesconto: Desconto = { tipo: "valor", informado: 0, motivo: "" };

export default function Pagina() {
  const { carregando } = useStore();
  if (!carregando) return <NovoPedido />;
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 pt-6" aria-busy aria-label="Carregando">
      <Esqueleto className="h-10 w-48" />
      <div className="grid grid-cols-2 gap-3">
        <Esqueleto className="h-16" />
        <Esqueleto className="h-16" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Esqueleto key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

function NovoPedido() {
  const { produtos, premissas, producoes, salvarPedido, removerPedido, avisar } = useStore();
  const [canal, setCanal] = useState<Canal>("whatsapp");
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [precos, setPrecos] = useState<Record<string, number>>({});
  const [pagamento, setPagamento] = useState<FormaPagamento>("pix");
  const [desconto, setDesconto] = useState<Desconto>(semDesconto);
  const [taxaEntrega, setTaxaEntrega] = useState(premissas.taxaEntrega.valor);
  const [custoEntrega, setCustoEntrega] = useState(premissas.custoEntrega.valor);
  const [cliente, setCliente] = useState("");
  const [bairro, setBairro] = useState("");
  const [obs, setObs] = useState("");
  const [detalhes, setDetalhes] = useState(false);

  const hoje = diaLocal();
  const prod = producaoDoDia(producoes, hoje, premissas);
  const ativos = produtos.filter((p) => (canal === "ifood" ? p.ativoIfood : p.ativoWhatsapp)).sort((a, b) => a.ordem - b.ordem);

  const itens = useMemo(
    () =>
      ativos
        .filter((p) => qtd[p.id])
        .map((p) => {
          const i = itemDoProduto(p, canal, qtd[p.id], prod?.custoKg ?? 0, premissas);
          return precos[p.id] !== undefined ? { ...i, preco: precos[p.id] } : i;
        }),
    [ativos, qtd, precos, canal, prod, premissas],
  );
  const taxas = taxasDoMomento(canal, pagamento, premissas);
  const pedido = { canal, itens, desconto, taxaEntrega, custoEntrega, pagamento, taxas };
  const t = calcPedido(pedido);
  const nItens = itens.reduce((s, i) => s + i.qtd, 0);

  const trocarCanal = (c: Canal) => {
    setCanal(c);
    setPrecos({});
    setPagamento(pagamentoPadrao(c));
  };
  const somar = (p: Produto, d: number) => setQtd((q) => ({ ...q, [p.id]: Math.max(0, (q[p.id] ?? 0) + d) }));

  const limpar = () => {
    setQtd({});
    setPrecos({});
    setDesconto(semDesconto);
    setPagamento(pagamentoPadrao(canal));
    setTaxaEntrega(premissas.taxaEntrega.valor);
    setCustoEntrega(premissas.custoEntrega.valor);
    setCliente("");
    setBairro("");
    setObs("");
    setDetalhes(false);
  };

  const salvar = () => {
    const agora = Date.now();
    const id = salvarPedido({
      ...pedido,
      criadoEm: agora,
      dia: hoje,
      fimDeSemana: fimDeSemana(hoje),
      cliente: cliente.trim(),
      bairro: bairro.trim(),
      obs: obs.trim(),
      status: "feito",
      producaoId: prod?.producao.id ?? "",
    });
    limpar();
    avisar(`Pedido salvo · ${brl(t.cobrado)}`, () => removerPedido(id));
  };

  const grupo = (cat: Categoria) => ativos.filter((p) => p.categoria === cat);
  const simples = grupo("feijoada").filter(ehSimples);
  const feijoadas = grupo("feijoada").filter((p) => !ehSimples(p));

  return (
    <div className="mx-auto max-w-lg pb-[calc(120px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-carvao/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur">
        <Link href="/" aria-label="Fechar" className="-ml-2 grid size-12 place-items-center rounded-full text-creme-2 active:bg-tisna">
          <IconFechar />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl uppercase leading-none">Novo pedido</h1>
          <p className="text-sm capitalize text-creme-3">
            {nomeDia(hoje)}, {dataBr(hoje)}
          </p>
        </div>
        <Selo tamanho={36} />
      </header>

      <div className="flex flex-col gap-6 px-4">
        <div role="radiogroup" aria-label="Canal" className="grid grid-cols-2 gap-3">
          {(["whatsapp", "ifood"] as const).map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={canal === c}
              onClick={() => trocarCanal(c)}
              className={cx(
                "flex min-h-16 items-center justify-center gap-2 rounded-[var(--radius-ctl)] border-2 font-display text-2xl uppercase transition-colors duration-150",
                canal === c ? `${CANAL[c].fundo} ${CANAL[c].borda} text-carvao` : "border-linha text-creme-3 active:bg-tisna",
              )}
            >
              {CANAL[c].nome}
            </button>
          ))}
        </div>

        <section className="flex flex-col gap-3">
          <Rotulo>Feijoada</Rotulo>
          <div className="grid grid-cols-3 gap-3">
            {feijoadas.map((p) => (
              <Bloco key={p.id} p={p} canal={canal} qtd={qtd[p.id] ?? 0} preco={precos[p.id]} grande onMais={() => somar(p, 1)} onMenos={() => somar(p, -1)} />
            ))}
          </div>
          {simples.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {simples.map((p) => (
                <Bloco key={p.id} p={p} canal={canal} qtd={qtd[p.id] ?? 0} preco={precos[p.id]} onMais={() => somar(p, 1)} onMenos={() => somar(p, -1)} />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <Rotulo>Adicionais</Rotulo>
          <div className="grid grid-cols-3 gap-3">
            {grupo("adicional").map((p) => (
              <Bloco key={p.id} p={p} canal={canal} qtd={qtd[p.id] ?? 0} preco={precos[p.id]} onMais={() => somar(p, 1)} onMenos={() => somar(p, -1)} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <Rotulo>Bebidas</Rotulo>
          <div className="grid grid-cols-2 gap-3">
            {grupo("bebida").map((p) => (
              <Bloco key={p.id} p={p} canal={canal} qtd={qtd[p.id] ?? 0} preco={precos[p.id]} onMais={() => somar(p, 1)} onMenos={() => somar(p, -1)} />
            ))}
          </div>
        </section>

        <section className="rounded-[var(--radius-card)] bg-brasa">
          <button onClick={() => setDetalhes(!detalhes)} aria-expanded={detalhes} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
            <span className="flex-1">
              <span className="block font-semibold uppercase tracking-wider">Pagamento, desconto e cliente</span>
              <span className="block text-sm text-creme-3">
                {PAGAMENTOS.find((x) => x.v === pagamento)!.t} · entrega {brl(taxaEntrega)} · {t.desconto ? `desconto ${brl(t.desconto)}` : "sem desconto"}
              </span>
            </span>
            <IconSeta className={cx("size-5 text-creme-3 transition-transform duration-200", detalhes && "rotate-90")} />
          </button>

          {detalhes && (
            <div className="flex animate-subir flex-col gap-5 border-t border-linha px-4 pb-5 pt-4">
              <div className="flex flex-col gap-2">
                <Rotulo>Pagamento</Rotulo>
                <Chips rotulo="Forma de pagamento" opcoes={PAGAMENTOS.filter((x) => canal === "ifood" || x.v !== "ifood_online")} valor={pagamento} onChange={setPagamento} />
              </div>

              <div className="flex flex-col gap-2">
                <Rotulo>Desconto</Rotulo>
                <div className="flex items-end gap-3">
                  <Chips
                    rotulo="Tipo de desconto"
                    opcoes={[{ v: "valor", t: "R$" }, { v: "pct", t: "%" }]}
                    valor={desconto.tipo}
                    onChange={(tipo) => setDesconto({ ...desconto, tipo, informado: 0 })}
                  />
                  <Valor
                    rotulo={desconto.tipo === "valor" ? "Valor do desconto" : "Percentual"}
                    valor={desconto.informado}
                    prefixo={desconto.tipo === "valor" ? "R$" : ""}
                    sufixo={desconto.tipo === "pct" ? "%" : undefined}
                    onChange={(informado) => setDesconto({ ...desconto, informado })}
                    className="flex-1"
                  />
                </div>
                {desconto.tipo === "pct" && t.desconto > 0 && <p className="text-sm text-creme-3">Dá {brl(t.desconto)} neste pedido.</p>}
                <div className="flex flex-wrap gap-2">
                  {MOTIVOS.map((m) => (
                    <button
                      key={m}
                      aria-pressed={desconto.motivo === m}
                      onClick={() => setDesconto({ ...desconto, motivo: desconto.motivo === m ? "" : m })}
                      className={cx("min-h-10 rounded-full border px-3 text-sm font-semibold", desconto.motivo === m ? "border-milho text-milho" : "border-linha text-creme-3")}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Valor rotulo="Taxa de entrega" valor={taxaEntrega} onChange={setTaxaEntrega} />
                <Valor rotulo="Custo da entrega" valor={custoEntrega} onChange={setCustoEntrega} />
              </div>

              {itens.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Rotulo>Preço neste pedido</Rotulo>
                  {itens.map((i) => (
                    <div key={i.produtoId} className="flex items-center gap-3">
                      <span className="flex-1 text-creme-2">
                        {i.qtd}× {i.nome}
                      </span>
                      <Valor rotulo={`Preço de ${i.nome}`} valor={i.preco} onChange={(v) => setPrecos({ ...precos, [i.produtoId]: v })} className="w-36 [&>label]:sr-only" />
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Texto rotulo="Cliente" valor={cliente} onChange={setCliente} placeholder="Opcional" />
                <Texto rotulo="Bairro" valor={bairro} onChange={setBairro} placeholder="Opcional" />
              </div>
              <Texto rotulo="Observação" valor={obs} onChange={setObs} placeholder="Sem cebola, troco pra 100…" />
            </div>
          )}
        </section>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-carvao/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-4 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-creme-3">
              Total
              <span className={CANAL[canal].cor}>· {CANAL[canal].nome}</span>
            </p>
            <Dinheiro valor={nItens ? t.cobrado : 0} className="font-display text-4xl leading-tight" />
            <p className="text-sm text-creme-3">
              {nItens ? (
                <>
                  {nItens} {nItens === 1 ? "item" : "itens"} · lucro <Dinheiro valor={t.lucro} sinal />
                </>
              ) : (
                "Toque nos produtos"
              )}
            </p>
          </div>
          <Botao variante="principal" onClick={salvar} disabled={!nItens} className="min-h-16 px-8 font-display text-2xl">
            Salvar
          </Botao>
        </div>
      </footer>
    </div>
  );
}

function Bloco({ p, canal, qtd, preco, grande, onMais, onMenos }: { p: Produto; canal: Canal; qtd: number; preco?: number; grande?: boolean; onMais: () => void; onMenos: () => void }) {
  const valor = preco ?? (canal === "ifood" ? p.precoIfood : p.precoWhatsapp);
  const estoque = p.categoria === "bebida" ? (p.estoque ?? 0) - qtd : null;
  const esgotou = estoque !== null && estoque <= 0;
  return (
    <div className="relative">
      <button
        onClick={onMais}
        disabled={esgotou && qtd === 0}
        aria-label={`${p.nome}, ${reais(valor)}${qtd ? `, ${qtd} no pedido` : ""}`}
        className={cx(
          "flex w-full flex-col items-start justify-between rounded-[var(--radius-card)] border-2 bg-brasa p-3 text-left transition-[transform,border-color] duration-150 active:scale-[0.96] disabled:opacity-40",
          grande ? "min-h-28" : "min-h-20",
          qtd ? "border-milho" : "border-transparent",
        )}
      >
        <span className={cx("font-semibold leading-tight", grande ? "text-xl" : "text-lg")}>{p.curto}</span>
        <span className="num text-creme-2">{reais(valor)}</span>
        {estoque !== null && <span className={cx("text-xs uppercase tracking-wider", esgotou ? "text-prejuizo" : "text-creme-3")}>{esgotou ? "Acabou" : `Restam ${estoque}`}</span>}
      </button>
      {qtd > 0 && (
        <>
          <span key={qtd} className="num pointer-events-none absolute -right-1.5 -top-1.5 grid size-8 animate-tick place-items-center rounded-full bg-milho font-display text-lg text-carvao">
            {qtd}
          </span>
          <button onClick={onMenos} aria-label={`Tirar um ${p.curto}`} className="absolute bottom-0 right-0 grid size-12 place-items-center rounded-br-[var(--radius-card)] rounded-tl-[var(--radius-ctl)] text-creme-2 active:bg-tisna">
            <IconMenos className="size-5" />
          </button>
        </>
      )}
    </div>
  );
}

