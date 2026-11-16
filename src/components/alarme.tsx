"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { calcPedido } from "@/lib/calc";
import { fb } from "@/lib/firebase";
import { brl } from "@/lib/format";
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
}
const Ctx = createContext<Alarme | null>(null);
export const useAlarme = () => useContext(Ctx)!;

// Criados no primeiro uso (só no navegador) e reaproveitados entre telas.
let audios: { alarme: HTMLAudioElement; queda: HTMLAudioElement } | null = null;
const el = () => (audios ??= { alarme: Object.assign(new Audio(), { loop: true }), queda: Object.assign(new Audio("/sons/conexao.wav"), { loop: true }) });

async function notificar(p: Pedido) {
  navigator.vibrate?.([500, 200, 500]);
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const titulo = `Pedido novo${p.numero ? ` nº ${p.numero}` : ""}`;
  const opcoes = { body: `${p.cliente} · ${brl(calcPedido(p).cobrado)}`, tag: p.id, icon: "/marca/icone-192.png" };
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
          if (!vistos.has(p.id) && !primeira) notificar(p);
          vistos.add(p.id);
        }
        primeira = false;
      },
      () => setConectado(false),
    );
  }, []);

  const semConexao = conectado === false || (conectado !== null && !online);
  const tocando = ligado && (novos.length > 0 || testando) ? "alarme" : ligado && semConexao ? "queda" : null;

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

  return (
    <Ctx.Provider value={{ novos, ligado, semConexao, som: pref.som, volume: pref.volume, ativar, testar, ajustar }}>
      <FaixaNovos />
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
