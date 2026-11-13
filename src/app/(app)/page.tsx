"use client";
import Link from "next/link";
import { brl, dataBr, fimDeSemana, kg, nomeDia, pctFmt, somaDias } from "@/lib/format";
import { porCanal, porProduto, porDia, resumo } from "@/lib/painel";
import { producaoDoDia } from "@/lib/pedido";
import { useStore } from "@/lib/store";
import { Botao, Dinheiro, Esqueleto, Estimativa, EtiquetaCanal, Linha, Painel, Rotulo, Selo, Vazio, cx } from "@/components/ui";
import type { Pedido } from "@/lib/types";
import { FiltroPeriodo, NOME_PERIODO, usePeriodo } from "@/components/periodo";

export default function PainelPage() {
  const { pedidos, compras, premissas, carregando } = useStore();
  const per = usePeriodo();
  const { hoje, periodo } = per;
  const lista = pedidos.filter((p) => per.dentro(p.dia));
  const r = resumo(lista);
  const canais = porCanal(lista);
  const usaEstimativa = !carregando && (premissas.rendimentoG.estimativa || (canais.ifood.pedidos > 0 && premissas.ifoodComissaoBp.estimativa));

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
      <header className="flex items-center gap-3 lg:col-span-2">
        <Selo tamanho={44} />
        <div>
          <p className="font-display text-lg uppercase leading-none tracking-wide">Cantinho da Feijoada</p>
          <p className="text-sm capitalize text-creme-3">
            {nomeDia(hoje)}, {dataBr(hoje)}
          </p>
        </div>
      </header>

      <div className="lg:col-span-2">
        <FiltroPeriodo p={per} />
      </div>

      {carregando ? (
        <Esqueletos />
      ) : r.pedidos === 0 ? (
        <Painel className="lg:col-span-2">
          <Vazio
            titulo={periodo === "hoje" ? "Nenhum pedido ainda hoje" : `Nenhum pedido ${NOME_PERIODO[periodo]}`}
            texto={periodo === "hoje" ? "Bora vender? O primeiro sai num toque." : "Escolhe outro período ou lança o primeiro."}
            acao={
              <Link href="/novo">
                <Botao variante="principal">Lançar pedido</Botao>
              </Link>
            }
          />
        </Painel>
      ) : (
        <>
          <section aria-labelledby="lucro" className="lg:col-span-2">
            <Rotulo>
              <span id="lucro">Lucro {NOME_PERIODO[periodo]}</span>
            </Rotulo>
            <Dinheiro valor={r.lucro} className={cx("mt-1 font-display text-[64px] leading-none", r.lucro < 0 ? "text-prejuizo" : "text-milho")} />
            <p className="mt-2 text-lg text-creme-2">
              {brl(r.cobrado)} faturados · margem {pctFmt(r.margem)} · {r.pedidos} {r.pedidos === 1 ? "pedido" : "pedidos"}
            </p>
            {usaEstimativa && (
              <Link href="/mais/premissas" className="mt-2 inline-block">
                <Estimativa texto="conta usa valores a confirmar" />
              </Link>
            )}
          </section>

          <Canais canais={canais} />
          <Producao pedidos={pedidos} hoje={hoje} />

          <Painel>
            <Rotulo className="mb-1">Os números</Rotulo>
            <Linha rotulo="Faturamento bruto (itens)">
              <Dinheiro valor={r.bruto} />
            </Linha>
            <Linha rotulo="Descontos dados" nota={`${pctFmt(r.pctDesconto, 1)} do bruto`}>
              <Dinheiro valor={-r.desconto} />
            </Linha>
            <Linha rotulo="Taxas de entrega">
              <Dinheiro valor={r.taxaEntrega} />
            </Linha>
            <Linha rotulo="Taxas do iFood">
              <Dinheiro valor={-r.taxasIfood} />
            </Linha>
            <Linha rotulo="Taxa da maquininha">
              <Dinheiro valor={-r.taxaPagamento} />
            </Linha>
            <Linha rotulo="Custo" nota="comida, embalagem, mão de obra e entrega">
              <Dinheiro valor={-r.custo} />
            </Linha>
            <Linha rotulo="Ticket médio">
              <Dinheiro valor={r.ticket} />
            </Linha>
            <Linha rotulo="Fica com a família" nota="lucro + mão de obra">
              <Dinheiro valor={r.lucro + r.maoDeObra} className="text-lucro" />
            </Linha>
          </Painel>

          <Barras titulo="O que mais saiu" itens={porProduto(lista).map((p) => ({ id: p.id, rotulo: p.nome, valor: p.qtd, texto: `${p.qtd}` }))} />
          {periodo !== "hoje" && (
            <Barras
              titulo="Vendas por dia"
              itens={porDia(lista).map((d) => ({ id: d.dia, rotulo: `${nomeDia(d.dia).slice(0, 3)} ${dataBr(d.dia).slice(0, 5)}`, valor: d.cobrado, texto: brl(d.cobrado) }))}
            />
          )}
        </>
      )}

      {!carregando && <Caixa pedidos={pedidos} compras={compras} />}
    </div>
  );
}

function Canais({ canais }: { canais: ReturnType<typeof porCanal> }) {
  const total = canais.whatsapp.cobrado + canais.ifood.cobrado || 1;
  return (
    <Painel className="flex flex-col gap-4">
      <div className="flex h-2 overflow-hidden rounded-full bg-tisna" aria-hidden>
        <div className="bg-zap transition-[width] duration-200" style={{ width: `${(canais.whatsapp.cobrado / total) * 100}%` }} />
        <div className="bg-ifood transition-[width] duration-200" style={{ width: `${(canais.ifood.cobrado / total) * 100}%` }} />
      </div>
      <div className="grid grid-cols-2 divide-x divide-linha">
        {(["whatsapp", "ifood"] as const).map((c, i) => {
          const x = canais[c];
          return (
            <div key={c} className={cx("flex flex-col gap-1", i ? "pl-4" : "pr-4")}>
              <EtiquetaCanal canal={c} />
              <Dinheiro valor={x.cobrado} className="font-display text-[28px] leading-tight" />
              <span className="text-creme-2">
                {x.pedidos} {x.pedidos === 1 ? "pedido" : "pedidos"}
              </span>
              <span className="text-creme-2">
                lucro <Dinheiro valor={x.lucro} sinal />
              </span>
              <span className="text-sm text-creme-3">{x.desconto ? `desconto ${brl(x.desconto)}` : "sem desconto"}</span>
            </div>
          );
        })}
      </div>
    </Painel>
  );
}

function Producao({ pedidos, hoje }: { pedidos: Pedido[]; hoje: string }) {
  const { producoes, produtos, premissas } = useStore();
  const fds = fimDeSemana(hoje);
  const prod = producaoDoDia(producoes, somaDias(fds, 2), premissas);
  if (!prod) return null;
  const vendido = resumo(pedidos.filter((p) => p.fimDeSemana === fds)).pesoG;
  const total = prod.producao.rendimentoG;
  const resta = Math.max(0, total - vendido);
  const uso = total ? vendido / total : 0;
  const perto = uso >= 0.8;
  const tamanhos = produtos.filter((p) => p.categoria === "feijoada" && p.ativoIfood);
  return (
    <Painel className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Rotulo>Panela do fim de semana</Rotulo>
        {prod.producao.rendimentoEstimativa && <Estimativa texto="rendimento" />}
      </div>
      <p className="flex items-baseline gap-2">
        <span className="font-display text-[28px] leading-none">{kg(vendido)}</span>
        <span className="text-creme-2">vendidos de {kg(total)}</span>
      </p>
      <div className="h-3 overflow-hidden rounded-full bg-tisna" role="progressbar" aria-valuenow={Math.round(uso * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Feijoada vendida">
        <div className={cx("h-full rounded-full transition-[width] duration-200", perto ? "bg-prejuizo" : "bg-creme")} style={{ width: `${Math.min(100, uso * 100)}%` }} />
      </div>
      {perto && <p className="font-semibold text-prejuizo">{resta ? "Tá acabando! Avisa no status que é por encomenda." : "Esgotou. Que fim de semana!"}</p>}
      <p className="text-creme-2">
        Ainda dá pra {tamanhos.map((p, i) => `${i ? (i === tamanhos.length - 1 ? " ou " : ", ") : ""}${porcoes(Math.floor(resta / p.pesoFeijoadaG), p.curto)}`).join("")}.
      </p>
      <p className="text-sm text-creme-3">
        Produção de {dataBr(prod.producao.data)} · {brl(Math.round(prod.custoKg))}/kg
      </p>
    </Painel>
  );
}

const porcoes = (n: number, curto: string) => (curto === "Individual" ? `${n} ${n === 1 ? "individual" : "individuais"}` : `${n} ${curto.toLowerCase()}`);

function Caixa({ pedidos, compras }: { pedidos: Pedido[]; compras: { valor: number }[] }) {
  const recebido = resumo(pedidos).recebido;
  const gasto = compras.reduce((s, c) => s + c.valor, 0);
  const saldo = recebido - gasto;
  return (
    <Link href="/caixa" className="block rounded-[var(--radius-card)] border border-linha p-4 active:bg-brasa">
      <Rotulo>Saldo do caixa · desde o começo</Rotulo>
      <Dinheiro valor={saldo} sinal className="mt-1 font-display text-[28px] leading-tight" />
      <p className="text-creme-2">
        {brl(recebido)} recebidos − {brl(gasto)} em compras
      </p>
      {saldo < 0 && <p className="mt-1 text-sm text-creme-3">Faltam {brl(-saldo)} pra pagar o que já saiu do bolso.</p>}
    </Link>
  );
}

function Barras({ titulo, itens }: { titulo: string; itens: { id: string; rotulo: string; valor: number; texto: string }[] }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <Painel>
      <Rotulo className="mb-3">{titulo}</Rotulo>
      <ul className="flex flex-col gap-3">
        {itens.map((i) => (
          <li key={i.id}>
            <div className="flex justify-between gap-3 text-creme-2">
              <span>{i.rotulo}</span>
              <span className="num font-semibold text-creme">{i.texto}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-tisna">
              <div className="h-full rounded-full bg-creme-2 transition-[width] duration-200" style={{ width: `${(i.valor / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Painel>
  );
}

function Esqueletos() {
  return (
    <div className="flex flex-col gap-6 lg:col-span-2" aria-busy aria-label="Carregando">
      <div className="flex flex-col gap-2">
        <Esqueleto className="h-4 w-32" />
        <Esqueleto className="h-16 w-56" />
        <Esqueleto className="h-5 w-64" />
      </div>
      <Esqueleto className="h-40" />
      <Esqueleto className="h-36" />
      <Esqueleto className="h-64" />
    </div>
  );
}

