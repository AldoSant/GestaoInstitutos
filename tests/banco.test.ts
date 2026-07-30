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
      assert.equal(Number(tabelas.rows[0].total), 57);

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
            'ex_regra_publicada_sem_sobreposicao',
            'ck_folha_revisao',
            'fk_folha_item_empresa_folha',
            'fk_folha_item_empresa_vinculo',
            'fk_folha_item_evento_empresa_item',
            'ck_folha_item_evento_natureza',
            'ck_folha_item_evento_origem',
            'ck_folha_item_evento_tipo_calculo',
            'ck_folha_item_evento_valores',
            'fk_outra_fonte_empresa_prestador',
            'ck_outra_fonte_competencia_mes',
            'ck_outra_fonte_documento',
            'ck_outra_fonte_valores',
            'fk_obrigacao_item_empresa_obrigacao',
            'fk_obrigacao_item_empresa_folha_item',
            'ck_obrigacao_item_natureza',
            'ck_obrigacao_item_origem',
            'ck_obrigacao_item_valores',
            'ck_enquadramento_regime',
            'ck_enquadramento_vigencia',
            'ck_enquadramento_aliquotas',
            'ck_enquadramento_cenario',
            'ex_enquadramento_publicado_sem_sobreposicao',
            'fk_folha_empresa_enquadramento',
            'ck_obrigacao_valor_declarado',
            'fk_obrigacao_documento_empresa_obrigacao',
            'ck_obrigacao_documento_tipo',
            'ck_obrigacao_documento_valor',
            'ck_obrigacao_documento_hash',
            'fk_folha_conferencia_empresa_folha',
            'ck_folha_conferencia_revisao',
            'ck_folha_conferencia_resultado',
            'ck_folha_conferencia_hash',
            'ck_folha_conferencia_aprovacao',
            'ck_folha_conferencia_rejeicao',
            'fk_medicao_empresa_vinculo',
            'ck_medicao_competencia_mes',
            'ck_medicao_tipo',
            'ck_medicao_valores_nao_negativos',
            'ck_medicao_campos_tipo',
            'ck_medicao_evidencia',
            'fk_folha_item_empresa_medicao',
            'fk_folha_homologacao_empresa_folha',
            'ck_folha_homologacao_revisao',
            'ck_folha_homologacao_hashes',
            'ck_folha_homologacao_origem',
            'ck_folha_homologacao_status',
            'ck_folha_homologacao_contagens',
            'fk_folha_homologacao_item_empresa_lote',
            'fk_folha_homologacao_item_empresa_folha_item',
            'ck_folha_homologacao_item_situacao',
            'ck_folha_homologacao_item_nao_negativo',
            'ck_folha_homologacao_item_diferencas',
            'ck_obrigacao_folha_revisao',
            'ck_obrigacao_folha_hash',
            'fk_consolidacao_caso_empresa_pessoa',
            'ck_consolidacao_caso_competencia',
            'ck_consolidacao_caso_hash',
            'ck_consolidacao_caso_status',
            'ck_consolidacao_caso_decisao',
            'ck_consolidacao_caso_resolucao',
            'fk_consolidacao_fonte_empresa_caso',
            'fk_consolidacao_fonte_empresa_vinculo',
            'fk_consolidacao_fonte_empresa_medicao',
            'fk_consolidacao_fonte_empresa_folha',
            'ck_consolidacao_fonte_valores',
            'fk_homologacao_competencia_empresa',
            'ck_homologacao_competencia_mes',
            'ck_homologacao_competencia_versao',
            'ck_homologacao_competencia_hash',
            'ck_homologacao_competencia_status',
            'ck_homologacao_competencia_resumo',
            'ck_homologacao_competencia_decisao',
            'fk_homologacao_item_empresa_lote',
            'ck_homologacao_item_tipo',
            'ck_homologacao_item_status',
            'ck_homologacao_item_contagens',
            'ck_homologacao_item_estado_contagens',
            'ck_homologacao_item_hash',
            'ck_homologacao_item_detalhes',
            'fk_simulacao_fiscal_empresa_caso',
            'fk_simulacao_fiscal_empresa_pessoa',
            'fk_simulacao_fiscal_regra',
            'fk_simulacao_fiscal_empresa_enquadramento',
            'ck_simulacao_fiscal_competencia',
            'ck_simulacao_fiscal_versao',
            'ck_simulacao_fiscal_status',
            'ck_simulacao_fiscal_hipotese',
            'ck_simulacao_fiscal_hashes',
            'ck_simulacao_fiscal_valores',
            'ck_simulacao_fiscal_memoria',
            'ck_simulacao_fiscal_decisao',
            'fk_simulacao_fonte_empresa_simulacao',
            'fk_simulacao_fonte_empresa_vinculo',
            'fk_simulacao_fonte_empresa_medicao',
            'fk_simulacao_fonte_empresa_folha',
            'ck_simulacao_fonte_ordem',
            'ck_simulacao_fonte_hash',
            'ck_simulacao_fonte_valores',
            'ck_simulacao_fonte_snapshot',
            'fk_legado_folha_empresa',
            'ck_legado_folha_competencia',
            'ck_legado_folha_valores',
            'ck_legado_folha_checksum',
            'ck_legado_folha_snapshot',
            'fk_legado_folha_item_empresa_folha',
            'ck_legado_folha_item_cpf',
            'ck_legado_folha_item_valores',
            'ck_legado_folha_item_snapshot',
            'fk_legado_folha_rubrica_empresa_item',
            'ck_legado_folha_rubrica_natureza',
            'ck_legado_folha_rubrica_valores',
            'ck_legado_folha_rubrica_snapshot',
            'fk_legado_guia_empresa',
            'ck_legado_guia_competencia',
            'ck_legado_guia_tipo',
            'ck_legado_guia_valores',
            'ck_legado_guia_folhas',
            'ck_legado_guia_checksum',
            'ck_legado_guia_snapshot',
            'fk_retificacao_empresa',
            'fk_retificacao_empresa_obrigacao',
            'ck_retificacao_versao',
            'ck_retificacao_status',
            'ck_retificacao_motivo',
            'ck_retificacao_responsavel',
            'ck_retificacao_hash',
            'ck_retificacao_snapshot',
            'ck_retificacao_resultado',
            'ck_retificacao_conclusao',
            'fk_fgts_apuracao_empresa',
            'ck_fgts_apuracao_competencia',
            'ck_fgts_apuracao_versao',
            'ck_fgts_apuracao_status',
            'ck_fgts_apuracao_valores',
            'ck_fgts_apuracao_hash',
            'ck_fgts_apuracao_snapshot',
            'ck_fgts_apuracao_responsavel',
            'ck_fgts_apuracao_conciliacao',
            'fk_fgts_item_empresa',
            'fk_fgts_item_empresa_apuracao',
            'fk_fgts_item_empresa_pessoa',
            'ck_fgts_item_categoria',
            'ck_fgts_item_identificacao',
            'ck_fgts_item_valores',
            'ck_fgts_item_totalizador',
            'ck_fgts_item_hash',
            'ck_fgts_item_snapshot',
            'fk_esocial_evento_empresa',
            'fk_esocial_evento_empresa_apuracao',
            'ck_esocial_evento_competencia',
            'ck_esocial_evento_ambiente',
            'ck_esocial_evento_tipo',
            'ck_esocial_evento_estado',
            'ck_esocial_evento_payload',
            'ck_esocial_evento_hash',
            'ck_esocial_evento_resposta',
            'ck_esocial_evento_transmissao',
            'ck_esocial_evento_conclusao',
            'ck_esocial_evento_aceite',
            'fk_fgts_guia_empresa',
            'fk_fgts_guia_empresa_apuracao',
            'ck_fgts_guia_tipo',
            'ck_fgts_guia_status',
            'ck_fgts_guia_datas',
            'ck_fgts_guia_valores',
            'ck_fgts_guia_hashes',
            'ck_fgts_guia_conteudo',
            'ck_fgts_guia_pagamento',
            'ck_demonstrativo_competencia',
            'ck_demonstrativo_totais',
            'ck_demonstrativo_fechamento',
            'fk_pagamento_empresa_demonstrativo',
            'ck_pagamento_tipo_origem',
            'ck_pagamento_beneficiario',
            'ck_pagamento_valores',
            'fk_pagamento_retencao_empresa_pagamento',
            'ck_pagamento_retencao_matriz',
            'fk_demonstrativo_obrigacao_obrigacao',
            'ck_classificacao_legado_natureza',
            'ck_classificacao_legado_decisao',
            'fk_demonstrativo_conferencia_empresa_demonstrativo',
            'ck_demonstrativo_conferencia_resultado',
            'ck_demonstrativo_conferencia_revisao',
            'ck_demonstrativo_conferencia_hash',
            'ck_demonstrativo_conferencia_conferente',
            'ck_demonstrativo_conferencia_aprovacao',
            'ck_demonstrativo_conferencia_rejeicao',
            'fk_demonstrativo_revisao_empresa',
            'fk_demonstrativo_revisao_empresa_demonstrativo',
            'ck_demonstrativo_revisao_sequencia',
            'ck_demonstrativo_revisao_hash',
            'ck_demonstrativo_revisao_motivo',
            'ck_demonstrativo_revisao_responsavel',
            'ck_demonstrativo_revisao_snapshot'
          )`,
      );
      assert.equal(restricoes.rowCount, 223);

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
              'tr_proteger_folha_fechada',
              'tr_proteger_folha_item_fechado',
              'tr_proteger_folha_evento_fechado',
              'tr_proteger_regra_calculo_utilizada',
              'tr_auditar_folha_item',
              'tr_auditar_folha_item_evento',
              'tr_auditar_contribuicao_outra_fonte',
              'tr_auditar_obrigacao_item',
              'tr_proteger_enquadramento_utilizado',
              'tr_auditar_enquadramento_previdenciario',
              'tr_auditar_obrigacao_documento',
              'tr_proteger_conferencia_folha',
              'tr_auditar_conferencia_folha',
              'tr_proteger_medicao_fechada',
              'tr_auditar_medicao_mensal',
              'tr_proteger_folha_homologacao',
              'tr_proteger_folha_homologacao_item',
              'tr_auditar_folha_homologacao',
              'tr_proteger_exclusao_consolidacao_caso',
              'tr_proteger_consolidacao_fonte',
              'tr_auditar_consolidacao_caso',
              'tr_auditar_consolidacao_fonte',
              'tr_proteger_exclusao_homologacao_competencia',
              'tr_proteger_item_homologacao_competencia',
              'tr_auditar_homologacao_competencia',
              'tr_auditar_homologacao_competencia_item',
              'tr_proteger_simulacao_fiscal',
              'tr_proteger_simulacao_fiscal_fonte',
              'tr_auditar_simulacao_fiscal',
              'tr_auditar_simulacao_fiscal_fonte',
              'tr_proteger_retificacao_obrigacao',
              'tr_auditar_retificacao_obrigacao',
              'tr_proteger_evento_esocial',
              'tr_proteger_guia_fgts',
              'tr_auditar_fgts_apuracao',
              'tr_auditar_fgts_apuracao_item',
              'tr_auditar_evento_esocial',
              'tr_auditar_guia_fgts',
              'ct_pagamento_retencoes_total',
              'ct_pagamento_total_retencoes',
              'ct_demonstrativo_pagamentos_total',
              'ct_demonstrativo_total_pagamentos',
              'tr_pagamento_demonstrativo_fechado',
              'tr_retencao_demonstrativo_fechado',
              'tr_proteger_demonstrativo_conferencia',
              'tr_proteger_demonstrativo_revisao',
              'tr_auditar_demonstrativo_revisao'
            )`,
      );
      assert.equal(gatilhos.rowCount, 52);

      const auditoriaImportacao = await client.query<{
        dry_runs: number;
        dry_runs_com_fonte: number;
        movimentos_mapeados: number;
      }>(
        `select
           (
             select count(*)::int
               from importacao_execucao
              where origem = 'GIW' and modo = 'DRY_RUN'
                and status = 'CONCLUIDA'
           ) dry_runs,
           (
             select count(*)::int
               from importacao_execucao
              where origem = 'GIW' and modo = 'DRY_RUN'
                and status = 'CONCLUIDA'
                and resumo->'fonte'->>'sistema' = 'GIW'
                and coalesce(resumo->'fonte'->>'formulario', '') <> ''
                and coalesce(resumo->'fonte'->>'extraidoEm', '') <> ''
           ) dry_runs_com_fonte,
           (
             select count(*)::int
               from legado_chave
              where origem = 'GIW'
                and (entidade, destino_tabela) in (
                  ('eventos', 'evento'),
                  ('lancamentos_eventos', 'lancamento_evento_recorrente'),
                  ('produtividade', 'medicao_mensal')
                )
           ) movimentos_mapeados`,
      );
      if (process.env.CI === "true") {
        assert.ok(auditoriaImportacao.rows[0].dry_runs >= 1);
        assert.equal(
          auditoriaImportacao.rows[0].dry_runs_com_fonte,
          auditoriaImportacao.rows[0].dry_runs,
        );
        assert.equal(auditoriaImportacao.rows[0].movimentos_mapeados, 3);
      }

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

      await client.query("savepoint vigencias_termo");
      await client.query(
        `insert into termo
           (empresa_id, numero, descricao, modalidade, inicio, valor_global)
         values
           ($1, 'TERMO-VERSIONADO', 'Versão inicial', 'TESTE', date '2026-01-01', 1),
           ($1, 'TERMO-VERSIONADO', 'Versão posterior', 'TESTE', date '2026-04-01', 1)`,
        [empresaId],
      );
      await assert.rejects(
        client.query(
          `insert into termo
             (empresa_id, numero, descricao, modalidade, inicio, valor_global)
           values ($1, 'TERMO-VERSIONADO', 'Duplicado', 'TESTE',
                   date '2026-04-01', 1)`,
          [empresaId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "uq_termo_empresa_numero_inicio",
      );
      await client.query("rollback to savepoint vigencias_termo");

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

      const casoConsolidacaoId = randomUUID();
      const fonteConsolidacaoId = randomUUID();
      await client.query(
        `select set_config('app.ator', 'TESTE_AUTOMATIZADO', true),
                set_config(
                  'app.motivo',
                  'Teste de integridade da consolidação mensal.',
                  true
                )`,
      );
      await client.query(
        `insert into consolidacao_mensal_caso
           (id, empresa_id, pessoa_id, competencia, hash_fontes, criado_por)
         values ($1, $2, $3, date '2026-01-01', repeat('a', 64),
                 'TESTE_AUTOMATIZADO')`,
        [casoConsolidacaoId, empresaId, pessoaId],
      );
      await client.query(
        `insert into consolidacao_mensal_fonte
           (id, empresa_id, caso_id, vinculo_id, termo_numero, meta_codigo,
            atividade, valor_contratual, valor_previsto, exige_medicao,
            snapshot)
         values ($1, $2, $3, $4, 'TERMO-CONCORRENCIA', 'META-1',
                 'Atividade de teste', 1000, 1000, false,
                 '{"origem":"teste"}'::jsonb)`,
        [
          fonteConsolidacaoId,
          empresaId,
          casoConsolidacaoId,
          vinculoId,
        ],
      );

      await client.query("savepoint fonte_consolidacao_imutavel");
      await assert.rejects(
        client.query(
          `update consolidacao_mensal_fonte
              set valor_previsto = 999
            where id = $1`,
          [fonteConsolidacaoId],
        ),
        (error: unknown) =>
          error instanceof Error && "code" in error && error.code === "55000",
      );
      await client.query("rollback to savepoint fonte_consolidacao_imutavel");

      await client.query("savepoint caso_resolvido_incompleto");
      await assert.rejects(
        client.query(
          `update consolidacao_mensal_caso
              set status = 'RESOLVIDO'
            where id = $1`,
          [casoConsolidacaoId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "ck_consolidacao_caso_resolucao",
      );
      await client.query("rollback to savepoint caso_resolvido_incompleto");

      await client.query("savepoint caso_consolidacao_nao_excluivel");
      await assert.rejects(
        client.query(
          `delete from consolidacao_mensal_caso where id = $1`,
          [casoConsolidacaoId],
        ),
        (error: unknown) =>
          error instanceof Error && "code" in error && error.code === "55000",
      );
      await client.query(
        "rollback to savepoint caso_consolidacao_nao_excluivel",
      );

      await client.query(
        `update consolidacao_mensal_caso
            set status = 'RESOLVIDO', decisao = 'RATEIO_NECESSARIO',
                justificativa = 'Rateio sintético conferido para o teste.',
                responsavel = 'TESTE_AUTOMATIZADO', resolvido_em = now()
          where id = $1`,
        [casoConsolidacaoId],
      );
      const regraFiscal = await client.query<{ id: string }>(
        `select id from regra_calculo_versao
          where empresa_id = $1 and codigo = $2 and versao = 1`,
        [empresaId, CODIGO_REGRA_FOLHA_PRESTADOR],
      );
      const enquadramento = await client.query<{ id: string }>(
        `insert into enquadramento_previdenciario
           (empresa_id, regime, inicio_vigencia, fim_vigencia,
            aliquota_segurado_numerador, aliquota_segurado_denominador,
            aliquota_patronal_numerador, aliquota_patronal_denominador,
            evidencia, fonte_normativa, publicado)
         values ($1, 'EMPRESA_GERAL', date '2026-01-01', date '2026-12-31',
                 11, 100, 20, 100, 'Evidência sintética',
                 'Fonte normativa sintética', true)
         returning id`,
        [empresaId],
      );
      const simulacaoFiscalId = randomUUID();
      const simulacaoFiscalFonteId = randomUUID();
      await client.query(
        `insert into consolidacao_fiscal_simulacao
           (id, empresa_id, caso_id, pessoa_id, competencia,
            regra_calculo_id, enquadramento_previdenciario_id, versao,
            hash_fontes, hash_regra, hash_enquadramento, hash_resultado,
            total_proventos, total_descontos, total_liquido,
            base_inss_bruta, base_inss, valor_inss, rendimentos_irrf,
            base_irrf, irrf_bruto, irrf_reducao, valor_irrf, memoria,
            criado_por)
         values ($1, $2, $3, $4, date '2026-01-01', $5, $6, 1,
                 repeat('d', 64), repeat('e', 64), repeat('f', 64),
                 repeat('0', 64), 1000, 110, 890, 1000, 1000, 110,
                 1000, 0, 0, 0, 0,
                 '{"modo":"SIMULACAO_NAO_HOMOLOGADA",
                    "hipoteseRateio":"PROPORCIONAL_MAIOR_RESTO"}'::jsonb,
                 'TESTE_AUTOMATIZADO')`,
        [
          simulacaoFiscalId,
          empresaId,
          casoConsolidacaoId,
          pessoaId,
          regraFiscal.rows[0].id,
          enquadramento.rows[0].id,
        ],
      );
      await client.query(
        `insert into consolidacao_fiscal_simulacao_fonte
           (id, empresa_id, simulacao_id, vinculo_id, ordem, hash_entrada,
            total_proventos, descontos_eventos, total_descontos, total_liquido,
            base_inss_bruta, base_inss_rateada, valor_inss_rateado,
            base_irrf_bruta, base_irrf_rateada, irrf_bruto_rateado,
            irrf_reducao_rateada, valor_irrf_rateado, snapshot)
         values ($1, $2, $3, $4, 1, repeat('1', 64), 1000, 0, 110, 890,
                 1000, 1000, 110, 1000, 0, 0, 0, 0,
                 '{"origem":"teste"}'::jsonb)`,
        [simulacaoFiscalFonteId, empresaId, simulacaoFiscalId, vinculoId],
      );

      await client.query("savepoint simulacao_conteudo_imutavel");
      await assert.rejects(
        client.query(
          `update consolidacao_fiscal_simulacao
              set total_proventos = 999
            where id = $1`,
          [simulacaoFiscalId],
        ),
        (error: unknown) =>
          error instanceof Error && "code" in error && error.code === "55000",
      );
      await client.query("rollback to savepoint simulacao_conteudo_imutavel");

      await client.query("savepoint simulacao_fonte_imutavel");
      await assert.rejects(
        client.query(
          `update consolidacao_fiscal_simulacao_fonte
              set valor_inss_rateado = 109
            where id = $1`,
          [simulacaoFiscalFonteId],
        ),
        (error: unknown) =>
          error instanceof Error && "code" in error && error.code === "55000",
      );
      await client.query("rollback to savepoint simulacao_fonte_imutavel");

      await client.query("savepoint simulacao_salto_homologacao");
      await assert.rejects(
        client.query(
          `update consolidacao_fiscal_simulacao
              set status = 'HOMOLOGADA',
                  responsavel = 'TESTE_AUTOMATIZADO',
                  justificativa = 'Tentativa inválida de pular uma etapa.',
                  decidido_em = now()
            where id = $1`,
          [simulacaoFiscalId],
        ),
        (error: unknown) =>
          error instanceof Error && "code" in error && error.code === "55000",
      );
      await client.query("rollback to savepoint simulacao_salto_homologacao");

      await client.query(
        `update consolidacao_fiscal_simulacao
            set status = 'EM_HOMOLOGACAO',
                responsavel = 'TESTE_AUTOMATIZADO',
                atualizado_em = now()
          where id = $1`,
        [simulacaoFiscalId],
      );
      await client.query(
        `update consolidacao_fiscal_simulacao
            set status = 'HOMOLOGADA',
                responsavel = 'TESTE_AUTOMATIZADO',
                justificativa = 'Cálculo sintético conferido integralmente.',
                decidido_em = now(), atualizado_em = now()
          where id = $1`,
        [simulacaoFiscalId],
      );

      await client.query("savepoint simulacao_terminal_imutavel");
      await assert.rejects(
        client.query(
          `update consolidacao_fiscal_simulacao
              set justificativa = 'Tentativa de alterar decisão terminal.'
            where id = $1`,
          [simulacaoFiscalId],
        ),
        (error: unknown) =>
          error instanceof Error && "code" in error && error.code === "55000",
      );
      await client.query("rollback to savepoint simulacao_terminal_imutavel");

      await client.query("savepoint simulacao_nao_excluivel");
      await assert.rejects(
        client.query(
          `delete from consolidacao_fiscal_simulacao where id = $1`,
          [simulacaoFiscalId],
        ),
        (error: unknown) =>
          error instanceof Error && "code" in error && error.code === "55000",
      );
      await client.query("rollback to savepoint simulacao_nao_excluivel");

      const homologacaoCompetenciaId = randomUUID();
      const homologacaoCompetenciaItemId = randomUUID();
      await client.query(
        `insert into homologacao_competencia
           (id, empresa_id, competencia, versao, hash_fontes, resumo,
            criado_por)
         values ($1, $2, date '2026-01-01', 1, repeat('b', 64),
                 '{"pronta":true,"bloqueios":[],"conformes":8,"total":8}'::jsonb,
                 'TESTE_AUTOMATIZADO')`,
        [homologacaoCompetenciaId, empresaId],
      );
      await client.query(
        `insert into homologacao_competencia_item
           (id, empresa_id, homologacao_id, tipo, status, total, conformes,
            pendentes, hash_evidencia, detalhes)
         values ($1, $2, $3, 'FOLHAS', 'OK', 1, 1, 0, repeat('c', 64),
                 '{"folha":"sintetica"}'::jsonb)`,
        [
          homologacaoCompetenciaItemId,
          empresaId,
          homologacaoCompetenciaId,
        ],
      );

      await client.query("savepoint homologacao_mensal_estado_incoerente");
      await assert.rejects(
        client.query(
          `insert into homologacao_competencia_item
             (empresa_id, homologacao_id, tipo, status, total, conformes,
              pendentes, hash_evidencia, detalhes)
           values ($1, $2, 'MEDICOES', 'OK', 1, 0, 1, repeat('d', 64),
                   '{}'::jsonb)`,
          [empresaId, homologacaoCompetenciaId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "ck_homologacao_item_estado_contagens",
      );
      await client.query(
        "rollback to savepoint homologacao_mensal_estado_incoerente",
      );

      await client.query("savepoint homologacao_mensal_decisao_incompleta");
      await assert.rejects(
        client.query(
          `update homologacao_competencia
              set status = 'APROVADA'
            where id = $1`,
          [homologacaoCompetenciaId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "ck_homologacao_competencia_decisao",
      );
      await client.query(
        "rollback to savepoint homologacao_mensal_decisao_incompleta",
      );

      await client.query("savepoint homologacao_mensal_item_imutavel");
      await assert.rejects(
        client.query(
          `update homologacao_competencia_item
              set status = 'PENDENTE'
            where id = $1`,
          [homologacaoCompetenciaItemId],
        ),
        (error: unknown) =>
          error instanceof Error && "code" in error && error.code === "55000",
      );
      await client.query(
        "rollback to savepoint homologacao_mensal_item_imutavel",
      );

      await client.query("savepoint homologacao_mensal_nao_excluivel");
      await assert.rejects(
        client.query(
          `delete from homologacao_competencia where id = $1`,
          [homologacaoCompetenciaId],
        ),
        (error: unknown) =>
          error instanceof Error && "code" in error && error.code === "55000",
      );
      await client.query(
        "rollback to savepoint homologacao_mensal_nao_excluivel",
      );

      await client.query(
        `insert into prestador_vinculo
           (empresa_id, prestador_id, termo_id, meta_id, numero_contrato,
            atividade, inicio, fim, valor_retribuicao)
         values ($1, $2, $3, $4, 'CONTRATO-PARALELO',
                 'Atividade de contrato paralelo',
                 date '2026-06-01', date '2026-12-31', 1000)`,
        [empresaId, prestadorId, termoId, metaId],
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

      await client.query("savepoint item_folha_fechada");
      await assert.rejects(
        client.query(
          `insert into folha_item
             (empresa_id, folha_id, vinculo_id, total_proventos,
              total_descontos, base_inss, valor_inss, base_irrf,
              irrf_bruto, irrf_reducao, valor_irrf, total_liquido,
              snapshots, memoria)
           values ($1, $2, $3, 1000, 0, 1000, 0, 1000, 0, 0, 0, 1000,
                   '{}'::jsonb, '{}'::jsonb)`,
          [empresaId, folhaId, vinculoId],
        ),
        (error: unknown) =>
          error instanceof Error && "code" in error && error.code === "55000",
      );
      await client.query("rollback to savepoint item_folha_fechada");

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
