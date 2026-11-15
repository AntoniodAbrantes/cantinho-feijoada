// Contas da taxa de entrega. Rodam no navegador (pra mostrar) e no servidor (que decide).
import { brl } from "./format";

export interface Ponto {
  lat: number;
  lng: number;
}
export interface Faixa {
  ateKm: number;
  taxa: number; // centavos
}
export interface Regiao {
  sul: number;
  norte: number;
  oeste: number;
  leste: number;
}

// O que o site recebe do servidor: tudo menos a origem.
export interface EntregaSite {
  ativo: boolean; // false = origem não configurada, vale a taxa fixa
  faixas: Faixa[];
  cidades: string[];
  regiao: Regiao;
  centro: Ponto;
}

// Taxa da faixa, ou null se passou da última (fora da área).
export function taxaPorKm(km: number, faixas: Faixa[]): number | null {
  return faixas.find((f) => km <= f.ateKm)?.taxa ?? null;
}

// Distância em linha reta (haversine), em km.
export function linhaRetaKm(a: Ponto, b: Ponto) {
  const rad = (g: number) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export const naRegiao = (p: Ponto, r: Regiao) =>
  Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= r.sul && p.lat <= r.norte && p.lng >= r.oeste && p.lng <= r.leste;

// Uma casa decimal: é o número que o cliente vê e o que decide a faixa.
export const arredondarKm = (km: number) => Math.round(km * 10) / 10;
export const kmTexto = (km: number) => `${km.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
export const taxaTexto = (taxa: number) => (taxa ? brl(taxa) : "Grátis");

// "Grátis até 4 km" / "Grátis até 3 km, R$ 8,00 até 6 km".
export const resumoFaixas = (faixas: Faixa[]) => faixas.map((f) => `${taxaTexto(f.taxa)} até ${f.ateKm} km`).join(", ");
