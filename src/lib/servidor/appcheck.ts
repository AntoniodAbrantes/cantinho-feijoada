import { getApps } from "firebase-admin/app";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { adminDb } from "./admin";
import { Recusa } from "./pedido";

// App Check com reCAPTCHA Enterprise (invisível): só aceita pedido vindo do nosso site num navegador de verdade.
// Token de uso único (consume): copiar o token de um pedido não serve para mandar outro.
// Feito à mão com jose porque o getAppCheck() do firebase-admin quebra na Vercel (jwks-rsa faz require de jose, que é ESM).
const CHAVES = createRemoteJWKSet(new URL("https://firebaseappcheck.googleapis.com/v1/jwks"));

// Assinatura, emissor, projeto e validade: as mesmas checagens do firebase-admin.
export async function verificarJwt(token: string, projectId: string, chaves: JWTVerifyGetKey = CHAVES) {
  const { payload } = await jwtVerify(token, chaves, { algorithms: ["RS256"], audience: `projects/${projectId}` });
  if (!payload.iss?.startsWith("https://firebaseappcheck.googleapis.com/")) throw new Error("emissor errado");
  if (!payload.sub) throw new Error("token sem app");
  return payload;
}

// Marca o token como usado no Firebase; responde se já tinha sido usado antes.
async function consumir(token: string) {
  adminDb(); // garante o app do Admin iniciado
  const app = getApps()[0];
  const { access_token } = await app.options.credential!.getAccessToken();
  const r = await fetch(`https://firebaseappcheck.googleapis.com/v1beta/projects/${app.options.projectId}:verifyAppCheckToken`, {
    method: "POST",
    headers: { authorization: `Bearer ${access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ app_check_token: token }),
  });
  if (!r.ok) throw new Error(`App Check respondeu ${r.status}`);
  return ((await r.json()) as { alreadyConsumed?: boolean }).alreadyConsumed === true;
}

export async function conferirAppCheck(token: string | null) {
  if (process.env.NEXT_PUBLIC_EMULADOR === "1") return; // o emulador não tem App Check
  if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) throw new Recusa(503, "O site ainda não está pronto para receber pedidos.");
  if (!token) throw new Recusa(403, "Não consegui confirmar que o pedido veio do site.");
  try {
    await verificarJwt(token, process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "");
    if (await consumir(token)) throw new Error("token reaproveitado");
  } catch (e) {
    console.error("App Check recusou o pedido:", (e as Error).message);
    throw new Recusa(403, "Não consegui confirmar que o pedido veio do site.");
  }
}
