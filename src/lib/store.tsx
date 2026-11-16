"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, increment, onSnapshot, orderBy, query, writeBatch, type WriteBatch } from "firebase/firestore";
import { baixaEstoque, calcPedido } from "./calc";
import { chave, consumo, diferenca, faltando, nomeCurto } from "./estoque";
import { diaLocal } from "./format";
import { sincronizarPotes } from "./potes";
import { fb } from "./firebase";
import { conta, type Baixa, type ConfigEstoque, type Embalagem, type Loja, type Cenario, type Compra, type Pedido, type Premissas, type Producao, type Produto, type StatusPedido } from "./types";

// set faz merge; delete apaga. Tudo num lote só: atômico e funciona offline.
export type Op = { caminho: string; dados?: object; apagar?: boolean };
export const novoId = (colecao: string) => doc(collection(fb().db, colecao)).id;

// Recusa com motivo e taxa de entrega ajustada no aceite (pedido do site mais longe que 4 km).
export type Extra = Partial<Pick<Pedido, "taxaEntrega" | "motivoRecusa" | "previsaoEm">>;

// O que dá pra mudar num pedido já lançado (data, canal, status e dados do site ficam).
export type Edicao = Pick<Pedido, "itens" | "desconto" | "taxaEntrega" | "custoEntrega" | "pagamento" | "taxas" | "cliente" | "bairro" | "obs">;

type Aviso = { id: number; texto: string; desfazer?: () => void; erro?: boolean };
type Alerta = { id: number; texto: string };

interface Dados {
  produtos: Produto[];
  premissas: Premissas | null;
  producoes: Producao[];
  pedidos: Pedido[];
  compras: Compra[];
  cenarios: Cenario[];
  embalagens: Embalagem[];
  baixas: Baixa[];
  estoque: ConfigEstoque | null; // null = estoque de potes ainda não começou
}

interface Store extends Omit<Dados, "premissas"> {
  premissas: Premissas;
  carregando: boolean;
  erro: string | null;
  salvarPedido: (p: Omit<Pedido, "id">) => string;
  removerPedido: (id: string) => void;
  mudarStatus: (p: Pedido, status: StatusPedido, extra?: Extra) => void;
  editarPedido: (antes: Pedido, mudancas: Edicao) => void;
  lote: (ops: Op[]) => void;
  aviso: Aviso | null;
  avisar: (texto: string, desfazer?: () => void, erro?: boolean) => void;
  alerta: Alerta | null; // falta de pote: aparece junto do aviso, sem tomar o lugar dele
  fecharAlerta: () => void;
}

const Ctx = createContext<Store | null>(null);
const vazio: Dados = { produtos: [], premissas: null, producoes: [], pedidos: [], compras: [], cenarios: [], embalagens: [], baixas: [], estoque: null };
const COLECOES = 9;

// Mexe no estoque das bebidas do pedido dentro do mesmo lote (atômico e funciona offline).
function estoqueNoLote(b: WriteBatch, itens: Pedido["itens"], sinal: 1 | -1) {
  for (const [id, q] of Object.entries(baixaEstoque(itens))) b.update(doc(fb().db, "produtos", id), { estoque: increment(sinal * q) });
}

export function StoreProvider({ usuario, children }: { usuario: User; children: React.ReactNode }) {
  const [dados, setDados] = useState<Dados>(vazio);
  const [prontas, setProntas] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [alerta, setAlerta] = useState<Alerta | null>(null);
  const [pendentes, setPendentes] = useState(false); // pedido salvo aqui que o servidor ainda não confirmou
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const timerAlerta = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dadosRef = useRef(dados);
  dadosRef.current = dados;
  const pedidosRef = useRef(dados.pedidos); // o "desfazer" roda depois do render que tinha a lista antiga
  pedidosRef.current = dados.pedidos;

  const avisar = useCallback((texto: string, desfazer?: () => void, erro?: boolean) => {
    clearTimeout(timer.current);
    setAviso({ id: Date.now(), texto, desfazer, erro });
    timer.current = setTimeout(() => setAviso(null), erro ? 8000 : 5000);
  }, []);

  const fecharAlerta = useCallback(() => setAlerta(null), []);

  // Avisa na hora se o pedido vai deixar algum pote negativo. Não bloqueia: a baixa acontece igual.
  const conferirPotes = useCallback((depois: Pick<Pedido, "itens" | "status" | "dia"> | null, id: string) => {
    const d = dadosRef.current;
    if (!d.estoque || !depois || depois.dia < d.estoque.desde) return;
    const antes = d.baixas.find((b) => b.id === id)?.potes ?? {};
    const falta = faltando(diferenca(antes, consumo(depois, d.produtos, d.estoque, diaLocal())), d.embalagens);
    if (!falta.length) return;
    clearTimeout(timerAlerta.current);
    setAlerta({ id: Date.now(), texto: `Faltou pote: ${falta.map((f) => `${nomeCurto(f.e)} fica em ${f.fica}`).join(", ")}. O pedido vale igual; dá entrada quando comprar.` });
    timerAlerta.current = setTimeout(() => setAlerta(null), 10000);
  }, []);

  useEffect(() => {
    const { db } = fb();
    const vistas = new Set<string>();
    const pronto = (k: string) => {
      if (!vistas.has(k)) {
        vistas.add(k);
        setProntas(vistas.size);
      }
    };
    const falhou = (e: Error) => setErro(e.message);
    const lista = <K extends keyof Dados>(k: K, q: ReturnType<typeof query>) =>
      onSnapshot(
        q,
        (s) => {
          setDados((d) => ({ ...d, [k]: s.docs.map((x) => ({ ...(x.data() as object), id: x.id })) }));
          pronto(k);
        },
        falhou,
      );
    const c = (n: string) => collection(db, n);
    const subs = [
      lista("produtos", query(c("produtos"), orderBy("ordem"))),
      lista("embalagens", query(c("embalagens"), orderBy("ordem"))),
      lista("baixas", query(c("baixas"))),
      lista("producoes", query(c("producoes"), orderBy("data", "desc"))),
      // shortcut: lê todos os pedidos (poucos milhares por ano); filtrar por data no servidor se passar de ~10 mil.
      // Com metadados: a baixa de potes espera o servidor confirmar o pedido.
      onSnapshot(
        query(c("pedidos"), orderBy("criadoEm", "desc")),
        { includeMetadataChanges: true },
        (s) => {
          setPendentes(s.metadata.hasPendingWrites);
          if (s.docChanges().length || !vistas.has("pedidos")) setDados((d) => ({ ...d, pedidos: s.docs.map((x) => ({ ...(x.data() as Pedido), id: x.id })) }));
          pronto("pedidos");
        },
        falhou,
      ),
      lista("compras", query(c("compras"), orderBy("data", "desc"))),
      lista("cenarios", query(c("cenarios"), orderBy("ordem"))),
      onSnapshot(
        doc(db, "config", "estoque"),
        (s) => {
          setDados((d) => ({ ...d, estoque: (s.data() as ConfigEstoque) ?? null }));
          pronto("estoque");
        },
        falhou,
      ),
      onSnapshot(
        doc(db, "config", "premissas"),
        (s) => {
          setDados((d) => ({ ...d, premissas: (s.data() as Premissas) ?? null }));
          pronto("premissas");
        },
        falhou,
      ),
    ];
    return () => subs.forEach((u) => u());
  }, [usuario.uid]);

  const commit = useCallback(
    (b: WriteBatch) =>
      b.commit().catch((e: Error) => avisar(`Não consegui salvar: ${e.message}. Tenta de novo.`, undefined, true)),
    [avisar],
  );

  // Sem await: offline o commit só resolve quando a rede volta, mas a tela já mostra o pedido.
  const salvarPedido = useCallback(
    (p: Omit<Pedido, "id">) => {
      const { db } = fb();
      const ref = doc(collection(db, "pedidos"));
      const b = writeBatch(db);
      b.set(ref, p);
      estoqueNoLote(b, p.itens, -1);
      commit(b);
      conferirPotes(p, ref.id);
      return ref.id;
    },
    [commit, conferirPotes],
  );

  const removerPedido = useCallback(
    (id: string) => {
      const { db } = fb();
      const alvo = pedidosRef.current.find((p) => p.id === id);
      const b = writeBatch(db);
      b.delete(doc(db, "pedidos", id));
      if (alvo && conta(alvo.status)) estoqueNoLote(b, alvo.itens, 1);
      if (alvo?.rastreio) b.delete(doc(db, "rastreio", alvo.rastreio));
      commit(b);
    },
    [commit],
  );

  // Bebida baixa quando o pedido passa a contar (aceite, reabrir) e volta quando deixa (cancelar).
  // O cliente do site acompanha pelo rastreio: muda junto, no mesmo lote.
  const mudarStatus = useCallback(
    (p: Pedido, status: StatusPedido, extra: Extra = {}) => {
      const { db } = fb();
      const b = writeBatch(db);
      b.update(doc(db, "pedidos", p.id), { status, ...extra, ...(p.status === "novo" && status === "feito" && { aceitoEm: Date.now() }) });
      const taxa = extra.taxaEntrega !== undefined && { taxaEntrega: extra.taxaEntrega, total: calcPedido({ ...p, ...extra }).cobrado };
      if (p.rastreio) b.update(doc(db, "rastreio", p.rastreio), { status, ...(extra.motivoRecusa !== undefined && { motivoRecusa: extra.motivoRecusa }), ...(extra.previsaoEm !== undefined && { previsaoEm: extra.previsaoEm }), ...taxa });
      if (conta(p.status) && !conta(status)) estoqueNoLote(b, p.itens, 1);
      if (!conta(p.status) && conta(status)) estoqueNoLote(b, p.itens, -1);
      commit(b);
      conferirPotes({ ...p, status }, p.id);
    },
    [commit, conferirPotes],
  );

  // Bebida: só a diferença entre antes e depois, e só se o pedido conta.
  const editarPedido = useCallback(
    (antes: Pedido, m: Edicao) => {
      const { db } = fb();
      const b = writeBatch(db);
      b.update(doc(db, "pedidos", antes.id), m);
      if (conta(antes.status)) {
        const de = baixaEstoque(antes.itens);
        const para = baixaEstoque(m.itens);
        for (const id of new Set([...Object.keys(de), ...Object.keys(para)])) {
          const d = (para[id] ?? 0) - (de[id] ?? 0);
          if (d) b.update(doc(db, "produtos", id), { estoque: increment(-d) });
        }
      }
      if (antes.rastreio)
        b.update(doc(db, "rastreio", antes.rastreio), {
          itens: m.itens.map((i) => ({ nome: i.nome, qtd: i.qtd, preco: i.preco })),
          taxaEntrega: m.taxaEntrega,
          total: calcPedido({ ...antes, ...m }).cobrado,
          pagamento: m.pagamento,
        });
      commit(b);
      conferirPotes({ ...antes, ...m }, antes.id);
    },
    [commit, conferirPotes],
  );

  const lote = useCallback(
    (ops: Op[]) => {
      const { db } = fb();
      const b = writeBatch(db);
      for (const o of ops) {
        if (o.apagar) b.delete(doc(db, o.caminho));
        else b.set(doc(db, o.caminho), o.dados!, { merge: true });
      }
      commit(b);
    },
    [commit],
  );

  const carregando = prontas < COLECOES || !dados.premissas;

  // Baixa de potes: todo pedido cuja chave mudou (novo, aceito, editado, cancelado, apagado, encomenda
  // que chegou no dia) vai pra transação. Pega também o que foi lançado offline ou em outro aparelho.
  const andando = useRef(new Set<string>());
  useEffect(() => {
    const { estoque, pedidos, baixas, produtos } = dados;
    if (carregando || pendentes || !estoque || !navigator.onLine) return;
    const hoje = diaLocal();
    const feitas = new Map(baixas.map((b) => [b.id, b.chave]));
    const ids = [
      ...pedidos.filter((p) => p.dia >= estoque.desde && (feitas.get(p.id) ?? "") !== chave(p, hoje)).map((p) => p.id),
      ...baixas.filter((b) => b.chave && !pedidos.some((p) => p.id === b.id)).map((b) => b.id),
    ];
    for (const id of ids) {
      if (andando.current.has(id)) continue;
      andando.current.add(id);
      sincronizarPotes(fb().db, id, produtos, estoque, hoje)
        .catch((e: Error) => console.warn("potes", id, e.message))
        .finally(() => andando.current.delete(id));
    }
  }, [dados, carregando, pendentes]);
  const valor = useMemo<Store>(
    () => ({ ...dados, premissas: dados.premissas!, carregando, erro, salvarPedido, removerPedido, mudarStatus, editarPedido, lote, aviso, avisar, alerta, fecharAlerta }),
    [dados, carregando, erro, salvarPedido, removerPedido, mudarStatus, editarPedido, lote, aviso, avisar, alerta, fecharAlerta],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx)!;

// config/loja ao vivo (só as telas que mexem com o site usam). Sem documento = fechada.
export function useLoja() {
  const [loja, setLoja] = useState<Loja | null>(null);
  useEffect(() => onSnapshot(doc(fb().db, "config", "loja"), (s) => setLoja((s.data() as Loja | undefined) ?? { modo: "fechada", horarios: {} })), []);
  return loja;
}

export function useUsuario() {
  const [u, setU] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(fb().auth, setU), []);
  return u; // undefined = ainda verificando
}
