"use client";
import { useMemo, useState } from "react";
import { arrayUnion } from "firebase/firestore";
import { brl, dataBr, diaLocal, horaLocal } from "@/lib/format";
import { cartao, nomePremio, normalizarTelefone, telefoneValido, type Cartao } from "@/lib/fidelidade";
import { mascaraTelefone } from "@/lib/site";
import { useStore } from "@/lib/store";
import { conta, type ConfigFidelidade } from "@/lib/types";
import { Botao, Chips, Dinheiro, Esqueleto, Linha, Painel, Rotulo, Vazio, cx } from "@/components/ui";
import { Campo, Interruptor, Texto, estiloCampo } from "@/components/campos";
import { Folha } from "@/components/folha";
import { FiltroPeriodo, NOME_PERIODO, usePeriodo } from "@/components/periodo";
import { Titulo } from "@/components/voltar";
import { CartaoSelos } from "@/components/selos";
import { textoResgate } from "@/components/selos-admin";

type Cliente = { tel: string; nome: string; c: Cartao };

export default function Fidelidade() {
  const { pedidos, produtos, fidelidade, cfgFidelidade: cfg, carregando } = useStore();
  const per = usePeriodo("mes");
  const [aberto, setAberto] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  // Um cliente por WhatsApp (iFood fica de fora), com o nome do pedido mais recente.
  const clientes = useMemo(() => {
    const m = new Map<string, typeof pedidos>();
    for (const p of pedidos) {
      if (!p.telefone || p.canal === "ifood") continue;
      const tel = normalizarTelefone(p.telefone);
      m.set(tel, [...(m.get(tel) ?? []), p]);
    }
    for (const f of fidelidade) if (!m.has(f.id)) m.set(f.id, []);
    return [...m.entries()]
      .map(([tel, ps]): Cliente => ({ tel, nome: [...ps].sort((a, b) => b.criadoEm - a.criadoEm).find((p) => p.cliente)?.cliente ?? "", c: cartao(ps, fidelidade.find((f) => f.id === tel)?.ajustes ?? [], produtos, cfg) }))
      .sort((a, b) => b.c.liberados - a.c.liberados || b.c.selos - a.c.selos || a.nome.localeCompare(b.nome));
  }, [pedidos, fidelidade, produtos, cfg]);

  if (carregando)
    return (
      <div className="flex flex-col gap-4" aria-busy aria-label="Carregando">
        <Esqueleto className="h-10 w-48" />
        <Esqueleto className="h-40" />
      </div>
    );

  const resgates = pedidos.filter((p) => p.fidelidade && conta(p.status) && per.dentro(p.dia));
  const trocas = resgates.filter((p) => p.fidelidade!.troca > 0);
  const custo = resgates.reduce((s, p) => s + p.itens.filter((i) => i.brinde).reduce((x, i) => x + i.qtd * i.custo, 0), 0);
  const liberados = clientes.filter((x) => x.c.liberados > 0);
  const filtro = busca.trim().toLowerCase();
  const lista = filtro ? clientes.filter((x) => x.nome.toLowerCase().includes(filtro) || x.tel.includes(filtro.replace(/\D/g, "") || "—")) : clientes;
  const sel = clientes.find((x) => x.tel === aberto) ?? (aberto ? { tel: aberto, nome: "", c: cartao([], [], produtos, cfg) } : null);

  return (
    <div className="flex flex-col gap-5">
      <Titulo>Fidelidade</Titulo>
      <Ajustes cfg={cfg} />

      <FiltroPeriodo p={per} />
      <Painel>
        <Rotulo className="mb-1">Prêmios {NOME_PERIODO[per.periodo]}</Rotulo>
        <Linha rotulo="Resgatados">
          <span className="num">{resgates.length}</span>
        </Linha>
        <Linha rotulo="Trocas de tamanho" nota={trocas.length ? `${brl(trocas.reduce((s, p) => s + p.fidelidade!.troca, 0))} pagos na diferença` : undefined}>
          <span className="num">{trocas.length}</span>
        </Linha>
        <Linha rotulo="Custo dos prêmios" nota="comida, embalagem e mão de obra">
          <Dinheiro valor={-custo} />
        </Linha>
      </Painel>

      {resgates.length > 0 && (
        <section className="flex flex-col gap-2">
          <Rotulo>Resgatados {NOME_PERIODO[per.periodo]}</Rotulo>
          <ul className="divide-y divide-linha overflow-hidden rounded-[var(--radius-card)] bg-brasa">
            {resgates.map((p) => (
              <li key={p.id} className="flex flex-col px-4 py-2.5">
                <span className="font-semibold">{p.cliente || mascaraTelefone(p.telefone ?? "")}</span>
                <span className="text-sm text-creme-2">
                  {dataBr(p.dia)} · {textoResgate(p.fidelidade!)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {liberados.length > 0 && (
        <section className="flex flex-col gap-2">
          <Rotulo>Prêmios liberados agora</Rotulo>
          <ul className="divide-y divide-linha overflow-hidden rounded-[var(--radius-card)] border-2 border-milho">
            {liberados.map((x) => (
              <li key={x.tel}>
                <button onClick={() => setAberto(x.tel)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left active:bg-tisna">
                  <span>
                    <span className="block font-semibold">{x.nome || mascaraTelefone(x.tel)}</span>
                    <span className="block text-sm text-creme-3">{mascaraTelefone(x.tel)}</span>
                  </span>
                  <span className="font-semibold text-milho">{nomePremio(x.c.premio!.nome)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <Rotulo>Clientes · {clientes.length}</Rotulo>
        <Texto rotulo="Buscar por nome ou WhatsApp" valor={busca} onChange={setBusca} />
        {telefoneValido(normalizarTelefone(busca)) && !clientes.some((x) => x.tel === normalizarTelefone(busca)) && (
          <Botao onClick={() => setAberto(normalizarTelefone(busca))}>Abrir cartão de {mascaraTelefone(normalizarTelefone(busca))}</Botao>
        )}
        {lista.length === 0 ? (
          <Vazio titulo="Nenhum cliente com WhatsApp" texto="Os pedidos do site já vêm com o número. No pedido manual, preenche o WhatsApp do cliente." />
        ) : (
          <ul className="divide-y divide-linha overflow-hidden rounded-[var(--radius-card)] bg-brasa">
            {lista.map((x) => (
              <li key={x.tel}>
                <button onClick={() => setAberto(x.tel)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-tisna">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{x.nome || "Sem nome"}</span>
                    <span className="block text-sm text-creme-3">{mascaraTelefone(x.tel)}</span>
                  </span>
                  <span className={cx("num font-display text-xl", x.c.liberados ? "text-milho" : "text-creme-2")}>
                    {x.c.liberados ? "Presente" : `${x.c.selos}/${x.c.meta}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sel && <DetalheCliente x={sel} onFechar={() => setAberto(null)} />}
    </div>
  );
}

function Ajustes({ cfg }: { cfg: ConfigFidelidade }) {
  const { lote, avisar } = useStore();
  const [c, setC] = useState(cfg);
  const mudou = c.ativo !== cfg.ativo || c.meta !== cfg.meta || c.regra !== cfg.regra;
  const metaOk = Number.isInteger(c.meta) && c.meta >= 2 && c.meta <= 20;
  return (
    <Painel className="flex flex-col gap-4">
      <Interruptor rotulo="Selo do Cantinho ligado" ligado={c.ativo} onChange={(ativo) => setC({ ...c, ativo })} destaque />
      <Campo rotulo="Pedidos pra ganhar o presente">
        {(id) => <input id={id} type="number" inputMode="numeric" min={2} max={20} value={c.meta || ""} onChange={(e) => setC({ ...c, meta: Number(e.target.value) })} className={estiloCampo} />}
      </Campo>
      {!metaOk && <p className="text-sm text-prejuizo">De 2 a 20 pedidos.</p>}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold uppercase tracking-wider text-creme-3">Tamanho do presente</span>
        <Chips rotulo="Tamanho do presente" valor={c.regra} onChange={(regra) => setC({ ...c, regra })} opcoes={[{ v: "menor", t: "Menor dos pedidos" }, { v: "maior", t: "Maior dos pedidos" }]} />
        <p className="text-sm text-creme-3">Vale o tamanho da maior feijoada de cada pedido do cartão. iFood, cancelado e resgate não contam.</p>
      </div>
      <Botao
        variante="principal"
        disabled={!mudou || !metaOk}
        onClick={() => {
          lote([{ caminho: "config/fidelidade", dados: c }]);
          avisar("Regra do Selo do Cantinho salva.", () => lote([{ caminho: "config/fidelidade", dados: cfg }]));
        }}
      >
        Salvar regra
      </Botao>
    </Painel>
  );
}

function DetalheCliente({ x, onFechar }: { x: Cliente; onFechar: () => void }) {
  const { fidelidade, lote, avisar } = useStore();
  const [qtd, setQtd] = useState(1);
  const [motivo, setMotivo] = useState("");
  const ajustes = fidelidade.find((f) => f.id === x.tel)?.ajustes ?? [];
  const ajustar = () => {
    const a = { em: Date.now(), qtd, motivo: motivo.trim() };
    lote([{ caminho: `fidelidade/${x.tel}`, dados: { ajustes: arrayUnion(a) } }]);
    avisar(`${qtd > 0 ? `+${qtd}` : qtd} ${Math.abs(qtd) === 1 ? "selo" : "selos"} pra ${x.nome || mascaraTelefone(x.tel)}.`);
    setMotivo("");
  };
  return (
    <Folha aberta onFechar={onFechar} titulo={x.nome || mascaraTelefone(x.tel)}>
      <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto pb-1">
        <p className="text-creme-3">{mascaraTelefone(x.tel)}</p>
        <CartaoSelos selos={x.c.selos} meta={x.c.meta} />
        <p className="text-creme-2">
          {x.c.liberados ? `Presente liberado: ${nomePremio(x.c.premio!.nome)}${x.c.liberados > 1 ? ` (${x.c.liberados} guardados)` : ""}.` : `${x.c.selos} de ${x.c.meta} selos.`} {x.c.validos} pedidos entregues que contam · {x.c.resgates} resgates
          {x.c.aCaminho ? ` · ${x.c.aCaminho} a caminho` : ""}.
        </p>

        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-carvao p-3">
          <Rotulo>Ajustar selos</Rotulo>
          <Chips rotulo="Quantidade" valor={String(qtd)} onChange={(v) => setQtd(Number(v))} opcoes={["-2", "-1", "1", "2"].map((v) => ({ v, t: Number(v) > 0 ? `+${v}` : `−${-Number(v)}` }))} />
          <Texto rotulo="Motivo" valor={motivo} onChange={setMotivo} placeholder="Ex.: pedido antigo pelo telefone da esposa" />
          <Botao variante="principal" disabled={motivo.trim().length < 3} onClick={ajustar}>
            {qtd > 0 ? "Dar" : "Tirar"} {Math.abs(qtd)} {Math.abs(qtd) === 1 ? "selo" : "selos"}
          </Botao>
        </div>

        {ajustes.length > 0 && (
          <ul className="flex flex-col gap-1">
            <Rotulo>Ajustes feitos</Rotulo>
            {[...ajustes].sort((a, b) => b.em - a.em).map((a) => (
              <li key={a.em} className="flex justify-between gap-3 text-sm text-creme-2">
                <span>
                  {dataBr(diaLocal(a.em))} {horaLocal(a.em)} · {a.motivo}
                </span>
                <span className={cx("num font-semibold", a.qtd > 0 ? "text-lucro" : "text-prejuizo")}>{a.qtd > 0 ? `+${a.qtd}` : a.qtd}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Folha>
  );
}
