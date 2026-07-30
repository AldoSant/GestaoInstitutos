import { sql, type SQLWrapper } from "drizzle-orm";

export function normalizarBusca(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

function escaparLike(valor: string) {
  return valor.replace(/[\\%_]/g, "\\$&");
}

/** Busca por trecho, ignorando caixa/acentos, com tolerância a pequenos erros. */
export function correspondeBuscaTextual(coluna: SQLWrapper, busca: string) {
  const termo = normalizarBusca(busca);
  const valorNormalizado = sql<string>`normalizar_texto_busca(coalesce(${coluna}, ''))`;
  const trecho = `%${escaparLike(termo)}%`;

  return sql`(
    ${valorNormalizado} like ${trecho} escape '\\'
    or (
      length(${termo}) >= 4
      and word_similarity(${termo}, ${valorNormalizado}) >= 0.6
    )
  )`;
}
