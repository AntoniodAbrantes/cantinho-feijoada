"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, doc, getFirestore, onSnapshot } from "firebase/firestore";
import { Selo, cx } from "@/components/ui";
import { config, emulador } from "@/lib/firebase-config";
import { LINK_AVALIACAO_GOOGLE, linkWhatsapp } from "@/lib/contato";
import { taxaTexto } from "@/lib/entrega";
import { brl, horaLocal } from "@/lib/format";
import { NOME_PAGAMENTO, type PagamentoSite } from "@/lib/site";
import type { StatusPedido } from "@/lib/types";
import { IconEstrela } from "@/components/icons";
import { botaoPrincipal } from "./estilo";

// O que a rota de pedido grava em rastreio/{token}: sem telefone, endereço nem custo.
interface Rastreio {
  numero: number;
  criadoEm: number;
  status: StatusPedido;
  nome: string;
  itens: { nome: string; qtd: number; preco: number }[];
  taxaEntrega: number;
  total: number;
  pagamento: PagamentoSite;
  trocoPara: number;
  motivoRecusa?: string;
  previsaoEm?: number;
  avaliacao?: { nota: number };
}

// App "site" separado do sistema: sem login e sem cache offline.
function db() {
  const primeira = !getApps().some((a) => a.name === "site");
  const d = getFirestore(primeira ? initializeApp(config, "site") : getApps().find((a) => a.name === "site")!);
  if (primeira && emulador) connectFirestoreEmulator(d, "127.0.0.1", 8080);
  return d;
}

const PASSOS: { status: StatusPedido; t: string }[] = [
  { status: "novo", t: "Recebido" },
  { status: "feito", t: "Aceito" },
  { status: "saiu", t: "Saiu pra entrega" },
  { status: "entregue", t: "Entregue" },
];
const FRASE: Record<StatusPedido, string> = {
  novo: "Recebemos seu pedido. Já já o Cantinho confirma.",
  feito: "Pedido aceito! Tá sendo preparado.",
  saiu: "Saiu pra entrega. Tá chegando.",
  entregue: "Entregue. Bom apetite!",
  cancelado: "Esse pedido não foi aceito.",
};

export function Acompanhar({ token }: { token: string }) {
  const [r, setR] = useState<Rastreio | null | undefined>(undefined); // undefined = carregando, null = não achou
  const [erro, setErro] = useState(false);

  useEffect(
    () =>
      onSnapshot(
        doc(db(), "rastreio", token),
        (s) => {
          setErro(false);
          setR(s.exists() ? (s.data() as Rastreio) : null);
        },
        () => setErro(true),
      ),
    [token],
  );

  const passo = r ? PASSOS.findIndex((p) => p.status === r.status) : -1;
  const zap = linkWhatsapp(r ? `Oi! Sobre o meu pedido nº ${r.numero}.` : "Oi! Fiz um pedido pelo site.");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-4 pb-12 pt-[max(20px,env(safe-area-inset-top))]">
      <Link href="/" aria-label="Cantinho da Feijoada, voltar pro início" className="self-start">
        <Selo tamanho={56} completo />
      </Link>

      {r === undefined && !erro && <p className="animate-brilho text-xl text-creme-2">Buscando seu pedido…</p>}
      {erro && <p role="alert" className="text-xl text-prejuizo">Sem conexão agora. Assim que a internet voltar, o status atualiza sozinho.</p>}
      {r === null && (
        <section className="flex flex-col gap-4">
          <h1 className="font-display text-5xl uppercase leading-[0.95]">Não achei esse pedido</h1>
          <p className="text-xl text-creme-2">Confere o link ou chama a gente no WhatsApp.</p>
        </section>
      )}

      {r && (
        <>
          <section className="flex flex-col gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-milho">Pedido nº {r.numero}</p>
            <h1 className="font-display text-[clamp(44px,13vw,64px)] uppercase leading-[0.95]">Oi, {r.nome}!</h1>
            <p role="status" className={cx("text-2xl leading-snug", r.status === "cancelado" ? "text-prejuizo" : "text-creme")}>
              {FRASE[r.status]}
            </p>
            {r.status === "cancelado" && r.motivoRecusa && <p className="text-xl text-creme-2">Motivo: {r.motivoRecusa}</p>}
            {(r.status === "feito" || r.status === "saiu") && r.previsaoEm && (
              <p className="mt-1 flex items-baseline gap-2 rounded-[var(--radius-card)] bg-brasa px-4 py-3">
                <span className="text-lg text-creme-2">Chega por volta de</span>
                <span className="num font-display text-4xl text-milho">{horaLocal(r.previsaoEm)}</span>
              </p>
            )}
          </section>

          {r.status !== "cancelado" && (
            <ol className="flex flex-col gap-3" aria-label="Andamento do pedido">
              {PASSOS.map((p, i) => (
                <li key={p.status} className={cx("flex items-center gap-3 text-xl", i <= passo ? "text-creme" : "text-creme-3")} aria-current={i === passo ? "step" : undefined}>
                  <span className={cx("grid size-8 shrink-0 place-items-center rounded-full font-display", i < passo ? "bg-lucro text-carvao" : i === passo ? "bg-milho text-carvao" : "border border-linha")}>{i + 1}</span>
                  {p.t}
                </li>
              ))}
            </ol>
          )}

          {r.status === "entregue" && <Avaliar token={token} feita={r.avaliacao?.nota} />}

          <section className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-brasa p-4">
            {r.itens.map((i) => (
              <p key={i.nome} className="flex justify-between gap-3 text-lg">
                <span>
                  {i.qtd}× {i.nome}
                </span>
                <span className="num text-creme-2">{brl(i.qtd * i.preco)}</span>
              </p>
            ))}
            <p className="flex justify-between gap-3 text-lg text-creme-2">
              <span>Entrega</span>
              <span className="num">{taxaTexto(r.taxaEntrega)}</span>
            </p>
            <p className="mt-1 flex items-baseline justify-between gap-3 border-t border-linha pt-3">
              <span className="text-lg">Total</span>
              <span className="num font-display text-3xl">{brl(r.total)}</span>
            </p>
            <p className="text-creme-2">
              {NOME_PAGAMENTO[r.pagamento]} na entrega{r.trocoPara ? ` · troco pra ${brl(r.trocoPara)}` : ""}
            </p>
          </section>

          <a href={zap} className={cx(botaoPrincipal, "w-full")}>
            Falar com o Cantinho
          </a>
        </>
      )}

      {(r === null || erro) && (
        <a href={zap} className={cx(botaoPrincipal, "w-full")}>
          Chamar no WhatsApp
        </a>
      )}
      <Link href="/" className="text-center font-semibold text-creme-2 underline underline-offset-4">
        Voltar pro cardápio
      </Link>
    </main>
  );
}

// Depois da entrega: estrelas e um recado. Nota alta ganha o convite pro Google; baixa fica só com a gente.
function Avaliar({ token, feita }: { token: string; feita?: number }) {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviada, setEnviada] = useState(0);
  const final = feita ?? enviada;

  const enviar = async () => {
    setEnviando(true);
    setErro("");
    try {
      const r = await fetch("/api/avaliacao", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, nota, comentario }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro ?? "Não consegui mandar agora.");
      setEnviada(nota);
    } catch (e) {
      setErro(navigator.onLine ? (e as Error).message : "Tô sem internet aqui. Tenta de novo daqui a pouco.");
    } finally {
      setEnviando(false);
    }
  };

  if (final)
    return (
      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-linha p-4">
        <p className="text-xl">{final >= 4 ? "Valeu demais pela nota! 🧡" : "Valeu por contar. A gente vai melhorar."}</p>
        {final >= 4 && LINK_AVALIACAO_GOOGLE && (
          <>
            <p className="text-creme-2">Ajuda o Cantinho deixando essa nota no Google também? Leva um minuto.</p>
            <a href={LINK_AVALIACAO_GOOGLE} target="_blank" rel="noopener" className={cx(botaoPrincipal, "w-full")}>
              Avaliar no Google
            </a>
          </>
        )}
      </section>
    );

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-milho p-4">
      <h2 className="font-display text-2xl uppercase">Como tava a feijoada?</h2>
      <div role="radiogroup" aria-label="Nota de 1 a 5" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={nota === n} aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`} onClick={() => setNota(n)} className={cx("grid size-12 place-items-center transition active:scale-90", n <= nota ? "text-milho" : "text-linha")}>
            <IconEstrela className="size-10" />
          </button>
        ))}
      </div>
      {nota > 0 && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold uppercase tracking-wider text-creme-3">Quer contar mais? (opcional)</span>
            <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={300} rows={3} className="rounded-[var(--radius-ctl)] border border-linha bg-carvao px-3 py-2 text-lg text-creme focus:border-milho focus:outline-none" />
          </label>
          <button onClick={enviar} disabled={enviando} className={cx(botaoPrincipal, "w-full disabled:opacity-50")}>
            {enviando ? "Enviando…" : "Mandar avaliação"}
          </button>
        </>
      )}
      {erro && <p role="alert" className="font-semibold text-prejuizo">{erro}</p>}
    </section>
  );
}
