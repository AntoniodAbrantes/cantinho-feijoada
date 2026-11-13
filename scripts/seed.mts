// Carrega os dados iniciais. Pode rodar de novo: só cria o que não existe, nunca sobrescreve.
// Uso: npm run seed            (produção, precisa de GOOGLE_APPLICATION_CREDENTIALS)
//      npm run seed:emulador   (emulador, com pedidos de exemplo)
import { FieldValue } from "firebase-admin/firestore";
import * as seed from "../src/data/seed";
import { exemplos } from "../src/data/exemplos";
import { baixaEstoque } from "../src/lib/calc";
import { db, noEmulador } from "./admin.mts";

const comExemplos = process.argv.includes("--exemplos");
if (comExemplos && !noEmulador) throw new Error("Pedidos de exemplo só no emulador.");

let criados = 0;
let pulados = 0;
async function criar(caminho: string, dados: object) {
  try {
    await db.doc(caminho).create(dados);
    criados++;
  } catch (e) {
    if ((e as { code?: number }).code !== 6) throw e; // 6 = ALREADY_EXISTS
    pulados++;
  }
}
const semId = (x: { id: string }) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== "id"));

await criar("config/premissas", seed.premissas);
for (const p of seed.produtos) await criar(`produtos/${p.id}`, semId(p));
for (const p of seed.producoes) await criar(`producoes/${p.id}`, semId(p));
for (const c of seed.compras) await criar(`compras/${c.id}`, semId(c));
for (const c of seed.cenarios) await criar(`cenarios/${c.id}`, semId(c));

if (comExemplos && (await db.collection("pedidos").limit(1).get()).empty) {
  for (const p of exemplos()) {
    const b = db.batch();
    b.create(db.doc(`pedidos/${p.id}`), semId(p));
    for (const [id, q] of Object.entries(baixaEstoque(p.itens))) b.update(db.doc(`produtos/${id}`), { estoque: FieldValue.increment(-q) });
    await b.commit();
    criados++;
  }
}

console.log(`Pronto: ${criados} criados, ${pulados} já existiam.`);
