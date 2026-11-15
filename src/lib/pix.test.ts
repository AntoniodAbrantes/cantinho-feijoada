import { describe, expect, it } from "vitest";
import { crc16, pixCopiaECola } from "./pix";

describe("pix", () => {
  it("CRC16-CCITT padrão", () => expect(crc16("123456789")).toBe("29B1"));

  it("bate com o exemplo do manual do BR Code", () => {
    expect(pixCopiaECola({ chave: "123e4567-e12b-12d1-a456-426655440000", nome: "Fulano de Tal", cidade: "BRASILIA" })).toBe(
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D",
    );
  });

  it("valor em reais, nome sem acento e cidade cortada", () => {
    const c = pixCopiaECola({ chave: "68429872000103", nome: "Cantinho da Feijoada", cidade: "João Pessoa", valor: 8390, txid: "PEDIDO12" });
    expect(c).toContain("540583.90");
    expect(c).toContain("6011Joao Pessoa");
    expect(c).toContain("62120508PEDIDO12");
    expect(c.slice(-4)).toBe(crc16(c.slice(0, -4)));
  });
});
