// Distância e taxa de entrega, calculadas aqui a partir do pino do cliente. O navegador só mostra o resultado.
import { ENTREGA } from "@/data/entrega";
import { arredondarKm, linhaRetaKm, naRegiao, taxaPorKm, type EntregaSite, type Ponto } from "../entrega";

export interface Calculo {
  km: number;
  taxa: number | null; // null = fora da área
  rota: boolean; // false = OSRM falhou, foi linha reta × fator
}
export type Config = typeof ENTREGA;
export type Rota = (de: Ponto, para: Ponto) => Promise<number>;

// Rota de carro pelo OSRM público, em km. Demora ou erro: quem chamou cai pra linha reta.
export const rotaOsrm: Rota = async (de, para) => {
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${de.lng},${de.lat};${para.lng},${para.lat}?overview=false`, {
    signal: AbortSignal.timeout(3000),
  });
  const j = (await r.json()) as { code?: string; routes?: { distance: number }[] };
  if (!r.ok || j.code !== "Ok" || !j.routes?.length) throw new Error(`OSRM ${r.status} ${j.code}`);
  return j.routes[0].distance / 1000;
};

// O mesmo pino pede a taxa ao abrir a revisão e de novo ao enviar: guarda a distância por um tempo.
const cache = new Map<string, { km: number; rota: boolean }>();

export function entregaSite(c: Config = ENTREGA): EntregaSite {
  return { ativo: !!c.origem, faixas: c.faixas, cidades: c.cidades, regiao: c.regiao, centro: c.centroMapa };
}

// null = origem não configurada (vale a taxa fixa das premissas).
export async function calcularEntrega(destino: Ponto, c: Config = ENTREGA, rota: Rota = rotaOsrm): Promise<Calculo | null> {
  if (!c.origem) return null;
  if (!naRegiao(destino, c.regiao)) return { km: 0, taxa: null, rota: false };
  const chave = `${destino.lat.toFixed(5)},${destino.lng.toFixed(5)}`;
  let d = cache.get(chave);
  if (!d) {
    try {
      d = { km: await rota(c.origem, destino), rota: true };
      if (cache.size > 500) cache.clear();
      cache.set(chave, d); // só rota de verdade: linha reta tenta o OSRM de novo na próxima
    } catch (e) {
      console.warn("rota da entrega falhou, usando linha reta:", (e as Error).message);
      d = { km: linhaRetaKm(c.origem, destino) * c.fatorLinhaReta, rota: false };
    }
  }
  const km = arredondarKm(d.km);
  return { km, taxa: taxaPorKm(km, c.faixas), rota: d.rota };
}
