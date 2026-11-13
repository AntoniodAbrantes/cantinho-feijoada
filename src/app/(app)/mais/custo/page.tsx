"use client";
import Link from "next/link";
import { useState } from "react";
import { custoPorcao, lucroCanal, precoMinimo } from "@/lib/calc";
import { bpFmt, brl, dataBr, diaLocal, kg, pctFmt } from "@/lib/format";
import { producaoDoDia } from "@/lib/pedido";
import { opsProduto } from "@/lib/produto";
import { useStore } from "@/lib/store";
import type { Canal, Premissas, Produto } from "@/lib/types";
import { Botao, CANAL, Dinheiro, Esqueleto, Estimativa, EtiquetaCanal, Painel, Rotulo, Vazio, cx } from "@/components/ui";
import { Valor } from "@/components/campos";
import { Titulo } from "@/components/voltar";

export default function CustoPreco() {
  const { produtos, producoes, premissas, carregando } = useStore();
  if (carregando) return <Esqueleto className="h-96" />;
  const prod = producaoDoDia(producoes, diaLocal(), premissas);
  if (!prod) return <Vazio titulo="Falta a produção" texto="Lança a nota da produção pra calcular o custo do kg." acao={<Link href="/mais/producoes"><Botao variante="principal">Lançar produção</Botao></Link>} />;

  const tamanhos = produtos.filter((p) => p.categoria === "feijoada" && (p.ativoWhatsapp || p.ativoIfood));
  return (
    <div className="flex flex-col gap-6">
      <Titulo>Custo e preço</Titulo>
      <section>
        <Rotulo>Custo do kg de feijoada</Rotulo>
        <Dinheiro valor={Math.round(prod.custoKg)} className="font-display text-[56px] leading-none text-milho" />
        <p className="mt-1 text-creme-2">
          Produção de {dataBr(prod.producao.data)}: {brl(prod.custo)} ÷ {kg(prod.producao.rendimentoG)} {prod.producao.rendimentoEstimativa && <Estimativa texto="rendimento" />}
        </p>
        <p className="mt-1 text-sm text-creme-3">
          Margem desejada {bpFmt(premissas.margemDesejadaBp.valor)} · iFood {bpFmt(premissas.ifoodComissaoBp.valor)} + {bpFmt(premissas.ifoodOnlineBp.valor)} · mão de obra {brl(premissas.maoDeObraKg.valor)}/kg
          {premissas.maoDeObraKg.estimativa && " (estimativa)"}
        </p>
      </section>
      {tamanhos.map((p) => (
        <Tamanho key={p.id} p={p} custoKg={prod.custoKg} premissas={premissas} />
      ))}
    </div>
  );
}

function Tamanho({ p, custoKg, premissas }: { p: Produto; custoKg: number; premissas: Premissas }) {
  const { lote, avisar } = useStore();
  const [sim, setSim] = useState({ whatsapp: p.precoWhatsapp, ifood: p.precoIfood });
  const c = custoPorcao(p, custoKg, premissas.maoDeObraKg.valor);
  const mudou = sim.whatsapp !== p.precoWhatsapp || sim.ifood !== p.precoIfood;
  const canais = (["whatsapp", "ifood"] as Canal[]).filter((k) => (k === "ifood" ? p.ativoIfood : p.ativoWhatsapp));

  const salvar = () => {
    lote(opsProduto(p, { ...p, precoWhatsapp: sim.whatsapp, precoIfood: sim.ifood }));
    avisar(`Preço de ${p.nome} salvo. Vale pros próximos pedidos.`, () => lote(opsProduto({ ...p, precoWhatsapp: sim.whatsapp, precoIfood: sim.ifood }, p)));
  };

  return (
    <Painel className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl uppercase">{p.curto}</h2>
        <p className="text-creme-2">
          Custa <span className="font-semibold text-creme">{brl(c.total)}</span>: {brl(c.comida)} de comida ({kg(p.pesoFeijoadaG)}) + {brl(c.embalagem)} de embalagem + {brl(c.maoDeObra)} de mão de obra
        </p>
        {p.estimativas.includes("embalagem") && (
          <span className="mt-1 inline-block">
            <Estimativa texto="embalagem" />
          </span>
        )}
      </div>
      <div className={cx("grid gap-4", canais.length === 2 && "grid-cols-2 divide-x divide-linha")}>
        {canais.map((k, i) => {
          const preco = sim[k];
          const r = lucroCanal(preco, c.total, k, premissas);
          const min = precoMinimo(c.total, k, premissas);
          return (
            <div key={k} className={cx("flex flex-col gap-2", canais.length === 2 && (i ? "pl-4" : "pr-4"))}>
              <EtiquetaCanal canal={k} />
              <Valor rotulo={`Preço ${CANAL[k].nome}`} valor={preco} onChange={(v) => setSim({ ...sim, [k]: v })} className="[&>label]:sr-only" />
              {k === "ifood" && <Item rotulo="Taxas">{brl(r.taxas)}</Item>}
              <Item rotulo="Lucro">
                <Dinheiro valor={r.lucro} sinal className="font-display text-2xl" />
              </Item>
              <Item rotulo="Margem">{pctFmt(r.margem, 1)}</Item>
              <Item rotulo="Fica com a família">{brl(r.lucro + c.maoDeObra)}</Item>
              <Item rotulo="Preço mínimo">
                <span className={preco < min ? "text-prejuizo" : ""}>{brl(min)}</span>
              </Item>
            </div>
          );
        })}
      </div>
      {mudou && (
        <div className="flex gap-3">
          <Botao variante="fantasma" onClick={() => setSim({ whatsapp: p.precoWhatsapp, ifood: p.precoIfood })}>
            Voltar
          </Botao>
          <Botao variante="principal" onClick={salvar} className="flex-1">
            Salvar preço
          </Botao>
        </div>
      )}
    </Painel>
  );
}

const Item = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
  <div>
    <span className="block text-sm text-creme-3">{rotulo}</span>
    <span className="num font-semibold">{children}</span>
  </div>
);
