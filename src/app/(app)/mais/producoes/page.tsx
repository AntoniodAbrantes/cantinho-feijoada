"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { custoPorKg, custoProducao } from "@/lib/calc";
import { baixarCsv } from "@/lib/csv";
import { brl, dataBr, diaLocal, kg, kgNum, reais } from "@/lib/format";
import { novoId, useStore } from "@/lib/store";
import { Botao, Esqueleto, Estimativa, Vazio } from "@/components/ui";
import { Titulo } from "@/components/voltar";
import { IconSeta } from "@/components/icons";

export default function Producoes() {
  const { producoes, premissas, carregando, lote, avisar } = useStore();
  const router = useRouter();
  if (carregando) return <Esqueleto className="h-64" />;

  const ultima = producoes[0];
  const nova = () => {
    const id = novoId("producoes");
    const base = ultima ?? { rendimentoG: premissas.rendimentoG.valor, rendimentoEstimativa: premissas.rendimentoG.estimativa, insumos: [] };
    lote([{ caminho: `producoes/${id}`, dados: { data: diaLocal(), rendimentoG: base.rendimentoG, rendimentoEstimativa: base.rendimentoEstimativa, insumos: base.insumos } }]);
    avisar(ultima ? "Copiei a última produção. Ajusta os valores da nota." : "Produção criada.");
    router.push(`/mais/producoes/${id}`);
  };

  const exportar = () =>
    baixarCsv(
      "producoes.csv",
      producoes.flatMap((p) =>
        p.insumos.map((i) => ({
          producao: dataBr(p.data), rendimento_kg: kgNum(p.rendimentoG), insumo: i.nome, preco_pago: reais(i.precoPago),
          pacote_kg: i.pesoPacoteG ? kgNum(i.pesoPacoteG) : "", usado_kg: i.usadoG ? kgNum(i.usadoG) : "", custo: reais(i.custo), obs: i.obs,
        })),
      ),
    );

  return (
    <div className="flex flex-col gap-5">
      <Titulo acao={producoes.length > 0 && <Botao variante="fantasma" onClick={exportar} className="text-base">CSV</Botao>}>Produções</Titulo>
      <Botao variante="principal" onClick={nova}>
        {ultima ? "Nova produção (copiar a última)" : "Nova produção"}
      </Botao>
      {producoes.length === 0 ? (
        <Vazio titulo="Nenhuma produção ainda" texto="Lança a nota do mercado pra saber o custo do kg." />
      ) : (
        <ul className="flex flex-col gap-2">
          {producoes.map((p) => {
            const total = custoProducao(p, premissas);
            return (
              <li key={p.id}>
                <Link href={`/mais/producoes/${p.id}`} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-brasa p-4 active:bg-tisna">
                  <span className="flex-1">
                    <span className="block text-lg font-semibold">Produção de {dataBr(p.data)}</span>
                    <span className="block text-creme-2">
                      {brl(total)} · rende {kg(p.rendimentoG)} {p.rendimentoEstimativa && <Estimativa />}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="num block font-display text-2xl">{brl(Math.round(custoPorKg(total, p.rendimentoG)))}</span>
                    <span className="text-sm text-creme-3">por kg</span>
                  </span>
                  <IconSeta className="size-5 text-creme-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
