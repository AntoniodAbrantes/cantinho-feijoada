import { describe, expect, it } from "vitest";
import { premissas, produtos } from "@/data/seed";
import { itemDoProduto } from "./calc";
import { FIDELIDADE_PADRAO, cartao, fraseCartao, itemPremio, normalizarTelefone } from "./fidelidade";
import { avisoTempo, textoTempo } from "./tempo";
import type { Canal, Pedido, StatusPedido } from "./types";

const prod = (id: string) => produtos.find((p) => p.id === id)!;
let t = 0;
const ped = (itens: [string, number][], status: StatusPedido = "entregue", canal: Canal = "whatsapp", extra: Partial<Pedido> = {}) =>
  ({ canal, status, criadoEm: ++t, itens: itens.map(([id, q]) => itemDoProduto(prod(id), canal === "ifood" ? "ifood" : "whatsapp", q, 30000, premissas)), ...extra }) as Pedido;
const cinco = (itens: [string, number][]) => Array.from({ length: 5 }, () => ped(itens));
const c = (pedidos: Pedido[], ajustes: { qtd: number }[] = []) => cartao(pedidos, ajustes.map((a) => ({ ...a, em: 0, motivo: "" })), produtos, FIDELIDADE_PADRAO);

describe("Selo do Cantinho", () => {
  it("prêmio acompanha o tamanho: individual, para 2 e para 3", () => {
    expect(c(cinco([["feijoada-individual", 1]]))).toMatchObject({ selos: 5, liberados: 1, premio: { id: "feijoada-individual" } });
    expect(c(cinco([["feijoada-2", 1]])).premio?.id).toBe("feijoada-2");
    expect(c(cinco([["feijoada-3", 1]])).premio?.id).toBe("feijoada-3");
  });

  it("misturou tamanhos: vale o menor; pedido com várias feijoadas vale a maior dele", () => {
    const mix = [ped([["feijoada-3", 1]]), ped([["feijoada-2", 1]]), ped([["feijoada-individual", 1]]), ped([["feijoada-individual", 1]]), ped([["feijoada-individual", 1]])];
    expect(c(mix).premio?.id).toBe("feijoada-individual");
    const varias = cinco([["feijoada-individual", 2], ["feijoada-2", 1]]);
    expect(c(varias).premio?.id).toBe("feijoada-2");
  });

  it("simples de 2 conta como tamanho para 2 (prêmio é a completa)", () => {
    expect(c(cinco([["simples-2", 1]])).premio?.id).toBe("feijoada-2");
  });

  it("não contam: iFood, cancelado, sem feijoada, ainda não entregue e o próprio resgate", () => {
    const quatro = cinco([["feijoada-2", 1]]).slice(0, 4);
    const fora = [
      ped([["feijoada-2", 1]], "entregue", "ifood"),
      ped([["feijoada-2", 1]], "cancelado"),
      ped([["coca-lata", 2]]),
      ped([["feijoada-2", 1]], "saiu"),
    ];
    const r = c([...quatro, ...fora]);
    expect(r).toMatchObject({ selos: 4, liberados: 0, aCaminho: 1 });
    expect(fraseCartao(r)).toBe("Tá quase, visse? Falta 1 selo pra sua feijoada para 2 de presente!");
  });

  it("troca de tamanho: diferença pelos preços cadastrados do site", () => {
    expect(c(cinco([["feijoada-individual", 1]])).trocas).toEqual([
      { id: "feijoada-2", nome: "Feijoada para 2 pessoas", diferenca: 3500 },
      { id: "feijoada-3", nome: "Feijoada para 3 pessoas", diferenca: 5500 },
    ]);
    expect(c(cinco([["feijoada-2", 1]])).trocas).toEqual([{ id: "feijoada-3", nome: "Feijoada para 3 pessoas", diferenca: 2000 }]);
  });

  it("resgate com troca: item de presente com custo real, preço = diferença, e zera o cartão", () => {
    const base = cinco([["feijoada-individual", 1]]);
    const r = itemPremio(c(base), "feijoada-2", produtos, "whatsapp", 30000, premissas)!;
    expect(r.resgate).toEqual({ premioId: "feijoada-individual", premioNome: "Feijoada individual", escolhidoId: "feijoada-2", escolhidoNome: "Feijoada para 2 pessoas", troca: 3500 });
    expect(r.item).toMatchObject({ produtoId: "feijoada-2", preco: 3500, brinde: true, custo: itemDoProduto(prod("feijoada-2"), "whatsapp", 1, 30000, premissas).custo });
    const resgate = ped([["coca-lata", 1]], "entregue", "whatsapp", { fidelidade: r.resgate });
    resgate.itens.push(r.item);
    expect(c([...base, resgate])).toMatchObject({ selos: 0, liberados: 0, resgates: 1 });
    // Resgate cancelado devolve o presente.
    expect(c([...base, { ...resgate, status: "cancelado" }]).liberados).toBe(1);
    // Troca pra tamanho que não existe: recusa.
    expect(itemPremio(c(base), "coca-lata", produtos, "whatsapp", 30000, premissas)).toBeNull();
    expect(itemPremio(c(base.slice(1)), "feijoada-individual", produtos, "whatsapp", 30000, premissas)).toBeNull();
  });

  it("ajuste manual soma ou tira selo", () => {
    expect(c(cinco([["feijoada-2", 1]]).slice(0, 3), [{ qtd: 2 }]).liberados).toBe(1);
    expect(c(cinco([["feijoada-2", 1]]).slice(0, 3), [{ qtd: -5 }]).selos).toBe(0);
    expect(fraseCartao(c([]))).toBe("Seu primeiro selo começa hoje!");
  });

  it("telefone: um cliente só, com ou sem 55, máscara e o 9", () => {
    for (const v of ["(83) 99824-4099", "5583998244099", "+55 83 99824-4099", "083998244099", "8398244099"]) expect(normalizarTelefone(v)).toBe("83998244099");
  });
});

it("tempo de entrega: texto e aviso só quando tá puxado", () => {
  expect(textoTempo({ min: 40, max: 60 })).toBe("40–60 min");
  expect(avisoTempo({ modo: "normal", min: 40, max: 60, em: 0 })).toBeNull();
  expect(avisoTempo({ modo: "movimentado", min: 60, max: 80, em: 0 })).toBe("Hoje tá movimentado por aqui! Seu pedido chega em uns 60–80 min.");
});
