import type { PoolClient } from "pg";
import {
  conteudoFontesConsolidacao,
  normalizarAtualizacaoCaso,
  type FonteConsolidacao,
} from "@/lib/caso-consolidacao";
import { hashJson } from "@/lib/json-canonico";
import { getPool } from "./index";

export type ExecutorConsolidacao = Pick<PoolClient, "query">;

type ConflitoConsolidacao = {
  pessoa_id: string;
  nome: string;
  documento: string;
  matricula: string;
  quantidade_vinculos: number;
  retribuicao_prevista: string;
  base_outras_fontes: string;
  medicao_pendente: boolean;
  fontes: FonteConsolidacao[];
  hash_fontes: string;
};

export type CasoConsolidacao = {
  id: string;
  pessoa_id: string;
  nome: string;
  documento: string;
  matricula: string;
  competencia: string;
  hash_fontes: string;
  status: "PENDENTE" | "EM_ANALISE" | "RESOLVIDO" | "INVALIDADO";
  decisao:
    | "UNIFICAR_VINCULOS"
    | "RATEIO_NECESSARIO"
    | "NAO_APLICAVEL"
    | null;
  justificativa: string;
  responsavel: string | null;
  resolvido_em: Date | null;
  criado_por: string;
  criado_em: Date;
  atualizado_em: Date;
  fontes: Array<
    FonteConsolidacao & {
      snapshot: Record<string, unknown>;
    }
  >;
};

function validarId(valor: string, campo: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      valor,
    )
  ) {
    throw new Error(`${campo} inválido.`);
  }
  return valor;
}

function validarAtor(valor: string) {
  const ator = valor.trim();
  if (ator.length < 3 || ator.length > 160) {
    throw new Error("O responsável deve ter entre 3 e 160 caracteres.");
  }
  return ator;
}

export function competenciaConsolidacao(valor: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) {
    throw new Error("Competência deve usar o formato AAAA-MM.");
  }
  return `${valor}-01`;
}

async function executarDiagnostico(
  executor: ExecutorConsolidacao,
  empresaId: string,
  competencia: string,
) {
  const data = competenciaConsolidacao(competencia);
  const [universo, conflitos] = await Promise.all([
    executor.query<{
      pessoas: number;
      vinculos: number;
      medicoes_pendentes: number;
    }>(
      `select count(distinct prestador.pessoa_id)::int pessoas,
              count(distinct vinculo.id)::int vinculos,
              count(distinct vinculo.id) filter (
                where vinculo.exige_medicao_mensal and medicao.id is null
              )::int medicoes_pendentes
         from prestador_vinculo vinculo
         join prestador
           on prestador.id = vinculo.prestador_id
          and prestador.empresa_id = vinculo.empresa_id
          and prestador.ativo
         join pessoa
           on pessoa.id = prestador.pessoa_id
          and pessoa.empresa_id = vinculo.empresa_id
          and pessoa.ativo
         left join medicao_mensal medicao
           on medicao.empresa_id = vinculo.empresa_id
          and medicao.vinculo_id = vinculo.id
          and medicao.competencia = $2::date
        where vinculo.empresa_id = $1
          and vinculo.ativo
          and vinculo.inicio <= $2::date
          and (vinculo.fim is null or vinculo.fim >= $2::date)`,
      [empresaId, data],
    ),
    executor.query<Omit<ConflitoConsolidacao, "hash_fontes">>(
      `with fontes as (
         select pessoa.id pessoa_id, pessoa.nome_razao_social nome,
                coalesce(pessoa.cpf, pessoa.cnpj, '') documento,
                prestador.matricula, vinculo.id vinculo_id,
                termo.id termo_id, termo.numero termo_numero,
                meta.id meta_id, meta.codigo meta_codigo,
                vinculo.atividade,
                vinculo.valor_retribuicao::text valor_contratual,
                coalesce(
                  medicao.valor_apurado,
                  vinculo.valor_retribuicao
                )::text valor_previsto,
                vinculo.exige_medicao_mensal,
                medicao.id medicao_id, medicao.tipo medicao_tipo,
                folha.id folha_id, folha.numero folha_numero,
                folha.status::text folha_status
           from prestador_vinculo vinculo
           join prestador
             on prestador.id = vinculo.prestador_id
            and prestador.empresa_id = vinculo.empresa_id
            and prestador.ativo
           join pessoa
             on pessoa.id = prestador.pessoa_id
            and pessoa.empresa_id = vinculo.empresa_id
            and pessoa.ativo
           join termo
             on termo.id = vinculo.termo_id
            and termo.empresa_id = vinculo.empresa_id
           join termo_meta meta
             on meta.id = vinculo.meta_id and meta.termo_id = termo.id
           left join medicao_mensal medicao
             on medicao.empresa_id = vinculo.empresa_id
            and medicao.vinculo_id = vinculo.id
            and medicao.competencia = $2::date
           left join lateral (
             select f.id, f.numero, f.status
               from folha f
              where f.empresa_id = vinculo.empresa_id
                and f.termo_id = vinculo.termo_id
                and f.meta_id = vinculo.meta_id
                and f.competencia = $2::date
                and f.status <> 'CANCELADA'
              order by f.numero desc
              limit 1
           ) folha on true
          where vinculo.empresa_id = $1
            and vinculo.ativo
            and vinculo.inicio <= $2::date
            and (vinculo.fim is null or vinculo.fim >= $2::date)
       )
       select fonte.pessoa_id, fonte.nome, fonte.documento,
              min(fonte.matricula) matricula,
              count(*)::int quantidade_vinculos,
              sum(fonte.valor_previsto::numeric)::text retribuicao_prevista,
              coalesce(
                (
                  select sum(outra.base_contribuicao)
                    from contribuicao_outra_fonte outra
                    join prestador prestador_outra
                      on prestador_outra.id = outra.prestador_id
                     and prestador_outra.empresa_id = outra.empresa_id
                   where outra.empresa_id = $1
                     and outra.competencia = $2::date
                     and outra.comprovante_verificado
                     and prestador_outra.pessoa_id = fonte.pessoa_id
                ),
                0
              )::text base_outras_fontes,
              bool_or(
                fonte.exige_medicao_mensal and fonte.medicao_id is null
              ) medicao_pendente,
              jsonb_agg(
                jsonb_build_object(
                  'vinculoId', fonte.vinculo_id,
                  'termoId', fonte.termo_id,
                  'termoNumero', fonte.termo_numero,
                  'metaId', fonte.meta_id,
                  'metaCodigo', fonte.meta_codigo,
                  'atividade', fonte.atividade,
                  'valorContratual', fonte.valor_contratual,
                  'valorPrevisto', fonte.valor_previsto,
                  'exigeMedicao', fonte.exige_medicao_mensal,
                  'medicaoId', fonte.medicao_id,
                  'medicaoTipo', fonte.medicao_tipo,
                  'folhaId', fonte.folha_id,
                  'folhaNumero', fonte.folha_numero,
                  'folhaStatus', fonte.folha_status
                )
                order by fonte.termo_numero, fonte.meta_codigo, fonte.vinculo_id
              ) fontes
         from fontes fonte
        group by fonte.pessoa_id, fonte.nome, fonte.documento
       having count(*) > 1
        order by fonte.nome`,
      [empresaId, data],
    ),
  ]);
  const resumo = universo.rows[0] ?? {
    pessoas: 0,
    vinculos: 0,
    medicoes_pendentes: 0,
  };
  const linhas: ConflitoConsolidacao[] = conflitos.rows.map((conflito) => ({
    ...conflito,
    hash_fontes: hashJson(
      conteudoFontesConsolidacao({
        competencia,
        pessoaId: conflito.pessoa_id,
        baseOutrasFontes: conflito.base_outras_fontes,
        fontes: conflito.fontes,
      }),
    ),
  }));
  return {
    competencia,
    pessoas: resumo.pessoas,
    vinculos: resumo.vinculos,
    medicoesPendentes: resumo.medicoes_pendentes,
    pessoasMultilote: conflitos.rowCount ?? conflitos.rows.length,
    conflitos: linhas,
  };
}

export async function diagnosticarConsolidacaoMensal(
  empresaId: string,
  competencia: string,
  executor: ExecutorConsolidacao = getPool(),
) {
  validarId(empresaId, "Empresa");
  return executarDiagnostico(executor, empresaId, competencia);
}

export async function listarCasosConsolidacao(
  empresaId: string,
  competencia: string,
  executor: ExecutorConsolidacao = getPool(),
) {
  validarId(empresaId, "Empresa");
  const data = competenciaConsolidacao(competencia);
  const resultado = await executor.query<CasoConsolidacao>(
    `select caso.id, caso.pessoa_id, pessoa.nome_razao_social nome,
            coalesce(pessoa.cpf, pessoa.cnpj, '') documento,
            prestador.matricula, caso.competencia::text,
            caso.hash_fontes, caso.status, caso.decisao,
            caso.justificativa, caso.responsavel, caso.resolvido_em,
            caso.criado_por, caso.criado_em, caso.atualizado_em,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'vinculoId', fonte.vinculo_id,
                  'termoId', fonte.snapshot->>'termoId',
                  'termoNumero', fonte.termo_numero,
                  'metaId', fonte.snapshot->>'metaId',
                  'metaCodigo', fonte.meta_codigo,
                  'atividade', fonte.atividade,
                  'valorContratual', fonte.valor_contratual::text,
                  'valorPrevisto', fonte.valor_previsto::text,
                  'exigeMedicao', fonte.exige_medicao,
                  'medicaoId', fonte.medicao_id,
                  'medicaoTipo', fonte.medicao_tipo,
                  'folhaId', fonte.folha_id,
                  'folhaNumero', fonte.folha_numero,
                  'folhaStatus', fonte.folha_status,
                  'snapshot', fonte.snapshot
                )
                order by fonte.termo_numero, fonte.meta_codigo, fonte.vinculo_id
              ) filter (where fonte.id is not null),
              '[]'::jsonb
            ) fontes
       from consolidacao_mensal_caso caso
       join pessoa
         on pessoa.empresa_id = caso.empresa_id and pessoa.id = caso.pessoa_id
       join lateral (
         select min(p.matricula) matricula
           from prestador p
          where p.empresa_id = caso.empresa_id
            and p.pessoa_id = caso.pessoa_id
       ) prestador on prestador.matricula is not null
       left join consolidacao_mensal_fonte fonte
         on fonte.empresa_id = caso.empresa_id and fonte.caso_id = caso.id
      where caso.empresa_id = $1 and caso.competencia = $2::date
      group by caso.id, pessoa.nome_razao_social, pessoa.cpf, pessoa.cnpj,
               prestador.matricula
      order by (caso.status = 'INVALIDADO'), pessoa.nome_razao_social,
               caso.criado_em desc`,
    [empresaId, data],
  );
  return resultado.rows;
}

export async function materializarCasosConsolidacao({
  empresaId,
  competencia,
  ator,
}: {
  empresaId: string;
  competencia: string;
  ator: string;
}) {
  validarId(empresaId, "Empresa");
  const data = competenciaConsolidacao(competencia);
  const responsavel = validarAtor(ator);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      `CONSOLIDACAO:${empresaId}:${data}`,
    ]);
    await client.query(
      `select set_config('app.ator', $1, true),
              set_config('app.motivo', $2, true)`,
      [
        responsavel,
        `Materialização dos casos de consolidação ${competencia}.`,
      ],
    );
    const diagnostico = await executarDiagnostico(
      client,
      empresaId,
      competencia,
    );
    const hashesAtuais = diagnostico.conflitos.map((conflito) => ({
      pessoaId: conflito.pessoa_id,
      hashFontes: conflito.hash_fontes,
    }));
    const invalidados = await client.query(
      `with atual as (
         select item."pessoaId" pessoa_id, item."hashFontes" hash_fontes
           from jsonb_to_recordset($3::jsonb)
                as item("pessoaId" uuid, "hashFontes" text)
       )
       update consolidacao_mensal_caso caso
          set status = 'INVALIDADO', atualizado_em = now()
        where caso.empresa_id = $1
          and caso.competencia = $2::date
          and caso.status <> 'INVALIDADO'
          and not exists (
            select 1 from atual
             where atual.pessoa_id = caso.pessoa_id
               and atual.hash_fontes = caso.hash_fontes
          )
      returning caso.id`,
      [empresaId, data, JSON.stringify(hashesAtuais)],
    );

    let criados = 0;
    let reutilizados = 0;
    let reativados = 0;
    for (const conflito of diagnostico.conflitos) {
      const existente = await client.query<{
        id: string;
        status: CasoConsolidacao["status"];
      }>(
        `select id, status
           from consolidacao_mensal_caso
          where empresa_id = $1 and competencia = $2::date
            and pessoa_id = $3 and hash_fontes = $4
          for update`,
        [empresaId, data, conflito.pessoa_id, conflito.hash_fontes],
      );
      let casoId = existente.rows[0]?.id;
      if (casoId && existente.rows[0].status === "INVALIDADO") {
        await client.query(
          `update consolidacao_mensal_caso
              set status = 'PENDENTE', decisao = null, justificativa = '',
                  responsavel = null, resolvido_em = null, atualizado_em = now()
            where empresa_id = $1 and id = $2`,
          [empresaId, casoId],
        );
        reativados += 1;
      } else if (casoId) {
        reutilizados += 1;
      } else {
        const inserido = await client.query<{ id: string }>(
          `insert into consolidacao_mensal_caso
             (empresa_id, pessoa_id, competencia, hash_fontes, criado_por)
           values ($1, $2, $3::date, $4, $5)
           returning id`,
          [
            empresaId,
            conflito.pessoa_id,
            data,
            conflito.hash_fontes,
            responsavel,
          ],
        );
        casoId = inserido.rows[0].id;
        for (const fonte of conflito.fontes) {
          await client.query(
            `insert into consolidacao_mensal_fonte
               (empresa_id, caso_id, vinculo_id, medicao_id, folha_id,
                termo_numero, meta_codigo, atividade, valor_contratual,
                valor_previsto, exige_medicao, medicao_tipo, folha_numero,
                folha_status, snapshot)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                     $13, $14, $15)`,
            [
              empresaId,
              casoId,
              fonte.vinculoId,
              fonte.medicaoId,
              fonte.folhaId,
              fonte.termoNumero,
              fonte.metaCodigo,
              fonte.atividade,
              fonte.valorContratual,
              fonte.valorPrevisto,
              fonte.exigeMedicao,
              fonte.medicaoTipo,
              fonte.folhaNumero,
              fonte.folhaStatus,
              {
                ...fonte,
                pessoaId: conflito.pessoa_id,
                nome: conflito.nome,
                documento: conflito.documento,
                baseOutrasFontes: conflito.base_outras_fontes,
              },
            ],
          );
        }
        criados += 1;
      }
    }
    await client.query("commit");
    return {
      totalConflitos: diagnostico.pessoasMultilote,
      criados,
      reutilizados,
      reativados,
      invalidados: invalidados.rowCount ?? 0,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function atualizarCasoConsolidacao({
  empresaId,
  casoId,
  status,
  decisao,
  justificativa,
  responsavel,
}: {
  empresaId: string;
  casoId: string;
  status: string;
  decisao?: string | null;
  justificativa: string;
  responsavel: string;
}) {
  validarId(empresaId, "Empresa");
  validarId(casoId, "Caso");
  const dados = normalizarAtualizacaoCaso({
    status,
    decisao,
    justificativa,
    responsavel,
  });
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `select set_config('app.ator', $1, true),
              set_config('app.motivo', $2, true)`,
      [
        dados.responsavel,
        `Revisão do caso mensal: ${dados.status}.`,
      ],
    );
    const bloqueado = await client.query<{
      status: CasoConsolidacao["status"];
      competencia: string;
      pessoa_id: string;
      hash_fontes: string;
    }>(
      `select status, competencia::text, pessoa_id, hash_fontes
         from consolidacao_mensal_caso
        where empresa_id = $1 and id = $2
        for update`,
      [empresaId, casoId],
    );
    if (!bloqueado.rows[0]) throw new Error("Caso de consolidação não encontrado.");
    if (bloqueado.rows[0].status === "INVALIDADO") {
      throw new Error(
        "Este caso foi invalidado por mudança nas fontes e não pode ser decidido.",
      );
    }
    const competencia = bloqueado.rows[0].competencia.slice(0, 7);
    const diagnosticoAtual = await executarDiagnostico(
      client,
      empresaId,
      competencia,
    );
    const aindaAtual = diagnosticoAtual.conflitos.some(
      (conflito) =>
        conflito.pessoa_id === bloqueado.rows[0].pessoa_id &&
        conflito.hash_fontes === bloqueado.rows[0].hash_fontes,
    );
    if (!aindaAtual) {
      await client.query(
        `update consolidacao_mensal_caso
            set status = 'INVALIDADO', atualizado_em = now()
          where empresa_id = $1 and id = $2`,
        [empresaId, casoId],
      );
      await client.query("commit");
      return { id: casoId, status: "INVALIDADO" as const };
    }
    await client.query(
      `update consolidacao_mensal_caso
          set status = $3, decisao = $4, justificativa = $5,
              responsavel = $6, resolvido_em = $7, atualizado_em = now()
        where empresa_id = $1 and id = $2`,
      [
        empresaId,
        casoId,
        dados.status,
        dados.decisao,
        dados.justificativa,
        dados.responsavel,
        dados.resolvidoEm,
      ],
    );
    await client.query("commit");
    return { id: casoId, ...dados };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
