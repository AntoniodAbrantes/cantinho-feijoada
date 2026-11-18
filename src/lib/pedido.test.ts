import { describe, expect, it } from "vitest";
import { lembretes } from "./pedido";
import type { Pedido } from "./types";

const enc = (o: Partial<Pedido>) => ({ id: "x", status: "feito", dia: "2026-11-21", criadoEm: Date.parse("2026-11-10T12:00:00-03:00"), ...o }) as Pedido;
const em = (s: string) => Date.parse(`${s}-03:00`);

describe("lembretes de encomenda", () => {
  it("começa às 8h da véspera (Fortaleza) e segue no dia da entrega", () => {
    expect(lembretes([enc({})], em("2026-11-20T07:59:00"))).toHaveLength(0);
    expect(lembretes([enc({})], em("2026-11-20T08:00:00"))).toHaveLength(1);
    expect(lembretes([enc({})], em("2026-11-21T15:00:00"))).toHaveLength(1);
    expect(lembretes([enc({})], em("2026-11-22T08:00:00"))).toHaveLength(0);
  });
  it("visto, cancelado, entregue ou venda do próprio dia não avisa", () => {
    const t = em("2026-11-20T10:00:00");
    expect(lembretes([enc({ lembreteVistoEm: 1 }), enc({ status: "cancelado" }), enc({ status: "entregue" }), enc({ criadoEm: em("2026-11-21T09:00:00") })], t)).toHaveLength(0);
  });
});
