import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolverEmpresaAtiva } from "../../db/cadastros";
import {
  atualizarCasoConsolidacao,
  listarCasosConsolidacao,
  materializarCasosConsolidacao,
} from "../../db/consolidacoes";
import {
  carregarFolha,
  criarFolha,
  fecharFolha,
  registrarConferenciaFolha,
} from "../../db/folhas";
import { getPool } from "../../db";
import { apurarRetencoesSegurados } from "../../db/obrigacoes";
import {
  atualizarStatusSimulacaoFiscal,
  criarSimulacaoConsolidacaoFiscal,
  listarSimulacoesConsolidacaoFiscal,
} from "../../db/simulacoes-consolidacao";
import {
  concluirTarefa,
  reservarTarefaPorChave,
} from "../../db/tarefas";
import { handlers } from "../worker/handlers";

const ator = "CI:SMOKE_CONSOLIDACAO";
const indiceEmpresa = process.argv.indexOf("--empresa-id");
const empresaId = indiceEmpresa >= 0 ? process.argv[indiceEmpresa + 1] ?? "" : "";
const indiceCompetencia = process.argv.indexOf("--competencia");
const competencia =
  indiceCompetencia >= 0 ? process.argv[indiceCompetencia + 1] ?? "" : "2026-07";

if (!empresaId) {
  throw new Error(
    "Informe --empresa-id para executar o smoke de consolidação em uma organização HML explícita.",
  );
}
if (!/^2026-(0[1-9]|1[0-2])$/.test(competencia)) {
  throw new Error("Informe --competencia no formato AAAA-MM de 2026.");
}

try {
  // A HML pode preservar empresas de cenários paralelos. O teste nunca deve
  // escolher uma delas por ordem de criação.
  process.env.EMPRESA_ATIVA_ID = empresaId;
  const empresa = await resolverEmpresaAtiva();
  process.env.FOLHA_CONSOLIDADA_PRODUTIVA = "true";
  process.env.FOLHA_CONSOLIDADA_EMPRESA_ID = empresa.id;
  process.env.FOLHA_CONSOLIDADA_INICIO = competencia;

  // Cada execução cria uma Pessoa própria. Assim, pendências deixadas por
  // cenários anteriores na HML nunca se misturam ao fechamento deste teste.
  const sufixo = randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  const cpfSintetico = `9${Date.now().toString().slice(-10)}`;
  const origem = await getPool().query<{
    pessoa_id: string;
    prestador_id: string;
    vinculo_id: string;
    termo_id: string;
    meta_id: string;
    segundo_termo_id: string;
    segundo_meta_id: string;
    segundo_vinculo_id: string;
  }>(
    `with pessoa_nova as (
       insert into pessoa
         (empresa_id, tipo, nome_razao_social, cpf, inscricao_inss,
          papel_prestador, ativo)
       values ($1, 'FISICA', $2, $3, $4, true, true)
       returning id
     ), prestador_novo as (
       insert into prestador
         (empresa_id, pessoa_id, matricula, categoria_contribuinte, ativo)
       select $1, pessoa_nova.id, $5, 'CONTRIBUINTE_INDIVIDUAL', true
         from pessoa_nova
       returning id, pessoa_id
     ), termo_principal as (
       insert into termo
         (empresa_id, numero, descricao, modalidade, inicio, fim, valor_global)
       values ($1, $6, 'Termo principal sintético de consolidação',
               'TESTE', date '2026-01-01', date '2026-12-31', 50000)
       returning id
     ), meta_principal as (
       insert into termo_meta (termo_id, codigo, descricao)
       select id, 'META-PRINCIPAL', 'Meta principal sintética'
         from termo_principal
       returning id, termo_id
     ), vinculo_principal as (
       insert into prestador_vinculo
         (empresa_id, prestador_id, termo_id, meta_id, atividade,
          inicio, fim, valor_retribuicao, exige_medicao_mensal)
       select $1, prestador_novo.id, meta_principal.termo_id, meta_principal.id,
              'Atividade sintética no lote principal',
              date '2026-01-01', date '2026-12-31', 1920, false
         from prestador_novo cross join meta_principal
       returning id, termo_id, meta_id
     ), termo_secundario as (
       insert into termo
         (empresa_id, numero, descricao, modalidade, inicio, fim, valor_global)
       values ($1, $7, 'Termo secundário sintético de consolidação',
               'TESTE', date '2026-01-01', date '2026-12-31', 50000)
       returning id
     ), meta_secundaria as (
       insert into termo_meta (termo_id, codigo, descricao)
       select id, 'META-SECUNDARIA', 'Meta secundária sintética'
         from termo_secundario
       returning id, termo_id
     ), vinculo_secundario as (
       insert into prestador_vinculo
         (empresa_id, prestador_id, termo_id, meta_id, atividade,
          inicio, fim, valor_retribuicao, exige_medicao_mensal)
       select $1, prestador_novo.id, meta_secundaria.termo_id, meta_secundaria.id,
              'Atividade sintética no lote secundário',
              date '2026-01-01', date '2026-12-31', 1920, false
         from prestador_novo cross join meta_secundaria
       returning id, termo_id, meta_id
     )
     select pessoa_nova.id pessoa_id, prestador_novo.id prestador_id,
            vinculo_principal.id vinculo_id, vinculo_principal.termo_id,
            vinculo_principal.meta_id,
            vinculo_secundario.termo_id segundo_termo_id,
            vinculo_secundario.meta_id segundo_meta_id,
            vinculo_secundario.id segundo_vinculo_id
       from pessoa_nova
       cross join prestador_novo
       cross join vinculo_principal
       cross join vinculo_secundario`,
    [
      empresa.id,
      `Prestador sintético ${sufixo}`,
      cpfSintetico,
      `9${Date.now().toString().slice(-10)}`,
      `CI-${sufixo}`,
      `CI-CONSOLIDADO-${competencia.replace("-", "")}-${sufixo}-A`,
      `CI-CONSOLIDADO-${competencia.replace("-", "")}-${sufixo}-B`,
    ],
  );
  assert.equal(origem.rowCount, 1, "Cenário sintético não foi criado.");

  await getPool().query(
    `insert into contribuicao_outra_fonte
       (empresa_id, prestador_id, competencia, fonte_pagadora, documento_fonte,
        remuneracao, inss_dedutivel_irrf, irrf_retido, base_contribuicao,
        valor_contribuicao, documento_referencia, comprovante_verificado,
        observacao)
     values ($1, $2, $3::date, 'Fonte sintética de IRRF', '12345678000199',
             1000, 0, 100, 0, 0, 'CI-IRRF-OUTRA-FONTE', true,
             'Comprovante sintético para validar IRRF consolidado.')
     on conflict (prestador_id, competencia, documento_fonte, documento_referencia)
     do update set remuneracao = excluded.remuneracao,
                   inss_dedutivel_irrf = excluded.inss_dedutivel_irrf,
                   irrf_retido = excluded.irrf_retido,
                   comprovante_verificado = true,
                   atualizado_em = now()`,
    [empresa.id, origem.rows[0].prestador_id, `${competencia}-01`],
  );

  const materializacao = await materializarCasosConsolidacao({
    empresaId: empresa.id,
    competencia,
    ator,
  });
  assert.ok(materializacao.totalConflitos >= 1);
  const casos = await listarCasosConsolidacao(empresa.id, competencia);
  const caso = casos.find(
    (item) => item.pessoa_id === origem.rows[0].pessoa_id,
  );
  assert.ok(caso, "Caso multi-vínculo não foi materializado.");
  await atualizarCasoConsolidacao({
    empresaId: empresa.id,
    casoId: caso.id,
    status: "RESOLVIDO",
    decisao: "RATEIO_NECESSARIO",
    justificativa:
      "Rateio sintético aprovado para validar o caminho produtivo completo.",
    responsavel: ator,
  });

  const criada = await criarSimulacaoConsolidacaoFiscal({
    empresaId: empresa.id,
    casoId: caso.id,
    ator,
  });
  await atualizarStatusSimulacaoFiscal({
    empresaId: empresa.id,
    simulacaoId: criada.id,
    status: "EM_HOMOLOGACAO",
    responsavel: ator,
    justificativa:
      "Memória, bases, tributos e fechamento monetário sintéticos conferidos.",
  });
  await atualizarStatusSimulacaoFiscal({
    empresaId: empresa.id,
    simulacaoId: criada.id,
    status: "HOMOLOGADA",
    responsavel: ator,
    justificativa:
      "Rateio sintético homologado para o teste de integração produtiva.",
  });

  const folhaPrincipal = await criarFolha({
    empresaId: empresa.id,
    termoId: origem.rows[0].termo_id,
    metaId: origem.rows[0].meta_id,
    competencia,
    ator,
  });
  const folhaSecundaria = await criarFolha({
    empresaId: empresa.id,
    termoId: origem.rows[0].segundo_termo_id,
    metaId: origem.rows[0].segundo_meta_id,
    competencia,
    ator,
  });

  const primeiraTarefa = await reservarTarefaPorChave({
    trabalhadorId: ator,
    empresaId: empresa.id,
    tipo: "PROCESSAR_FOLHA",
    chaveIdempotencia: `folha:${folhaPrincipal.id}:revisao:${folhaPrincipal.revisao}`,
  });
  assert.ok(primeiraTarefa, "Primeira tarefa consolidada não foi enfileirada.");
  const primeiroResultado = await handlers.PROCESSAR_FOLHA(primeiraTarefa);
  await concluirTarefa(primeiraTarefa.id, ator, primeiroResultado);
  const estadoParcial = await Promise.all(
    [folhaPrincipal.id, folhaSecundaria.id].map((folhaId) =>
      carregarFolha(empresa.id, folhaId),
    ),
  );
  const primeiraProcessada = estadoParcial.find(
    (folha) => folha.folha.status === "ABERTA",
  );
  assert.ok(primeiraProcessada);
  await registrarConferenciaFolha({
    empresaId: empresa.id,
    folhaId: primeiraProcessada.folha.id,
    resultado: "APROVADA",
    conferente: "RH sintético da consolidação",
    confirmouCadastros: true,
    confirmouValores: true,
    confirmouRubricas: true,
    observacao: "Primeiro lote do rateio sintético conferido.",
  });
  await assert.rejects(
    fecharFolha(primeiraProcessada.folha.id, ator),
    /Todas as Folhas da Pessoa devem estar processadas/,
  );

  const segundaTarefa = await reservarTarefaPorChave({
    trabalhadorId: ator,
    empresaId: empresa.id,
    tipo: "PROCESSAR_FOLHA",
    chaveIdempotencia: `folha:${folhaSecundaria.id}:revisao:${folhaSecundaria.revisao}`,
  });
  assert.ok(segundaTarefa, "Segunda tarefa consolidada não foi enfileirada.");
  const segundoResultado = await handlers.PROCESSAR_FOLHA(segundaTarefa);
  await concluirTarefa(segundaTarefa.id, ator, segundoResultado);

  const folhas = await Promise.all(
    [folhaPrincipal.id, folhaSecundaria.id].map((folhaId) =>
      carregarFolha(empresa.id, folhaId),
    ),
  );
  for (const folha of folhas) {
    assert.equal(folha.folha.status, "ABERTA");
    assert.equal(folha.itens.length, 1);
    assert.equal(
      folha.itens[0].memoria.consolidacaoFiscal.simulacaoId,
      criada.id,
    );
    assert.equal(
      folha.itens[0].snapshots.consolidacaoFiscal.simulacaoId,
      criada.id,
    );
    if (folha.conferencias.length === 0) {
      await registrarConferenciaFolha({
        empresaId: empresa.id,
        folhaId: folha.folha.id,
        resultado: "APROVADA",
        conferente: "RH sintético da consolidação",
        confirmouCadastros: true,
        confirmouValores: true,
        confirmouRubricas: true,
        observacao: "Rateio consolidado sintético conferido.",
      });
    }
  }
  await fecharFolha(folhaPrincipal.id, ator);
  await fecharFolha(folhaSecundaria.id, ator);

  const fechadas = await Promise.all(
    [folhaPrincipal.id, folhaSecundaria.id].map((folhaId) =>
      carregarFolha(empresa.id, folhaId),
    ),
  );
  assert.ok(fechadas.every((folha) => folha.folha.status === "FECHADA"));
  const simulacoes = await listarSimulacoesConsolidacaoFiscal(
    empresa.id,
    competencia,
  );
  const simulacao = simulacoes.find((item) => item.id === criada.id);
  assert.ok(simulacao);
  const memoriaOutrasFontes = simulacao.memoria.outrasFontes as Record<
    string,
    unknown
  >;
  assert.equal(memoriaOutrasFontes.rendimentosTributaveisCentavos, 100_000);
  assert.equal(memoriaOutrasFontes.irrfRetidoCentavos, 10_000);
  const somaInssFolhas = fechadas.reduce(
    (total, folha) => total + Number(folha.itens[0].valor_inss),
    0,
  );
  assert.equal(somaInssFolhas.toFixed(2), simulacao.valor_inss);
  const somaIrrfFolhas = fechadas.reduce(
    (total, folha) => total + Number(folha.itens[0].valor_irrf),
    0,
  );
  assert.equal(somaIrrfFolhas.toFixed(2), simulacao.valor_irrf);
  const obrigacao = await apurarRetencoesSegurados({
    empresaId: empresa.id,
    competencia,
    ator,
  });
  const folhasDoCenario = [folhaPrincipal.id, folhaSecundaria.id];
  const fontesDoCenario = await getPool().query<{ total: number }>(
    `select count(*)::int total
       from obrigacao_fiscal_folha
      where obrigacao_id = $1 and folha_id = any($2::uuid[])`,
    [obrigacao.id, folhasDoCenario],
  );
  assert.equal(
    fontesDoCenario.rows[0].total,
    2,
    "A obrigação deve conter as duas Folhas criadas pelo cenário.",
  );
  const segurado = await getPool().query<{ valor: string }>(
    `select coalesce(sum(valor), 0)::text valor
       from obrigacao_fiscal_item item
       join folha_item folha_item on folha_item.id = item.folha_item_id
      where item.empresa_id = $1 and item.obrigacao_id = $2
        and item.natureza = 'SEGURADO'
        and folha_item.folha_id = any($3::uuid[])`,
    [empresa.id, obrigacao.id, folhasDoCenario],
  );
  assert.equal(segurado.rows[0].valor, simulacao.valor_inss);
  const gpsConsolidada = await getPool().query<{ total: number }>(
    `select count(*)::int total
       from guia_gps_individual guia
       join obrigacao_fiscal_item item on item.id = guia.obrigacao_item_id
       join folha_item folha_item on folha_item.id = item.folha_item_id
       join prestador_vinculo vinculo on vinculo.id = folha_item.vinculo_id
      where guia.empresa_id = $1 and guia.obrigacao_id = $2
        and vinculo.prestador_id = $3`,
    [empresa.id, obrigacao.id, origem.rows[0].prestador_id],
  );
  assert.equal(
    gpsConsolidada.rows[0].total,
    1,
    "A mesma pessoa em duas Folhas deve receber uma única GPS consolidada.",
  );

  console.log(
    `Folhas ${folhaPrincipal.id} e ${folhaSecundaria.id} fechadas com ` +
      `rateio homologado ${criada.id}; obrigação ${obrigacao.id} reconciliou ` +
      `a retenção consolidada.`,
  );
} finally {
  await getPool().end();
}
