import Link from "next/link";
import { IconSeta } from "./icons";

export function Titulo({ voltar = "/mais", children, acao }: { voltar?: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-2">
      <Link href={voltar} aria-label="Voltar" className="-ml-3 grid size-12 place-items-center rounded-full text-creme-2 active:bg-tisna">
        <IconSeta className="size-6 rotate-180" />
      </Link>
      <h1 className="flex-1 font-display text-3xl uppercase leading-none">{children}</h1>
      {acao}
    </header>
  );
}
