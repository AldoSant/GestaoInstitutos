import type { NextConfig } from "next";

const basePath = process.env.NEXT_BASE_PATH;
const distDir = process.env.NEXT_DIST_DIR;

const nextConfig: NextConfig = {
  ...(distDir ? { distDir } : {}),
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
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
