"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Botao, Chips, cx } from "@/components/ui";
import { Campo, Valor, estiloCampo } from "@/components/campos";
import { IconFechar, IconMais, IconMenos, IconSeta } from "@/components/icons";
import { ACOMPANHAMENTOS } from "@/data/fotos";
import { ehSimples } from "@/lib/types";
import { iniciarAppCheck, tokenAppCheck } from "@/lib/appcheck-cliente";
import { linkWhatsapp } from "@/lib/contato";
import { brl } from "@/lib/format";
import { lojaAberta, textoFechado } from "@/lib/loja";
import {
  NOME_PAGAMENTO, PAGAMENTOS, erroCarrinho, errosCliente, mascaraTelefone, subtotal,
  type Carrinho, type CampoCliente, type DadosCliente, type DadosSite, type ItemSite,
} from "@/lib/site";
import { botaoPrincipal } from "./estilo";
import { EnderecoEntrega, useTaxa, type Taxa } from "./endereco";
import { resumoFaixas, taxaTexto, type Ponto } from "@/lib/entrega";
import type { Endereco } from "@/lib/types";

// Guardado no aparelho do cliente: o carrinho e os dados para o próximo pedido.
const K_CARRINHO = "cantinho:carrinho";
const K_CLIENTE = "cantinho:cliente";
export const K_PEDIDOS = "cantinho:pedidos";
const K_ULTIMO = "cantinho:ultimo"; // itens do último pedido enviado, pro "pedir de novo" // pedidos feitos neste aparelho, para achar o acompanhamento de novo
function ler<T>(k: string): T | null {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function gravar(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {} // aba anônima ou armazenamento bloqueado: segue sem guardar
}

type Etapa = "carrinho" | "dados" | "revisao";
interface Ctx {
  dados: DadosSite | null;
  aberta: boolean;
  qtd: Carrinho;
  mudar: (id: string, n: number) => void;
  limpar: () => void;
  pode: (id: string) => boolean;
  abrir: () => void;
  repetir: (itens: Carrinho) => void;
}
const C = createContext<Ctx | null>(null);
const usePedido = () => useContext(C)!;

export function PedidoProvider({ dados, children }: { dados: DadosSite | null; children: React.ReactNode }) {
  const [qtd, setQtd] = useState<Carrinho>({});
  const [aberta, setAberta] = useState(!!dados?.aberta);
  const [etapa, setEtapa] = useState<Etapa | null>(null);

  // A página vem pronta do servidor (até 30 s de cache): o relógio do aparelho confirma se abriu ou fechou.
  useEffect(() => {
    if (!dados) return;
    const ver = () => setAberta(lojaAberta(dados.loja));
    ver();
    const t = setInterval(ver, 30_000);
    return () => clearInterval(t);
  }, [dados]);

  useEffect(() => {
    const salvo = ler<Carrinho>(K_CARRINHO) ?? {};
    const valido = Object.fromEntries(Object.entries(salvo).filter(([id, q]) => q > 0 && dados?.itens.some((i) => i.id === id && !i.esgotado)));
    if (dados && erroCarrinho(valido, dados.itens, dados.restaG) === null) setQtd(valido);
  }, [dados]);

  const mudar = (id: string, n: number) => {
    const novo = { ...qtd, [id]: n };
    if (n <= 0) delete novo[id];
    setQtd(novo);
    gravar(K_CARRINHO, novo);
  };
  const limpar = () => {
    setQtd({});
    gravar(K_CARRINHO, {});
  };
  const pode = (id: string) => !!dados && erroCarrinho({ ...qtd, [id]: (qtd[id] ?? 0) + 1 }, dados.itens, dados.restaG) === null;

  // Pedir de novo: só o que ainda tem. Com os dados de entrega salvos e completos, vai direto pra revisão.
  const repetir = (itens: Carrinho) => {
    if (!dados) return;
    const valido = Object.fromEntries(Object.entries(itens).filter(([id, q]) => q > 0 && dados.itens.some((i) => i.id === id && !i.esgotado)));
    setQtd(valido);
    gravar(K_CARRINHO, valido);
    const salvo = { ...clienteVazio, ...ler<Partial<DadosCliente>>(K_CLIENTE), trocoPara: 0, obs: "" };
    const completo = !Object.keys(errosCliente(salvo, 0)).length && (!dados.entrega.ativo || !!salvo.local);
    const tudo = Object.keys(valido).length === Object.keys(itens).filter((id) => itens[id] > 0).length;
    setEtapa(!tudo || erroCarrinho(valido, dados.itens, dados.restaG) ? "carrinho" : completo ? "revisao" : "dados");
  };

  return (
    <C.Provider value={{ dados, aberta, qtd, mudar, limpar, pode, abrir: () => setEtapa("carrinho"), repetir }}>
      {children}
      <BarraPedido />
      {etapa && dados && <Checkout etapa={etapa} setEtapa={setEtapa} dados={dados} />}
    </C.Provider>
  );
}

export function StatusLoja({ className }: { className?: string }) {
  const { dados, aberta } = usePedido();
  return (
    <p className={cx("flex items-start gap-2 text-lg font-semibold", className)}>
      <span className={cx("mt-2.5 size-2.5 shrink-0 rounded-full", aberta ? "bg-lucro" : "bg-creme-3")} aria-hidden />
      {aberta ? "Aberto agora. Bora pedir?" : dados ? textoFechado(dados.loja) : "A gente abre sexta, sábado e domingo, no almoço."}
    </p>
  );
}

// Pedido recente feito neste aparelho: atalho pro acompanhamento.
export function UltimoPedido() {
  const [p, setP] = useState<{ numero: number; rastreio: string } | null>(null);
  useEffect(() => {
    const [u] = ler<{ numero: number; rastreio: string; em: number }[]>(K_PEDIDOS) ?? [];
    if (u && Date.now() - u.em < 12 * 3_600_000) setP(u);
  }, []);
  if (!p) return null;
  return (
    <a href={`/pedido/${p.rastreio}`} className="flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius-ctl)] border border-milho px-4 text-lg font-semibold text-milho active:bg-tisna">
      Acompanhar seu pedido nº {p.numero}
      <IconSeta className="size-5" />
    </a>
  );
}

// Último pedido feito neste aparelho: um toque e vai pra revisão com os mesmos itens.
export function PedirDeNovo() {
  const { dados, aberta, repetir } = usePedido();
  const [u, setU] = useState<Carrinho | null>(null);
  useEffect(() => setU(ler<Carrinho>(K_ULTIMO)), []);
  const itens = u && dados ? dados.itens.filter((i) => u[i.id] > 0 && !i.esgotado) : [];
  if (!u || !aberta || !itens.length) return null;
  return (
    <button onClick={() => repetir(u)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-[var(--radius-ctl)] bg-brasa px-4 py-3 text-left active:bg-tisna">
      <span>
        <span className="block text-sm font-semibold uppercase tracking-[0.14em] text-milho">Pedir de novo</span>
        <span className="block text-lg leading-snug">{itens.map((i) => `${u[i.id]}× ${i.nome}`).join(", ")}</span>
      </span>
      <IconSeta className="size-5 shrink-0 text-milho" />
    </button>
  );
}

export function BotaoAbertura() {
  const { aberta } = usePedido();
  return (
    <a href="#cardapio" className={cx(botaoPrincipal, "min-h-16 w-full text-2xl")}>
      {aberta ? "Pedir agora" : "Ver o cardápio"}
    </a>
  );
}

const peso = (g: number) => (g >= 1000 && g % 1000 === 0 ? `${g / 1000} kg` : `${g} g`);

export function Cardapio() {
  const { dados } = usePedido();
  if (!dados || !dados.itens.length)
    return (
      <p className="text-xl text-creme-2">
        O cardápio não carregou agora.{" "}
        <a href={linkWhatsapp("Oi! Quero fazer um pedido.")} className="font-semibold text-milho underline underline-offset-4">
          Pede pelo WhatsApp
        </a>
        .
      </p>
    );
  const de = (c: ItemSite["categoria"]) => dados.itens.filter((i) => i.categoria === c);
  return (
    <div className="flex flex-col gap-10">
      <ul className="flex flex-col gap-3">
        {de("feijoada").map((i) => (
          <li key={i.id} className={cx("flex flex-col gap-4 rounded-[var(--radius-card)] bg-brasa p-5", i.esgotado && "opacity-60")}>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-display text-[32px] uppercase leading-[0.95]">{i.nome}</h3>
              <p className="text-lg text-creme-2">
                {peso(i.pesoG)} de feijoada{ACOMPANHAMENTOS[i.id] ? <>, com {ACOMPANHAMENTOS[i.id]}</> : ehSimples(i) && ", sem arroz e sem farofa"}.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="num font-display text-[30px] leading-none text-milho">{brl(i.preco)}</span>
              <Quantidade i={i} grande />
            </div>
          </li>
        ))}
      </ul>
      <Grupo titulo="Pra completar" itens={de("adicional")} />
      <Grupo titulo="Pra beber" itens={de("bebida")} />
    </div>
  );
}

function Grupo({ titulo, itens }: { titulo: string; itens: ItemSite[] }) {
  if (!itens.length) return null;
  return (
    <section className="flex flex-col gap-1">
      <h3 className="font-display text-[28px] uppercase leading-none">{titulo}</h3>
      <ul className="divide-y divide-linha">
        {itens.map((i) => (
          <li key={i.id} className={cx("flex min-h-[72px] items-center gap-3 py-2", i.esgotado && "opacity-60")}>
            <span className="flex-1">
              <span className="block text-xl font-semibold leading-tight">{i.nome}</span>
              <span className="num text-lg text-creme-2">{brl(i.preco)}</span>
            </span>
            <Quantidade i={i} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Quantidade({ i, grande }: { i: ItemSite; grande?: boolean }) {
  const { aberta, qtd, mudar, pode } = usePedido();
  const q = qtd[i.id] ?? 0;
  if (i.esgotado) return <span className="rounded-full border border-creme-3 px-3 py-1 text-sm font-bold uppercase tracking-wider text-creme-2">Esgotou</span>;
  if (!aberta && !q) return null;
  if (!q)
    return grande ? (
      <Botao onClick={() => mudar(i.id, 1)} disabled={!pode(i.id)} className="border border-creme/30">
        <IconMais className="size-5" /> Adicionar
      </Botao>
    ) : (
      <button onClick={() => mudar(i.id, 1)} disabled={!pode(i.id)} aria-label={`Adicionar ${i.nome}`} className="grid size-12 place-items-center rounded-full border border-creme/30 bg-tisna text-creme active:bg-linha disabled:opacity-40">
        <IconMais className="size-5" />
      </button>
    );
  return (
    <div className="flex items-center gap-1 rounded-full bg-creme p-1 text-carvao" role="group" aria-label={`Quantidade de ${i.nome}`}>
      <button onClick={() => mudar(i.id, q - 1)} aria-label={`Tirar um ${i.nome}`} className="grid size-10 place-items-center rounded-full active:bg-carvao/10">
        <IconMenos className="size-5" />
      </button>
      <span className="num min-w-6 text-center font-display text-xl" aria-live="polite">{q}</span>
      <button onClick={() => mudar(i.id, q + 1)} disabled={!pode(i.id)} aria-label={`Mais um ${i.nome}`} className="grid size-10 place-items-center rounded-full active:bg-carvao/10 disabled:opacity-30">
        <IconMais className="size-5" />
      </button>
    </div>
  );
}

function BarraPedido() {
  const { dados, aberta, qtd, abrir } = usePedido();
  const n = Object.values(qtd).reduce((s, q) => s + q, 0);
  // Carrinho vazio: a abertura já tem o "Pedir agora"; a barra só entra depois de rolar.
  const [rolou, setRolou] = useState(false);
  useEffect(() => {
    const ver = () => setRolou(window.scrollY > window.innerHeight * 0.6);
    ver();
    window.addEventListener("scroll", ver, { passive: true });
    return () => window.removeEventListener("scroll", ver);
  }, []);
  if (aberta && !n && !rolou) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-linha bg-carvao/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
        {!aberta ? (
          <>
            <span className="flex-1 leading-tight text-creme-2">{dados ? textoFechado(dados.loja) : "Pede pelo WhatsApp."}</span>
            <a href={linkWhatsapp("Oi! Quero saber quando vocês abrem.")} className="inline-flex min-h-12 items-center rounded-[var(--radius-ctl)] bg-tisna px-4 font-semibold uppercase tracking-wide active:bg-linha">
              WhatsApp
            </a>
          </>
        ) : n && dados ? (
          <>
            <span className="flex-1">
              <span className="block text-sm font-semibold uppercase tracking-[0.14em] text-creme-3">
                {n} {n === 1 ? "item" : "itens"}
              </span>
              <span className="num font-display text-[26px] leading-none">{brl(subtotal(qtd, dados.itens))}</span>
            </span>
            <button onClick={abrir} className={botaoPrincipal}>
              Ver pedido
            </button>
          </>
        ) : (
          <a href="#cardapio" className={cx(botaoPrincipal, "w-full")}>
            Pedir agora
          </a>
        )}
      </div>
    </div>
  );
}

const clienteVazio: DadosCliente = {
  nome: "", telefone: "", pagamento: "pix", trocoPara: 0, obs: "",
  endereco: { rua: "", numero: "", bairro: "", complemento: "", referencia: "" },
};
const TITULO: Record<Etapa, string> = { carrinho: "Seu pedido", dados: "Pra onde vai?", revisao: "Confere e manda" };
const ORDEM: Etapa[] = ["carrinho", "dados", "revisao"];

function Checkout({ etapa, setEtapa, dados }: { etapa: Etapa; setEtapa: (e: Etapa | null) => void; dados: DadosSite }) {
  const { qtd, limpar } = usePedido();
  const [cliente, setCliente] = useState<DadosCliente>(() => ({ ...clienteVazio, ...ler<Partial<DadosCliente>>(K_CLIENTE), trocoPara: 0, obs: "" }));
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const sub = subtotal(qtd, dados.itens);
  const ativo = dados.entrega.ativo; // taxa por distância (com mapa) ou fixa
  const taxa = useTaxa(cliente.local, ativo);
  const total = sub + (ativo ? (taxa.estado === "ok" ? taxa.taxa : 0) : dados.taxaEntrega);
  const erroEntrega = !ativo || taxa.estado === "ok" ? "" : MSG_ENTREGA[taxa.estado] ?? (taxa.estado === "erro" ? taxa.msg : "");
  const setLocal = useCallback((local?: Ponto) => setCliente((c) => ({ ...c, local })), []);
  const preencher = useCallback((campos: Partial<Endereco>, local?: Ponto) => setCliente((c) => ({ ...c, endereco: { ...c.endereco, ...campos }, ...(local && { local }) })), []);
  const erroItens = erroCarrinho(qtd, dados.itens, dados.restaG);
  const erros = errosCliente(cliente, total);
  const passo = ORDEM.indexOf(etapa);

  useEffect(() => {
    iniciarAppCheck().catch(() => {}); // o reCAPTCHA começa a observar já no carrinho
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setEtapa(null);
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", esc);
    };
  }, [setEtapa]);
  const painel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    painel.current?.scrollTo(0, 0);
  }, [etapa]);

  const voltar = () => setEtapa(passo ? ORDEM[passo - 1] : null);
  const seguir = () => {
    if (etapa === "carrinho") return setEtapa("dados");
    setTentou(true);
    if (Object.keys(erros).length || erroEntrega) return;
    gravar(K_CLIENTE, { nome: cliente.nome, telefone: cliente.telefone, endereco: cliente.endereco, local: cliente.local, pagamento: cliente.pagamento }); // troco e recado valem só pra este pedido
    setEtapa("revisao");
  };
  const enviar = async () => {
    setEnviando(true);
    setErro("");
    try {
      let falhaToken = "";
      const token = await tokenAppCheck().catch((e: Error) => {
        falhaToken = e.message.slice(0, 200); // vai pro log do servidor: diagnóstico da proteção
        return null;
      });
      const r = await fetch("/api/pedido", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { "x-firebase-appcheck": token } : { "x-appcheck-falha": encodeURIComponent(falhaToken || "sem chave") }) },
        body: JSON.stringify({ itens: qtd, cliente }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro ?? "Não consegui enviar agora.");
      gravar(K_PEDIDOS, [{ numero: j.numero, rastreio: j.rastreio, em: Date.now() }, ...(ler<object[]>(K_PEDIDOS) ?? [])].slice(0, 10));
      gravar(K_ULTIMO, qtd);
      limpar();
      window.location.href = `/pedido/${j.rastreio}`;
    } catch (e) {
      setErro(`${(e as Error).message} Tenta de novo ou chama a gente no WhatsApp.`);
      setEnviando(false);
    }
  };

  return (
    <div ref={painel} role="dialog" aria-modal aria-label={TITULO[etapa]} className="fixed inset-0 z-50 overflow-y-auto bg-carvao">
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(8px,env(safe-area-inset-top))]">
        <header className="flex items-center gap-2 py-2">
          <button onClick={voltar} aria-label={passo ? "Voltar" : "Fechar"} className="-ml-3 grid size-12 place-items-center rounded-full text-creme-2 active:bg-tisna">
            {passo ? <IconSeta className="size-6 rotate-180" /> : <IconFechar className="size-6" />}
          </button>
          <span className="flex-1 text-sm font-semibold uppercase tracking-[0.14em] text-creme-3">Passo {passo + 1} de 3</span>
          {passo > 0 && (
            <button onClick={() => setEtapa(null)} aria-label="Fechar" className="-mr-3 grid size-12 place-items-center rounded-full text-creme-2 active:bg-tisna">
              <IconFechar className="size-6" />
            </button>
          )}
        </header>
        <h2 className="mb-6 mt-2 font-display text-[44px] uppercase leading-[0.95]">{TITULO[etapa]}</h2>

        <div className="flex flex-1 flex-col gap-6 pb-6">
          {etapa === "carrinho" && <EtapaCarrinho dados={dados} />}
          {etapa === "dados" && (
            <EtapaDados cliente={cliente} setCliente={setCliente} erros={tentou ? erros : {}} total={total}>
              {ativo && (
                <EnderecoEntrega
                  e={dados.entrega}
                  end={cliente.endereco}
                  local={cliente.local}
                  setLocal={setLocal}
                  preencher={preencher}
                  erros={tentou ? erros : {}}
                  taxa={taxa}
                  linkFora={linkFora(cliente.endereco, dados.itens.filter((i) => qtd[i.id]).map((i) => `${qtd[i.id]}× ${i.nome}`))}
                  aviso={tentou ? erroEntrega : ""}
                />
              )}
            </EtapaDados>
          )}
          {etapa === "revisao" && <EtapaRevisao dados={dados} cliente={cliente} />}
          <Totais sub={sub} dados={dados} taxa={taxa} />
          {etapa === "carrinho" && erroItens && sub > 0 && <p role="alert" className="font-semibold text-prejuizo">{erroItens}</p>}
          {erro && <p role="alert" className="font-semibold text-prejuizo">{erro}</p>}
        </div>

        <div className="sticky bottom-0 -mx-4 border-t border-linha bg-carvao px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          {etapa === "revisao" ? (
            <button onClick={enviar} disabled={enviando || !!erroItens || !!erroEntrega} className={cx(botaoPrincipal, "w-full disabled:opacity-50")}>
              {enviando ? "Enviando…" : `Enviar pedido · ${brl(total)}`}
            </button>
          ) : (
            <button onClick={seguir} disabled={!!erroItens} className={cx(botaoPrincipal, "w-full disabled:opacity-50")}>
              {etapa === "carrinho" ? "Continuar" : "Revisar pedido"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EtapaCarrinho({ dados }: { dados: DadosSite }) {
  const { qtd } = usePedido();
  const itens = dados.itens.filter((i) => qtd[i.id]);
  if (!itens.length) return <p className="text-xl text-creme-2">O carrinho tá vazio. Volta e escolhe sua feijoada.</p>;
  return (
    <ul className="divide-y divide-linha">
      {itens.map((i) => (
        <li key={i.id} className="flex min-h-[72px] items-center gap-3 py-2">
          <span className="flex-1">
            <span className="block text-xl font-semibold leading-tight">{i.nome}</span>
            <span className="num text-creme-2">{brl(i.preco * qtd[i.id])}</span>
          </span>
          <Quantidade i={i} />
        </li>
      ))}
    </ul>
  );
}

const MSG_ENTREGA: Partial<Record<Taxa["estado"], string>> = {
  "sem-pino": "Marca no mapa onde é a entrega.",
  calculando: "Espera só a entrega terminar de calcular.",
  fora: "Esse endereço fica fora da nossa área de entrega.",
};

// Mensagem pronta pro WhatsApp quando o endereço passa da área de entrega.
function linkFora(e: Endereco, itens: string[]) {
  const end = `${e.rua}, ${e.numero}${e.complemento ? ` (${e.complemento})` : ""} - ${e.bairro}, ${e.cidade || "João Pessoa"}${e.cep ? `, CEP ${e.cep}` : ""}`;
  return linkWhatsapp(`Oi! Quero fazer um pedido pelo site, mas meu endereço ficou fora da área de entrega:\n${end}\n\nPedido: ${itens.join(", ")}\n\nDá pra combinar a entrega?`);
}

function Totais({ sub, dados, taxa }: { sub: number; dados: DadosSite; taxa: Taxa }) {
  if (!sub) return null;
  const ativo = dados.entrega.ativo;
  const entrega = !ativo ? dados.taxaEntrega : taxa.estado === "ok" ? taxa.taxa : null;
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-brasa p-4">
      <p className="flex justify-between text-lg text-creme-2">
        <span>Itens</span>
        <span className="num">{brl(sub)}</span>
      </p>
      <p className="flex justify-between text-lg text-creme-2">
        <span>{!ativo ? "Entrega até 4 km" : "Entrega"}</span>
        <span className="num">{entrega !== null ? taxaTexto(entrega) : taxa.estado === "calculando" ? "calculando…" : "pelo endereço"}</span>
      </p>
      <p className="flex items-baseline justify-between border-t border-linha pt-2">
        <span className="text-lg font-semibold uppercase tracking-wider">Total</span>
        <span className="num font-display text-[30px] leading-none text-milho">{brl(sub + (entrega ?? 0))}</span>
      </p>
      {!ativo ? (
        <p className="text-creme-3">Mora a mais de 4 km? A gente confirma o valor da entrega no WhatsApp antes de sair.</p>
      ) : (
        entrega === null && <p className="text-creme-3">{resumoFaixas(dados.entrega.faixas)}. A taxa sai pelo seu endereço.</p>
      )}
    </div>
  );
}

function Entrada({ rotulo, valor, onChange, erro, opcional, ...p }: { rotulo: string; valor: string; onChange: (v: string) => void; erro?: string; opcional?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <Campo rotulo={opcional ? `${rotulo} (opcional)` : rotulo}>
      {(id) => (
        <>
          <input id={id} value={valor} onChange={(e) => onChange(e.target.value)} aria-invalid={!!erro} aria-describedby={erro ? `${id}-erro` : undefined} className={cx(estiloCampo, erro && "border-prejuizo")} {...p} />
          {erro && <span id={`${id}-erro`} className="font-semibold text-prejuizo">{erro}</span>}
        </>
      )}
    </Campo>
  );
}

function EtapaDados({ cliente: c, setCliente, erros, total, children }: { cliente: DadosCliente; setCliente: (c: DadosCliente) => void; erros: Partial<Record<CampoCliente, string>>; total: number; children?: React.ReactNode }) {
  const end = (k: keyof DadosCliente["endereco"]) => (v: string) => setCliente({ ...c, endereco: { ...c.endereco, [k]: v } });
  return (
    <>
      <Entrada rotulo="Seu nome" valor={c.nome} onChange={(nome) => setCliente({ ...c, nome })} erro={erros.nome} autoComplete="name" maxLength={60} />
      <Entrada rotulo="WhatsApp" valor={mascaraTelefone(c.telefone)} onChange={(v) => setCliente({ ...c, telefone: v.replace(/\D/g, "").slice(0, 11) })} erro={erros.telefone} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(83) 9…" />
      {children ?? (
        <>
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <Entrada rotulo="Rua" valor={c.endereco.rua} onChange={end("rua")} erro={erros.rua} autoComplete="address-line1" maxLength={100} />
        <Entrada rotulo="Número" valor={c.endereco.numero} onChange={end("numero")} erro={erros.numero} maxLength={10} />
      </div>
      <Entrada rotulo="Bairro" valor={c.endereco.bairro} onChange={end("bairro")} erro={erros.bairro} autoComplete="address-level3" maxLength={60} />
      <Entrada rotulo="Complemento" opcional valor={c.endereco.complemento} onChange={end("complemento")} erro={erros.complemento} autoComplete="address-line2" placeholder="Apto, bloco, casa" maxLength={60} />
      <Entrada rotulo="Ponto de referência" opcional valor={c.endereco.referencia} onChange={end("referencia")} erro={erros.referencia} maxLength={100} />
        </>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold uppercase tracking-wider text-creme-3">Pagamento na entrega</span>
        <Chips rotulo="Pagamento na entrega" opcoes={PAGAMENTOS} valor={c.pagamento} onChange={(pagamento) => setCliente({ ...c, pagamento, trocoPara: 0 })} />
        {erros.pagamento && <span className="font-semibold text-prejuizo">{erros.pagamento}</span>}
      </div>
      {c.pagamento === "dinheiro" && (
        <div className="flex flex-col gap-1">
          <Valor rotulo="Troco para quanto?" valor={c.trocoPara} onChange={(trocoPara) => setCliente({ ...c, trocoPara })} />
          <span className={erros.trocoPara ? "font-semibold text-prejuizo" : "text-creme-3"}>{erros.trocoPara ?? `Total de ${brl(total)}. Deixa zerado se não precisar de troco.`}</span>
        </div>
      )}
      <Campo rotulo="Recado pra gente (opcional)">
        {(id) => <textarea id={id} value={c.obs} onChange={(e) => setCliente({ ...c, obs: e.target.value })} maxLength={300} rows={3} className={cx(estiloCampo, "py-2")} />}
      </Campo>
      <p className="text-creme-3">Seu nome, WhatsApp e endereço servem só pra entrega. Ficam guardados neste aparelho pro próximo pedido.</p>
    </>
  );
}

function EtapaRevisao({ dados, cliente: c }: { dados: DadosSite; cliente: DadosCliente }) {
  const { qtd } = usePedido();
  const e = c.endereco;
  return (
    <>
      <ul className="flex flex-col gap-1 text-lg">
        {dados.itens.filter((i) => qtd[i.id]).map((i) => (
          <li key={i.id} className="flex justify-between gap-3">
            <span>{qtd[i.id]}× {i.nome}</span>
            <span className="num text-creme-2">{brl(qtd[i.id] * i.preco)}</span>
          </li>
        ))}
      </ul>
      <Bloco titulo="Entrega">
        {c.nome} · {mascaraTelefone(c.telefone)}
        <br />
        {e.rua}, {e.numero}
        {e.complemento && ` · ${e.complemento}`} · {e.bairro}
        {e.cidade && ` · ${e.cidade}`}
        {e.referencia && <><br />Referência: {e.referencia}</>}
      </Bloco>
      <Bloco titulo="Pagamento na entrega">
        {NOME_PAGAMENTO[c.pagamento]}
        {c.pagamento === "dinheiro" && (c.trocoPara ? ` · troco para ${brl(c.trocoPara)}` : " · sem troco")}
      </Bloco>
      {c.obs.trim() && <Bloco titulo="Recado">{c.obs}</Bloco>}
    </>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold uppercase tracking-[0.14em] text-creme-3">{titulo}</span>
      <p className="text-lg leading-snug">{children}</p>
    </div>
  );
}
