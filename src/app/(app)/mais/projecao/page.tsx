"use client";
import { useState } from "react";
import { mensalidadeIfood, projecao } from "@/lib/calc";
import { brl, diaLocal, kg, pctFmt } from "@/lib/format";
import { resumo, porCanal } from "@/lib/painel";
import { producaoDoDia } from "@/lib/pedido";
import { useStore } from "@/lib/store";
import type { Cenario } from "@/lib/types";
import { Dinheiro, Esqueleto, Estimativa, Linha, Painel, Rotulo, cx } from "@/components/ui";
import { IconMais, IconMenos } from "@/components/icons";
import { Titulo } from "@/components/voltar";

export default function Projecao() {
  const { cenarios, produtos, producoes, premissas, carregando, lote } = useStore();
  const [sel, setSel] = useState("meta");
  if (carregando) return <Esqueleto className="h-96" />;

  const mes = diaLocal().slice(0, 7);
  const custoKg = producaoDoDia(producoes, mes + "-31", premissas)?.custoKg ?? 0;
  const feijoadas = produtos.filter((p) => p.categoria === "feijoada" && p.ativoIfood);
  const proj = Object.fromEntries(cenarios.map((c) => [c.id, projecao(c.porDia, produtos, custoKg, premissas)]));
  const cen = cenarios.find((c) => c.id === sel);
  const x = cen ? proj[cen.id] : null;
  const estimado = premissas.parteIfoodBp.estimativa || premissas.rendimentoG.estimativa || premissas.ifoodComissaoBp.estimativa;

  const mudar = (c: Cenario, id: string, d: number) => lote([{ caminho: `cenarios/${c.id}`, dados: { porDia: { ...c.porDia, [id]: Math.max(0, (c.porDia[id] ?? 0) + d) } } }]);

  return (
    <div className="flex flex-col gap-6">
      <Titulo>Projeção do mês</Titulo>
      {/* Escolhe o cenário e já compara o lucro de cada um */}
      <div role="radiogroup" aria-label="Cenário" className="grid grid-cols-4 gap-2 text-center">
        {cenarios.map((c) => (
          <button key={c.id} role="radio" aria-checked={sel === c.id} onClick={() => setSel(c.id)} className={cx("min-h-14 rounded-[var(--radius-ctl)] border px-1 py-2 transition-colors duration-150", sel === c.id ? "border-creme bg-tisna" : "border-linha")}>
            <span className="block text-xs uppercase tracking-wider text-creme-3">{c.nome}</span>
            <span className={cx("num block text-sm font-semibold", proj[c.id].lucro < 0 ? "text-prejuizo" : "text-creme")}>{brl(proj[c.id].lucro)}</span>
          </button>
        ))}
        <button role="radio" aria-checked={sel === "real"} onClick={() => setSel("real")} className={cx("min-h-14 rounded-[var(--radius-ctl)] border px-1 py-2 transition-colors duration-150", sel === "real" ? "border-creme bg-tisna" : "border-linha")}>
          <span className="block text-xs uppercase tracking-wider text-creme-3">Realizado</span>
          <span className="block text-sm font-semibold text-creme-2">no mês</span>
        </button>
      </div>

      {cen && x ? (
        <>
          <section>
            <Rotulo>Lucro líquido no mês</Rotulo>
            <Dinheiro valor={x.lucro} className={cx("font-display text-[56px] leading-none", x.lucro < 0 ? "text-prejuizo" : "text-milho")} />
            <p className="mt-1 text-creme-2">
              margem {pctFmt(x.margem)} · fica com a família {brl(x.familia)}
            </p>
            {estimado && (
              <span className="mt-2 inline-block">
                <Estimativa texto="usa valores a confirmar" />
              </span>
            )}
          </section>

          <Painel>
            <Rotulo className="mb-2">Porções por dia</Rotulo>
            {feijoadas.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-1">
                <span>{p.curto}</span>
                <span className="flex items-center gap-1">
                  <button onClick={() => mudar(cen, p.id, -1)} aria-label={`Menos ${p.curto}`} className="grid size-12 place-items-center rounded-full text-creme-2 active:bg-tisna">
                    <IconMenos className="size-5" />
                  </button>
                  <span key={cen.porDia[p.id]} className="num w-8 animate-tick text-center font-display text-2xl">{cen.porDia[p.id] ?? 0}</span>
                  <button onClick={() => mudar(cen, p.id, 1)} aria-label={`Mais ${p.curto}`} className="grid size-12 place-items-center rounded-full text-creme-2 active:bg-tisna">
                    <IconMais className="size-5" />
                  </button>
                </span>
              </div>
            ))}
            <p className="mt-2 text-sm text-creme-3">
              {kg(x.gDia)} por dia · {x.producoes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} produções no mês · {x.pedidos} pedidos ({x.porcoesDia}/dia)
            </p>
          </Painel>

          <Alertas x={x} limite={premissas.limiteMei.valor} />

          <Painel>
            <Rotulo className="mb-1">Entra</Rotulo>
            <Linha rotulo="Vendas no WhatsApp"><span className="text-zap">{brl(x.fatWhatsapp)}</span></Linha>
            <Linha rotulo="Vendas no iFood" nota={`${pctFmt(premissas.parteIfoodBp.valor / 10000)} das vendas`}><span className="text-ifood">{brl(x.fatIfood)}</span></Linha>
            <Linha rotulo="Taxas de entrega recebidas">{brl(x.entregasRecebidas)}</Linha>
            <Rotulo className="mb-1 mt-4">Sai</Rotulo>
            <Linha rotulo="Ingredientes">{brl(x.ingredientes)}</Linha>
            <Linha rotulo="Embalagens">{brl(x.embalagens)}</Linha>
            <Linha rotulo="Mão de obra">{brl(x.maoDeObra)}</Linha>
            <Linha rotulo="Comissão e pagamento do iFood">{brl(x.taxasIfood)}</Linha>
            <Linha rotulo="Mensalidade do iFood" nota={x.mensalidade ? "passou do limite" : "abaixo do limite"}>{brl(x.mensalidade)}</Linha>
            <Linha rotulo="Custo das entregas">{brl(x.custoEntregas)}</Linha>
            <Linha rotulo="DAS do MEI">{brl(x.das)}</Linha>
            <Linha rotulo="Divulgação">{brl(x.divulgacao)}</Linha>
            <Linha rotulo="Outros fixos">{brl(x.outrosFixos)}</Linha>
          </Painel>
        </>
      ) : (
        <Realizado mes={mes} />
      )}
    </div>
  );
}

function Realizado({ mes }: { mes: string }) {
  const { pedidos, premissas } = useStore();
  const lista = pedidos.filter((p) => p.dia.startsWith(mes));
  const r = resumo(lista);
  const c = porCanal(lista);
  const mensal = mensalidadeIfood(c.ifood.liquido, premissas);
  const fixos = premissas.das.valor + premissas.divulgacao.valor + premissas.outrosFixos.valor + mensal;
  const lucro = r.lucro - fixos;
  const dias = new Set(lista.filter((p) => p.status !== "cancelado").map((p) => p.dia)).size;
  return (
    <>
      <section>
        <Rotulo>Lucro do mês até agora</Rotulo>
        <Dinheiro valor={lucro} className={cx("font-display text-[56px] leading-none", lucro < 0 ? "text-prejuizo" : "text-milho")} />
        <p className="mt-1 text-creme-2">
          {r.pedidos} pedidos em {dias} {dias === 1 ? "dia" : "dias"} · {brl(r.cobrado)} faturados
        </p>
      </section>
      <Painel>
        <Linha rotulo="WhatsApp"><span className="text-zap">{brl(c.whatsapp.cobrado)}</span></Linha>
        <Linha rotulo="iFood"><span className="text-ifood">{brl(c.ifood.cobrado)}</span></Linha>
        <Linha rotulo="Lucro dos pedidos" nota="já sem custo, taxas e entrega">{brl(r.lucro)}</Linha>
        <Linha rotulo="Fixos do mês" nota={`DAS, divulgação, outros${mensal ? " e mensalidade do iFood" : ""}`}>{brl(-fixos)}</Linha>
        <Linha rotulo="Fica com a família">{brl(lucro + r.maoDeObra)}</Linha>
        <Linha rotulo="Faturamento em 12 meses nesse ritmo" nota={dias ? `média de ${dias} dias × ${premissas.diasVendaMes.valor} por mês` : undefined}>
          {dias ? brl(Math.round((r.cobrado / dias) * premissas.diasVendaMes.valor * 12)) : "—"}
        </Linha>
      </Painel>
    </>
  );
}

function Alertas({ x, limite }: { x: ReturnType<typeof projecao>; limite: number }) {
  return (
    <Painel className="flex flex-col gap-2">
      <p className={x.cabeMei ? "text-creme-2" : "font-semibold text-prejuizo"}>
        {x.cabeMei ? "Cabe no MEI." : "Estoura o MEI!"} Nesse ritmo são {brl(x.receita12)} em 12 meses (limite {brl(limite)}).
      </p>
      <p className="text-creme-2">
        {Number.isFinite(x.pedidosEmpate)
          ? `Pra pagar os fixos: ${x.pedidosEmpate} pedidos no mês, uns ${Math.ceil(x.pedidosEmpateDia)} por dia de venda.`
          : "Com esses preços cada pedido dá prejuízo: os fixos nunca se pagam."}
      </p>
    </Painel>
  );
}
