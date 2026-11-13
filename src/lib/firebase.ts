import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const emulador = process.env.NEXT_PUBLIC_EMULADOR === "1";

const config = emulador
  ? { apiKey: "demo", projectId: "demo-cantinho", authDomain: "demo-cantinho.firebaseapp.com" }
  : {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

// Só no navegador e uma vez (o hot reload reexecuta o módulo).
function iniciar() {
  const app = initializeApp(config);
  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  const auth = getAuth(app);
  if (emulador) {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return { app, db, auth };
}

const g = globalThis as unknown as { __fb?: ReturnType<typeof iniciar> };
export const fb = () => (g.__fb ??= iniciar());
