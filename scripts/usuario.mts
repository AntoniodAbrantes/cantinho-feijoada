// Cria (ou atualiza) a conta dona do sistema e marca com a claim "dono", exigida pelas regras.
// Uso: npm run usuario -- email senha     |  npm run usuario:emulador -- email senha
import { auth } from "./admin.mts";

const [email, senha] = process.argv.slice(2);
if (!email || !senha || senha.length < 8) throw new Error("Uso: npm run usuario -- <email> <senha com 8+ caracteres>");

const u = await auth.getUserByEmail(email).catch(() => null);
const conta = u ? await auth.updateUser(u.uid, { password: senha }) : await auth.createUser({ email, password: senha });
await auth.setCustomUserClaims(conta.uid, { dono: true });
console.log(`Conta ${email} pronta (uid ${conta.uid}), marcada como dona.`);
