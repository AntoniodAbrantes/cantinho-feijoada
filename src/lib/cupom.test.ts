import { describe, expect, it } from "vitest";
import { calcPedido } from "./calc";
import { descontoDoCupom, erroCupom, normalizarCupom, usosDoCupom } from "./cupom";
import type { Cupom, PedidoBase } from "./types";

const cupom = (o: Partial<Cupom> = {}): Cupom => ({ id: "FEIJAO10", tipo: "pct", valor: 1000, ativo: true, umPorTelefone: false, criadoEm: 0, ...o });
const ok = { hoje: "2026-11-20", itens: 7490, usos: 0, usosDoTelefone: 0, comPresente: false };

describe("cupom", () => {
  it("código: sem espaço, acento nem minúscula", () => {
    expect(normalizarCupom(" feijão 10 ")).toBe("FEIJAO10");
  });
  it("vale e vira desconto nos itens (a entrega fica de fora)", () => {
    expect(erroCupom(cupom(), ok)).toBeNull();
    const base: PedidoBase = { canal: "site", itens: [{ produtoId: "x", nome: "x", categoria: "feijoada", qtd: 1, preco: 7490, custo: 0, maoDeObra: 0, pesoG: 750 }], desconto: descontoDoCupom(cupom()), taxaEntrega: 800, custoEntrega: 0, pagamento: "pix", taxas: { comissaoBp: 0, onlineBp: 0, base: "liquido", pagamentoBp: 0 } };
    expect(calcPedido(base)).toMatchObject({ desconto: 749, cobrado: 7490 - 749 + 800 });
    expect(calcPedido({ ...base, desconto: descontoDoCupom(cupom({ tipo: "valor", valor: 1000 })) }).desconto).toBe(1000);
  });
  it("recusa: inexistente, desligado, vencido, esgotado, já usado, abaixo do mínimo e com presente", () => {
    expect(erroCupom(null, ok)).toMatch(/não existe/);
    expect(erroCupom(cupom({ ativo: false }), ok)).toMatch(/não existe/);
    expect(erroCupom(cupom({ validoAte: "2026-11-19" }), ok)).toBe("Esse cupom venceu em 19/11/2026.");
    expect(erroCupom(cupom({ validoAte: "2026-11-20" }), ok)).toBeNull(); // vale o dia todo
    expect(erroCupom(cupom({ limiteUsos: 3 }), { ...ok, usos: 3 })).toMatch(/esgotou/);
    expect(erroCupom(cupom({ umPorTelefone: true }), { ...ok, usosDoTelefone: 1 })).toMatch(/já usou/);
    expect(erroCupom(cupom({ umPorTelefone: false }), { ...ok, usosDoTelefone: 1 })).toBeNull();
    expect(erroCupom(cupom({ minimo: 8000 }), ok)).toMatch(/a partir de R\$\s80,00/);
    expect(erroCupom(cupom(), { ...ok, comPresente: true })).toMatch(/não junta/);
  });
  it("cancelado devolve o uso", () => {
    expect(usosDoCupom([{ cupom: "FEIJAO10", status: "entregue" }, { cupom: "FEIJAO10", status: "cancelado" }, { status: "feito" }], "FEIJAO10")).toBe(1);
  });
});
