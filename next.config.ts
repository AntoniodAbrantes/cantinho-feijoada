import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // O sistema saiu da raiz para /admin (a raiz é o site): links e favoritos antigos continuam funcionando.
  redirects: async () =>
    ["/novo", "/pedidos", "/caixa", "/entrar", "/mais", "/mais/:caminho*"].map((source) => ({ source, destination: `/admin${source}`, permanent: false })),
};

export default nextConfig;
