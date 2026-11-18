// Gera os sons do alarme em public/sons (WAV, sem arquivo de terceiros): npx tsx scripts/sons.mts
import { mkdirSync, writeFileSync } from "node:fs";

const TAXA = 22050;
type Onda = (t: number) => number; // t em segundos, volta -1..1

const quadrada = (f: number) => (t: number) => (Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1);
const seno = (f: number) => (t: number) => Math.sin(2 * Math.PI * f * t);

function wav(segundos: number, onda: Onda) {
  const n = Math.round(segundos * TAXA);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // mono
  b.writeUInt32LE(TAXA, 24);
  b.writeUInt32LE(TAXA * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const borda = Math.min(1, i / 200, (n - 1 - i) / 200); // sem estalo na volta do loop
    const v = Math.max(-1, Math.min(1, onda(i / TAXA))) * borda;
    b.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return b;
}

// Sirene: varredura 650-1500 Hz em onda quadrada, o mais alto e chato possível.
// Fase acumulada amostra a amostra (wav chama em ordem) pra varredura não estalar.
let faseSirene = 0;
function sirene(t: number) {
  const x = t % 1;
  faseSirene += (650 + 850 * (x < 0.5 ? x * 2 : 2 - x * 2)) / TAXA;
  return 0.95 * (Math.sin(2 * Math.PI * faseSirene) >= 0 ? 1 : -1);
}

// Sino: duas batidas com harmônicos que somem.
function sino(t: number) {
  const tb = t % 0.8;
  const env = Math.exp(-tb * 5);
  return 0.9 * env * (0.6 * seno(880)(tb) + 0.3 * seno(1760)(tb) + 0.2 * seno(2640)(tb));
}

// Apito: bipe-bipe agudo de dois tons.
function apito(t: number) {
  const tb = t % 0.6;
  if (tb < 0.2) return 0.9 * quadrada(1000)(tb);
  if (tb >= 0.3 && tb < 0.5) return 0.9 * quadrada(1300)(tb);
  return 0;
}

// Conexão caiu: dois bipes graves e pausa. Diferente de todos os de pedido.
function conexao(t: number) {
  if (t < 0.35 || (t >= 0.55 && t < 0.9)) return 0.8 * (2 * Math.abs(2 * ((t * 330) % 1) - 1) - 1);
  return 0;
}

// Caixa registradora ("cha-ching"): chiado curto da gaveta + duas moedinhas agudas. Toca ao lançar pedido.
let ruido = 1;
function caixa(t: number) {
  ruido = (ruido * 16807) % 2147483647; // pseudoaleatório fixo: o arquivo sai igual toda vez
  const cha = t < 0.09 ? 0.5 * Math.exp(-t * 30) * ((ruido / 2147483647) * 2 - 1) : 0;
  const ding = (t0: number, f: number) => {
    const x = t - t0;
    return x < 0 ? 0 : Math.exp(-x * 6) * (0.5 * seno(f)(x) + 0.3 * seno(f * 2.76)(x) + 0.15 * seno(f * 5.4)(x));
  };
  return cha + 0.8 * (ding(0.08, 2093) + ding(0.2, 2637));
}

const pasta = new URL("../public/sons/", import.meta.url);
mkdirSync(pasta, { recursive: true });
const sons: [string, number, Onda][] = [["sirene", 2, sirene], ["sino", 1.6, sino], ["apito", 1.2, apito], ["conexao", 3, conexao], ["caixa", 0.9, caixa]];
for (const [nome, s, onda] of sons) writeFileSync(new URL(`${nome}.wav`, pasta), wav(s, onda));
console.log("sons gerados em public/sons");
