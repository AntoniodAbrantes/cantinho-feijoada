"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { custoInsumo, custoPorKg, custoProducao } from "@/lib/calc";
import { brl, dataBr, igual, kg } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Insumo, Producao } from "@/lib/types";
import { Botao, Dinheiro, Esqueleto, Estimativa, Linha, Painel, Rotulo, Vazio } from "@/components/ui";
import { Campo, Interruptor, Texto, Valor } from "@/components/campos";
import { Confirmar, Folha } from "@/components/folha";
import { Titulo } from "@/components/voltar";

export default function Pagina() {
  const { id } = useParams<{ id: string }>();
  const { producoes, carregando } = useStore();
  const p = producoes.find((x) => x.id === id);
  if (carregando) return <Esqueleto className="h-64" />;
  if (!p) return <Vazio titulo="Produção não encontrada" texto="Pode ter sido apagada. Volta pra lista." />;
  return <Editor key={p.id} inicial={p} />;
}

const vazio: Insumo = { nome: "", precoPago: 0, pesoPacoteG: null, usadoG: null, custo: 0, obs: "" };
const campoData = "min-h-12 w-full rounded-[var(--radius-ctl)] border border-linha bg-carvao px-3 text-lg text-creme focus:border-milho focus:outline-none";

function Editor({ inicial }: { inicial: Producao }) {
  const { premissas, lote, avisar } = useStore();
  const router = useRouter();
  const [p, setP] = useState(inicial);
  const [aberto, setAberto] = useState<number | null>(null); // índice; -1 = novo
  const [apagar, setApagar] = useState(false);
  const total = custoProducao(p, premissas);
  const extras = premissas.temperos.valor + premissas.gasEnergia.valor;
  const mudou = !igual(p, inicial);

  const salvar = () => {
    const { id, ...dados } = p;
    lote([{ caminho: `producoes/${id}`, dados }]);
    avisar("Produção salva. O custo do kg já vale pros próximos pedidos.");
  };

  const gravarInsumo = (i: Insumo) => {
    const insumos = [...p.insumos];
    if (aberto === -1) insumos.push(i);
    else insumos[aberto!] = i;
    setP({ ...p, insumos });
    setAberto(null);
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      <Titulo voltar="/mais/producoes">Produção</Titulo>

      <section>
        <Rotulo>Custo por kg</Rotulo>
        <Dinheiro valor={Math.round(custoPorKg(total, p.rendimentoG))} className="font-display text-[56px] leading-none text-milho" />
        <p className="mt-1 text-creme-2">
          {brl(total)} ÷ {kg(p.rendimentoG)} {p.rendimentoEstimativa && <Estimativa texto="rendimento" />}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data">{(id) => <input id={id} type="date" value={p.data} onChange={(e) => setP({ ...p, data: e.target.value })} className={campoData} />}</Campo>
        <Valor rotulo="Rendimento" valor={p.rendimentoG} onChange={(rendimentoG) => setP({ ...p, rendimentoG })} prefixo="" sufixo="kg" casas={3} />
      </div>
      <Interruptor rotulo="Rendimento é estimativa" ligado={p.rendimentoEstimativa} onChange={(rendimentoEstimativa) => setP({ ...p, rendimentoEstimativa })} destaque />

      <section className="flex flex-col gap-2">
        <Rotulo>Insumos (o que foi pago)</Rotulo>
        <ul className="divide-y divide-linha overflow-hidden rounded-[var(--radius-card)] bg-brasa">
          {p.insumos.map((i, n) => (
            <li key={n}>
              <button onClick={() => setAberto(n)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-tisna">
                <span className="flex-1">
                  <span className="block">{i.nome || "Sem nome"}</span>
                  <span className="block text-sm text-creme-3">
                    {i.pesoPacoteG && i.usadoG ? `${kg(i.usadoG)} de pacote ${kg(i.pesoPacoteG)} a ${brl(i.precoPago)}` : i.obs || "valor inteiro"}
                  </span>
                </span>
                <span className={i.custo ? "num font-semibold" : "num text-milho"}>{i.custo ? brl(i.custo) : "a preencher"}</span>
              </button>
            </li>
          ))}
        </ul>
        <Botao onClick={() => setAberto(-1)}>Adicionar insumo</Botao>
      </section>

      <Painel>
        <Linha rotulo="Soma da nota">{brl(total - extras)}</Linha>
        <Linha rotulo="Temperos e gás (premissas)">{brl(extras)}</Linha>
        <Linha rotulo="Custo da produção">
          <span className="font-display text-xl">{brl(total)}</span>
        </Linha>
      </Painel>

      <Botao variante="perigo" onClick={() => setApagar(true)} className="self-start">
        Apagar produção
      </Botao>

      {mudou && (
        <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 mx-auto max-w-lg animate-subir px-4 pb-3">
          <Botao variante="principal" onClick={salvar} className="w-full shadow-lg shadow-black/40">
            Salvar produção
          </Botao>
        </div>
      )}

      {aberto !== null && <EditorInsumo inicial={aberto === -1 ? vazio : p.insumos[aberto]} onSalvar={gravarInsumo} onTirar={aberto === -1 ? undefined : () => { setP({ ...p, insumos: p.insumos.filter((_, n) => n !== aberto) }); setAberto(null); }} onFechar={() => setAberto(null)} />}
      <Confirmar
        aberta={apagar}
        titulo="Apagar produção?"
        texto={`A produção de ${dataBr(p.data)} some. Pedidos já lançados não mudam: o custo deles ficou guardado.`}
        acao="Apagar"
        onNao={() => setApagar(false)}
        onSim={() => {
          lote([{ caminho: `producoes/${p.id}`, apagar: true }]);
          avisar("Produção apagada.");
          router.replace("/mais/producoes");
        }}
      />
    </div>
  );
}

function EditorInsumo({ inicial, onSalvar, onTirar, onFechar }: { inicial: Insumo; onSalvar: (i: Insumo) => void; onTirar?: () => void; onFechar: () => void }) {
  const [i, setI] = useState(inicial);
  const custo = custoInsumo(i.precoPago, i.pesoPacoteG, i.usadoG);
  return (
    <Folha aberta onFechar={onFechar} titulo={inicial.nome || "Novo insumo"}>
      <div className="flex flex-col gap-4">
        <Texto rotulo="O que foi comprado" valor={i.nome} onChange={(nome) => setI({ ...i, nome })} />
        <Valor rotulo="Preço pago (do pacote)" valor={i.precoPago} onChange={(precoPago) => setI({ ...i, precoPago })} />
        <div className="grid grid-cols-2 gap-3">
          <Valor rotulo="Peso do pacote" valor={i.pesoPacoteG ?? 0} onChange={(v) => setI({ ...i, pesoPacoteG: v || null })} prefixo="" sufixo="kg" casas={3} />
          <Valor rotulo="Usado" valor={i.usadoG ?? 0} onChange={(v) => setI({ ...i, usadoG: v || null })} prefixo="" sufixo="kg" casas={3} />
        </div>
        <p className="text-creme-2">
          Custo na produção: <span className="font-display text-xl text-creme">{brl(custo)}</span>
          <span className="block text-sm text-creme-3">Sem peso, conta o preço inteiro.</span>
        </p>
        <Texto rotulo="Observação" valor={i.obs} onChange={(obs) => setI({ ...i, obs })} />
        <div className="grid grid-cols-2 gap-3">
          {onTirar ? <Botao variante="perigo" onClick={onTirar}>Tirar</Botao> : <span />}
          <Botao variante="principal" onClick={() => onSalvar({ ...i, nome: i.nome.trim(), custo })} disabled={!i.nome.trim()}>
            Pronto
          </Botao>
        </div>
      </div>
    </Folha>
  );
}
