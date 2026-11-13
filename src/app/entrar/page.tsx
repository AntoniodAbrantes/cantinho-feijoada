"use client";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { fb } from "@/lib/firebase";
import { Botao, Selo } from "@/components/ui";
import { Campo } from "@/components/campos";

const NAO_BATE = "E-mail ou senha não batem. Confere e tenta de novo.";
const ERROS: Record<string, string> = {
  "auth/invalid-credential": NAO_BATE,
  "auth/wrong-password": NAO_BATE,
  "auth/user-not-found": NAO_BATE,
  "auth/invalid-email": "Esse e-mail tá estranho. Confere a digitação.",
  "auth/network-request-failed": "Sem internet. Conecta e tenta de novo.",
  "auth/too-many-requests": "Muita tentativa seguida. Espera uns minutinhos.",
};

const campo = "min-h-12 w-full rounded-[var(--radius-ctl)] border border-linha bg-carvao px-3 text-lg text-creme focus:border-milho focus:outline-none";

export default function Entrar() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [indo, setIndo] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIndo(true);
    setErro("");
    try {
      await signInWithEmailAndPassword(fb().auth, email.trim(), senha);
    } catch (x) {
      setErro(ERROS[(x as { code?: string }).code ?? ""] ?? "Não deu pra entrar agora. Tenta de novo.");
      setIndo(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <Selo tamanho={168} completo />
        <p className="text-creme-2">Bora pro fim de semana?</p>
      </div>
      <form onSubmit={entrar} className="flex flex-col gap-4">
        <Campo rotulo="E-mail">{(id) => <input id={id} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />}</Campo>
        <Campo rotulo="Senha">{(id) => <input id={id} type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} />}</Campo>
        {erro && (
          <p role="alert" className="font-semibold text-prejuizo">
            {erro}
          </p>
        )}
        <Botao variante="principal" type="submit" disabled={indo} className="min-h-14 font-display text-xl">
          {indo ? "Entrando…" : "Entrar"}
        </Botao>
      </form>
    </main>
  );
}
