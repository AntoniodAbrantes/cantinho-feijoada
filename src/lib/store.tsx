"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, increment, onSnapshot, orderBy, query, writeBatch, type WriteBatch } from "firebase/firestore";
import { baixaEstoque } from "./calc";
import { fb } from "./firebase";
import type { Cenario, Compra, Pedido, Premissas, Producao, Produto, StatusPedido } from "./types";

// set faz merge; delete apaga. Tudo num lote só: atômico e funciona offline.
export type Op = { caminho: string; dados?: object; apagar?: boolean };
export const novoId = (colecao: string) => doc(collection(fb().db, colecao)).id;

type Aviso = { id: number; texto: string; desfazer?: () => void; erro?: boolean };

interface Dados {
  produtos: Produto[];
  premissas: Premissas | null;
  producoes: Producao[];
  pedidos: Pedido[];
  compras: Compra[];
  cenarios: Cenario[];
}

interface Store extends Omit<Dados, "premissas"> {
  premissas: Premissas;
  carregando: boolean;
  erro: string | null;
  salvarPedido: (p: Omit<Pedido, "id">) => string;
  removerPedido: (id: string) => void;
  mudarStatus: (p: Pedido, status: StatusPedido) => void;
  lote: (ops: Op[]) => void;
  aviso: Aviso | null;
  avisar: (texto: string, desfazer?: () => void, erro?: boolean) => void;
}

const Ctx = createContext<Store | null>(null);
const vazio: Dados = { produtos: [], premissas: null, producoes: [], pedidos: [], compras: [], cenarios: [] };
const COLECOES = 6;

// Mexe no estoque das bebidas do pedido dentro do mesmo lote (atômico e funciona offline).
function estoqueNoLote(b: WriteBatch, itens: Pedido["itens"], sinal: 1 | -1) {
  for (const [id, q] of Object.entries(baixaEstoque(itens))) b.update(doc(fb().db, "produtos", id), { estoque: increment(sinal * q) });
}

export function StoreProvider({ usuario, children }: { usuario: User; children: React.ReactNode }) {
  const [dados, setDados] = useState<Dados>(vazio);
  const [prontas, setProntas] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pedidosRef = useRef(dados.pedidos); // o "desfazer" roda depois do render que tinha a lista antiga
  pedidosRef.current = dados.pedidos;

  const avisar = useCallback((texto: string, desfazer?: () => void, erro?: boolean) => {
    clearTimeout(timer.current);
    setAviso({ id: Date.now(), texto, desfazer, erro });
    timer.current = setTimeout(() => setAviso(null), erro ? 8000 : 5000);
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
      lista("producoes", query(c("producoes"), orderBy("data", "desc"))),
      // shortcut: lê todos os pedidos (poucos milhares por ano); filtrar por data no servidor se passar de ~10 mil.
      lista("pedidos", query(c("pedidos"), orderBy("criadoEm", "desc"))),
      lista("compras", query(c("compras"), orderBy("data", "desc"))),
      lista("cenarios", query(c("cenarios"), orderBy("ordem"))),
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
      return ref.id;
    },
    [commit],
  );

  const removerPedido = useCallback(
    (id: string) => {
      const { db } = fb();
      const alvo = pedidosRef.current.find((p) => p.id === id);
      const b = writeBatch(db);
      b.delete(doc(db, "pedidos", id));
      if (alvo && alvo.status !== "cancelado") estoqueNoLote(b, alvo.itens, 1);
      commit(b);
    },
    [commit],
  );

  // Cancelar devolve as bebidas ao estoque; tirar do cancelado baixa de novo.
  const mudarStatus = useCallback(
    (p: Pedido, status: StatusPedido) => {
      const { db } = fb();
      const b = writeBatch(db);
      b.update(doc(db, "pedidos", p.id), { status });
      if (status === "cancelado" && p.status !== "cancelado") estoqueNoLote(b, p.itens, 1);
      if (status !== "cancelado" && p.status === "cancelado") estoqueNoLote(b, p.itens, -1);
      commit(b);
    },
    [commit],
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
  const valor = useMemo<Store>(
    () => ({ ...dados, premissas: dados.premissas!, carregando, erro, salvarPedido, removerPedido, mudarStatus, lote, aviso, avisar }),
    [dados, carregando, erro, salvarPedido, removerPedido, mudarStatus, lote, aviso, avisar],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx)!;

export function useUsuario() {
  const [u, setU] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(fb().auth, setU), []);
  return u; // undefined = ainda verificando
}
