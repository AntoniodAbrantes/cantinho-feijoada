"use client";
import { useEffect, useRef } from "react";
import { Botao } from "./ui";

/* Folha que sobe de baixo (modal). Fecha no fundo, no Esc e no botão voltar do teclado. */
export function Folha({ aberta, onFechar, titulo, children }: { aberta: boolean; onFechar: () => void; titulo: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const abertaRef = useRef(aberta);
  abertaRef.current = aberta;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) d.showModal();
    if (!aberta && d.open) d.close();
  }, [aberta]);
  return (
    <dialog
      ref={ref}
      onClose={() => abertaRef.current && onFechar()} // fechar por código (aberta=false) não avisa
      onClick={(e) => e.target === ref.current && onFechar()}
      aria-label={titulo}
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-none bg-transparent p-0 text-creme backdrop:bg-black/60 sm:m-auto sm:max-w-lg"
    >
      <div className="mx-auto max-w-lg animate-subir rounded-t-[24px] bg-brasa px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 sm:rounded-[24px]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-linha" aria-hidden />
        <h2 className="mb-3 font-display text-2xl uppercase">{titulo}</h2>
        {children}
      </div>
    </dialog>
  );
}

export function Confirmar({ aberta, titulo, texto, acao, onSim, onNao }: { aberta: boolean; titulo: string; texto: string; acao: string; onSim: () => void; onNao: () => void }) {
  return (
    <Folha aberta={aberta} onFechar={onNao} titulo={titulo}>
      <p className="mb-5 text-creme-2">{texto}</p>
      <div className="grid grid-cols-2 gap-3">
        <Botao onClick={onNao}>Voltar</Botao>
        <Botao variante="perigo" onClick={onSim}>
          {acao}
        </Botao>
      </div>
    </Folha>
  );
}
