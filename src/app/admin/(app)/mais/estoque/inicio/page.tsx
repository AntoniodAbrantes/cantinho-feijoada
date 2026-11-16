"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cargaInicial, configEstoque, embalagens, receitas } from "@/data/estoque";
import { comReceita, descPedido, nomeCurto, planoCarga } from "@/lib/estoque";
import { fb } from "@/lib/firebase";
import { dataBr, diaLocal, horaLocal, nomeDia } from "@/lib/format";
import { fazerCarga } from "@/lib/potes";
import { useStore } from "@/lib/store";
import { Botao, Esqueleto, Painel, Rotulo, Vazio, cx } from "@/components/ui";
import { Confirmar } from "@/components/folha";
import { Titulo } from "@/components/voltar";

const nome = (id: string) => nomeCurto(embalagens.find((e) => e.id === id)!);
const listaPotes = (m: Record<string, number>) =>
  embalagens
    .filter((e) => m[e.id])
    .map((e) => `${nomeCurto(e)} ×${m[e.id]}`)
    .join(" · ");

// Começa o estoque: compra de 11/11 menos os pedidos desde 13/11, conferido com a contagem do dono antes de salvar.
export default function Inicio() {
  const { pedidos, produtos, estoque, carregando, avisar } = useStore();
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  if (carregando) return <Esqueleto className="h-96" />;

  if (estoque)
    return (
      <div className="flex flex-col gap-5">
        <Titulo voltar="/admin/mais/estoque">Começar o estoque</Titulo>
        <Painel>
          <Vazio titulo="O estoque já começou" acao={<Link href="/admin/mais/estoque"><Botao variante="principal">Ver o estoque</Botao></Link>} />
        </Painel>
      </div>
    );

  const hoje = diaLocal();
  const plano = planoCarga(pedidos, comReceita(produtos, receitas), configEstoque, cargaInicial.compra, hoje);
  const conferidos = embalagens.filter((e) => e.id in cargaInicial.esperado);
  const difs = conferidos.map((e) => ({ e, d: plano.saldo(e.id) - cargaInicial.esperado[e.id] })).filter((x) => x.d);
  const bate = difs.length === 0;
  const contam = plano.linhas.filter((l) => l.chave);

  const salvar = async () => {
    setConfirmar(false);
    setSalvando(true);
    setErro("");
    try {
      await fazerCarga(fb().db, pedidos, produtos, hoje);
      avisar("Estoque de potes começou. Daqui pra frente cada pedido dá baixa sozinho.");
      router.push("/admin/mais/estoque");
    } catch (e) {
      setErro(navigator.onLine ? `Não deu pra salvar: ${(e as Error).message}` : "Precisa de internet pra começar o estoque.");
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Titulo voltar="/admin/mais/estoque">Começar o estoque</Titulo>
      <p className="text-creme-2">
        Entra a compra de {dataBr(cargaInicial.dia)} e sai o que cada pedido desde {dataBr(configEstoque.desde)} usou. Nada é salvo até você conferir e tocar em salvar.
      </p>

      <section className="flex flex-col gap-2">
        <Rotulo>1. Compra de {dataBr(cargaInicial.dia)}</Rotulo>
        <Painel>
          <p className="num">{listaPotes(cargaInicial.compra)}</p>
        </Painel>
      </section>

      <section className="flex flex-col gap-2">
        <Rotulo>
          2. Pedidos desde {dataBr(configEstoque.desde)} · {contam.length} dão baixa
        </Rotulo>
        {plano.linhas.length === 0 ? (
          <Painel>
            <Vazio titulo="Nenhum pedido" texto={`Não achei pedido de ${dataBr(configEstoque.desde)} pra cá.`} />
          </Painel>
        ) : (
          <ul className="divide-y divide-linha overflow-hidden rounded-[var(--radius-card)] bg-brasa">
            {plano.linhas.map(({ p, potes, chave }) => (
              <li key={p.id} className={cx("flex flex-col gap-0.5 px-4 py-3", !chave && "opacity-50")}>
                <span className="flex justify-between gap-3">
                  <span className="font-semibold">{descPedido(p) || "Pedido"}</span>
                  <span className="num shrink-0 text-sm text-creme-3">
                    {nomeDia(p.dia).slice(0, 3)} {dataBr(p.dia).slice(0, 5)} {horaLocal(p.criadoEm)}
                  </span>
                </span>
                <span className="text-sm text-creme-2">{p.itens.map((i) => `${i.qtd}× ${i.nome}`).join(", ")}</span>
                <span className={cx("num text-sm", chave ? "text-creme" : "text-creme-3")}>
                  {chave ? listaPotes(potes) || "não usa pote" : p.status === "cancelado" ? "cancelado: ignorado" : p.status === "novo" ? "não aceito: ignorado" : `encomenda pra ${dataBr(p.dia)}: baixa no dia`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Rotulo>3. Como fica</Rotulo>
        <Painel className="overflow-x-auto p-0">
          <table className="num w-full text-right">
            <thead className="text-sm text-creme-3">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Pote</th>
                <th className="px-2 py-2 font-semibold">Entrou</th>
                <th className="px-2 py-2 font-semibold">Saiu</th>
                <th className="px-2 py-2 font-semibold">Fica</th>
                <th className="px-3 py-2 font-semibold">Contagem</th>
              </tr>
            </thead>
            <tbody>
              {embalagens.map((e) => {
                const fica = plano.saldo(e.id);
                const esp = cargaInicial.esperado[e.id];
                const ok = esp === undefined || esp === fica;
                return (
                  <tr key={e.id} className="border-t border-linha">
                    <td className="px-3 py-2.5 text-left">{nomeCurto(e)}</td>
                    <td className="px-2 py-2.5 text-creme-2">{cargaInicial.compra[e.id] ?? 0}</td>
                    <td className="px-2 py-2.5 text-creme-2">{plano.usado[e.id] ?? 0}</td>
                    <td className={cx("px-2 py-2.5 font-semibold", fica < 0 && "text-prejuizo")}>{fica}</td>
                    <td className={cx("px-3 py-2.5", esp === undefined ? "text-creme-3" : ok ? "text-lucro" : "font-semibold text-prejuizo")}>{esp === undefined ? "—" : ok ? `${esp} ✓` : `${esp} ✗`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Painel>
      </section>

      {bate ? (
        <Painel className="flex flex-col gap-3 ring-2 ring-lucro">
          <p className="font-display text-2xl uppercase text-lucro">Bate com a sua contagem</p>
          <p className="text-creme-2">Ao salvar, os pedidos acima ficam baixados e os próximos dão baixa sozinhos.</p>
          <Botao variante="principal" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar estoque"}
          </Botao>
        </Painel>
      ) : (
        <Painel className="flex flex-col gap-3 ring-2 ring-prejuizo">
          <p className="font-display text-2xl uppercase text-prejuizo">Não bate com a sua contagem</p>
          <ul className="flex flex-col gap-1">
            {difs.map(({ e, d }) => (
              <li key={e.id}>
                <span className="font-semibold">{nome(e.id)}</span>: a conta dá {plano.saldo(e.id)}, você contou {cargaInicial.esperado[e.id]}. {d > 0 ? `Saíram ${d} a mais do que os pedidos explicam.` : `Os pedidos tiram ${-d} a mais do que sumiu.`}
              </li>
            ))}
          </ul>
          <p className="text-creme-2">
            Confere os pedidos acima: cada um mostra os potes que tira. Se for receita errada,{" "}
            <Link href="/admin/mais/estoque/receitas" className="font-semibold text-milho underline underline-offset-4">
              ajusta os potes por produto
            </Link>{" "}
            e volta aqui. Se for pedido lançado errado, corrige o pedido.
          </p>
          <Botao variante="perigo" onClick={() => setConfirmar(true)} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar mesmo assim"}
          </Botao>
        </Painel>
      )}
      {erro && (
        <p role="alert" className="font-semibold text-prejuizo">
          {erro}
        </p>
      )}
      <Confirmar
        aberta={confirmar}
        titulo="Salvar sem bater?"
        texto="O estoque começa com a conta dos pedidos, não com a sua contagem. Depois dá pra acertar cada pote em Ajustar estoque."
        acao="Salvar"
        onSim={salvar}
        onNao={() => setConfirmar(false)}
      />
    </div>
  );
}
