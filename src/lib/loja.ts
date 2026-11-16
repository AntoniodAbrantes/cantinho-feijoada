import { FUSO, dataBr, diaLocal, horaLocal, nomeDia, somaDias } from "./format";
import type { DiaLoja, Loja } from "./types";

export const DIAS_LOJA: DiaLoja[] = ["sexta", "sabado", "domingo"];
export const NOME_DIA: Record<DiaLoja, string> = { sexta: "sexta", sabado: "sábado", domingo: "domingo" };
const NUM: Record<DiaLoja, number> = { sexta: 5, sabado: 6, domingo: 0 };
const SEMANA = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Dia da semana (0 = domingo) e "hh:mm" no fuso de Fortaleza.
function relogio(agora: Date | number) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(agora)
      .map((x) => [x.type, x.value]),
  );
  return { semana: SEMANA.indexOf(p.weekday), hora: `${p.hour}:${p.minute}` };
}
const diaDoNumero = (n: number) => DIAS_LOJA.find((d) => NUM[d] === n);

// Aberta pelo botão manual, ou no modo "auto" dentro do horário do dia (fuso de Fortaleza).
export function lojaAberta(loja: Loja, agora: Date | number = new Date()) {
  if (loja.modo !== "auto") return loja.modo === "aberta";
  const { semana, hora } = relogio(agora);
  const dia = diaDoNumero(semana);
  const h = dia && loja.horarios[dia];
  return !!h && hora >= h.inicio && hora < h.fim;
}

// Próxima abertura no modo "auto": hoje, se ainda não passou do início. Fechada à mão ou sem horário: null.
export function proximaAbertura(loja: Loja, agora: Date | number = new Date()) {
  if (loja.modo !== "auto") return null;
  const { semana, hora } = relogio(agora);
  for (let k = 0; k <= 7; k++) {
    const dia = diaDoNumero((semana + k) % 7);
    const h = dia && loja.horarios[dia];
    if (dia && h && (k > 0 || hora < h.inicio)) return { dia, inicio: h.inicio, hoje: k === 0 };
  }
  return null;
}

export function textoFechado(loja: Loja, agora: Date | number = new Date()) {
  const p = proximaAbertura(loja, agora);
  return p ? `Fechado agora. Abre ${p.hoje ? "hoje" : NOME_DIA[p.dia]} às ${p.inicio}.` : "Fechado agora. A gente abre sexta, sábado e domingo, no almoço.";
}

// Agendamento pelo site: faixas de 30 min dentro do horário de cada dia da loja, de amanhã até 7 dias.
// Pro dia seguinte, só até as 20h da véspera (pra dar tempo de planejar a panela). No dia, só "pra agora".
export const AGENDA = { dias: 7, corte: "20:00", passoMin: 30 };
export interface Horario {
  inicio: number; // epoch ms do começo da faixa
  dia: string;
}
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function horariosAgenda(loja: Loja, agora: Date | number = new Date()): Horario[] {
  if (loja.modo === "fechada") return []; // fechada à mão (férias, sem panela): nem agenda
  const { semana, hora } = relogio(agora);
  const hoje = diaLocal(agora);
  const r: Horario[] = [];
  for (let k = 1; k <= AGENDA.dias; k++) {
    if (k === 1 && hora >= AGENDA.corte) continue;
    const dia = somaDias(hoje, k);
    const d = diaDoNumero((semana + k) % 7);
    const h = d && loja.horarios[d];
    if (!h) continue;
    // Fortaleza é UTC-3 o ano todo (sem horário de verão).
    for (let m = minutos(h.inicio); m + AGENDA.passoMin <= minutos(h.fim); m += AGENDA.passoMin) r.push({ inicio: Date.parse(`${dia}T${hhmm(m)}:00-03:00`), dia });
  }
  return r;
}

// "sábado, 21/11, das 12:00 às 12:30"
export function textoHorario(inicio: number) {
  const dia = diaLocal(inicio);
  return `${nomeDia(dia)}, ${dataBr(dia).slice(0, 5)}, das ${horaLocal(inicio)} às ${horaLocal(inicio + AGENDA.passoMin * 60_000)}`;
}
