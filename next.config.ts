import type { NextConfig } from "next";

const basePath = process.env.NEXT_BASE_PATH;

const nextConfig: NextConfig = {
  output: "standalone",
  ...(basePath ? { basePath } : {}),
  env: {
    APP_BASE_PATH: basePath ?? "",
  },
};

export default nextConfig;
