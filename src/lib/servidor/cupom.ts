// Prévia do cupom no checkout. Só diz se vale e quanto; a rota do pedido confere de novo, na transação.
import { adminDb } from "./admin";
import { Recusa, hash } from "./pedido";
import { erroCupom, normalizarCupom, usosDoCupom } from "../cupom";
import { normalizarTelefone, telefoneValido } from "../fidelidade";
import { diaLocal } from "../format";
import type { Cupom, Pedido } from "../types";

// shortcut: limite chutado; contra quem fica tentando adivinhar código.
export const LIMITE_CUPOM_HORA = 20;

export function lerPreviaCupom(corpo: unknown) {
  const b = corpo as { codigo?: unknown; telefone?: unknown; itens?: unknown } | null;
  const codigo = typeof b?.codigo === "string" && b.codigo.length <= 40 ? normalizarCupom(b.codigo) : "";
  if (!codigo) throw new Recusa(400, "Digita o código do cupom.");
  const tel = typeof b?.telefone === "string" && b.telefone.length <= 30 ? normalizarTelefone(b.telefone) : "";
  const itens = typeof b?.itens === "number" && Number.isSafeInteger(b.itens) && b.itens >= 0 ? b.itens : 0;
  return { codigo, telefone: telefoneValido(tel) ? tel : "", itens };
}

export async function previaCupom({ codigo, telefone, itens }: ReturnType<typeof lerPreviaCupom>, ip: string, agora = Date.now()) {
  const db = adminDb();
  const hora = Math.floor(agora / 3_600_000);
  const lim = db.doc(`limites/cupom-${hash(ip)}`);
  await db.runTransaction(async (t) => {
    const s = await t.get(lim);
    const n = s.get("hora") === hora ? (s.get("n") as number) : 0;
    if (n >= LIMITE_CUPOM_HORA) throw new Recusa(429, "Muita tentativa de cupom daqui. Tenta de novo daqui a pouco.");
    t.set(lim, { hora, n: n + 1 });
  });
  const [cS, usosS] = await Promise.all([db.doc(`cupons/${codigo}`).get(), db.collection("pedidos").where("cupom", "==", codigo).get()]);
  const c = cS.exists ? ({ ...cS.data(), id: cS.id } as Cupom) : null;
  const usos = usosS.docs.map((d) => d.data() as Pedido);
  const erro = erroCupom(c, { hoje: diaLocal(agora), itens, usos: usosDoCupom(usos, codigo), usosDoTelefone: telefone ? usosDoCupom(usos.filter((p) => p.telefone === telefone), codigo) : 0, comPresente: false });
  if (erro) throw new Recusa(409, erro);
  return { codigo, tipo: c!.tipo, valor: c!.valor, minimo: c!.minimo ?? 0 };
}
