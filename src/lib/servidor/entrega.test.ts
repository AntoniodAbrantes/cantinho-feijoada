import { describe, expect, it, vi } from "vitest";
import { ENTREGA } from "@/data/entrega";
import { calcularEntrega, entregaSite } from "./entrega";

const config = { ...ENTREGA, origem: { lat: -7.1, lng: -34.84 }, faixas: [{ ateKm: 3, taxa: 0 }, { ateKm: 6, taxa: 800 }] };

describe("calcularEntrega", () => {
  it("sem origem configurada não calcula (vale a taxa fixa)", async () => {
    expect(await calcularEntrega({ lat: -7.12, lng: -34.86 }, { ...config, origem: null })).toBeNull();
  });

  it("usa a rota de carro e aplica a faixa", async () => {
    const rota = vi.fn().mockResolvedValue(4.26);
    expect(await calcularEntrega({ lat: -7.13, lng: -34.86 }, config, rota)).toEqual({ km: 4.3, taxa: 800, rota: true });
  });

  it("rota falhou: linha reta × 1,3", async () => {
    const rota = vi.fn().mockRejectedValue(new Error("fora do ar"));
    const r = await calcularEntrega({ lat: -7.12, lng: -34.84 }, config, rota); // 2,22 km ao sul
    expect(r).toMatchObject({ km: 2.9, taxa: 0, rota: false });
  });

  it("longe demais: fora da área", async () => {
    const rota = vi.fn().mockResolvedValue(12);
    expect((await calcularEntrega({ lat: -7.2, lng: -34.85 }, config, rota))?.taxa).toBeNull();
  });

  it("pino fora da região metropolitana nem consulta a rota", async () => {
    const rota = vi.fn();
    expect((await calcularEntrega({ lat: -8.05, lng: -34.88 }, config, rota))?.taxa).toBeNull();
    expect(rota).not.toHaveBeenCalled();
  });

  it("o site recebe as faixas, nunca a origem", () => {
    expect(JSON.stringify(entregaSite(config))).not.toContain('"lat":-7.1,');
    expect(entregaSite(config)).not.toHaveProperty("origem");
    expect(entregaSite(config).ativo).toBe(true);
  });
});
