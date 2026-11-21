import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Prévia do link no WhatsApp, Instagram e Google: o selo e a frase da abertura, sem foto (não há foto real ainda).
export const alt = "Cantinho da Feijoada · feijoada delivery em João Pessoa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Imagem() {
  const selo = await readFile(join(process.cwd(), "public/marca/cantinho-selo.svg"), "base64");
  return new ImageResponse(
    (
      <div style={{ display: "flex", alignItems: "center", gap: 64, width: "100%", height: "100%", padding: 80, background: "#15110F", color: "#F3EAD7" }}>
        <img src={`data:image/svg+xml;base64,${selo}`} width={320} height={320} alt="" />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05, textTransform: "uppercase" }}>Dessa vez, o Cantinho</div>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05, textTransform: "uppercase", color: "#EBA91F" }}>vai até você.</div>
          <div style={{ fontSize: 36, color: "#BFB39E" }}>Feijoada delivery em João Pessoa</div>
        </div>
      </div>
    ),
    size,
  );
}
