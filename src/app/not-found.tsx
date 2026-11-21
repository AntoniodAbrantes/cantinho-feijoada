import Link from "next/link";

export default function NaoEncontrada() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-6 px-4">
      <h1 className="font-display text-[52px] uppercase leading-[0.9]">Página não encontrada</h1>
      <p className="text-xl text-creme-2">Esse endereço não existe mais, ou nunca existiu.</p>
      <Link href="/" className="text-xl font-semibold text-milho underline underline-offset-4">
        Ver o cardápio do Cantinho
      </Link>
    </main>
  );
}
