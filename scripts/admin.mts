import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const noEmulador = !!process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.GCLOUD_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) throw new Error("Defina GCLOUD_PROJECT (ou NEXT_PUBLIC_FIREBASE_PROJECT_ID).");

const app = initializeApp(noEmulador ? { projectId } : { projectId, credential: applicationDefault() });
export const db = getFirestore(app);
export const auth = getAuth(app);
console.log(`→ ${noEmulador ? "EMULADOR" : "PRODUÇÃO"} · projeto ${projectId}`);
