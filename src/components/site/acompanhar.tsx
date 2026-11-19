"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Selo, cx } from "@/components/ui";
import { dbSite } from "@/lib/firebase-site";
import { LINK_AVALIACAO_GOOGLE, PIX, linkWhatsapp } from "@/lib/contato";
import { taxaTexto } from "@/lib/entrega";
import { textoHorario } from "@/lib/loja";
import { brl, horaLocal } from "@/lib/format";
import { pixCopiaECola } from "@/lib/pix";
import { NOME_PAGAMENTO, type PagamentoSite } from "@/lib/site";
import type { StatusPedido } from "@/lib/types";
import { IconEstrela } from "@/components/icons";
import { botaoPrincipal } from "./estilo";
import { TempoEstimado, useTempo } from "./tempo";
import { CartaoSelos, ComoFunciona } from "@/components/selos";

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
  agendadoPara?: number;
  avaliacao?: { nota: number };
  selo?: { antes: number; meta: number; resgate: boolean; ganha: boolean };
  cupom?: string;
  desconto?: number;
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
        doc(dbSite(), "rastreio", token),
        (s) => {
          setErro(false);
          setR(s.exists() ? (s.data() as Rastreio) : null);
        },
        () => setErro(true),
      ),
    [token],
  );

  const tempo = useTempo();
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
            {r.agendadoPara && ["novo", "feito", "saiu"].includes(r.status) && (
              <p className="mt-1 flex flex-col rounded-[var(--radius-card)] bg-brasa px-4 py-3">
                <span className="text-lg text-creme-2">Agendado pra</span>
                <span className="font-display text-3xl uppercase leading-tight text-milho">{textoHorario(r.agendadoPara)}</span>
              </p>
            )}
            {(r.status === "feito" || r.status === "saiu") && r.previsaoEm && !r.agendadoPara && (
              <p className="mt-1 flex items-baseline gap-2 rounded-[var(--radius-card)] bg-brasa px-4 py-3">
                <span className="text-lg text-creme-2">Chega por volta de</span>
                <span className="num font-display text-4xl text-milho">{horaLocal(r.previsaoEm)}</span>
              </p>
            )}
          </section>

          {r.status === "novo" && !r.agendadoPara && <TempoEstimado tempo={tempo} depois />}

          {r.selo && r.status !== "cancelado" && <SeloDoPedido token={token} s={r.selo} entregue={r.status === "entregue"} />}

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

          {r.pagamento === "pix" && PIX.nome && PIX.cidade && ["novo", "feito", "saiu"].includes(r.status) && <PagarPix numero={r.numero} total={r.total} />}

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
            {r.cupom && r.desconto ? (
              <p className="flex justify-between gap-3 text-lg text-lucro">
                <span>Cupom {r.cupom}</span>
                <span className="num">− {brl(r.desconto)}</span>
              </p>
            ) : null}
            <p className="flex justify-between gap-3 text-lg text-creme-2">
              <span>Entrega</span>
              <span className="num">{taxaTexto(r.taxaEntrega)}</span>
            </p>
            <p className="mt-1 flex items-baseline justify-between gap-3 border-t border-linha pt-3">
              <span className="text-lg">Total</span>
              <span className="num font-display text-3xl">{brl(r.total)}</span>
            </p>
            <p className="text-creme-2">
              {NOME_PAGAMENTO[r.pagamento]} {r.pagamento === "pix" && PIX.nome && PIX.cidade ? "agora ou na entrega" : "na entrega"}{r.trocoPara ? ` · troco pra ${brl(r.trocoPara)}` : ""}
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

// Pix com o valor do pedido. O total vem do rastreio (servidor/admin), então segue qualquer ajuste na taxa.
function PagarPix({ numero, total }: { numero: number; total: number }) {
  const codigo = pixCopiaECola({ ...PIX, valor: total, txid: `PEDIDO${numero}` });
  const [svg, setSvg] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    import("qrcode").then((q) => q.toString(codigo, { type: "svg", margin: 2, errorCorrectionLevel: "M" })).then((s) => vivo && setSvg(s));
    return () => {
      vivo = false;
    };
  }, [codigo]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      prompt("Copia o código Pix:", codigo); // navegador sem acesso à área de transferência
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-milho p-4">
      <h2 className="font-display text-2xl uppercase">Paga com Pix</h2>
      <p className="text-lg text-creme-2">
        Valor de <span className="num text-creme">{brl(total)}</span> já preenchido. Pode pagar agora ou na entrega.
      </p>
      {/* QR sempre em fundo branco: câmera de banco lê melhor. */}
      <div role="img" aria-label="QR code do Pix" className="mx-auto aspect-square w-56 rounded-[var(--radius-ctl)] bg-white" dangerouslySetInnerHTML={{ __html: svg }} />
      <button onClick={copiar} className={cx(botaoPrincipal, "w-full")}>
        {copiado ? "Código copiado!" : "Copiar código Pix"}
      </button>
      <p role="status" className="text-creme-2">
        {copiado ? "Agora cola no app do seu banco, em Pix copia e cola." : "Pagou? Manda o comprovante no WhatsApp."}
      </p>
    </section>
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

// O selo novo carimba no cartão na primeira vez que o cliente abre a confirmação.
function SeloDoPedido({ token, s, entregue }: { token: string; s: NonNullable<Rastreio["selo"]>; entregue: boolean }) {
  const [animar, setAnimar] = useState(false);
  const novo = s.ganha && s.antes < s.meta;
  useEffect(() => {
    if (!novo) return;
    const k = `cantinho:carimbo:${token}`;
    try {
      if (localStorage.getItem(k)) return;
      localStorage.setItem(k, "1");
    } catch {}
    setAnimar(true);
  }, [novo, token]);
  const selos = s.antes + (novo ? 1 : 0);
  const frase = s.resgate
    ? "Presente resgatado! Seu cartão recomeça agora, visse?"
    : !s.ganha
      ? "Esse pedido não tem feijoada, então não vale selo."
      : !novo
        ? "Seu presente continua guardado esperando o próximo pedido."
        : entregue
          ? selos === s.meta ? "Cartão completo! O presente vem no próximo pedido." : "Selo valendo! Obrigado pela preferência."
          : selos === s.meta
            ? "Mais um selo pra conta! Com ele o cartão fecha: quando o pedido for entregue, seu presente tá liberado."
            : "Mais um selo pra conta! Ele vale quando o pedido for entregue.";
  return (
    <section className="flex flex-col gap-3">
      <CartaoSelos selos={selos} meta={s.meta} carimba={animar ? s.antes : undefined} />
      <p className="text-xl leading-snug">{frase}</p>
      <ComoFunciona meta={s.meta} />
    </section>
  );
}
