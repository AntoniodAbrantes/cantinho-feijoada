// Roda com o emulador: npm run test:regras
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

let env: RulesTestEnvironment;
const pedido = { canal: "whatsapp", status: "feito", itens: [] };

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-cantinho", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
afterAll(() => env.cleanup());

const dono = () => env.authenticatedContext("antonio", { dono: true }).firestore();
const outro = () => env.authenticatedContext("intruso", { email: "x@y.com" }).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

describe("regras", () => {
  it("dono lê e escreve", async () => {
    await assertSucceeds(setDoc(doc(dono(), "produtos/x"), { nome: "x" }));
    await assertSucceeds(getDoc(doc(dono(), "produtos/x")));
    await assertSucceeds(setDoc(doc(dono(), "pedidos/p1"), pedido));
    await assertSucceeds(deleteDoc(doc(dono(), "pedidos/p1")));
  });

  it("sem login não lê nem escreve", async () => {
    await assertFails(getDoc(doc(anonimo(), "produtos/x")));
    await assertFails(setDoc(doc(anonimo(), "compras/c"), { valor: 1 }));
  });

  it("outra conta logada não lê nem escreve", async () => {
    await assertFails(getDoc(doc(outro(), "config/premissas")));
    await assertFails(setDoc(doc(outro(), "pedidos/p2"), pedido));
  });

  it("aceita canal site e os status novos", async () => {
    await assertSucceeds(setDoc(doc(dono(), "pedidos/s1"), { ...pedido, canal: "site", status: "novo" }));
    await assertSucceeds(setDoc(doc(dono(), "pedidos/s1"), { ...pedido, canal: "site", status: "saiu" }));
  });

  it("rastreio: qualquer um lê pelo token, ninguém lista nem escreve sem ser dono", async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "rastreio/tokenlongo"), { status: "novo" }));
    await assertSucceeds(getDoc(doc(anonimo(), "rastreio/tokenlongo")));
    await assertFails(getDocs(collection(anonimo(), "rastreio")));
    await assertFails(setDoc(doc(anonimo(), "rastreio/tokenlongo"), { status: "entregue" }));
    await assertFails(setDoc(doc(outro(), "rastreio/outro"), { status: "novo" }));
    await assertSucceeds(setDoc(doc(dono(), "rastreio/tokenlongo"), { status: "feito" }, { merge: true }));
  });

  it("site público não escreve pedido nem lê limites e contador", async () => {
    await assertFails(setDoc(doc(anonimo(), "pedidos/falso"), { ...pedido, canal: "site", status: "novo" }));
    await assertFails(getDoc(doc(anonimo(), "pedidos/s1")));
    await assertFails(getDoc(doc(anonimo(), "limites/ip-x")));
    await assertFails(getDoc(doc(anonimo(), "config/contador")));
  });

  it("pedido inválido é recusado", async () => {
    await assertFails(setDoc(doc(dono(), "pedidos/p3"), { ...pedido, canal: "balcao" }));
    await assertFails(setDoc(doc(dono(), "pedidos/p4"), { ...pedido, status: "sumiu" }));
  });
});
