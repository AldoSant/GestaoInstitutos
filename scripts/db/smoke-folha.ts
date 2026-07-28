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
  registrarDocumentoObrigacao,
} from "../../db/obrigacoes";
import { salvarMedicaoMensal } from "../../db/medicoes";
import { getPool } from "../../db";
import {
  concluirTarefa,
  reservarProximaTarefa,
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
    `update prestador
        set categoria_contribuinte = '701',
            nit_pis_pasep = coalesce(nit_pis_pasep, '12345678901'),
            atualizado_em = now()
      where empresa_id = $1 and matricula = 'CI-0001'`,
    [empresa.id],
  );
  assert.equal(
    classificados.rowCount,
    1,
    "Prestador sintético não pôde ser classificado na categoria 701.",
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
  const tarefa = await reservarProximaTarefa(trabalhador, ["PROCESSAR_FOLHA"]);
  assert.ok(tarefa, "Tarefa de Folha não foi enfileirada.");
  const resultado = await handlers.PROCESSAR_FOLHA(tarefa);
  await concluirTarefa(tarefa.id, trabalhador, resultado);

  const processada = await carregarFolha(empresa.id, folha.id);
  assert.equal(processada.folha.status, "ABERTA");
  assert.equal(processada.itens.length, 1);
  assert.ok(processada.folha.hash_resultado);
  assert.equal(processada.itens[0].total_proventos, "4080.00");
  assert.ok(processada.itens[0].snapshots.medicaoMensal);

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
  console.log(
    `Folha sintética ${folha.id} fechada e obrigação ${obrigacao.id} conciliada até o DARF.`,
  );
} finally {
  await getPool().end();
}
