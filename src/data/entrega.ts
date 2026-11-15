// Taxa de entrega do site, num lugar só. Só o servidor lê este arquivo: a origem nunca vai pro navegador.
import type { Faixa, Regiao } from "@/lib/entrega";

function lerPonto(v?: string) {
  const [lat, lng] = (v ?? "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat && lng ? { lat, lng } : null;
}

export const ENTREGA = {
  // Ponto de saída das entregas (a cozinha), na variável ENTREGA_ORIGEM="lat,lng": fica fora do git
  // (o repositório é público) e nunca vai pro navegador. Sem ela, o site não calcula distância
  // e cobra a premissa "Taxa de entrega cobrada", como antes.
  origem: lerPonto(process.env.ENTREGA_ORIGEM),

  // Em ordem crescente. Taxa em centavos. Acima da última faixa = fora da área (combina pelo WhatsApp).
  faixas: [
    { ateKm: 4, taxa: 0 },
    { ateKm: 7, taxa: 1000 },
  ] as Faixa[],

  // Se a rota de carro (OSRM) falhar: linha reta × este fator.
  fatorLinhaReta: 1.3,

  // João Pessoa e região metropolitana (Cabedelo, Bayeux, Santa Rita, Conde): busca de endereço e pino ficam aqui dentro.
  cidades: ["João Pessoa", "Cabedelo", "Bayeux", "Santa Rita", "Conde"],
  regiao: { sul: -7.4, norte: -6.94, oeste: -35.2, leste: -34.78 } as Regiao,
  centroMapa: { lat: -7.1195, lng: -34.845 }, // centro de João Pessoa, pro mapa abrir antes do endereço
};
