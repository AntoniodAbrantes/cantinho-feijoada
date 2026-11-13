export const FUSO = "America/Fortaleza";

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const brl = (centavos: number) => brlFmt.format(centavos / 100).replace(/ /g, " ");
export const reais = (centavos: number) => numFmt.format(centavos / 100); // sem "R$"
export const pctFmt = (fracao: number, casas = 0) =>
  `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`;
export const bpFmt = (bp: number) => `${(bp / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
export const kg = (g: number) => `${(g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`;

// aaaa-mm-dd no fuso de Fortaleza
export const diaLocal = (d: Date | number = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(d);

export const horaLocal = (d: Date | number) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(d);

export const dataBr = (dia: string) => dia.split("-").reverse().join("/");

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const diaDaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay();
export const nomeDia = (dia: string) => DIAS[diaDaSemana(dia)];

export function somaDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Sexta-feira do fim de semana a que o dia pertence (seg–qui contam para a sexta anterior).
export const fimDeSemana = (dia: string) => somaDias(dia, -((diaDaSemana(dia) + 2) % 7));

export const kgNum = (g: number) => (g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

// Igualdade profunda que ignora a ordem das chaves (o Firestore não preserva).
const ordenar = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(ordenar) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenar((v as Record<string, unknown>)[k])])) : v;
export const igual = (a: unknown, b: unknown) => JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
