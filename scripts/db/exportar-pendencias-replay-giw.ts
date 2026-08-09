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
       left join legado_chave vinculo_legado
         on vinculo_legado.empresa_id = f.empresa_id and vinculo_legado.origem = 'GIW'
        and vinculo_legado.entidade = 'vinculos' and vinculo_legado.legacy_id = i.vinculo_legacy_id
        and vinculo_legado.destino_tabela = 'prestador_vinculo'
       left join legado_chave termo
         on termo.empresa_id = f.empresa_id and termo.origem = 'GIW'
        and termo.entidade = 'termos' and termo.legacy_id = f.termo_legacy_id
        and termo.destino_tabela = 'termo'
       left join legado_chave meta
         on meta.empresa_id = f.empresa_id and meta.origem = 'GIW'
        and meta.entidade = 'metas' and meta.legacy_id = f.meta_legacy_id
        and meta.destino_tabela = 'termo_meta'
       left join lateral (
         select (array_agg(t.id order by t.id))[1] termo_id,
                (array_agg(m.id order by m.id))[1] meta_id
           from termo t
           join termo_meta m on m.termo_id = t.id and m.ativo
          where t.empresa_id = f.empresa_id and t.ativo
            and lower(btrim(m.descricao)) = lower(btrim(f.meta_legacy_id))
            and t.inicio <= f.competencia and (t.fim is null or t.fim >= f.competencia)
         having count(*) = 1
       ) rotulo on true
       left join lateral (
         select (array_agg(v.id order by v.id))[1] vinculo_id
           from prestador p
           join pessoa pessoa_atual on pessoa_atual.empresa_id = p.empresa_id and pessoa_atual.id = p.pessoa_id
           join prestador_vinculo v on v.empresa_id = p.empresa_id and v.prestador_id = p.id and v.ativo
          where p.empresa_id = f.empresa_id and p.ativo and pessoa_atual.ativo
            and (
              exists (
                select 1 from legado_chave pessoa
                 where pessoa.empresa_id = f.empresa_id and pessoa.origem = 'GIW'
                   and pessoa.entidade = 'pessoas' and pessoa.legacy_id = i.pessoa_legacy_id
                   and pessoa.destino_tabela = 'pessoa' and pessoa.destino_id = p.pessoa_id
              )
              or (i.cpf is not null and pessoa_atual.cpf = i.cpf)
              or (i.cnpj is not null and pessoa_atual.cnpj = i.cnpj)
            )
            and (coalesce(termo.destino_id, rotulo.termo_id) is null or v.termo_id = coalesce(termo.destino_id, rotulo.termo_id))
            and (coalesce(meta.destino_id, rotulo.meta_id) is null or v.meta_id = coalesce(meta.destino_id, rotulo.meta_id))
            and v.inicio <= f.competencia and (v.fim is null or v.fim >= f.competencia)
         having count(*) = 1
       ) candidato on true
      where f.empresa_id = $1 and f.origem = 'GIW'
        and existente.legacy_id is null
        and vinculo_legado.destino_id is null and candidato.vinculo_id is null
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
