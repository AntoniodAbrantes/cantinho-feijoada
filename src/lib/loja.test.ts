import { describe, expect, it } from "vitest";
import { horariosAgenda, lojaAberta, proximaAbertura, textoFechado, textoHorario } from "./loja";
import type { Loja } from "./types";

const auto: Loja = { modo: "auto", horarios: { sexta: { inicio: "11:00", fim: "14:30" }, domingo: { inicio: "11:00", fim: "14:00" } } };
const em = (iso: string) => new Date(`${iso}-03:00`); // horário de Fortaleza

describe("lojaAberta", () => {
  it("abre no horário do dia", () => {
    expect(lojaAberta(auto, em("2026-11-13T11:00:00"))).toBe(true); // sexta
    expect(lojaAberta(auto, em("2026-11-13T14:29:00"))).toBe(true);
  });
  it("fecha fora do horário e em dia sem horário", () => {
    expect(lojaAberta(auto, em("2026-11-13T10:59:00"))).toBe(false);
    expect(lojaAberta(auto, em("2026-11-13T14:30:00"))).toBe(false);
    expect(lojaAberta(auto, em("2026-11-14T12:00:00"))).toBe(false); // sábado sem horário
    expect(lojaAberta(auto, em("2026-11-16T12:00:00"))).toBe(false); // segunda
  });
  it("botão manual manda", () => {
    expect(lojaAberta({ ...auto, modo: "aberta" }, em("2026-11-16T03:00:00"))).toBe(true);
    expect(lojaAberta({ ...auto, modo: "fechada" }, em("2026-11-13T12:00:00"))).toBe(false);
  });
  it("sem horário cadastrado fica fechada", () => {
    expect(lojaAberta({ modo: "auto", horarios: {} }, em("2026-11-13T12:00:00"))).toBe(false);
  });
});

describe("proximaAbertura", () => {
  it("hoje antes do início, senão o próximo dia com horário", () => {
    expect(proximaAbertura(auto, em("2026-11-13T09:00:00"))).toEqual({ dia: "sexta", inicio: "11:00", hoje: true });
    expect(proximaAbertura(auto, em("2026-11-13T15:00:00"))).toEqual({ dia: "domingo", inicio: "11:00", hoje: false });
    expect(proximaAbertura(auto, em("2026-11-16T12:00:00"))).toEqual({ dia: "sexta", inicio: "11:00", hoje: false });
  });
  it("só sexta cadastrada: depois de fechar, a sexta seguinte", () => {
    expect(proximaAbertura({ modo: "auto", horarios: { sexta: { inicio: "11:00", fim: "14:00" } } }, em("2026-11-13T15:00:00"))?.dia).toBe("sexta");
  });
  it("manual ou sem horário: texto genérico", () => {
    expect(proximaAbertura({ ...auto, modo: "fechada" })).toBeNull();
    expect(textoFechado({ modo: "auto", horarios: {} })).toBe("Fechado agora. A gente abre sexta, sábado e domingo, no almoço.");
    expect(textoFechado(auto, em("2026-11-13T09:00:00"))).toBe("Fechado agora. Abre hoje às 11:00.");
  });
});

describe("horariosAgenda", () => {
  const dias = (l: { dia: string }[]) => [...new Set(l.map((h) => h.dia))];
  it("faixas de 30 min dentro do horário, de amanhã até 7 dias", () => {
    const h = horariosAgenda(auto, em("2026-11-16T10:00:00")); // segunda
    expect(dias(h)).toEqual(["2026-11-20", "2026-11-22"]); // sexta e domingo
    const sexta = h.filter((x) => x.dia === "2026-11-20");
    expect(sexta).toHaveLength(7); // 11:00 … 14:00 (a última termina 14:30)
    expect(sexta[0].inicio).toBe(em("2026-11-20T11:00:00").getTime());
    expect(textoHorario(sexta[6].inicio)).toBe("sexta, 20/11, das 14:00 às 14:30");
  });
  it("hoje nunca; amanhã só até as 20h da véspera", () => {
    expect(dias(horariosAgenda(auto, em("2026-11-19T19:59:00")))).toEqual(["2026-11-20", "2026-11-22"]); // quinta
    expect(dias(horariosAgenda(auto, em("2026-11-19T20:00:00")))).toEqual(["2026-11-22"]);
    expect(dias(horariosAgenda(auto, em("2026-11-20T12:00:00")))).toEqual(["2026-11-22", "2026-11-27"]);
  });
  it("fechada à mão não agenda; aberta à mão usa os horários", () => {
    expect(horariosAgenda({ ...auto, modo: "fechada" }, em("2026-11-16T10:00:00"))).toEqual([]);
    expect(horariosAgenda({ ...auto, modo: "aberta" }, em("2026-11-16T10:00:00"))).toHaveLength(13);
  });
});
