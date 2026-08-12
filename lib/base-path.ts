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
  if (
    basePath &&
    (normalizado === basePath || normalizado.startsWith(`${basePath}/`))
  ) {
    return normalizado;
  }
  return `${basePath}${normalizado}`;
}

/**
 * Rota para Link e redirect do App Router. O Next aplica `basePath`
 * automaticamente nesses dois mecanismos; prefixá-la aqui produz
 * `/gestao-institutos/gestao-institutos/...`.
 */
export function rotaAplicacao(caminho: string, basePath = basePathAplicacao()) {
  const normalizado = caminho.startsWith("/") ? caminho : `/${caminho}`;
  if (!basePath) return normalizado;
  if (normalizado === basePath) return "/";
  if (normalizado.startsWith(`${basePath}/`)) {
    return normalizado.slice(basePath.length) || "/";
  }
  return normalizado;
}
