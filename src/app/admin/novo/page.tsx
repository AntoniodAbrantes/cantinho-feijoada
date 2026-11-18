"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { calcPedido, custoPorcao, itemDoProduto } from "@/lib/calc";
import { brl, dataBr, diaLocal, fimDeSemana, nomeDia, reais, somaDias } from "@/lib/format";
import { producaoDoDia, taxasDoMomento } from "@/lib/pedido";
import { useStore, type Edicao } from "@/lib/store";
import { ehSimples, type Canal, type Categoria, type Desconto, type FormaPagamento, type Pedido, type Produto } from "@/lib/types";
import { Botao, CANAL, Chips, Dinheiro, Esqueleto, Rotulo, Selo, cx } from "@/components/ui";
import { Campo, Texto, Valor, estiloCampo } from "@/components/campos";
import { IconFechar, IconMenos, IconSeta } from "@/components/icons";
import { useAlarme } from "@/components/alarme";
import { BlocoSelos } from "@/components/selos";
import { useCartao } from "@/components/selos-admin";
import { itemPremio, normalizarTelefone, telefoneValido } from "@/lib/fidelidade";
import { mascaraTelefone } from "@/lib/site";

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
  return (
    <Suspense>
      <Carregar />
    </Suspense>
  );
}

// ?editar=<id> abre um pedido já lançado na mesma tela.
function Carregar() {
  const { carregando, pedidos } = useStore();
  const id = useSearchParams().get("editar");
  if (!carregando) {
    if (!id) return <NovoPedido />;
    const original = pedidos.find((p) => p.id === id);
    if (original) return <NovoPedido key={id} original={original} />;
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-10">
        <h1 className="font-display text-3xl uppercase">Pedido não encontrado</h1>
        <Link href="/admin/pedidos" className="font-semibold text-milho underline underline-offset-4">Voltar pros pedidos</Link>
      </div>
    );
  }
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

function NovoPedido({ original: o }: { original?: Pedido }) {
  const { produtos, premissas, producoes, pedidos, salvarPedido, removerPedido, editarPedido, avisar } = useStore();
  const router = useRouter();
  const { caixa } = useAlarme();
  const [canal, setCanal] = useState<Canal>(o?.canal ?? "whatsapp");
  // O presente da fidelidade fica de fora dos botões: passa igual na edição.
  const pagos = o?.itens.filter((i) => !i.brinde) ?? [];
  const [qtd, setQtd] = useState<Record<string, number>>(() => Object.fromEntries(pagos.map((i) => [i.produtoId, i.qtd])));
  const [precos, setPrecos] = useState<Record<string, number>>(() => Object.fromEntries(pagos.map((i) => [i.produtoId, i.preco])));
  const [pagamento, setPagamento] = useState<FormaPagamento>(o?.pagamento ?? "pix");
  const [desconto, setDesconto] = useState<Desconto>(o?.desconto ?? semDesconto);
  const [taxaEntrega, setTaxaEntrega] = useState(o?.taxaEntrega ?? premissas.taxaEntrega.valor);
  const [custoEntrega, setCustoEntrega] = useState(o?.custoEntrega ?? premissas.custoEntrega.valor);
  const [cliente, setCliente] = useState(o?.cliente ?? "");
  const [bairro, setBairro] = useState(o?.bairro ?? "");
  const [obs, setObs] = useState(o?.obs ?? "");
  const [telefone, setTelefone] = useState(o?.telefone ?? "");
  const tel = normalizarTelefone(telefone);
  const [detalhes, setDetalhes] = useState(false);
  // Encomenda: pedido de outro dia (ex.: feijoada pra 50 pessoas no dia 30). Conta nas vendas do dia da entrega.
  const [encomenda, setEncomenda] = useState("");
  const [hora, setHora] = useState(""); // horário aproximado da encomenda (opcional)
  const [usouPote, setUsouPote] = useState(!o?.semPote);

  const amanha = somaDias(diaLocal(), 1);
  const hoje = o?.dia ?? (encomenda || diaLocal());
  const dataInvalida = encomenda !== "" && encomenda < amanha;
  const prod = producaoDoDia(producoes, hoje, premissas);
  // Selo do Cantinho pelo WhatsApp: mesmo cartão e mesma regra do site (iFood não participa).
  const selos = useCartao(canal !== "ifood" ? telefone : undefined);
  const [escolha, setEscolha] = useState({ usar: true, escolhidoId: "" });
  const premioId = selos?.liberados ? selos.premio?.id ?? "" : "";
  useEffect(() => setEscolha({ usar: true, escolhidoId: premioId }), [premioId]);
  const brinde = !o && selos && escolha.usar ? itemPremio(selos, escolha.escolhidoId, produtos, canal, prod?.custoKg ?? 0, premissas) : null;
  const noPedido = (p: Produto) => !!o?.itens.some((i) => i.produtoId === p.id);
  const vende = (p: Produto) => (canal === "ifood" ? p.ativoIfood : canal === "site" ? p.ativoSite : p.ativoWhatsapp);
  const ativos = produtos.filter((p) => vende(p) || noPedido(p)).sort((a, b) => a.ordem - b.ordem);

  // Na edição, item que já estava no pedido guarda o custo da época; só o novo pega o custo de agora.
  const itens = useMemo(
    () =>
      ativos
        .filter((p) => qtd[p.id])
        .map((p) => {
          const antes = o?.itens.find((i) => i.produtoId === p.id && !i.brinde);
          // Item antigo (antes de guardar a embalagem) pega a do cadastro, pro "Usou pote? Não" tirar do custo.
          const i = antes ? { ...antes, qtd: qtd[p.id], embalagem: antes.embalagem ?? custoPorcao(p, 0, 0).embalagem } : itemDoProduto(p, canal, qtd[p.id], prod?.custoKg ?? 0, premissas);
          return precos[p.id] !== undefined ? { ...i, preco: precos[p.id] } : i;
        }),
    [ativos, qtd, precos, canal, prod, premissas, o],
  );
  const todos = [...itens, ...(o ? o.itens.filter((i) => i.brinde) : brinde ? [brinde.item] : [])];
  const taxas = o && pagamento === o.pagamento ? o.taxas : taxasDoMomento(canal, pagamento, premissas);
  const pedido = { canal, itens: todos, desconto, taxaEntrega, custoEntrega, pagamento, taxas, semPote: !usouPote };
  const t = calcPedido(pedido);
  const nItens = todos.reduce((s, i) => s + i.qtd, 0);

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
    setEncomenda("");
    setHora("");
    setUsouPote(true);
    setTelefone("");
  };
  // Achou o número: puxa o nome do último pedido dele.
  const mudarTelefone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 13);
    setTelefone(d);
    const n = normalizarTelefone(d);
    const ultimo = telefoneValido(n) && !cliente ? pedidos.find((p) => p.telefone && normalizarTelefone(p.telefone) === n && p.cliente) : null;
    if (ultimo) setCliente(ultimo.cliente);
  };

  const salvar = () => {
    if (o) {
      const campos = (x: Edicao): Edicao => ({ itens: x.itens, desconto: x.desconto, taxaEntrega: x.taxaEntrega, custoEntrega: x.custoEntrega, pagamento: x.pagamento, taxas: x.taxas, cliente: x.cliente, bairro: x.bairro, obs: x.obs, semPote: !!x.semPote, telefone: x.telefone ?? "" });
      const novo = campos({ ...pedido, cliente: cliente.trim(), bairro: bairro.trim(), obs: obs.trim(), telefone: telefoneValido(tel) ? tel : "" });
      editarPedido(o, novo);
      avisar(`Pedido alterado · ${brl(t.cobrado)}`, () => editarPedido({ ...o, ...novo }, campos(o)));
      router.push("/admin/pedidos");
      return;
    }
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
      ...(telefoneValido(tel) && { telefone: tel }),
      ...(brinde && { fidelidade: brinde.resgate }),
      ...(encomenda && hora && { agendadoPara: Date.parse(`${encomenda}T${hora}:00-03:00`) }), // Fortaleza não tem horário de verão
      ...(encomenda === amanha && { lembreteEm: agora }), // lançada na véspera: aparece no aviso, sem tocar o alarme
    });
    caixa();
    limpar();
    avisar(encomenda ? `Encomenda salva pra ${dataBr(hoje)} · ${brl(t.cobrado)}` : `Pedido salvo · ${brl(t.cobrado)}`, () => removerPedido(id));
  };

  const grupo = (cat: Categoria) => ativos.filter((p) => p.categoria === cat);
  const simples = grupo("feijoada").filter(ehSimples);
  const feijoadas = grupo("feijoada").filter((p) => !ehSimples(p));

  return (
    <div className="mx-auto max-w-lg pb-[calc(120px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-carvao/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur">
        <Link href={o ? "/admin/pedidos" : "/admin"} aria-label="Fechar" className="-ml-2 grid size-12 place-items-center rounded-full text-creme-2 active:bg-tisna">
          <IconFechar />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl uppercase leading-none">{o ? `Editar pedido${o.numero ? ` nº ${o.numero}` : ""}` : "Novo pedido"}</h1>
          <p className="text-sm capitalize text-creme-3">
            {nomeDia(hoje)}, {dataBr(hoje)}
          </p>
        </div>
        <Selo tamanho={36} />
      </header>

      <div className="flex flex-col gap-6 px-4">
        {o ? (
          <p className="flex items-center gap-2 text-creme-2">
            <span className={cx("font-display text-2xl uppercase", CANAL[canal].cor)}>{CANAL[canal].nome}</span>
            {o.cliente && `· ${o.cliente}`}
          </p>
        ) : (
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
        )}

        {!o && (
          <div className="flex flex-col gap-3">
            <Chips
              rotulo="Para quando"
              valor={encomenda ? "encomenda" : "hoje"}
              onChange={(v) => {
                setEncomenda(v === "encomenda" ? amanha : "");
                if (v === "encomenda") setDetalhes(true); // encomenda precisa do nome do cliente
              }}
              opcoes={[{ v: "hoje", t: "Venda de hoje" }, { v: "encomenda", t: "Encomenda" }]}
            />
            {encomenda !== "" && (
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Dia da entrega">
                  {(id) => <input id={id} type="date" min={amanha} value={encomenda} onChange={(e) => setEncomenda(e.target.value || amanha)} className={estiloCampo} />}
                </Campo>
                <Campo rotulo="Horário aproximado">
                  {(id) => <input id={id} type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={estiloCampo} />}
                </Campo>
              </div>
            )}
            {dataInvalida && <p className="text-prejuizo">Encomenda é pra amanhã em diante.</p>}
          </div>
        )}

        {canal !== "ifood" && (
          <div className="flex flex-col gap-3">
            <Campo rotulo="WhatsApp do cliente (pros selos)">
              {(id) => <input id={id} type="tel" inputMode="tel" value={mascaraTelefone(telefone)} onChange={(e) => mudarTelefone(e.target.value)} placeholder="(83) 9…" className={estiloCampo} />}
            </Campo>
            {telefone && !telefoneValido(tel) && <p className="text-sm text-creme-3">Com DDD: (83) 9xxxx-xxxx.</p>}
            {selos && !o && <BlocoSelos c={selos} escolha={escolha} onEscolha={setEscolha} comoFunciona={false} />}
            {o?.fidelidade && <p className="font-semibold text-milho">Pedido de resgate de fidelidade: o presente fica como está.</p>}
          </div>
        )}

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

        <div className="flex flex-col gap-2">
          <Rotulo>Usou pote?</Rotulo>
          <Chips rotulo="Usou pote?" valor={usouPote ? "sim" : "nao"} onChange={(v) => setUsouPote(v === "sim")} opcoes={[{ v: "sim", t: "Sim" }, { v: "nao", t: "Não" }]} />
          {!usouPote && <p className="text-sm text-creme-3">Nenhum pote sai do estoque nem entra no custo deste pedido.</p>}
        </div>

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
          <Botao variante="principal" onClick={salvar} disabled={!nItens || dataInvalida} className="min-h-16 px-8 font-display text-2xl">
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

