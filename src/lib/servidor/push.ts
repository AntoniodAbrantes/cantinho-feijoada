// Aviso de pedido novo no celular do dono, mesmo com o app fechado (Web Push).
// Os celulares ficam em push/{id}, gravados pela tela ao vivo. No iPhone só funciona com o app na tela inicial.
import webpush from "web-push";
import { adminDb } from "./admin";

const PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC;
const PRIVADA = process.env.VAPID_PRIVATE;

export async function avisarCelulares(aviso: { titulo: string; corpo: string; tag: string }) {
  if (!PUBLICA || !PRIVADA) return; // sem as chaves, fica só o alarme da tela aberta
  const db = adminDb();
  const s = await db.collection("push").get();
  await Promise.all(
    s.docs.map((d) =>
      webpush
        .sendNotification(JSON.parse(d.get("assinatura")), JSON.stringify(aviso), {
          vapidDetails: { subject: "https://cantinho-feijoada.vercel.app", publicKey: PUBLICA, privateKey: PRIVADA },
          TTL: 600, // pedido de mais de 10 minutos já não é novidade
          urgency: "high",
        })
        .catch((e: { statusCode?: number; message?: string }) => {
          // 404/410: o celular desinstalou ou tirou a permissão.
          if (e.statusCode === 404 || e.statusCode === 410) return d.ref.delete();
          console.warn("push falhou", e.statusCode ?? e.message);
        }),
    ),
  );
}
