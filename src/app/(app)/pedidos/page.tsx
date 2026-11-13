"use client";
import Link from "next/link";
import { useState } from "react";
import { calcPedido } from "@/lib/calc";
import { baixarCsv } from "@/lib/csv";
import { brl, bpFmt, dataBr, horaLocal, nomeDia, pctFmt, reais } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Canal, Pedido, StatusPedido } from "@/lib/types";
import { Botao, CANAL, Chips, Dinheiro, Esqueleto, EtiquetaCanal, Linha, Painel, Rotulo, Vazio, cx } from "@/components/ui";
import { Confirmar, Folha } from "@/components/folha";
import { FiltroPeriodo, NOME_PERIODO, usePeriodo } from "@/components/periodo";

const STATUS: Record<StatusPedido, string> = { feito: "Feito", entregue: "Entregue", cancelado: "Cancelado" };
const PAGAMENTO: Record<string, string> = { pix: "Pix", dinheiro: "Dinheiro", debito: "Débito", credito: "Crédito", ifood_online: "Online iFood" };
const resumoItens = (p: Pedido) => p.itens.map((i) => `${i.qtd}× ${i.nome}`).join(", ");

export default function Pedidos() {
  const { pedidos, carregando } = useStore();
  const per = usePeriodo("fds");
  const [canal, setCanal] = useState<"todos" | Canal>("todos");
  const [status, setStatus] = useState<"todos" | StatusPedido>("todos");
  const [aberto, setAberto] = useState<string | null>(null);

  const lista = pedidos.filter((p) => per.dentro(p.dia) && (canal === "todos" || p.canal === canal) && (status === "todos" || p.status === status));
  const validos = lista.filter((p) => p.status !== "cancelado");
  const total = validos.reduce((s, p) => s + calcPedido(p).cobrado, 0);
  const dias = [...new Set(lista.map((p) => p.dia))];
  const sel = pedidos.find((p) => p.id === aberto);

  const exportar = () =>
    baixarCsv(
      `pedidos-${per.hoje}.csv`,
      lista.map((p) => {
        const t = calcPedido(p);
        return {
          data: dataBr(p.dia), hora: horaLocal(p.criadoEm), canal: CANAL[p.canal].nome, status: STATUS[p.status], cliente: p.cliente, bairro: p.bairro, itens: resumoItens(p),
          bruto: reais(t.bruto), desconto: reais(t.desconto), motivo_desconto: p.desconto.motivo, liquido: reais(t.liquido), taxa_entrega: reais(p.taxaEntrega),
          taxas_ifood: reais(t.taxasIfood), taxa_pagamento: reais(t.taxaPagamento), custo: reais(t.custo), lucro: reais(t.lucro), margem: pctFmt(t.margem, 1),
          pagamento: PAGAMENTO[p.pagamento], obs: p.obs,
        };
      }),
    );

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-3xl uppercase">Pedidos</h1>
      <FiltroPeriodo p={per} />
      <Chips rotulo="Canal" valor={canal} onChange={setCanal} opcoes={[{ v: "todos", t: "Todos" }, { v: "whatsapp", t: "WhatsApp" }, { v: "ifood", t: "iFood" }]} />
      <Chips rotulo="Status" valor={status} onChange={setStatus} opcoes={[{ v: "todos", t: "Todos" }, { v: "feito", t: "Feito" }, { v: "entregue", t: "Entregue" }, { v: "cancelado", t: "Cancelado" }]} />

      {carregando ? (
        <div className="flex flex-col gap-3" aria-busy aria-label="Carregando">
          {[1, 2, 3].map((i) => (
            <Esqueleto key={i} className="h-24" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <Vazio
          titulo={`Nenhum pedido ${NOME_PERIODO[per.periodo]}`}
          texto={canal !== "todos" || status !== "todos" ? "Tira um filtro pra ver mais." : "Bora vender? O primeiro sai num toque."}
          acao={<Link href="/novo"><Botao variante="principal">Lançar pedido</Botao></Link>}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-creme-2">
              <span className="font-display text-2xl text-creme">{validos.length}</span> {validos.length === 1 ? "pedido" : "pedidos"} · {brl(total)}
            </p>
            <Botao variante="fantasma" onClick={exportar} className="text-base">
              Exportar CSV
            </Botao>
          </div>
          {dias.map((dia) => (
            <section key={dia} className="flex flex-col gap-2">
              <Rotulo>
                {nomeDia(dia)}, {dataBr(dia)}
              </Rotulo>
              <ul className="grid gap-2 lg:grid-cols-2">
                {lista.filter((p) => p.dia === dia).map((p) => (
                  <li key={p.id}>
                    <Cartao p={p} onAbrir={() => setAberto(p.id)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <Detalhe p={sel} onFechar={() => setAberto(null)} />
    </div>
  );
}

function Cartao({ p, onAbrir }: { p: Pedido; onAbrir: () => void }) {
  const t = calcPedido(p);
  const cancelado = p.status === "cancelado";
  return (
    <button onClick={onAbrir} className={cx("flex w-full items-stretch gap-3 rounded-[var(--radius-card)] bg-brasa p-3 text-left transition-transform duration-150 active:scale-[0.98]", cancelado && "opacity-55")}>
      <span className={cx("w-1 shrink-0 rounded-full", CANAL[p.canal].fundo)} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm">
          <span className="num text-creme-3">{horaLocal(p.criadoEm)}</span>
          <EtiquetaCanal canal={p.canal} />
          {p.status !== "feito" && <span className={cx("text-xs font-bold uppercase tracking-wider", cancelado ? "text-prejuizo" : "text-creme-3")}>· {STATUS[p.status]}</span>}
        </span>
        <span className="truncate">{p.cliente ? `${p.cliente} · ` : ""}{resumoItens(p)}</span>
        {p.desconto.informado > 0 && <span className="text-sm text-creme-3">desconto {brl(t.desconto)}{p.desconto.motivo && ` · ${p.desconto.motivo}`}</span>}
      </span>
      <span className="flex flex-col items-end justify-center">
        <span className={cx("num font-display text-xl", cancelado && "line-through")}>{brl(t.cobrado)}</span>
        {!cancelado && <span className="text-sm">lucro <Dinheiro valor={t.lucro} sinal /></span>}
      </span>
    </button>
  );
}

function Detalhe({ p, onFechar }: { p?: Pedido; onFechar: () => void }) {
  const { mudarStatus, removerPedido, avisar } = useStore();
  const [confirmar, setConfirmar] = useState<"cancelar" | "apagar" | null>(null);
  if (!p) return <Folha aberta={false} onFechar={onFechar} titulo="Pedido">{null}</Folha>;
  const t = calcPedido(p);

  const status = (s: StatusPedido) => {
    const antes = p.status;
    onFechar(); // o aviso com "desfazer" fica atrás do modal
    mudarStatus(p, s);
    avisar(s === "cancelado" ? "Pedido cancelado. Bebidas voltaram pro estoque." : `Marcado como ${STATUS[s].toLowerCase()}.`, () => mudarStatus({ ...p, status: s }, antes));
  };

  return (
    <>
      <Folha aberta={!confirmar} onFechar={onFechar} titulo={`Pedido das ${horaLocal(p.criadoEm)}`}>
        <div className="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto">
          <p className="flex flex-wrap items-center gap-2 text-creme-2">
            <EtiquetaCanal canal={p.canal} /> · {nomeDia(p.dia)}, {dataBr(p.dia)} · {PAGAMENTO[p.pagamento]} · {STATUS[p.status]}
          </p>
          {(p.cliente || p.bairro) && <p>{[p.cliente, p.bairro].filter(Boolean).join(" · ")}</p>}
          <ul className="flex flex-col gap-1">
            {p.itens.map((i) => (
              <li key={i.produtoId} className="flex justify-between gap-3">
                <span>{i.qtd}× {i.nome}</span>
                <span className="num text-creme-2">{brl(i.qtd * i.preco)}</span>
              </li>
            ))}
          </ul>
          {p.obs && <p className="rounded-[var(--radius-ctl)] bg-tisna p-3 text-creme-2">{p.obs}</p>}
          <Painel className="bg-carvao">
            <Linha rotulo="Bruto dos itens"><Dinheiro valor={t.bruto} /></Linha>
            {t.desconto > 0 && (
              <>
                <Linha rotulo="Desconto" nota={p.desconto.motivo || undefined}><Dinheiro valor={-t.desconto} /></Linha>
                <Linha rotulo="Líquido dos itens"><Dinheiro valor={t.liquido} /></Linha>
              </>
            )}
            <Linha rotulo="Taxa de entrega"><Dinheiro valor={p.taxaEntrega} /></Linha>
            {p.canal === "ifood" && (
              <Linha rotulo="Taxas do iFood" nota={`comissão ${bpFmt(p.taxas.comissaoBp)} sobre o ${p.taxas.base}${p.pagamento === "ifood_online" ? ` + online ${bpFmt(p.taxas.onlineBp)}` : ""}`}>
                <Dinheiro valor={-t.taxasIfood} />
              </Linha>
            )}
            {t.taxaPagamento > 0 && <Linha rotulo="Taxa da maquininha" nota={bpFmt(p.taxas.pagamentoBp)}><Dinheiro valor={-t.taxaPagamento} /></Linha>}
            <Linha rotulo="Custo" nota="itens + entrega"><Dinheiro valor={-t.custo} /></Linha>
            <Linha rotulo="Lucro" nota={`margem ${pctFmt(t.margem, 1)}`}><Dinheiro valor={t.lucro} sinal className="font-display text-xl" /></Linha>
          </Painel>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {p.status === "cancelado" ? (
            <Botao onClick={() => status("feito")}>Reabrir</Botao>
          ) : p.status === "feito" ? (
            <Botao variante="principal" onClick={() => status("entregue")}>Entregue</Botao>
          ) : (
            <Botao onClick={() => status("feito")}>Voltar pra feito</Botao>
          )}
          {p.status !== "cancelado" ? (
            <Botao variante="perigo" onClick={() => setConfirmar("cancelar")}>Cancelar</Botao>
          ) : (
            <Botao variante="perigo" onClick={() => setConfirmar("apagar")}>Apagar</Botao>
          )}
        </div>
      </Folha>
      <Confirmar
        aberta={confirmar === "cancelar"}
        titulo="Cancelar pedido?"
        texto={`O pedido de ${brl(t.cobrado)} sai dos totais e as bebidas voltam pro estoque. Dá pra reabrir depois.`}
        acao="Cancelar pedido"
        onNao={() => setConfirmar(null)}
        onSim={() => {
          setConfirmar(null);
          status("cancelado");
        }}
      />
      <Confirmar
        aberta={confirmar === "apagar"}
        titulo="Apagar de vez?"
        texto="Some da lista e não volta. Se foi só engano de status, melhor deixar cancelado."
        acao="Apagar"
        onNao={() => setConfirmar(null)}
        onSim={() => {
          setConfirmar(null);
          onFechar();
          removerPedido(p.id);
          avisar("Pedido apagado.");
        }}
      />
    </>
  );
}
