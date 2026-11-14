// Firebase Admin no servidor (rotas e páginas do site). Nunca importar em componente "use client".
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const emulador = process.env.NEXT_PUBLIC_EMULADOR === "1";
if (emulador) process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

// Na Vercel: FIREBASE_SERVICE_ACCOUNT com o JSON da conta de serviço. Local: GOOGLE_APPLICATION_CREDENTIALS.
function iniciar() {
  if (emulador) return initializeApp({ projectId: "demo-cantinho" });
  const conta = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    credential: conta ? cert(JSON.parse(conta)) : applicationDefault(),
  });
}

export const adminDb = () => getFirestore(getApps()[0] ?? iniciar());
