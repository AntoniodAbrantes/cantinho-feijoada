// Roda com o emulador: npm run test:regras
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";

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

  it("pedido inválido é recusado", async () => {
    await assertFails(setDoc(doc(dono(), "pedidos/p3"), { ...pedido, canal: "balcao" }));
    await assertFails(setDoc(doc(dono(), "pedidos/p4"), { ...pedido, status: "sumiu" }));
  });
});
