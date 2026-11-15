import { describe, expect, it } from "vitest";
import { arredondarKm, linhaRetaKm, naRegiao, resumoFaixas, taxaPorKm } from "./entrega";

const faixas = [
  { ateKm: 3, taxa: 0 },
  { ateKm: 6, taxa: 800 },
  { ateKm: 10, taxa: 1200 },
];
const regiao = { sul: -7.4, norte: -6.94, oeste: -35.2, leste: -34.78 };

describe("taxa de entrega", () => {
  it("escolhe a faixa, com o limite dentro da faixa de baixo", () => {
    expect(taxaPorKm(0, faixas)).toBe(0);
    expect(taxaPorKm(3, faixas)).toBe(0);
    expect(taxaPorKm(3.1, faixas)).toBe(800);
    expect(taxaPorKm(10, faixas)).toBe(1200);
  });

  it("passou da última faixa: fora da área", () => {
    expect(taxaPorKm(10.1, faixas)).toBeNull();
  });

  it("linha reta: Ponta do Seixas até o Busto de Tamandaré, uns 6,3 km", () => {
    const km = linhaRetaKm({ lat: -7.1486, lng: -34.7955 }, { lat: -7.1061, lng: -34.8327 });
    expect(km).toBeGreaterThan(6.1);
    expect(km).toBeLessThan(6.4);
  });

  it("arredonda pra uma casa", () => {
    expect(arredondarKm(4.04)).toBe(4);
    expect(arredondarKm(4.06)).toBe(4.1);
  });

  it("aceita só ponto dentro da região metropolitana", () => {
    expect(naRegiao({ lat: -7.12, lng: -34.86 }, regiao)).toBe(true);
    expect(naRegiao({ lat: -8.05, lng: -34.88 }, regiao)).toBe(false); // Recife
    expect(naRegiao({ lat: NaN, lng: -34.86 }, regiao)).toBe(false);
  });

  it("resume as faixas pro cliente", () => {
    expect(resumoFaixas([{ ateKm: 4, taxa: 0 }])).toBe("Grátis até 4 km");
  });
});
