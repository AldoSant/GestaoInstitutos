import assert from "node:assert/strict";
import { resolverEmpresaAtiva } from "../../db/cadastros";
import {
  carregarFolha,
  criarFolha,
  fecharFolha,
  registrarConferenciaFolha,
} from "../../db/folhas";
import {
  apurarRetencoesSegurados,
  carregarEspelhoObrigacao,
  registrarDocumentoObrigacao,
  solicitarRetificacaoObrigacao,
} from "../../db/obrigacoes";
import { montarResumoDossieObrigacao } from "../../lib/relatorio-obrigacao";
import { diagnosticarHomologacaoCompetencia } from "../../db/homologacoes-competencia";
import { carregarDashboardOperacional } from "../../db/dashboard";
import {
  extrairItemRelacaoPagamento,
  gerarRelacaoPagamentosCsv,
  montarRelacaoPagamentos,
} from "../../lib/relacao-pagamentos";
import { salvarMedicaoMensal } from "../../db/medicoes";
import { getPool } from "../../db";
import {
  concluirTarefa,
  reservarTarefaPorChave,
} from "../../db/tarefas";
import { handlers } from "../worker/handlers";

const trabalhador = "CI:SMOKE_FOLHA";

try {
  const empresa = await resolverEmpresaAtiva();
  const instrumento = await getPool().query<{
    termo_id: string;
    meta_id: string;
  }>(
    `select t.id termo_id, m.id meta_id
       from termo t
       join termo_meta m on m.termo_id = t.id
      where t.empresa_id = $1
        and t.numero = 'CI-2026'
        and m.codigo = 'META-CI'`,
    [empresa.id],
  );
  assert.equal(instrumento.rowCount, 1, "Instrumento sintético não encontrado.");
  const classificados = await getPool().query(
    `update pessoa pessoa_ci
        set inscricao_inss = coalesce(pessoa_ci.inscricao_inss, '12345678901'),
            atualizado_em = now()
       from prestador prestador_ci
      where pessoa_ci.id = prestador_ci.pessoa_id
        and pessoa_ci.empresa_id = $1 and prestador_ci.matricula = 'CI-0001'`,
    [empresa.id],
  );
  assert.equal(
    classificados.rowCount,
    1,
    "Pessoa sintética não pôde receber a inscrição INSS.",
  );
  const vinculoMedido = await getPool().query<{ id: string }>(
    `update prestador_vinculo v
        set exige_medicao_mensal = true, atualizado_em = now()
       from prestador pr
      where v.prestador_id = pr.id
        and v.empresa_id = $1 and v.termo_id = $2 and v.meta_id = $3
        and pr.matricula = 'CI-0001'
      returning v.id`,
    [
      empresa.id,
      instrumento.rows[0].termo_id,
      instrumento.rows[0].meta_id,
    ],
  );
  assert.equal(vinculoMedido.rowCount, 1, "Vínculo sintético não encontrado.");
  await salvarMedicaoMensal({
    empresaId: empresa.id,
    vinculoId: vinculoMedido.rows[0].id,
    competencia: "2026-06",
    tipo: "PERCENTUAL",
    percentual: "100",
    quantidade: "",
    valorUnitario: "",
    valor: "",
    evidenciaReferencia: "Relatório sintético CI 2026-06",
    evidenciaHash: "b".repeat(64),
    conferente: trabalhador,
    observacao: "Medição sintética integral.",
  });

  const folha = await criarFolha({
    empresaId: empresa.id,
    termoId: instrumento.rows[0].termo_id,
    metaId: instrumento.rows[0].meta_id,
    competencia: "2026-06",
    ator: trabalhador,
  });
  const tarefa = await reservarTarefaPorChave({
    trabalhadorId: trabalhador,
    empresaId: empresa.id,
    tipo: "PROCESSAR_FOLHA",
    chaveIdempotencia: `folha:${folha.id}:revisao:${folha.revisao}`,
  });
  assert.ok(tarefa, "Tarefa de Folha não foi enfileirada.");
  const resultado = await handlers.PROCESSAR_FOLHA(tarefa);
  await concluirTarefa(tarefa.id, trabalhador, resultado);

  const processada = await carregarFolha(empresa.id, folha.id);
  assert.equal(processada.folha.status, "ABERTA");
  assert.equal(processada.itens.length, 1);
  assert.ok(processada.folha.hash_resultado);
  assert.equal(processada.itens[0].total_proventos, "4080.00");
  assert.ok(processada.itens[0].snapshots.medicaoMensal);
  assert.ok(processada.itens[0].snapshots.contaBancaria);
  const relacaoProcessada = montarRelacaoPagamentos(
    processada.itens.map(extrairItemRelacaoPagamento),
  );
  assert.equal(relacaoProcessada.pronta, true);
  assert.equal(
    relacaoProcessada.totalLiquidoCentavos,
    Math.round(Number(processada.itens[0].total_liquido) * 100),
  );

  await registrarConferenciaFolha({
    empresaId: empresa.id,
    folhaId: folha.id,
    resultado: "APROVADA",
    conferente: "RH sintético do CI",
    confirmouCadastros: true,
    confirmouValores: true,
    confirmouRubricas: true,
    observacao: "Conferência sintética automatizada.",
  });
  await fecharFolha(folha.id, trabalhador);
  const fechada = await carregarFolha(empresa.id, folha.id);
  assert.equal(fechada.folha.status, "FECHADA");
  assert.equal(fechada.conferencias[0].resultado, "APROVADA");
  const espelhoPagamentos = gerarRelacaoPagamentosCsv({
    empresa: empresa.razaoSocial,
    competencia: fechada.folha.competencia.slice(0, 7),
    folhaNumero: fechada.folha.numero,
    revisao: fechada.folha.revisao,
    folhaStatus: fechada.folha.status,
    hashFolha: fechada.folha.hash_resultado,
    itens: fechada.itens.map(extrairItemRelacaoPagamento),
  });
  assert.equal(espelhoPagamentos.resumo.pronta, true);
  assert.equal(espelhoPagamentos.liberada, true);
  assert.match(espelhoPagamentos.hashSha256, /^[0-9a-f]{64}$/);
  assert.match(espelhoPagamentos.conteudo, /PRESTADOR SINTETICO CI/);
  const fechamentoMensal = await diagnosticarHomologacaoCompetencia(
    empresa.id,
    "2026-06",
  );
  const gatePagamentos = fechamentoMensal.itens.find(
    (item) => item.tipo === "PAGAMENTOS",
  );
  assert.ok(gatePagamentos);
  assert.equal(gatePagamentos.status, "OK");
  assert.equal(gatePagamentos.total, 1);
  const obrigacao = await apurarRetencoesSegurados({
    empresaId: empresa.id,
    competencia: "2026-06",
    ator: trabalhador,
  });
  assert.equal(obrigacao.folhas, 1);
  assert.equal(obrigacao.itens, 2);
  assert.ok(Number(obrigacao.principal) > 0);
  const apurada = await getPool().query<{
    status: string;
    itens: number;
  }>(
    `select o.status,
            (select count(*)::int from obrigacao_fiscal_item oi
              where oi.obrigacao_id = o.id) itens
       from obrigacao_fiscal o
      where o.id = $1`,
    [obrigacao.id],
  );
  assert.equal(apurada.rows[0].status, "BLOQUEADA");
  assert.equal(apurada.rows[0].itens, 2);
  await registrarDocumentoObrigacao({
    empresaId: empresa.id,
    obrigacaoId: obrigacao.id,
    tipo: "TOTALIZADOR_DCTFWEB",
    referencia: "DCTFWEB-CI-2026-06",
    valorTotal: obrigacao.total,
    emitidoEm: "2026-07-01",
    localizador: "Documento sintético da integração contínua",
    hashSha256: "a".repeat(64),
    verificado: true,
    ator: trabalhador,
  });
  await registrarDocumentoObrigacao({
    empresaId: empresa.id,
    obrigacaoId: obrigacao.id,
    tipo: "RECIBO_DCTFWEB",
    referencia: "RECIBO-DCTFWEB-CI-2026-06",
    valorTotal: "0.00",
    emitidoEm: "2026-07-01",
    localizador: "Recibo sintético da integração contínua",
    hashSha256: "c".repeat(64),
    verificado: true,
    ator: trabalhador,
  });
  await registrarDocumentoObrigacao({
    empresaId: empresa.id,
    obrigacaoId: obrigacao.id,
    tipo: "DARF",
    referencia: "DARF-CI-2026-06",
    valorTotal: obrigacao.total,
    emitidoEm: "2026-07-01",
    localizador: "DARF sintético da integração contínua",
    hashSha256: "b".repeat(64),
    verificado: true,
    ator: trabalhador,
  });
  const emitida = await getPool().query<{
    status: string;
    diferenca: string;
    documentos: number;
  }>(
    `select o.status, o.diferenca::text,
            (select count(*)::int from obrigacao_fiscal_documento d
              where d.obrigacao_id = o.id) documentos
       from obrigacao_fiscal o where o.id = $1`,
    [obrigacao.id],
  );
  assert.equal(emitida.rows[0].status, "EMITIDA");
  assert.equal(emitida.rows[0].diferenca, "0.00");
  assert.equal(emitida.rows[0].documentos, 3);
  const espelho = await carregarEspelhoObrigacao(empresa.id, obrigacao.id);
  const dossie = montarResumoDossieObrigacao({
    status: espelho.obrigacao.status,
    principal: espelho.obrigacao.principal,
    juros: espelho.obrigacao.juros,
    multa: espelho.obrigacao.multa,
    total: espelho.obrigacao.total,
    itens: espelho.itens.map((item) => ({
      id: item.id,
      natureza: item.natureza,
      valor: item.valor,
    })),
    documentos: espelho.documentos.map((documento) => ({
      tipo: documento.tipo,
      valorTotal: documento.valor_total,
      verificado: documento.verificado,
    })),
  });
  assert.equal(dossie.documentos.totalizadorVerificado, true);
  assert.equal(dossie.documentos.reciboVerificado, true);
  assert.equal(dossie.documentos.darfVerificado, true);
  const retificacao = await solicitarRetificacaoObrigacao({
    empresaId: empresa.id,
    obrigacaoId: obrigacao.id,
    motivo:
      "Retificação sintética para validar o ciclo completo sem apagar a emissão original.",
    responsavel: trabalhador,
  });
  assert.equal(retificacao.status, "SOLICITADA");
  assert.match(retificacao.hashSnapshot, /^[0-9a-f]{64}$/);
  const bloqueadaParaRetificacao = await getPool().query<{
    status: string;
    documentos_verificados: number;
  }>(
    `select obrigacao.status::text,
            (select count(*)::int
               from obrigacao_fiscal_documento documento
              where documento.obrigacao_id = obrigacao.id
                and documento.verificado) documentos_verificados
       from obrigacao_fiscal obrigacao
      where obrigacao.id = $1`,
    [obrigacao.id],
  );
  assert.equal(bloqueadaParaRetificacao.rows[0].status, "BLOQUEADA");
  assert.equal(
    bloqueadaParaRetificacao.rows[0].documentos_verificados,
    0,
  );
  await apurarRetencoesSegurados({
    empresaId: empresa.id,
    competencia: "2026-06",
    ator: trabalhador,
  });
  await registrarDocumentoObrigacao({
    empresaId: empresa.id,
    obrigacaoId: obrigacao.id,
    tipo: "TOTALIZADOR_DCTFWEB",
    referencia: "DCTFWEB-CI-2026-06-RET-1",
    valorTotal: obrigacao.total,
    emitidoEm: "2026-07-02",
    localizador: "Totalizador retificador sintético da integração contínua",
    hashSha256: "d".repeat(64),
    verificado: true,
    ator: trabalhador,
  });
  await registrarDocumentoObrigacao({
    empresaId: empresa.id,
    obrigacaoId: obrigacao.id,
    tipo: "RECIBO_DCTFWEB",
    referencia: "RECIBO-DCTFWEB-CI-2026-06-RET-1",
    valorTotal: "0.00",
    emitidoEm: "2026-07-02",
    localizador: "Recibo retificador sintético da integração contínua",
    hashSha256: "e".repeat(64),
    verificado: true,
    ator: trabalhador,
  });
  await registrarDocumentoObrigacao({
    empresaId: empresa.id,
    obrigacaoId: obrigacao.id,
    tipo: "DARF",
    referencia: "DARF-CI-2026-06-RET-1",
    valorTotal: obrigacao.total,
    emitidoEm: "2026-07-02",
    localizador: "DARF retificador sintético da integração contínua",
    hashSha256: "f".repeat(64),
    verificado: true,
    ator: trabalhador,
  });
  const retificacaoConcluida = await getPool().query<{
    obrigacao_status: string;
    retificacao_status: string;
    protocolo: string;
    resultado_status: string;
  }>(
    `select obrigacao.status::text obrigacao_status,
            retificacao.status retificacao_status,
            retificacao.protocolo,
            retificacao.resultado ->> 'status' resultado_status
       from obrigacao_fiscal obrigacao
       join obrigacao_fiscal_retificacao retificacao
         on retificacao.obrigacao_id = obrigacao.id
      where obrigacao.id = $1 and retificacao.id = $2`,
    [obrigacao.id, retificacao.id],
  );
  assert.equal(retificacaoConcluida.rows[0].obrigacao_status, "EMITIDA");
  assert.equal(
    retificacaoConcluida.rows[0].retificacao_status,
    "CONCLUIDA",
  );
  assert.equal(
    retificacaoConcluida.rows[0].protocolo,
    "RECIBO-DCTFWEB-CI-2026-06-RET-1",
  );
  assert.equal(retificacaoConcluida.rows[0].resultado_status, "EMITIDA");
  const dashboard = await carregarDashboardOperacional(empresa.id);
  const competenciaDashboard = dashboard.competencias.find(
    (item) => item.competencia.slice(0, 7) === "2026-06",
  );
  assert.ok(competenciaDashboard);
  assert.equal(competenciaDashboard.status_folhas, "FECHADA");
  assert.equal(competenciaDashboard.pagamentos_total, 1);
  assert.equal(competenciaDashboard.pagamentos_conformes, 1);
  assert.equal(competenciaDashboard.obrigacao_status, "EMITIDA");
  console.log(
    `Folha sintética ${folha.id} fechada; obrigação ${obrigacao.id} emitida, retificada e reemitida.`,
  );
} finally {
  await getPool().end();
}
