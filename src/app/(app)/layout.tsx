import { BarraInferior, Conteudo } from "@/components/shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Conteudo>{children}</Conteudo>
      <BarraInferior />
    </>
  );
}
