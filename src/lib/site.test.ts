import { describe, expect, it } from "vitest";
import { cardapioSite, erroCarrinho, errosCliente, mascaraTelefone, subtotal, type DadosCliente } from "./site";
import { produtos } from "@/data/seed";
import type { Pedido } from "./types";

const reserva = (itens: [string, number][], status: Pedido["status"] = "novo") =>
  ({ status, itens: itens.map(([produtoId, qtd]) => ({ produtoId, qtd, categoria: produtoId.startsWith("coca") ? "bebida" : "feijoada" })) }) as Pedido;

describe("cardápio do site", () => {
  const itens = cardapioSite(produtos, [], 24000);
  it("com o preço do WhatsApp, inclusive a feijoada simples", () => {
    expect(itens.map((i) => [i.id, i.preco])).toContainEqual(["simples-2", 6990]);
    expect(itens.map((i) => [i.id, i.preco])).toContainEqual(["feijoada-2", 7490]);
    expect(itens.map((i) => [i.id, i.preco])).toContainEqual(["coca-1l", 1200]);
  });
  it("feijoada esgota quando a panela não tem o peso dela", () => {
    const pouca = cardapioSite(produtos, [], 700);
    expect(pouca.find((i) => i.id === "feijoada-individual")!.esgotado).toBe(false);
    expect(pouca.find((i) => i.id === "feijoada-2")!.esgotado).toBe(true);
    expect(pouca.find((i) => i.id === "feijoada-3")!.esgotado).toBe(true);
  });
  it("bebida desconta o que está reservado em pedido novo; aceito já saiu do estoque", () => {
    const c = cardapioSite(produtos, [reserva([["coca-1l", 2]]), reserva([["coca-1l", 5]], "feito")], 24000);
    expect(c.find((i) => i.id === "coca-1l")!.livre).toBe(4);
    const zero = cardapioSite(produtos, [reserva([["coca-1l", 6]])], 24000);
    expect(zero.find((i) => i.id === "coca-1l")!.esgotado).toBe(true);
  });
  it("esgotado à mão", () => {
    const c = cardapioSite(produtos.map((p) => (p.id === "adicional-arroz" ? { ...p, esgotadoSite: true } : p)), [], 24000);
    expect(c.find((i) => i.id === "adicional-arroz")!.esgotado).toBe(true);
  });
});

describe("carrinho", () => {
  const itens = cardapioSite(produtos, [], 1500);
  it("aceita pedido normal e soma o subtotal", () => {
    const q = { "feijoada-2": 1, "coca-lata": 2 };
    expect(erroCarrinho(q, itens, 1500)).toBeNull();
    expect(subtotal(q, itens)).toBe(7490 + 1200);
  });
  it("recusa vazio, item fora do cardápio, esgotado, excesso e quantidade quebrada", () => {
    expect(erroCarrinho({}, itens, 1500)).toMatch(/vazio/);
    const semSimples = cardapioSite(produtos.map((p) => (p.id === "simples-2" ? { ...p, ativoSite: false } : p)), [], 24000);
    expect(erroCarrinho({ "simples-2": 1 }, semSimples, 1500)).toMatch(/saiu do cardápio/);
    expect(erroCarrinho({ "feijoada-3": 1, "feijoada-individual": 2 }, itens, 1500)).toMatch(/Não tem feijoada/);
    expect(erroCarrinho({ "adicional-arroz": 11 }, itens, 1500)).toMatch(/até 10/);
    expect(erroCarrinho({ "adicional-arroz": 10, "adicional-farofa": 10, "adicional-couve": 1 }, itens, 1500)).toMatch(/até 20 itens/);
    expect(erroCarrinho({ "coca-1l": 7 }, itens, 1500)).toMatch(/só restam 6/);
    expect(erroCarrinho({ "adicional-arroz": 1.5 }, itens, 1500)).toMatch(/inválida/);
    expect(erroCarrinho({ "adicional-arroz": -1 }, itens, 1500)).toMatch(/inválida/);
  });
});

describe("dados do cliente", () => {
  const ok: DadosCliente = {
    nome: "Maria",
    telefone: "83998244099",
    endereco: { rua: "Av. Cabo Branco", numero: "100", bairro: "Cabo Branco", complemento: "", referencia: "" },
    pagamento: "dinheiro",
    trocoPara: 0,
    obs: "",
  };
  it("aceita o básico e troco maior que o total", () => {
    expect(errosCliente(ok, 9490)).toEqual({});
    expect(errosCliente({ ...ok, trocoPara: 10000 }, 9490)).toEqual({});
  });
  it("aponta cada campo errado", () => {
    const e = errosCliente({ ...ok, nome: " ", telefone: "8399", endereco: { ...ok.endereco, rua: "", numero: "", bairro: "" }, trocoPara: 5000 }, 9490);
    expect(Object.keys(e).sort()).toEqual(["bairro", "nome", "numero", "rua", "telefone", "trocoPara"]);
    expect(errosCliente({ ...ok, pagamento: "ifood_online" as never }, 0).pagamento).toBeDefined();
    expect(errosCliente({ ...ok, obs: "x".repeat(301) }, 0).obs).toBeDefined();
  });
  it("máscara do WhatsApp", () => {
    expect(mascaraTelefone("83998244099")).toBe("(83) 99824-4099");
    expect(mascaraTelefone("8332211234")).toBe("(83) 3221-1234");
    expect(mascaraTelefone("839")).toBe("(83) 9");
    expect(mascaraTelefone("(83) 99824-40991234")).toBe("(83) 99824-4099");
  });
});
