import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { getPool } from "../../db";

function argumento(nome: string) {
  const indice = process.argv.indexOf(nome);
  return indice >= 0 ? process.argv[indice + 1] ?? "" : "";
}

function arquivoPrivado(caminho: string) {
  const absoluto = resolve(caminho);
  const raizPrivada = resolve(".private");
  if (relative(raizPrivada, absoluto).startsWith("..")) {
    throw new Error("A saída deve ficar dentro de .private para não expor cadastros históricos.");
  }
  return absoluto;
}

const empresaId = argumento("--empresa-id");
const saida = argumento("--saida");
if (!empresaId || !saida) {
  throw new Error("Use --empresa-id e --saida .private/.../mapeamento-replay.json.");
}
const destino = arquivoPrivado(saida);

try {
  const resultado = await getPool().query<{
    folha_legacy_id: string;
    item_legacy_id: string;
    competencia: string;
    pessoa_legacy_id: string;
    nome: string;
    meta_legacy_id: string | null;
  }>(
    `select f.legacy_id folha_legacy_id, i.legacy_id item_legacy_id,
            to_char(f.competencia, 'YYYY-MM') competencia, i.pessoa_legacy_id,
            i.nome, f.meta_legacy_id
       from legado_folha f
       join legado_folha_item i on i.folha_legado_id = f.id
       left join legado_chave existente
         on existente.empresa_id = f.empresa_id and existente.origem = 'GIW'
        and existente.entidade = 'folha_itens_vinculo'
        and existente.legacy_id = concat(f.legacy_id, '/', i.legacy_id)
      where f.empresa_id = $1 and f.origem = 'GIW'
        and existente.legacy_id is null
      order by f.competencia, f.legacy_id, i.legacy_id`,
    [empresaId],
  );
  const arquivo = {
    schemaVersion: "1.0",
    source: "MAPEAMENTO_HISTORICO_CONFIRMADO",
    empresaId,
    instrucoes: "Preencha vinculoId, confirmadoPor e justificativa somente após conferir a fonte histórica. Não use aproximação por nome.",
    mappings: resultado.rows.map((linha) => ({
      folhaLegacyId: linha.folha_legacy_id,
      itemLegacyId: linha.item_legacy_id,
      competencia: linha.competencia,
      pessoaLegacyId: linha.pessoa_legacy_id,
      nomeReferencia: linha.nome,
      metaReferencia: linha.meta_legacy_id,
      vinculoId: "",
      confirmadoPor: "",
      justificativa: "",
    })),
  };
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, `${JSON.stringify(arquivo, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ modo: "EXPORTACAO_PRIVADA", pendencias: resultado.rows.length }, null, 2));
} finally {
  await getPool().end();
}
