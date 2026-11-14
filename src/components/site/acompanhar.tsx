"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, doc, getFirestore, onSnapshot } from "firebase/firestore";
import { Selo, cx } from "@/components/ui";
import { config, emulador } from "@/lib/firebase-config";
import { linkWhatsapp } from "@/lib/contato";
import { brl } from "@/lib/format";
import { NOME_PAGAMENTO, type PagamentoSite } from "@/lib/site";
import type { StatusPedido } from "@/lib/types";
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
              <span className="num">{brl(r.taxaEntrega)}</span>
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
