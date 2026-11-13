"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { StoreProvider, useStore, useUsuario } from "@/lib/store";
import { Selo, cx } from "./ui";
import { IconCaixa, IconHoje, IconMais, IconMenu, IconOffline, IconPedidos } from "./icons";

export function Providers({ children }: { children: React.ReactNode }) {
  const usuario = useUsuario();
  const rota = usePathname();
  const router = useRouter();
  const publica = rota === "/entrar";
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
  }, []);
  useEffect(() => {
    if (usuario === null && !publica) router.replace("/entrar");
    if (usuario && publica) router.replace("/");
  }, [usuario, publica, router]);

  if (publica) return children;
  if (!usuario) return <Abertura />;
  return (
    <StoreProvider usuario={usuario}>
      <SemInternet />
      <ErroDados />
      {children}
      <AvisoFlutuante />
    </StoreProvider>
  );
}

function Abertura() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy aria-label="Abrindo">
      <div className="animate-brilho">
        <Selo tamanho={96} />
      </div>
    </div>
  );
}

function ErroDados() {
  const { erro } = useStore();
  if (!erro) return null;
  return (
    <div role="alert" className="sticky top-0 z-40 bg-prejuizo px-4 py-2 text-sm font-semibold text-carvao">
      Não consegui ler os dados ({erro}). Confere a internet; se continuar, sai e entra de novo.
    </div>
  );
}

const assinarRede = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

function SemInternet() {
  const online = useSyncExternalStore(assinarRede, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-40 flex items-center gap-2 bg-tisna px-4 py-2 text-sm text-creme-2">
      <IconOffline className="size-4 shrink-0 text-milho" />
      Sem internet. Pode lançar que eu guardo e mando quando voltar.
    </div>
  );
}

function AvisoFlutuante() {
  const { aviso, avisar } = useStore();
  if (!aviso) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <div key={aviso.id} role={aviso.erro ? "alert" : "status"} className={cx("pointer-events-auto flex min-h-14 w-full max-w-md animate-subir items-center gap-3 rounded-[var(--radius-ctl)] py-1 pl-4 pr-1 text-carvao shadow-lg shadow-black/40", aviso.erro ? "bg-prejuizo" : "bg-creme")}>
        <span className="flex-1 font-semibold">{aviso.texto}</span>
        {aviso.desfazer && (
          <button
            onClick={() => {
              aviso.desfazer!();
              avisar("Pronto, desfeito.");
            }}
            className="min-h-12 rounded-xl px-4 font-bold uppercase tracking-wide active:bg-carvao/10"
          >
            Desfazer
          </button>
        )}
      </div>
    </div>
  );
}

const ABAS = [
  { href: "/", nome: "Hoje", Icone: IconHoje },
  { href: "/pedidos", nome: "Pedidos", Icone: IconPedidos },
  null,
  { href: "/caixa", nome: "Caixa", Icone: IconCaixa },
  { href: "/mais", nome: "Mais", Icone: IconMenu },
];

export function BarraInferior() {
  const rota = usePathname();
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-carvao/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid h-[72px] max-w-lg grid-cols-5 items-center">
        {ABAS.map((a) =>
          a ? (
            <li key={a.href}>
              <Link
                href={a.href}
                aria-current={rota === a.href ? "page" : undefined}
                className={cx(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm font-semibold uppercase tracking-wider transition-colors duration-150",
                  rota === a.href ? "text-creme" : "text-creme-3",
                )}
              >
                <a.Icone className="size-6" />
                {a.nome}
              </Link>
            </li>
          ) : (
            <li key="novo" className="flex justify-center">
              <Link
                href="/novo"
                aria-label="Novo pedido"
                className="-mt-7 grid size-[68px] place-items-center rounded-full bg-milho text-carvao ring-[6px] ring-carvao transition-transform duration-150 active:scale-95"
              >
                <IconMais className="size-8 stroke-[2.5]" />
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

// Painel e Pedidos aproveitam a tela do computador; o resto fica na coluna do celular.
const LARGAS = ["/", "/pedidos"];
export function Conteudo({ children }: { children: React.ReactNode }) {
  const larga = LARGAS.includes(usePathname());
  return <main className={cx("mx-auto px-4 pb-32 pt-[max(16px,env(safe-area-inset-top))]", larga ? "max-w-lg lg:max-w-5xl lg:px-8" : "max-w-lg")}>{children}</main>;
}
