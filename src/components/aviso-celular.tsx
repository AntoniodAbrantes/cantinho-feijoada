"use client";
// Liga o aviso de pedido novo neste aparelho, que chega mesmo com o app fechado (Web Push).
import { useEffect, useState } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { fb } from "@/lib/firebase";
import { Botao } from "./ui";

const CHAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC;
type Estado = "carregando" | "sem-suporte" | "bloqueado" | "desligado" | "ligado";

// O id do aparelho é um hash do endpoint: o mesmo celular não vira dois.
async function idDo(endpoint: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(h).slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const registro = () => navigator.serviceWorker.getRegistration("/admin");

export function AvisoCelular() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const ios = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);

  useEffect(() => {
    if (!CHAVE || !("serviceWorker" in navigator) || !("PushManager" in window)) return setEstado("sem-suporte");
    if (Notification.permission === "denied") return setEstado("bloqueado");
    registro().then((r) => r?.pushManager.getSubscription()).then((s) => setEstado(s ? "ligado" : "desligado"), () => setEstado("desligado"));
  }, []);

  const ligar = async () => {
    setOcupado(true);
    setErro("");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setEstado("bloqueado");
      const r = (await registro()) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/admin" }));
      await navigator.serviceWorker.ready;
      const s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: CHAVE });
      await setDoc(doc(fb().db, "push", await idDo(s.endpoint)), { assinatura: JSON.stringify(s), aparelho: navigator.userAgent.slice(0, 200), criadoEm: Date.now() });
      setEstado("ligado");
    } catch {
      setErro("Não consegui ligar o aviso. Confere a internet e tenta de novo.");
    } finally {
      setOcupado(false);
    }
  };

  const desligar = async () => {
    setOcupado(true);
    try {
      const s = await (await registro())?.pushManager.getSubscription();
      if (s) {
        await deleteDoc(doc(fb().db, "push", await idDo(s.endpoint)));
        await s.unsubscribe();
      }
      setEstado("desligado");
    } finally {
      setOcupado(false);
    }
  };

  if (estado === "carregando") return null;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-xl uppercase">Aviso no celular</h2>
      {estado === "sem-suporte" && (
        <p className="text-creme-2">{ios ? "No iPhone, o aviso só funciona com o app instalado: Compartilhar, “Adicionar à Tela de Início”, e abre por lá." : "Este navegador não recebe aviso com o app fechado."}</p>
      )}
      {estado === "bloqueado" && <p className="text-creme-2">As notificações estão bloqueadas. Libera nas configurações do celular, em notificações do app, e volta aqui.</p>}
      {estado === "desligado" && (
        <>
          <p className="text-creme-2">Pedido do site aparece na tela do celular, mesmo com o app fechado.</p>
          <Botao variante="principal" onClick={ligar} disabled={ocupado}>
            {ocupado ? "Ligando…" : "Ligar aviso neste celular"}
          </Botao>
        </>
      )}
      {estado === "ligado" && (
        <>
          <p className="flex items-center gap-2 font-semibold text-lucro">
            <span className="size-2.5 rounded-full bg-lucro" aria-hidden /> Aviso ligado neste celular.
          </p>
          <Botao variante="fantasma" onClick={desligar} disabled={ocupado}>
            Desligar aviso
          </Botao>
        </>
      )}
      {erro && <p role="alert" className="font-semibold text-prejuizo">{erro}</p>}
    </div>
  );
}
