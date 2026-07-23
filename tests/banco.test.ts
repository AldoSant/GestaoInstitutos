import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { hashJson } from "../lib/json-canonico";
import {
  CODIGO_REGRA_FOLHA_PRESTADOR,
  REGRA_FISCAL_2026,
} from "../lib/regras-fiscais";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

test(
  "migrações criam o schema e as restrições críticas",
  { skip: !databaseUrl },
  async () => {
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl:
        process.env.DATABASE_SSL === "true"
          ? {
              rejectUnauthorized:
                process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
            }
          : undefined,
    });
    const client = await pool.connect();

    try {
      const tabelas = await client.query<{ total: string }>(
        `select count(*)::text as total
           from information_schema.tables
          where table_schema = 'public'
            and table_type = 'BASE TABLE'`,
      );
      assert.equal(Number(tabelas.rows[0].total), 26);

      const restricoes = await client.query<{ conname: string }>(
        `select conname
           from pg_constraint
          where conname in (
            'ck_empresa_cnpj_formato',
            'ck_pessoa_documento_exclusivo',
            'ck_folha_item_total_liquido',
            'ck_obrigacao_total',
            'ck_importacao_totais',
            'ck_meta_valor_previsto',
            'ck_vinculo_carga_horaria',
            'ck_evento_natureza',
            'ck_evento_informativo_sem_incidencia',
            'ck_evento_recorrente_vigencia',
            'ck_pessoa_conta_tipo',
            'ck_dependente_cpf',
            'ex_vinculo_sem_sobreposicao',
            'ex_evento_recorrente_sem_sobreposicao',
            'ck_auditoria_acao',
            'ck_auditoria_conteudo',
            'ck_tarefa_tentativas',
            'ck_tarefa_execucao',
            'ck_tarefa_conclusao',
            'ck_tarefa_falha',
            'fk_prestador_empresa_pessoa',
            'fk_vinculo_empresa_prestador',
            'fk_vinculo_empresa_termo',
            'fk_vinculo_termo_meta',
            'fk_evento_recorrente_empresa_vinculo',
            'fk_folha_empresa_termo',
            'uq_regra_empresa_codigo_versao',
            'ck_regra_hash',
            'ex_regra_publicada_sem_sobreposicao'
          )`,
      );
      assert.equal(restricoes.rowCount, 29);

      const gatilhos = await client.query<{ tgname: string }>(
        `select tgname
           from pg_trigger
          where not tgisinternal
            and tgname in (
              'tr_auditar_vinculo',
              'tr_auditar_evento',
              'tr_auditar_evento_recorrente',
              'tr_auditar_folha',
              'tr_auditar_obrigacao',
              'tr_proteger_folha_fechada'
            )`,
      );
      assert.equal(gatilhos.rowCount, 6);

      await client.query("begin");
      const empresaId = randomUUID();
      await client.query(
        `insert into empresa (id, cnpj, razao_social)
         values ($1, '12345678000199', 'Empresa sintética de teste')`,
        [empresaId],
      );

      const outraEmpresaId = randomUUID();
      const pessoaOutraEmpresaId = randomUUID();
      await client.query(
        `insert into empresa (id, cnpj, razao_social)
         values ($1, '12345678000270', 'Outra empresa sintética')`,
        [outraEmpresaId],
      );
      await client.query(
        `insert into pessoa (id, empresa_id, tipo, nome_razao_social, cpf)
         values ($1, $2, 'FISICA', 'Pessoa de outra empresa', '98765432100')`,
        [pessoaOutraEmpresaId, outraEmpresaId],
      );

      await client.query("savepoint referencia_entre_empresas");
      await assert.rejects(
        client.query(
          `insert into prestador (empresa_id, pessoa_id, matricula)
           values ($1, $2, 'EMPRESA-ERRADA')`,
          [empresaId, pessoaOutraEmpresaId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "fk_prestador_empresa_pessoa",
      );
      await client.query("rollback to savepoint referencia_entre_empresas");

      const regraHash = hashJson(REGRA_FISCAL_2026);
      await client.query(
        `insert into regra_calculo_versao
           (empresa_id, codigo, versao, inicio_vigencia, fim_vigencia,
            parametros, fonte_normativa, hash_conteudo, publicada)
         values ($1, $2, 1, date '2026-01-01', date '2026-12-31',
                 $3, 'Fonte sintética de teste', $4, true)`,
        [
          empresaId,
          CODIGO_REGRA_FOLHA_PRESTADOR,
          REGRA_FISCAL_2026,
          regraHash,
        ],
      );

      await client.query("savepoint regra_global_duplicada");
      await assert.rejects(
        client.query(
          `insert into regra_calculo_versao
             (empresa_id, codigo, versao, inicio_vigencia,
              parametros, fonte_normativa, hash_conteudo)
           values ($1, $2, 1, date '2027-01-01',
                   $3, 'Fonte sintética', $4)`,
          [
            empresaId,
            CODIGO_REGRA_FOLHA_PRESTADOR,
            REGRA_FISCAL_2026,
            regraHash,
          ],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "uq_regra_empresa_codigo_versao",
      );
      await client.query("rollback to savepoint regra_global_duplicada");

      await client.query("savepoint regra_sobreposta");
      await assert.rejects(
        client.query(
          `insert into regra_calculo_versao
             (empresa_id, codigo, versao, inicio_vigencia, fim_vigencia,
              parametros, fonte_normativa, hash_conteudo, publicada)
           values ($1, $2, 2, date '2026-06-01', date '2027-05-31',
                   $3, 'Fonte sintética', $4, true)`,
          [
            empresaId,
            CODIGO_REGRA_FOLHA_PRESTADOR,
            REGRA_FISCAL_2026,
            regraHash,
          ],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "ex_regra_publicada_sem_sobreposicao",
      );
      await client.query("rollback to savepoint regra_sobreposta");

      await client.query("savepoint regra_hash_invalido");
      await assert.rejects(
        client.query(
          `insert into regra_calculo_versao
             (empresa_id, codigo, versao, inicio_vigencia,
              parametros, fonte_normativa, hash_conteudo)
           values ($1, $2, 3, date '2028-01-01',
                   $3, 'Fonte sintética', 'hash-invalido')`,
          [empresaId, CODIGO_REGRA_FOLHA_PRESTADOR, REGRA_FISCAL_2026],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "ck_regra_hash",
      );
      await client.query("rollback to savepoint regra_hash_invalido");

      await client.query("savepoint evento_informativo_invalido");
      await assert.rejects(
        client.query(
          `insert into evento
             (empresa_id, codigo, descricao, natureza, incide_inss)
           values ($1, 'INFO-INVALIDO', 'Informativo com incidência', 'INFORMATIVO', true)`,
          [empresaId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "ck_evento_informativo_sem_incidencia",
      );
      await client.query("rollback to savepoint evento_informativo_invalido");

      await client.query("savepoint documento_invalido");
      await assert.rejects(
        client.query(
          `insert into pessoa
             (empresa_id, tipo, nome_razao_social, cpf, cnpj)
           values ($1, 'FISICA', 'Pessoa inválida', '12345678901', '12345678000199')`,
          [empresaId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "ck_pessoa_documento_exclusivo",
      );
      await client.query("rollback to savepoint documento_invalido");

      await client.query("savepoint valor_invalido");
      await assert.rejects(
        client.query(
          `insert into atividade (empresa_id, codigo, descricao, valor)
           values ($1, 'TESTE', 'Atividade inválida', -0.01)`,
          [empresaId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "ck_atividade_valor",
      );
      await client.query("rollback to savepoint valor_invalido");

      const pessoaId = randomUUID();
      const prestadorId = randomUUID();
      const termoId = randomUUID();
      const metaId = randomUUID();
      const vinculoId = randomUUID();
      const eventoId = randomUUID();

      await client.query(
        `insert into pessoa (id, empresa_id, tipo, nome_razao_social, cpf)
         values ($1, $2, 'FISICA', 'Prestador concorrente', '98765432100')`,
        [pessoaId, empresaId],
      );
      await client.query(
        `insert into prestador (id, empresa_id, pessoa_id, matricula)
         values ($1, $2, $3, 'CONCORRENCIA-1')`,
        [prestadorId, empresaId, pessoaId],
      );
      await client.query(
        `insert into termo
           (id, empresa_id, numero, descricao, modalidade, inicio, valor_global)
         values ($1, $2, 'TERMO-CONCORRENCIA', 'Termo de teste', 'TESTE',
                 date '2026-01-01', 10000)`,
        [termoId, empresaId],
      );
      await client.query(
        `insert into termo_meta (id, termo_id, codigo, descricao)
         values ($1, $2, 'META-1', 'Meta de teste')`,
        [metaId, termoId],
      );
      await client.query(
        `insert into prestador_vinculo
           (id, empresa_id, prestador_id, termo_id, meta_id, atividade,
            inicio, fim, valor_retribuicao)
         values ($1, $2, $3, $4, $5, 'Atividade de teste',
                 date '2026-01-01', date '2026-06-30', 1000)`,
        [vinculoId, empresaId, prestadorId, termoId, metaId],
      );

      await client.query("savepoint vinculo_sobreposto");
      await assert.rejects(
        client.query(
          `insert into prestador_vinculo
             (empresa_id, prestador_id, termo_id, meta_id, atividade,
              inicio, fim, valor_retribuicao)
           values ($1, $2, $3, $4, 'Atividade concorrente',
                   date '2026-06-01', date '2026-12-31', 1000)`,
          [empresaId, prestadorId, termoId, metaId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "ex_vinculo_sem_sobreposicao",
      );
      await client.query("rollback to savepoint vinculo_sobreposto");

      await client.query(
        `insert into evento
           (id, empresa_id, codigo, descricao, natureza, tipo_calculo)
         values ($1, $2, 'EVENTO-CONCORRENCIA', 'Evento de teste', 'PROVENTO', 'VALOR')`,
        [eventoId, empresaId],
      );
      await client.query(
        `insert into lancamento_evento_recorrente
           (empresa_id, vinculo_id, evento_id, valor, inicio_competencia, fim_competencia)
         values ($1, $2, $3, 100, date '2026-01-01', date '2026-06-01')`,
        [empresaId, vinculoId, eventoId],
      );

      await client.query("savepoint evento_sobreposto");
      await assert.rejects(
        client.query(
          `insert into lancamento_evento_recorrente
             (empresa_id, vinculo_id, evento_id, valor,
              inicio_competencia, fim_competencia)
           values ($1, $2, $3, 200, date '2026-06-01', date '2026-12-01')`,
          [empresaId, vinculoId, eventoId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "ex_evento_recorrente_sem_sobreposicao",
      );
      await client.query("rollback to savepoint evento_sobreposto");

      await client.query(
        `insert into auditoria
           (empresa_id, ator, entidade, registro_id, acao, dados_posteriores)
         values ($1, 'TESTE_AUTOMATIZADO', 'empresa', $1, 'CRIACAO',
                 '{"origem":"teste"}'::jsonb)`,
        [empresaId],
      );

      await client.query("savepoint tarefa_concluida_incompleta");
      await assert.rejects(
        client.query(
          `insert into tarefa_processamento
             (empresa_id, tipo, chave_idempotencia, status, payload)
           values ($1, 'FOLHA', '2026-01:1', 'CONCLUIDA', '{}'::jsonb)`,
          [empresaId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "ck_tarefa_conclusao",
      );
      await client.query("rollback to savepoint tarefa_concluida_incompleta");

      await client.query(
        `insert into tarefa_processamento
           (empresa_id, tipo, chave_idempotencia, payload)
         values ($1, 'FOLHA', '2026-01:1', '{"folhaId":"teste"}'::jsonb)`,
        [empresaId],
      );
      await client.query("savepoint tarefa_duplicada");
      await assert.rejects(
        client.query(
          `insert into tarefa_processamento
             (empresa_id, tipo, chave_idempotencia, payload)
           values ($1, 'FOLHA', '2026-01:1', '{}'::jsonb)`,
          [empresaId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "uq_tarefa_idempotencia",
      );
      await client.query("rollback to savepoint tarefa_duplicada");

      const folhaId = randomUUID();
      await client.query(
        `select set_config('app.ator', 'TESTE_AUTOMATIZADO', true)`,
      );
      await client.query(
        `insert into folha
           (id, empresa_id, termo_id, meta_id, competencia, numero,
            status, processada_em, fechada_em)
         values ($1, $2, $3, $4, date '2026-01-01', 1,
                 'FECHADA', now(), now())`,
        [folhaId, empresaId, termoId, metaId],
      );

      await client.query("savepoint folha_fechada_imutavel");
      await assert.rejects(
        client.query(
          `update folha set hash_resultado = repeat('a', 64) where id = $1`,
          [folhaId],
        ),
        (error: unknown) =>
          error instanceof Error && "code" in error && error.code === "55000",
      );
      await client.query("rollback to savepoint folha_fechada_imutavel");

      await client.query(
        `select set_config('app.permitir_reabertura', 'true', true),
                set_config('app.motivo', 'Correção controlada de teste', true)`,
      );
      const reaberta = await client.query<{
        status: string;
        fechada_em: Date | null;
      }>(
        `update folha
            set status = 'ABERTA', atualizado_em = now()
          where id = $1
        returning status, fechada_em`,
        [folhaId],
      );
      assert.equal(reaberta.rows[0].status, "ABERTA");
      assert.equal(reaberta.rows[0].fechada_em, null);

      const auditoriaReabertura = await client.query<{ total: string }>(
        `select count(*)::text total
           from auditoria
          where empresa_id = $1
            and entidade = 'folha'
            and registro_id = $2
            and acao = 'REABERTURA'
            and ator = 'TESTE_AUTOMATIZADO'
            and motivo = 'Correção controlada de teste'`,
        [empresaId, folhaId],
      );
      assert.equal(Number(auditoriaReabertura.rows[0].total), 1);

      await client.query("rollback");
    } finally {
      client.release();
      await pool.end();
    }
  },
);
