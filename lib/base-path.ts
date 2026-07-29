function normalizarBasePath(valor: string | undefined) {
  const limpo = valor?.trim();
  if (!limpo || limpo === "/") return "";
  return `/${limpo.replace(/^\/+|\/+$/gu, "")}`;
}

export function basePathAplicacao() {
  return normalizarBasePath(
    process.env.APP_BASE_PATH ?? process.env.NEXT_BASE_PATH,
  );
}

export function caminhoAplicacao(caminho: string, basePath = basePathAplicacao()) {
  const normalizado = caminho.startsWith("/") ? caminho : `/${caminho}`;
  return `${basePath}${normalizado}`;
}
