import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolverEmpresaAtiva } from "../../db/cadastros";
import { carregarFolha, criarFolha, processarFolha } from "../../db/folhas";
import { getPool } from "../../db";

function argumento(nome: string) {
  const indice = process.argv.indexOf(nome);
  return indice >= 0 ? process.argv[indice + 1] ?? "" : "";
}

const empresaId = argumento("--empresa-id");
const competencia = argumento("--competencia") || "2026-08";
const ator = "CI:SMOKE_MULTILOTE_PROVISORIO";

if (!empresaId) {
  throw new Error(
    "Informe --empresa-id para executar o smoke provisório em uma organização HML explícita.",
  );
}

try {
  process.env.EMPRESA_ATIVA_ID = empresaId;
  // A ausência de uma simulação homologada é proposital: esta é a primeira
  // apuração que forma as fontes para o rateio mensal posterior.
  delete process.env.FOLHA_CONSOLIDADA_PRODUTIVA;
  delete process.env.FOLHA_CONSOLIDADA_EMPRESA_ID;
  delete process.env.FOLHA_CONSOLIDADA_INICIO;

  const empresa = await resolverEmpresaAtiva();
  const pool = getPool();
  const origem = await pool.query<{ prestador_id: string }>(
    `select id prestador_id
       from prestador
      where empresa_id = $1 and matricula = 'CI-0001' and ativo
      limit 1`,
    [empresa.id],
  );
  assert.equal(origem.rowCount, 1, "Prestador sintético HML não encontrado.");

  const sufixo = randomUUID().slice(0, 8).toUpperCase();
  const instrumentos: Array<{ termoId: string; metaId: string }> = [];
  for (const lote of ["A", "B"]) {
    const termo = await pool.query<{ id: string }>(
      `insert into termo
          (empresa_id, numero, descricao, modalidade, inicio, fim, valor_global)
       values ($1, $2, $3, 'TESTE', date '2026-01-01', date '2026-12-31', 10000)
       returning id`,
      [
        empresa.id,
        `CI-PROVISORIO-${sufixo}-${lote}`,
        "Termo sintético para apuração multi-Folha provisória",
      ],
    );
    const meta = await pool.query<{ id: string }>(
      `insert into termo_meta (termo_id, codigo, descricao)
       values ($1, $2, 'Meta sintética para apuração provisória')
       returning id`,
      [termo.rows[0].id, `META-PROV-${lote}`],
    );
    await pool.query(
      `insert into prestador_vinculo
         (empresa_id, prestador_id, termo_id, meta_id, atividade, inicio, fim,
          valor_retribuicao, exige_medicao_mensal)
       values ($1, $2, $3, $4, 'Atividade sintética multi-Folha provisória',
               date '2026-01-01', date '2026-12-31', 1000, false)`,
      [empresa.id, origem.rows[0].prestador_id, termo.rows[0].id, meta.rows[0].id],
    );
    instrumentos.push({ termoId: termo.rows[0].id, metaId: meta.rows[0].id });
  }

  const folhas = [];
  for (const instrumento of instrumentos) {
    const folha = await criarFolha({
      empresaId: empresa.id,
      termoId: instrumento.termoId,
      metaId: instrumento.metaId,
      competencia,
      ator,
    });
    await processarFolha(folha.id, ator, empresa.id, folha.revisao);
    const processada = await carregarFolha(empresa.id, folha.id);
    assert.equal(processada.folha.status, "ABERTA");
    assert.equal(processada.itens.length, 1);
    assert.equal(
      "consolidacaoFiscal" in processada.itens[0].memoria,
      false,
      "A primeira apuração não deve exigir nem aplicar rateio inexistente.",
    );
    folhas.push(processada.folha.id);
  }

  console.log(
    `Folhas provisórias ${folhas.join(" e ")} processadas em ${competencia} sem ` +
      "simulação homologada; consolidação permanece uma etapa de fechamento.",
  );
} finally {
  await getPool().end();
}
