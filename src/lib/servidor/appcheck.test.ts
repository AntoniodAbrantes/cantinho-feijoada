import { describe, expect, it } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { verificarJwt } from "./appcheck";

// Token no formato do App Check, assinado com uma chave de teste.
async function cenario() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  const chaves = createLocalJWKSet({ keys: [jwk] });
  const token = (claims: { iss?: string; aud?: string[]; sub?: string; exp?: string }) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(claims.iss ?? "https://firebaseappcheck.googleapis.com/123")
      .setAudience(claims.aud ?? ["projects/123", "projects/cantinho"])
      .setSubject(claims.sub ?? "1:123:web:abc")
      .setIssuedAt()
      .setExpirationTime(claims.exp ?? "1h")
      .sign(privateKey);
  return { chaves, token };
}

describe("token do App Check", () => {
  it("aceita token válido do projeto", async () => {
    const { chaves, token } = await cenario();
    await expect(verificarJwt(await token({}), "cantinho", chaves)).resolves.toMatchObject({ sub: "1:123:web:abc" });
  });
  it("recusa outro projeto, outro emissor, vencido e sem app", async () => {
    const { chaves, token } = await cenario();
    await expect(verificarJwt(await token({ aud: ["projects/outro"] }), "cantinho", chaves)).rejects.toThrow();
    await expect(verificarJwt(await token({ iss: "https://evil.example/123" }), "cantinho", chaves)).rejects.toThrow();
    await expect(verificarJwt(await token({ exp: "-1m" }), "cantinho", chaves)).rejects.toThrow();
    await expect(verificarJwt(await token({ sub: "" }), "cantinho", chaves)).rejects.toThrow();
  });
  it("recusa token assinado por outra chave", async () => {
    const a = await cenario();
    const b = await cenario();
    await expect(verificarJwt(await b.token({}), "cantinho", a.chaves)).rejects.toThrow();
  });
});
