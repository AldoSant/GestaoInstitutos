import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { getPool } from "../../db";
import {
  chaveMapeamentoReplayGiw,
  validarArquivoMapeamentoReplayGiw,
} from "../../lib/mapeamento-replay-giw";

function argumento(nome: string) {
  const indice = process.argv.indexOf(nome);
  return indice >= 0 ? process.argv[indice + 1] ?? "" : "";
}

function arquivoPrivado(caminho: string) {
  const absoluto = resolve(caminho);
  if (relative(resolve(".private"), absoluto).startsWith("..")) {
    throw new Error("O arquivo de mapeamento deve ficar dentro de .private.");
  }
  return absoluto;
}

const arquivoArgumento = argumento("--arquivo");
const empresaArgumento = argumento("--empresa-id");
const aplicar = process.argv.includes("--aplicar");
if (!arquivoArgumento) throw new Error("Use --arquivo .private/.../mapeamento-replay.json.");
const arquivo = arquivoPrivado(arquivoArgumento);
if (aplicar && (process.env.GIW_REPLAY_MAPEAMENTO !== "CONFIRMADO" || !process.argv.includes("--confirmar-homologacao"))) {
  throw new Error("Para gravar na HML, use GIW_REPLAY_MAPEAMENTO=CONFIRMADO e --confirmar-homologacao.");
}

const conteudo = await readFile(arquivo, "utf8");
const mapeamento = validarArquivoMapeamentoReplayGiw(JSON.parse(conteudo));
if (empresaArgumento && empresaArgumento !== mapeamento.empresaId) {
  throw new Error("--empresa-id diverge do arquivo de mapeamento.");
}

const pool = getPool();
try {
  const validos: Array<{ chave: string; vinculoId: string }> = [];
  const erros: string[] = [];
  for (const linha of mapeamento.mappings) {
    const chave = chaveMapeamentoReplayGiw(linha);
    const resultado = await pool.query<{ ok: boolean }>(
      `select exists (
         select 1
           from legado_folha f
           join legado_folha_item i on i.folha_legado_id = f.id
           join prestador_vinculo v on v.id = $4 and v.empresa_id = f.empresa_id
           join prestador pr on pr.id = v.prestador_id and pr.empresa_id = f.empresa_id
           join pessoa pessoa_atual on pessoa_atual.id = pr.pessoa_id and pessoa_atual.empresa_id = f.empresa_id
          where f.empresa_id = $1 and f.origem = 'GIW'
            and f.legacy_id = $2 and i.legacy_id = $3
            and (
              exists (
                select 1 from legado_chave pessoa
                 where pessoa.empresa_id = f.empresa_id and pessoa.origem = 'GIW'
                   and pessoa.entidade = 'pessoas' and pessoa.legacy_id = i.pessoa_legacy_id
                   and pessoa.destino_tabela = 'pessoa' and pessoa.destino_id = pessoa_atual.id
              )
              or (i.cpf is not null and pessoa_atual.cpf = i.cpf)
              or (i.cnpj is not null and pessoa_atual.cnpj = i.cnpj)
            )
       ) ok`,
      [mapeamento.empresaId, linha.folhaLegacyId, linha.itemLegacyId, linha.vinculoId],
    );
    if (!resultado.rows[0]?.ok) erros.push(chave);
    else validos.push({ chave, vinculoId: linha.vinculoId });
  }
  const resumo = { modo: aplicar ? "APLICAR_HML" : "PREVIA_SEM_GRAVACAO", informados: mapeamento.mappings.length, validos: validos.length, invalidos: erros.length };
  console.log(JSON.stringify(resumo, null, 2));
  if (erros.length) throw new Error(`Mapeamento recusado: ${erros.length} item(ns) não pertencem à Pessoa/Vínculo indicado.`);
  if (!aplicar) process.exitCode = 0;
  else {
    await pool.query("begin");
    try {
      const checksum = createHash("sha256").update(conteudo).digest("hex");
      const execucao = await pool.query<{ id: string }>(
        `insert into importacao_execucao
          (empresa_id, origem, entidade, arquivo, checksum_arquivo, modo, status, total_lidos, total_inseridos, resumo, concluido_em)
         values ($1, 'GIW', 'folha_itens_vinculo', $2, $3, 'APLICAR', 'EM_ANDAMENTO', $4, 0, '{}'::jsonb, now())
         returning id`,
        [mapeamento.empresaId, arquivo, checksum, validos.length],
      );
      for (const [ordem, linha] of mapeamento.mappings.entries()) {
        const chave = chaveMapeamentoReplayGiw(linha);
        const linhaChecksum = createHash("sha256").update(JSON.stringify(linha)).digest("hex");
        await pool.query(
          `insert into legado_chave
            (empresa_id, origem, entidade, legacy_id, destino_tabela, destino_id, checksum, primeira_execucao_id, ultima_execucao_id)
           values ($1, 'GIW', 'folha_itens_vinculo', $2, 'prestador_vinculo', $3, $4, $5, $5)
           on conflict (empresa_id, origem, entidade, legacy_id) do update
             set destino_tabela = excluded.destino_tabela, destino_id = excluded.destino_id,
                 checksum = excluded.checksum, ultima_execucao_id = excluded.ultima_execucao_id,
                 atualizado_em = now()`,
          [mapeamento.empresaId, chave, linha.vinculoId, linhaChecksum, execucao.rows[0].id],
        );
        await pool.query(
          `insert into importacao_registro
            (execucao_id, ordem, legacy_id, checksum, status, destino_tabela, destino_id, payload)
           values ($1, $2, $3, $4, 'INSERIDO', 'prestador_vinculo', $5, $6::jsonb)`,
          [execucao.rows[0].id, ordem + 1, chave, linhaChecksum, linha.vinculoId, JSON.stringify({ confirmadoPor: linha.confirmadoPor, justificativa: linha.justificativa })],
        );
      }
      await pool.query(
        `update importacao_execucao
            set status = 'CONCLUIDA', total_inseridos = $2, resumo = $3::jsonb, concluido_em = now()
          where id = $1`,
        [execucao.rows[0].id, validos.length, JSON.stringify(resumo)],
      );
      await pool.query("commit");
    } catch (erro) {
      await pool.query("rollback");
      throw erro;
    }
  }
} finally {
  await pool.end();
}
