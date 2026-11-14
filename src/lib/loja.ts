import { FUSO } from "./format";
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
