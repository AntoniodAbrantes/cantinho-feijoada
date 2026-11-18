// Consulta pública dos selos pelo WhatsApp. Devolve só contagem e tamanhos: sem nome, endereço nem pedidos.
import { adminDb } from "./admin";
import { Recusa, hash } from "./pedido";
import { FIDELIDADE_PADRAO, cartao, normalizarTelefone, telefoneValido } from "../fidelidade";
import type { AjusteSelo, ConfigFidelidade, Pedido, Produto } from "../types";

// shortcut: limite chutado; quem digita o número algumas vezes passa longe disso.
export const LIMITE_CONSULTA_HORA = 30;

const lista = <T>(s: FirebaseFirestore.QuerySnapshot) => s.docs.map((d) => ({ ...d.data(), id: d.id }) as T);

export function lerConsulta(corpo: unknown) {
  const t = (corpo as { telefone?: unknown } | null)?.telefone;
  const tel = typeof t === "string" && t.length <= 30 ? normalizarTelefone(t) : "";
  if (!telefoneValido(tel)) throw new Recusa(400, "Confere o WhatsApp com DDD.");
  return tel;
}

export async function consultarSelos(tel: string, ip: string, agora = Date.now()) {
  const db = adminDb();
  const hora = Math.floor(agora / 3_600_000);
  const lim = db.doc(`limites/selo-${hash(ip)}`);
  await db.runTransaction(async (t) => {
    const s = await t.get(lim);
    const n = s.get("hora") === hora ? (s.get("n") as number) : 0;
    if (n >= LIMITE_CONSULTA_HORA) throw new Recusa(429, "Muita consulta daqui. Tenta de novo daqui a pouco.");
    t.set(lim, { hora, n: n + 1 });
  });
  const [cfgS, cliS, pedS, prodS] = await Promise.all([
    db.doc("config/fidelidade").get(),
    db.doc(`fidelidade/${tel}`).get(),
    db.collection("pedidos").where("telefone", "==", tel).get(),
    db.collection("produtos").get(),
  ]);
  const cfg = (cfgS.data() as ConfigFidelidade | undefined) ?? FIDELIDADE_PADRAO;
  if (!cfg.ativo) return { ativo: false as const };
  const { selos, meta, liberados, premio, trocas, aCaminho } = cartao(lista<Pedido>(pedS), (cliS.get("ajustes") as AjusteSelo[] | undefined) ?? [], lista<Produto>(prodS), cfg);
  return { ativo: true as const, selos, meta, liberados, premio, trocas, aCaminho };
}
export type Selos = Awaited<ReturnType<typeof consultarSelos>>;
