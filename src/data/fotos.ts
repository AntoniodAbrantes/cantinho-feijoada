// Fotos reais do Cantinho. Ponha o arquivo em public/fotos/ e o caminho aqui (ex.: "/fotos/feijoada.jpg").
// Sem foto (null), a seção fica só na tipografia. Nada de foto gerada por IA nem de banco de imagens.
export const FOTOS: Record<"feijoada" | "potes" | "cantinho2012", string | null> = {
  feijoada: null, // abertura
  potes: null, // "Como funciona"
  cantinho2012: null, // "A história"
};

// Acompanhamentos por tamanho (o resto do cardápio vem do cadastro de produtos).
// shortcut: por id de produto; virar campo do produto se mudar de tamanho com frequência.
export const ACOMPANHAMENTOS: Record<string, string> = {
  "feijoada-individual": "150 g de arroz, 50 g de couve e 40 g de farofa",
  "feijoada-2": "300 g de arroz, 100 g de couve e 80 g de farofa",
  "feijoada-3": "450 g de arroz, 150 g de couve e 120 g de farofa",
};
