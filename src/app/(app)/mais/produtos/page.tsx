"use client";
import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { fb } from "@/lib/firebase";
import { brl, dataBr, diaLocal, kgNum } from "@/lib/format";
import { opsProduto } from "@/lib/produto";
import { novoId, useStore } from "@/lib/store";
import type { Categoria, Produto } from "@/lib/types";
import { Botao, Chips, Esqueleto, Estimativa, Rotulo, cx } from "@/components/ui";
import { Interruptor, Texto, Valor } from "@/components/campos";
import { Folha } from "@/components/folha";
import { Titulo } from "@/components/voltar";

const CATEGORIAS: { v: Categoria; t: string }[] = [
  { v: "feijoada", t: "Feijoada" },
  { v: "adicional", t: "Adicional" },
  { v: "bebida", t: "Bebida" },
];

export default function Produtos() {
  const { produtos, carregando, lote, avisar } = useStore();
  const [aberto, setAberto] = useState<Produto | null>(null);
  if (carregando) return <Esqueleto className="h-64" />;

  const novo = (): Produto => ({
    id: "", nome: "", curto: "", categoria: "adicional", ordem: Math.max(0, ...produtos.map((p) => p.ordem)) + 1,
    precoWhatsapp: 0, precoIfood: 0, ativoWhatsapp: true, ativoIfood: true, custo: 0, pesoFeijoadaG: 0, embalagem: 0, estimativas: [],
  });

  const salvar = (p: Produto) => {
    const antes = produtos.find((x) => x.id === p.id);
    const depois = { ...p, id: p.id || novoId("produtos"), curto: p.curto.trim() || p.nome.trim() };
    if (depois.categoria === "bebida" && depois.estoque === undefined) depois.estoque = 0;
    lote(opsProduto(antes, depois));
    setAberto(null);
    avisar(antes ? `${depois.nome} atualizado.` : `${depois.nome} no cardápio.`);
  };

  return (
    <div className="flex flex-col gap-5">
      <Titulo acao={<Botao variante="fantasma" onClick={() => setAberto(novo())} className="text-base">Novo</Botao>}>Produtos</Titulo>
      {CATEGORIAS.map((c) => (
        <section key={c.v} className="flex flex-col gap-2">
          <Rotulo>{c.t}</Rotulo>
          <ul className="divide-y divide-linha overflow-hidden rounded-[var(--radius-card)] bg-brasa">
            {produtos.filter((p) => p.categoria === c.v).map((p) => (
              <li key={p.id}>
                <button onClick={() => setAberto(p)} className={cx("flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-tisna", !p.ativoWhatsapp && !p.ativoIfood && "opacity-50")}>
                  <span className="flex-1">
                    <span className="block">{p.nome}</span>
                    <span className="block text-sm text-creme-3">
                      {[!p.ativoWhatsapp && "fora do WhatsApp", !p.ativoIfood && "fora do iFood", p.estimativas.length > 0 && "tem valor a confirmar"].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="num text-right">
                    <span className={cx("block", p.ativoWhatsapp ? "text-zap" : "text-creme-3 line-through")}>{brl(p.precoWhatsapp)}</span>
                    <span className={cx("block", p.ativoIfood ? "text-ifood" : "text-creme-3 line-through")}>{brl(p.precoIfood)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {aberto && <Editor inicial={aberto} onSalvar={salvar} onFechar={() => setAberto(null)} />}
    </div>
  );
}

type Hist = { id: string; em: number; antes: { whatsapp: number; ifood: number }; depois: { whatsapp: number; ifood: number } };

function Editor({ inicial, onSalvar, onFechar }: { inicial: Produto; onSalvar: (p: Produto) => void; onFechar: () => void }) {
  const [p, setP] = useState(inicial);
  const [hist, setHist] = useState<Hist[]>([]);
  useEffect(() => {
    if (!inicial.id) return;
    return onSnapshot(query(collection(fb().db, "produtos", inicial.id, "historicoPreco"), orderBy("em", "desc"), limit(10)), (s) =>
      setHist(s.docs.map((d) => ({ ...(d.data() as Omit<Hist, "id">), id: d.id }))),
    );
  }, [inicial.id]);

  const est = (campo: string) => p.estimativas.includes(campo);
  const marcar = (campo: string, sim: boolean) => setP({ ...p, estimativas: sim ? [...new Set([...p.estimativas, campo])] : p.estimativas.filter((x) => x !== campo) });

  return (
    <Folha aberta onFechar={onFechar} titulo={inicial.nome || "Novo produto"}>
      <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto pb-1">
        {!inicial.id && <Chips rotulo="Categoria" valor={p.categoria} onChange={(categoria) => setP({ ...p, categoria })} opcoes={CATEGORIAS} />}
        <Texto rotulo="Nome" valor={p.nome} onChange={(nome) => setP({ ...p, nome })} />
        <Texto rotulo="Nome curto (botão do pedido)" valor={p.curto} onChange={(curto) => setP({ ...p, curto })} />
        <div className="grid grid-cols-2 gap-3">
          <Valor rotulo="Preço WhatsApp" valor={p.precoWhatsapp} onChange={(precoWhatsapp) => setP({ ...p, precoWhatsapp })} />
          <Valor rotulo="Preço iFood" valor={p.precoIfood} onChange={(precoIfood) => setP({ ...p, precoIfood })} />
        </div>
        <Interruptor rotulo="Vende no WhatsApp" ligado={p.ativoWhatsapp} onChange={(ativoWhatsapp) => setP({ ...p, ativoWhatsapp })} />
        <Interruptor rotulo="Vende no iFood" ligado={p.ativoIfood} onChange={(ativoIfood) => setP({ ...p, ativoIfood })} />

        {p.categoria === "feijoada" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Valor rotulo="Peso da feijoada" valor={p.pesoFeijoadaG} onChange={(pesoFeijoadaG) => setP({ ...p, pesoFeijoadaG })} prefixo="" sufixo="kg" casas={3} />
              <Valor rotulo="Embalagem do kit" valor={p.embalagem} onChange={(embalagem) => setP({ ...p, embalagem })} />
            </div>
            <Interruptor rotulo="Embalagem é estimativa" ligado={est("embalagem")} onChange={(v) => marcar("embalagem", v)} destaque />
          </>
        ) : (
          <>
            <Valor rotulo={p.categoria === "bebida" ? "Custo por unidade" : "Custo"} valor={p.custo} onChange={(custo) => setP({ ...p, custo })} />
            <Interruptor rotulo="Custo é estimativa" ligado={est("custo")} onChange={(v) => marcar("custo", v)} destaque />
          </>
        )}

        {hist.length > 0 && (
          <div className="flex flex-col gap-1">
            <Rotulo>Histórico de preço</Rotulo>
            {hist.map((h) => (
              <p key={h.id} className="text-sm text-creme-2">
                {dataBr(diaLocal(h.em))}: <span className="text-zap">{brl(h.antes.whatsapp)} → {brl(h.depois.whatsapp)}</span> · <span className="text-ifood">{brl(h.antes.ifood)} → {brl(h.depois.ifood)}</span>
              </p>
            ))}
          </div>
        )}
        {p.categoria === "feijoada" && p.pesoFeijoadaG > 0 && <p className="text-sm text-creme-3">Leva {kgNum(p.pesoFeijoadaG)} kg da produção por unidade.</p>}
        {p.estimativas.length > 0 && <Estimativa />}
      </div>
      <Botao variante="principal" onClick={() => onSalvar(p)} disabled={!p.nome.trim()} className="mt-4 w-full">
        Salvar
      </Botao>
    </Folha>
  );
}
