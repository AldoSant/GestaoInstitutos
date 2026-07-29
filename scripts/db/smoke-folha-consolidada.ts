import assert from "node:assert/strict";
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
import { salvarMedicaoMensal } from "../../db/medicoes";
import { apurarRetencoesSegurados } from "../../db/obrigacoes";
import {
  atualizarStatusSimulacaoFiscal,
  criarSimulacaoConsolidacaoFiscal,
  listarSimulacoesConsolidacaoFiscal,
} from "../../db/simulacoes-consolidacao";
import {
  concluirTarefa,
  reservarProximaTarefa,
} from "../../db/tarefas";
import { handlers } from "../worker/handlers";

const ator = "CI:SMOKE_CONSOLIDACAO";
const competencia = "2026-07";

try {
  const empresa = await resolverEmpresaAtiva();
  process.env.FOLHA_CONSOLIDADA_PRODUTIVA = "true";
  process.env.FOLHA_CONSOLIDADA_EMPRESA_ID = empresa.id;
  process.env.FOLHA_CONSOLIDADA_INICIO = competencia;

  const origem = await getPool().query<{
    pessoa_id: string;
    prestador_id: string;
    vinculo_id: string;
    termo_id: string;
    meta_id: string;
  }>(
    `select pessoa.id pessoa_id, prestador.id prestador_id,
            vinculo.id vinculo_id, vinculo.termo_id, vinculo.meta_id
       from prestador
       join pessoa
         on pessoa.empresa_id = prestador.empresa_id
        and pessoa.id = prestador.pessoa_id
       join prestador_vinculo vinculo
         on vinculo.empresa_id = prestador.empresa_id
        and vinculo.prestador_id = prestador.id
       join termo
         on termo.empresa_id = vinculo.empresa_id
        and termo.id = vinculo.termo_id
       join termo_meta meta
         on meta.termo_id = termo.id and meta.id = vinculo.meta_id
      where prestador.empresa_id = $1 and prestador.matricula = 'CI-0001'
        and termo.numero = 'CI-2026' and meta.codigo = 'META-CI'
      limit 1`,
    [empresa.id],
  );
  assert.equal(origem.rowCount, 1, "Vínculo principal sintético não encontrado.");

  await salvarMedicaoMensal({
    empresaId: empresa.id,
    vinculoId: origem.rows[0].vinculo_id,
    competencia,
    tipo: "PERCENTUAL",
    percentual: "100",
    quantidade: "",
    valorUnitario: "",
    valor: "",
    evidenciaReferencia: "Relatório consolidado sintético CI 2026-07",
    evidenciaHash: "d".repeat(64),
    conferente: ator,
    observacao: "Medição integral para o teste produtivo multi-vínculo.",
  });

  const segundo = await getPool().query<{
    termo_id: string;
    meta_id: string;
    vinculo_id: string;
  }>(
    `with termo_novo as (
       insert into termo
         (empresa_id, numero, descricao, modalidade, inicio, fim, valor_global)
       values
         ($1, 'CI-CONSOLIDADO-2026', 'Termo sintético de consolidação',
          'TESTE', date '2026-01-01', date '2026-12-31', 50000)
       returning id
     ), meta_nova as (
       insert into termo_meta (termo_id, codigo, descricao)
       select id, 'META-CONSOLIDADA', 'Meta sintética de consolidação'
         from termo_novo
       returning id, termo_id
     ), vinculo_novo as (
       insert into prestador_vinculo
         (empresa_id, prestador_id, termo_id, meta_id, atividade,
          inicio, fim, valor_retribuicao, exige_medicao_mensal)
       select $1, $2, meta_nova.termo_id, meta_nova.id,
              'Atividade sintética em segundo lote',
              date '2026-01-01', date '2026-12-31', 1920, false
         from meta_nova
       returning id, termo_id, meta_id
     )
     select termo_id, meta_id, id vinculo_id from vinculo_novo`,
    [empresa.id, origem.rows[0].prestador_id],
  );
  assert.equal(segundo.rowCount, 1, "Segundo Vínculo sintético não foi criado.");

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
    termoId: segundo.rows[0].termo_id,
    metaId: segundo.rows[0].meta_id,
    competencia,
    ator,
  });

  const primeiraTarefa = await reservarProximaTarefa(ator, ["PROCESSAR_FOLHA"]);
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

  const segundaTarefa = await reservarProximaTarefa(ator, ["PROCESSAR_FOLHA"]);
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
  assert.equal(obrigacao.folhas, 2);
  assert.equal(obrigacao.itens, 4);
  const segurado = await getPool().query<{ valor: string }>(
    `select coalesce(sum(valor), 0)::text valor
       from obrigacao_fiscal_item
      where empresa_id = $1 and obrigacao_id = $2 and natureza = 'SEGURADO'`,
    [empresa.id, obrigacao.id],
  );
  assert.equal(segurado.rows[0].valor, simulacao.valor_inss);

  console.log(
    `Folhas ${folhaPrincipal.id} e ${folhaSecundaria.id} fechadas com ` +
      `rateio homologado ${criada.id}; obrigação ${obrigacao.id} reconciliou ` +
      `a retenção consolidada.`,
  );
} finally {
  await getPool().end();
}
