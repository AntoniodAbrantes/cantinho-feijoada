import { describe, expect, it } from "vitest";
import { cargaInicial, configEstoque, embalagens, receitas } from "@/data/estoque";
import { chave, consumo, daPraMais, diferenca, faltando, nivel, somar } from "./estoque";
import type { Embalagem, ItemPedido, Pedido, StatusPedido } from "./types";

const produtos = Object.entries(receitas).map(([id, potes]) => ({ id, potes }));
const item = (produtoId: string, qtd: number) => ({ produtoId, qtd }) as ItemPedido;
const ped = (itens: [string, number][], status: StatusPedido = "entregue", dia = "2026-11-14") => ({ itens: itens.map(([id, q]) => item(id, q)), status, dia }) as Pick<Pedido, "itens" | "status" | "dia">;
const hoje = "2026-11-16";
const semSaco = { ...configEstoque, sacoPorPedido: false };

describe("consumo", () => {
  it("segue a receita × quantidade e põe um saco por pedido", () => {
    expect(consumo(ped([["feijoada-2", 2], ["coca-lata", 3]]), produtos, configEstoque, hoje)).toEqual({ "pote-750": 2, "pote-500": 2, "pote-250": 4, "saco-entrega": 1 });
  });
  it("saco desligado, adicional sem pote definido e bebida não tiram nada", () => {
    expect(consumo(ped([["adicional-arroz", 2], ["coca-1l", 1]]), produtos, semSaco, hoje)).toEqual({});
  });
  it("novo, cancelado e encomenda de dia futuro não tiram pote", () => {
    expect(consumo(ped([["feijoada-3", 1]], "novo"), produtos, configEstoque, hoje)).toEqual({});
    expect(consumo(ped([["feijoada-3", 1]], "cancelado"), produtos, configEstoque, hoje)).toEqual({});
    expect(consumo(ped([["feijoada-3", 1]], "feito", "2026-12-30"), produtos, configEstoque, hoje)).toEqual({});
    expect(consumo(ped([["feijoada-3", 1]], "feito", "2026-12-30"), produtos, configEstoque, "2026-12-30")).toEqual({ "pote-1000": 1, "pote-750": 1, "pote-250": 2, "saco-entrega": 1 });
  });
});

describe("chave", () => {
  it("só muda quando muda o que tira pote", () => {
    const a = ped([["feijoada-2", 1], ["coca-lata", 1]]);
    expect(chave(a, hoje)).toBe(chave({ ...a, status: "saiu" }, hoje));
    expect(chave(a, hoje)).toBe(chave({ ...a, itens: [...a.itens].reverse() }, hoje));
    expect(chave(a, hoje)).not.toBe(chave(ped([["feijoada-2", 2], ["coca-lata", 1]]), hoje));
    expect(chave({ ...a, status: "cancelado" }, hoje)).toBe("");
    expect(chave(null, hoje)).toBe("");
  });
});

it("diferenca e somar", () => {
  expect(diferenca({ a: 2, b: 1 }, { a: 2, c: 3 })).toEqual({ b: -1, c: 3 });
  expect(somar([{ a: 1 }, { a: 2, b: 1 }])).toEqual({ a: 3, b: 1 });
});

it("nivel: vermelho abaixo do mínimo ou negativo, amarelo até 50% acima", () => {
  expect(nivel({ quantidade: 14, minimo: 15 })).toBe("abaixo");
  expect(nivel({ quantidade: -2, minimo: 0 })).toBe("abaixo");
  expect(nivel({ quantidade: 15, minimo: 15 })).toBe("perto");
  expect(nivel({ quantidade: 23, minimo: 15 })).toBe("ok");
});

describe("daPraMais", () => {
  const com = (q: Record<string, number>): Embalagem[] => embalagens.map((e) => ({ ...e, quantidade: q[e.id] ?? 0 }));
  it("o pote que acaba primeiro manda", () => {
    const r = daPraMais({ id: "feijoada-2", potes: receitas["feijoada-2"] }, com({ "pote-750": 9, "pote-500": 20, "pote-250": 9, "saco-entrega": 50 }), configEstoque);
    expect(r.n).toBe(4); // 250 ml: 2 por pedido
    expect(r.gargalo?.id).toBe("pote-250");
  });
  it("estoque negativo vale zero", () => {
    expect(daPraMais({ id: "feijoada-individual", potes: receitas["feijoada-individual"] }, com({ "pote-250": -2, "pote-500": 9, "saco-entrega": 9 }), configEstoque)).toMatchObject({ n: 0, gargalo: { id: "pote-250" } });
  });
});

it("faltando: avisa o pote que fica negativo", () => {
  const lista = embalagens.map((e) => ({ ...e, quantidade: e.id === "pote-750" ? 1 : 10 }));
  expect(faltando({ "pote-750": 2, "pote-500": 2 }, lista).map((x) => [x.e.id, x.fica])).toEqual([["pote-750", -1]]);
});

// Uma combinação de vendas de 13 a 15/11 que fecha com a contagem do dono: a receita e a conta estão coerentes.
it("carga inicial: compra − vendas bate com a contagem", () => {
  const vendas = [
    ped([["feijoada-individual", 1]]),
    ped([["simples-individual", 1]]),
    ped([["feijoada-2", 8], ["coca-lata", 2]]),
    ped([["simples-2", 2]]),
    ped([["feijoada-3", 3], ["adicional-farofa", 1]]),
    ped([["simples-3", 3]]),
    ped([["feijoada-3", 5]], "cancelado"),
  ];
  const usado = somar(vendas.map((v) => consumo(v, produtos, configEstoque, hoje)));
  for (const [id, q] of Object.entries(cargaInicial.esperado)) expect([id, (cargaInicial.compra[id] ?? 0) - (usado[id] ?? 0)]).toEqual([id, q]);
  expect(usado["pote-100"] ?? usado["pote-145"]).toBeUndefined(); // fora do controle
});
