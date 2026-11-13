"use client";
import Link from "next/link";
import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword } from "firebase/auth";
import { fb } from "@/lib/firebase";
import { useStore } from "@/lib/store";
import { Botao } from "@/components/ui";
import { Campo } from "@/components/campos";
import { Folha } from "@/components/folha";
import { IconSeta } from "@/components/icons";

const SECOES = [
  { href: "/mais/custo", t: "Custo e preço", d: "Quanto custa cada porção e o lucro por canal" },
  { href: "/mais/producoes", t: "Produções", d: "Nota do mercado e custo por kg" },
  { href: "/mais/projecao", t: "Projeção do mês", d: "Cenários, limite do MEI e realizado" },
  { href: "/mais/produtos", t: "Produtos e cardápio", d: "Preços por canal, ativos e histórico" },
  { href: "/mais/premissas", t: "Premissas", d: "Taxas, custos e valores a confirmar" },
];

export default function Mais() {
  const { premissas, carregando } = useStore();
  const [senha, setSenha] = useState(false);
  const aConfirmar = carregando ? 0 : Object.values(premissas).filter((x) => x.estimativa).length;
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-3xl uppercase">Mais</h1>
      <ul className="divide-y divide-linha overflow-hidden rounded-[var(--radius-card)] bg-brasa">
        {SECOES.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-tisna">
              <span className="flex-1">
                <span className="block text-lg font-semibold">{s.t}</span>
                <span className="block text-sm text-creme-3">
                  {s.d}
                  {s.href === "/mais/premissas" && aConfirmar > 0 && <span className="text-milho"> · {aConfirmar} a confirmar</span>}
                </span>
              </span>
              <IconSeta className="size-5 text-creme-3" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Botao onClick={() => setSenha(true)}>Trocar senha</Botao>
        <Botao variante="fantasma" onClick={() => signOut(fb().auth)}>
          Sair da conta
        </Botao>
      </div>
      {senha && <TrocarSenha onFechar={() => setSenha(false)} />}
    </div>
  );
}

const ERROS: Record<string, string> = {
  "auth/invalid-credential": "A senha atual não bate.",
  "auth/wrong-password": "A senha atual não bate.",
  "auth/weak-password": "Senha nova fraca demais. Usa pelo menos 8 caracteres.",
  "auth/network-request-failed": "Precisa de internet pra trocar a senha.",
  "auth/too-many-requests": "Muita tentativa seguida. Espera uns minutinhos.",
};
const campo = "min-h-12 w-full rounded-[var(--radius-ctl)] border border-linha bg-carvao px-3 text-lg text-creme focus:border-milho focus:outline-none";

function TrocarSenha({ onFechar }: { onFechar: () => void }) {
  const { avisar } = useStore();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repete, setRepete] = useState("");
  const [erro, setErro] = useState("");
  const [indo, setIndo] = useState(false);

  const trocar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nova.length < 8) return setErro("A senha nova precisa de pelo menos 8 caracteres.");
    if (nova !== repete) return setErro("As duas senhas novas não estão iguais.");
    const u = fb().auth.currentUser!;
    setIndo(true);
    setErro("");
    try {
      // O Firebase exige login recente para trocar senha.
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email!, atual));
      await updatePassword(u, nova);
      onFechar();
      avisar("Senha trocada. Guarda bem a nova.");
    } catch (x) {
      setErro(ERROS[(x as { code?: string }).code ?? ""] ?? "Não deu pra trocar agora. Tenta de novo.");
      setIndo(false);
    }
  };

  return (
    <Folha aberta onFechar={onFechar} titulo="Trocar senha">
      <form onSubmit={trocar} className="flex flex-col gap-4">
        <Campo rotulo="Senha atual">{(id) => <input id={id} type="password" autoComplete="current-password" required value={atual} onChange={(e) => setAtual(e.target.value)} className={campo} />}</Campo>
        <Campo rotulo="Senha nova">{(id) => <input id={id} type="password" autoComplete="new-password" required value={nova} onChange={(e) => setNova(e.target.value)} className={campo} />}</Campo>
        <Campo rotulo="Repete a senha nova">{(id) => <input id={id} type="password" autoComplete="new-password" required value={repete} onChange={(e) => setRepete(e.target.value)} className={campo} />}</Campo>
        {erro && <p role="alert" className="font-semibold text-prejuizo">{erro}</p>}
        <Botao variante="principal" type="submit" disabled={indo}>
          {indo ? "Trocando…" : "Trocar senha"}
        </Botao>
      </form>
    </Folha>
  );
}
