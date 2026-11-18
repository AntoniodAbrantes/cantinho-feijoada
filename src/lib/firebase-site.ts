// App "site" separado do sistema: sem login e sem cache offline. Só no navegador.
import { getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { config, emulador } from "./firebase-config";

export function dbSite() {
  const primeira = !getApps().some((a) => a.name === "site");
  const d = getFirestore(primeira ? initializeApp(config, "site") : getApps().find((a) => a.name === "site")!);
  if (primeira && emulador) connectFirestoreEmulator(d, "127.0.0.1", 8080);
  return d;
}
