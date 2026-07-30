import type { NextConfig } from "next";

const basePath = process.env.NEXT_BASE_PATH;

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/homologacoes",
        destination: "/fechamento-mensal",
        permanent: true,
      },
      {
        source: "/homologacoes/espelho",
        destination: "/fechamento-mensal/espelho",
        permanent: true,
      },
      {
        source: "/consolidacoes",
        destination: "/conferencia-entre-folhas",
        permanent: true,
      },
      {
        source: "/consolidacoes/espelho",
        destination: "/conferencia-entre-folhas/espelho",
        permanent: true,
      },
      {
        source: "/consolidacoes/simulacoes",
        destination: "/conferencia-entre-folhas/simulacoes",
        permanent: true,
      },
      {
        source: "/consolidacoes/simulacoes/espelho",
        destination: "/conferencia-entre-folhas/simulacoes/espelho",
        permanent: true,
      },
      {
        source: "/instrumentos",
        destination: "/termos-e-metas",
        permanent: true,
      },
      {
        source: "/folhas/:competencia/homologacao/modelo",
        destination: "/folhas/:competencia/conferencia/modelo",
        permanent: true,
      },
    ];
  },
  ...(basePath ? { basePath } : {}),
  env: {
    APP_BASE_PATH: basePath ?? "",
  },
};

export default nextConfig;
