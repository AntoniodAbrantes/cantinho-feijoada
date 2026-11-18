"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { calcPedido } from "@/lib/calc";
import { fb } from "@/lib/firebase";
import { brl, dataBr, diaLocal, horaLocal, nomeDia, somaDias } from "@/lib/format";
import { lembretes } from "@/lib/pedido";
import { useStore } from "@/lib/store";
import type { Pedido } from "@/lib/types";

// Alarme dos pedidos do site: vale em qualquer tela do sistema, não só na de pedidos ao vivo.
export const SONS = { sino: "Sino", sirene: "Sirene (a mais alta)", apito: "Apito" } as const;
export type Som = keyof typeof SONS;
const K_ALARME = "cantinho:alarme-v2"; // v2: o padrão virou o sino, a escolha antiga (sirene) não vale mais

interface Alarme {
  novos: Pedido[]; // esperando aceite, o mais antigo primeiro
  ligado: boolean; // o navegador só deixa tocar depois de um toque na tela
  semConexao: boolean;
  som: Som;
  volume: number; // 0..1
  ativar: () => Promise<void>;
  testar: () => void;
  ajustar: (a: { som?: Som; volume?: number }) => void;
  caixa: () => void; // "cha-ching" ao lançar pedido: chamar dentro do toque, que o navegador deixa tocar
}
const Ctx = createContext<Alarme | null>(null);
export const useAlarme = () => useContext(Ctx)!;

// Criados no primeiro uso (só no navegador) e reaproveitados entre telas.
let audios: { alarme: HTMLAudioElement; queda: HTMLAudioElement } | null = null;
const el = () => (audios ??= { alarme: Object.assign(new Audio(), { loop: true }), queda: Object.assign(new Audio("/sons/conexao.wav"), { loop: true }) });
let somCaixa: HTMLAudioElement | null = null;

const resumoItens = (p: Pedido) => p.itens.map((i) => `${i.qtd}× ${i.nome}`).join(", ");
const ondeEntrega = (p: Pedido) => (p.endereco ? [`${p.endereco.rua}, ${p.endereco.numero}`, p.endereco.complemento, p.endereco.bairro].filter(Boolean).join(" · ") : p.bairro);
const quando = (p: Pedido, hoje = diaLocal()) => (p.dia === hoje ? "hoje" : p.dia === somaDias(hoje, 1) ? "amanhã" : `${nomeDia(p.dia)}, ${dataBr(p.dia)}`);

async function notificar(titulo: string, body: string, tag: string) {
  navigator.vibrate?.([500, 200, 500]);
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const opcoes = { body, tag, icon: "/marca/icone-192.png" };
  try {
    // No Android só o service worker mostra notificação; no computador serve a direta.
    const sw = await navigator.serviceWorker?.getRegistration("/admin");
    if (sw) await sw.showNotification(titulo, { ...opcoes, requireInteraction: true });
    else new Notification(titulo, opcoes);
  } catch {}
}

export function AlarmeProvider({ children }: { children: React.ReactNode }) {
  const [novos, setNovos] = useState<Pedido[]>([]);
  const [conectado, setConectado] = useState<boolean | null>(null); // null = ainda não falou com o servidor
  const [online, setOnline] = useState(true);
  const [ligado, setLigado] = useState(false);
  const [testando, setTestando] = useState(false);
  const [pref, setPref] = useState<{ som: Som; volume: number }>({ som: "sino", volume: 1 });

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(K_ALARME) ?? "null");
      if (salvo && salvo.som in SONS && typeof salvo.volume === "number") setPref(salvo);
    } catch {}
    const rede = () => setOnline(navigator.onLine);
    rede();
    window.addEventListener("online", rede);
    window.addEventListener("offline", rede);
    return () => {
      window.removeEventListener("online", rede);
      window.removeEventListener("offline", rede);
    };
  }, []);

  // Consulta própria com metadados: fromCache diz se o servidor parou de responder.
  useEffect(() => {
    const vistos = new Set<string>();
    let primeira = true;
    return onSnapshot(
      query(collection(fb().db, "pedidos"), where("status", "==", "novo")),
      { includeMetadataChanges: true },
      (s) => {
        setConectado((c) => (s.metadata.fromCache ? (c === null ? null : false) : true));
        const lista = s.docs.map((d) => ({ ...(d.data() as Omit<Pedido, "id">), id: d.id })).sort((a, b) => a.criadoEm - b.criadoEm);
        setNovos(lista);
        for (const p of lista) {
          if (!vistos.has(p.id) && !primeira) notificar(`Pedido novo${p.numero ? ` nº ${p.numero}` : ""}`, `${p.cliente} · ${brl(calcPedido(p).cobrado)}`, p.id);
          vistos.add(p.id);
        }
        primeira = false;
      },
      () => setConectado(false),
    );
  }, []);

  // Encomenda da véspera: dispara uma vez só (fica salvo no pedido); se o sistema estava fechado, dispara ao abrir.
  // Toca o mesmo alarme até marcar "visto", mas só no aparelho que disparou.
  const { pedidos, carregando, lote } = useStore();
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const avisos = useMemo(() => (carregando ? [] : lembretes(pedidos, agora)), [carregando, pedidos, agora]);
  const disparados = useRef(new Set<string>());
  const [soando, setSoando] = useState<string[]>([]);
  useEffect(() => {
    const novas = avisos.filter((p) => !p.lembreteEm && !disparados.current.has(p.id));
    if (!novas.length) return;
    for (const p of novas) {
      disparados.current.add(p.id);
      notificar(`Encomenda pra ${quando(p)}${p.agendadoPara ? ` às ${horaLocal(p.agendadoPara)}` : ""}`, [p.cliente, resumoItens(p), ondeEntrega(p)].filter(Boolean).join(" · "), `lembrete-${p.id}`);
    }
    lote(novas.map((p) => ({ caminho: `pedidos/${p.id}`, dados: { lembreteEm: Date.now() } })));
    setSoando((s) => [...s, ...novas.map((p) => p.id)]);
  }, [avisos, lote]);
  const lembrando = avisos.some((p) => soando.includes(p.id));

  const semConexao = conectado === false || (conectado !== null && !online);
  const tocando = ligado && (novos.length > 0 || testando || lembrando) ? "alarme" : ligado && semConexao ? "queda" : null;

  useEffect(() => {
    const a = el();
    const arquivo = `/sons/${pref.som}.wav`;
    if (!a.alarme.src.endsWith(arquivo)) a.alarme.src = arquivo;
    a.alarme.volume = a.queda.volume = pref.volume; // shortcut: o iPhone ignora volume pelo navegador; lá vale o botão do aparelho
    for (const [nome, x] of Object.entries(a)) {
      if (nome === tocando) x.play().catch(() => setLigado(false));
      else {
        x.pause();
        x.currentTime = 0;
      }
    }
  }, [tocando, pref]);

  // Tela acesa enquanto o alarme estiver ligado (volta ao reabrir a aba).
  useEffect(() => {
    if (!ligado || !("wakeLock" in navigator)) return;
    let trava: WakeLockSentinel | null = null;
    let vivo = true;
    const pedir = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock.request("screen").then(
        (t) => {
          if (vivo) trava = t;
          else t.release();
        },
        () => {},
      );
    };
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", pedir);
      trava?.release();
    };
  }, [ligado]);

  // Título piscando na aba.
  useEffect(() => {
    if (!novos.length) return;
    const original = document.title;
    let i = 0;
    const t = setInterval(() => (document.title = i++ % 2 ? original : `(${novos.length}) Pedido novo!`), 1000);
    return () => {
      clearInterval(t);
      document.title = original;
    };
  }, [novos.length]);

  // Precisa vir de um toque: libera os dois sons tocando mudo e parando.
  const ativar = useCallback(async () => {
    if (ligado) return; // já liberado: tocar mudo aqui calaria um alarme tocando
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    const a = el();
    if (!a.alarme.src) a.alarme.src = `/sons/${pref.som}.wav`;
    try {
      for (const x of [a.alarme, a.queda]) {
        x.muted = true;
        await x.play();
        x.pause();
        x.currentTime = 0;
        x.muted = false;
      }
      setLigado(true);
    } catch {
      setLigado(false);
    }
  }, [ligado, pref.som]);

  // Qualquer toque em qualquer tela do sistema já libera o som, não só o botão da tela ao vivo.
  useEffect(() => {
    if (ligado) return;
    const liberar = () => void ativar();
    document.addEventListener("click", liberar);
    document.addEventListener("keydown", liberar);
    return () => {
      document.removeEventListener("click", liberar);
      document.removeEventListener("keydown", liberar);
    };
  }, [ligado, ativar]);

  const testar = useCallback(() => {
    ativar().then(() => {
      setTestando(true);
      setTimeout(() => setTestando(false), 3000);
    });
  }, [ativar]);

  const ajustar = useCallback((a: { som?: Som; volume?: number }) => {
    setPref((p) => {
      const n = { ...p, ...a };
      try {
        localStorage.setItem(K_ALARME, JSON.stringify(n));
      } catch {}
      return n;
    });
  }, []);

  const caixa = useCallback(() => {
    somCaixa ??= new Audio("/sons/caixa.wav");
    somCaixa.volume = pref.volume;
    somCaixa.currentTime = 0;
    somCaixa.play().catch(() => {}); // bloqueado ou sem arquivo: o pedido salva igual
  }, [pref.volume]);

  return (
    <Ctx.Provider value={{ novos, ligado, semConexao, som: pref.som, volume: pref.volume, ativar, testar, ajustar, caixa }}>
      <FaixaNovos />
      <EncomendasAmanha avisos={avisos} onVisto={(p) => lote([{ caminho: `pedidos/${p.id}`, dados: { lembreteVistoEm: Date.now() } }])} />
      {children}
      {novos.length > 0 && <div aria-hidden className="pointer-events-none fixed inset-0 z-[45] animate-piscar bg-milho" />}
    </Ctx.Provider>
  );
}

// Fora da tela ao vivo, uma faixa leva até os pedidos esperando.
function FaixaNovos() {
  const { novos, ligado } = useAlarme();
  const rota = usePathname();
  if (!novos.length || rota === "/admin/ao-vivo") return null;
  return (
    <Link href="/admin/ao-vivo" role="alert" className="sticky top-0 z-40 block bg-milho px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] text-lg font-semibold text-carvao">
      {novos.length === 1 ? "1 pedido novo do site." : `${novos.length} pedidos novos do site.`} {ligado ? "Toca pra aceitar." : "Som desligado: toca aqui pra ver e ativar."}
    </Link>
  );
}

// Fica em todas as telas até marcar "visto" (salvo no pedido, vale pra todos os aparelhos).
function EncomendasAmanha({ avisos, onVisto }: { avisos: Pedido[]; onVisto: (p: Pedido) => void }) {
  if (!avisos.length) return null;
  const amanha = avisos.every((p) => p.dia !== diaLocal());
  return (
    <section role="alert" aria-label="Encomendas" className="border-b-2 border-milho bg-brasa px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
      <p className="font-display text-xl uppercase text-milho">{amanha ? "Encomendas de amanhã" : "Encomendas"}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {avisos.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-carvao p-3">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold text-milho">
                {quando(p)} · {p.agendadoPara ? `por volta das ${horaLocal(p.agendadoPara)}` : "sem horário"}
              </span>
              <span className="font-semibold">{p.cliente || "Cliente sem nome"}</span>
              <span className="text-creme-2">{resumoItens(p)}</span>
              {ondeEntrega(p) && <span className="text-sm text-creme-3">{ondeEntrega(p)}</span>}
              {p.obs && <span className="text-sm text-creme-3">{p.obs}</span>}
            </span>
            <button onClick={() => onVisto(p)} className="min-h-12 shrink-0 rounded-[var(--radius-ctl)] bg-milho px-4 font-semibold text-carvao active:scale-[0.96]">
              Visto
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
