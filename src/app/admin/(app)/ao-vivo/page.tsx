"use client";
import Link from "next/link";
import { useState } from "react";
import { calcPedido } from "@/lib/calc";
import { brl, horaLocal } from "@/lib/format";
import { lojaAberta, textoHorario } from "@/lib/loja";
import { useLoja, useStore } from "@/lib/store";
import type { Pedido } from "@/lib/types";
import { SONS, useAlarme, type Som } from "@/components/alarme";
import { BotaoZap, Entrega, zapCliente } from "@/components/entrega";
import { Texto, Valor } from "@/components/campos";
import { Folha } from "@/components/folha";
import { AvisoCelular } from "@/components/aviso-celular";
import { SelosDoPedido } from "@/components/selos-admin";
import { Botao, Chips, Painel, Vazio } from "@/components/ui";

// Tela pra deixar aberta durante o almoço: pedido do site chega, toca até alguém aceitar ou recusar.
export default function AoVivo() {
  const { novos, ligado, semConexao, som, volume, ativar, testar, ajustar } = useAlarme();
  const loja = useLoja();
  const aberta = loja && lojaAberta(loja);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-3xl uppercase">Pedidos ao vivo</h1>
      {loja && (
        <Link href="/admin/mais/loja" className="flex min-h-12 items-center justify-between gap-3 rounded-[var(--radius-ctl)] bg-brasa px-4 font-semibold active:bg-tisna">
          <span className={aberta ? "text-lucro" : "text-creme-2"}>{aberta ? "Site aberto pra pedidos" : "Site fechado pra pedidos"}</span>
          <span className="text-milho">Mudar</span>
        </Link>
      )}

      {ligado ? (
        <p className="flex items-center gap-2 font-semibold text-lucro">
          <span className="size-2.5 rounded-full bg-lucro" aria-hidden /> Som ligado. Deixa esta tela aberta.
        </p>
      ) : (
        <div role="alert" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-prejuizo p-4 text-carvao">
          <p className="font-display text-2xl uppercase leading-tight">Som desligado. Você não vai escutar os pedidos.</p>
          <button onClick={ativar} className="min-h-14 rounded-[var(--radius-ctl)] bg-carvao px-5 font-display text-xl uppercase text-creme active:scale-[0.97]">
            Ativar som
          </button>
        </div>
      )}

      {semConexao && (
        <div role="alert" className="rounded-[var(--radius-card)] border-2 border-prejuizo p-4 font-semibold text-prejuizo">
          Sem conexão. Pedido novo não chega até a internet voltar.
        </div>
      )}

      {novos.length === 0 ? (
        <Vazio titulo="Nenhum pedido esperando" texto="Quando chegar pedido do site, o alarme toca e ele aparece aqui." />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {novos.map((p) => (
            <li key={p.id}>
              <CartaoNovo p={p} />
            </li>
          ))}
        </ul>
      )}

      <Painel>
        <AvisoCelular />
      </Painel>

      <Painel className="flex flex-col gap-4">
        <h2 className="font-display text-xl uppercase">Som do alarme</h2>
        <Chips rotulo="Som do alarme" valor={som} onChange={(s: Som) => ajustar({ som: s })} opcoes={(Object.keys(SONS) as Som[]).map((v) => ({ v, t: SONS[v] }))} />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold uppercase tracking-wider text-creme-3">Volume {Math.round(volume * 100)}%</span>
          <input type="range" min={0.1} max={1} step={0.1} value={volume} onChange={(e) => ajustar({ volume: Number(e.target.value) })} className="h-12 accent-milho" />
        </label>
        <Botao onClick={testar}>Testar o som</Botao>
      </Painel>

      <Link href="/admin/pedidos" className="text-center font-semibold text-creme-2 underline underline-offset-4">
        Ver todos os pedidos
      </Link>
    </div>
  );
}

// Quanto falta pro pedido chegar no cliente, escolhido no aceite. Vira "chega por volta de 12:40" pra ele.
// Começa no fim da faixa do painel (Entrega em 40–60 min → 60).
const PRAZOS = [30, 45, 60, 75, 90];

function CartaoNovo({ p }: { p: Pedido }) {
  const { mudarStatus, avisar, tempo } = useStore();
  const prazos = [...new Set([...PRAZOS, tempo.max])].sort((a, b) => a - b).map(String);
  const [taxa, setTaxa] = useState(p.taxaEntrega);
  const [recusar, setRecusar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [prazo, setPrazo] = useState(String(tempo.max));
  const total = calcPedido({ ...p, taxaEntrega: taxa }).cobrado;
  const novaTaxa = taxa !== p.taxaEntrega ? { taxaEntrega: taxa } : undefined;

  // Agendado: a hora já é a faixa que o cliente escolheu, sem prazo.
  const aceitar = () => {
    mudarStatus(p, "feito", p.agendadoPara ? novaTaxa : { ...novaTaxa, previsaoEm: Date.now() + Number(prazo) * 60_000 });
    avisar(`Pedido nº ${p.numero} aceito. ${p.agendadoPara ? `Agendado pra ${textoHorario(p.agendadoPara)}.` : `Chega em ${prazo} min.`}`, () => mudarStatus({ ...p, ...novaTaxa, status: "feito" }, "novo", novaTaxa && { taxaEntrega: p.taxaEntrega }));
  };
  const confirmarRecusa = () => {
    const m = motivo.trim();
    window.open(zapCliente(p, `Infelizmente não vai dar pra atender esse pedido: ${m}.`), "_blank", "noopener");
    setRecusar(false);
    mudarStatus(p, "cancelado", { motivoRecusa: m });
    avisar(`Pedido nº ${p.numero} recusado.`, () => mudarStatus({ ...p, status: "cancelado" }, "novo"));
  };

  return (
    <article className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-brasa p-4 ring-2 ring-milho">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-4xl uppercase">Nº {p.numero}</h2>
        <span className="num text-creme-3">chegou {horaLocal(p.criadoEm)}</span>
      </header>
      <Link href={`/admin/novo?editar=${p.id}`} className="-mt-2 self-start font-semibold text-creme-2 underline underline-offset-4">
        Editar itens
      </Link>
      <Entrega p={p} />
      <ul className="flex flex-col gap-1 border-y border-linha py-3">
        {p.itens.map((i) => (
          <li key={`${i.produtoId}${i.brinde ? "-presente" : ""}`} className="flex justify-between gap-3 text-lg">
            <span>
              {i.qtd}× {i.nome}
            </span>
            <span className="num text-creme-2">{brl(i.qtd * i.preco)}</span>
          </li>
        ))}
      </ul>
      {p.obs && <p className="rounded-[var(--radius-ctl)] bg-tisna p-3">Recado: {p.obs}</p>}
      <SelosDoPedido p={p} />
      <div className="flex flex-col gap-1">
        <Valor rotulo="Taxa de entrega" valor={taxa} onChange={setTaxa} />
        <p className="text-sm text-creme-3">A taxa já vem calculada pela distância. Se combinar outra no WhatsApp, muda aqui antes de aceitar.</p>
      </div>
      <p className="flex items-baseline justify-between">
        <span className="text-creme-2">Total</span>
        <span className="num font-display text-3xl">{brl(total)}</span>
      </p>
      {!p.agendadoPara && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold uppercase tracking-wider text-creme-3">Chega na casa do cliente em</span>
          <Chips rotulo="Chega na casa do cliente em" valor={prazo} onChange={setPrazo} opcoes={prazos.map((v) => ({ v, t: `${v} min` }))} />
        </div>
      )}
      <Botao variante="principal" onClick={aceitar} className="min-h-16 text-2xl">
        Aceitar
      </Botao>
      <div className="grid grid-cols-2 gap-3">
        <BotaoZap href={zapCliente(p)}>WhatsApp</BotaoZap>
        <Botao variante="perigo" onClick={() => setRecusar(true)}>
          Recusar
        </Botao>
      </div>
      <Folha aberta={recusar} onFechar={() => setRecusar(false)} titulo={`Recusar o nº ${p.numero}?`}>
        <div className="flex flex-col gap-4">
          <Texto rotulo="Motivo (vai pro cliente)" valor={motivo} onChange={setMotivo} placeholder="Ex.: fora da área de entrega" />
          <p className="text-creme-2">O pedido não entra nos totais. O WhatsApp abre com a mensagem pronta pro cliente.</p>
          <div className="grid grid-cols-2 gap-3">
            <Botao onClick={() => setRecusar(false)}>Voltar</Botao>
            <Botao variante="perigo" disabled={!motivo.trim()} onClick={confirmarRecusa}>
              Recusar
            </Botao>
          </div>
        </div>
      </Folha>
    </article>
  );
}
