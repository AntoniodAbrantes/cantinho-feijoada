// Pix copia-e-cola (BR Code estático do Banco Central) com o valor do pedido já preenchido.
// Gerado no navegador a partir do total do rastreio, que só o servidor e o admin escrevem.

const campo = (id: string, v: string) => id + String(v.length).padStart(2, "0") + v;
// Sem acento nem símbolo: alguns apps de banco recusam o código.
const limpo = (v: string, max: number) => v.normalize("NFD").replace(/[^\w ]/g, "").trim().slice(0, max);

export function crc16(s: string) {
  let c = 0xffff;
  for (const b of new TextEncoder().encode(s)) {
    c ^= b << 8;
    for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c.toString(16).toUpperCase().padStart(4, "0");
}

// valor em centavos (omitido = o cliente digita). txid: até 25 letras/números, aparece no extrato.
export function pixCopiaECola({ chave, nome, cidade, valor, txid = "***" }: { chave: string; nome: string; cidade: string; valor?: number; txid?: string }) {
  const corpo =
    campo("00", "01") +
    campo("26", campo("00", "br.gov.bcb.pix") + campo("01", chave)) +
    campo("52", "0000") +
    campo("53", "986") +
    (valor ? campo("54", (valor / 100).toFixed(2)) : "") +
    campo("58", "BR") +
    campo("59", limpo(nome, 25)) +
    campo("60", limpo(cidade, 15)) +
    campo("62", campo("05", txid)) +
    "6304";
  return corpo + crc16(corpo);
}
