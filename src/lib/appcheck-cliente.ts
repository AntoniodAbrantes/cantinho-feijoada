// App Check no navegador do cliente do site. Carrega só quando o checkout abre: o Firebase não pesa na landing.
import { config, emulador } from "./firebase-config";

const chave = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
let pronto: Promise<import("firebase/app-check").AppCheck | null> | null = null;

export function iniciarAppCheck() {
  pronto ??= (async () => {
    if (!chave || emulador) return null;
    const [{ getApps, initializeApp }, { initializeAppCheck, ReCaptchaEnterpriseProvider }] = await Promise.all([import("firebase/app"), import("firebase/app-check")]);
    const app = getApps().find((a) => a.name === "site") ?? initializeApp(config, "site"); // a página de acompanhamento usa o mesmo app
    return initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(chave), isTokenAutoRefreshEnabled: false });
  })();
  return pronto;
}

// Token de uso único para o envio do pedido (a rota consome e não aceita de novo).
export async function tokenAppCheck() {
  const ac = await iniciarAppCheck();
  if (!ac) return null;
  const { getLimitedUseToken } = await import("firebase/app-check");
  return (await getLimitedUseToken(ac)).token;
}
