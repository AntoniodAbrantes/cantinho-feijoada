export const emulador = process.env.NEXT_PUBLIC_EMULADOR === "1";

export const config = emulador
  ? { apiKey: "demo", projectId: "demo-cantinho", authDomain: "demo-cantinho.firebaseapp.com" }
  : {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
