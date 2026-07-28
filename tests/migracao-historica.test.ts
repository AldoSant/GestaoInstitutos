import assert from "node:assert/strict";
import test from "node:test";
import {
  resumirCompetenciaHistorica,
  validarSnapshotFolhasHistoricas,
  validarSnapshotGuiasInssHistoricas,
} from "../lib/migracao-historica";

function snapshotFolha() {
  return {
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569390",
      extractedAt: "2026-07-28T12:00:00.000Z",
    },
    entity: "folhas_historicas",
    records: [
      {
        legacyId: "F-10",
        competencia: "06/2026",
        numero: "10",
        termoLegacyId: "T-1",
        metaLegacyId: "M-1",
        status: "FECHADA",
        dataPagamento: "10/07/2026",
        totalProventos: "2.000,00",
        totalDescontos: "320,00",
        baseInss: "2.000,00",
        valorInss: "220,00",
        baseIrrf: "1.780,00",
        valorIrrf: "100,00",
        totalLiquido: "1.680,00",
        itens: [
          {
            legacyId: "FI-1",
            pessoaLegacyId: "P-1",
            vinculoLegacyId: "V-1",
            matricula: "0001",
            nome: "Pessoa de teste",
            cpf: "123.456.789-01",
            totalProventos: "2.000,00",
            totalDescontos: "320,00",
            baseInss: "2.000,00",
            valorInss: "220,00",
            baseIrrf: "1.780,00",
            valorIrrf: "100,00",
            totalLiquido: "1.680,00",
            rubricas: [
              {
                legacyId: "R-1",
                eventoLegacyId: "E-1",
                codigo: "001",
                descricao: "Retribuição",
                natureza: "PROVENTO",
                referencia: "100",
                baseCalculo: "2.000,00",
                valor: "2.000,00",
                incideInss: "sim",
                incideIrrf: "sim",
              },
            ],
          },
        ],
      },
    ],
  };
}

function snapshotGuia() {
  return {
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569421",
      extractedAt: "2026-07-28T12:05:00.000Z",
    },
    entity: "guias_inss_historicas",
    records: [
      {
        legacyId: "G-1",
        competencia: "06/2026",
        tipo: "GPS",
        status: "EMITIDA",
        identificador: "GUIA-001",
        codigoReceita: "2100",
        vencimento: "20/07/2026",
        pagamento: null,
        principal: "220,00",
        juros: "10,00",
        multa: "5,00",
        compensacoes: "15,00",
        total: "220,00",
        folhaLegacyIds: ["F-10", "F-10"],
      },
    ],
  };
}

test("normaliza folha histórica e valida fechamento por item", () => {
  const result = validarSnapshotFolhasHistoricas(snapshotFolha());
  assert.deepEqual(result.issues, []);
  assert.equal(result.snapshot?.records[0].competencia, "2026-06-01");
  assert.equal(result.snapshot?.records[0].totalLiquido, "1680.00");
  assert.equal(result.snapshot?.records[0].itens[0].cpf, "12345678901");
  assert.equal(result.snapshot?.records[0].itens[0].rubricas[0].incideInss, true);
});

test("rejeita total de folha que não confere com os itens", () => {
  const input = snapshotFolha();
  input.records[0].totalLiquido = "1.679,99";
  const result = validarSnapshotFolhasHistoricas(input);
  assert.equal(result.snapshot, null);
  assert.ok(
    result.issues.some(
      (issue) => issue.field === "totalLiquido" && issue.message.includes("soma"),
    ),
  );
});

test("normaliza guia histórica e remove vínculos duplicados", () => {
  const result = validarSnapshotGuiasInssHistoricas(snapshotGuia());
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.snapshot?.records[0].folhaLegacyIds, ["F-10"]);
  assert.equal(result.snapshot?.records[0].total, "220.00");
});

test("rejeita guia cujo total não fecha", () => {
  const input = snapshotGuia();
  input.records[0].total = "219,99";
  const result = validarSnapshotGuiasInssHistoricas(input);
  assert.equal(result.snapshot, null);
  assert.ok(result.issues.some((issue) => issue.field === "total"));
});

test("resume competência histórica sem arredondamento binário", () => {
  const folha = validarSnapshotFolhasHistoricas(snapshotFolha()).snapshot!.records[0];
  const guia = validarSnapshotGuiasInssHistoricas(snapshotGuia()).snapshot!.records[0];
  const resumo = resumirCompetenciaHistorica([folha, folha], [guia]);
  assert.deepEqual(resumo, {
    folhas: 2,
    pessoas: 1,
    proventosCentavos: 400000,
    descontosCentavos: 64000,
    liquidoCentavos: 336000,
    baseInssCentavos: 400000,
    inssCentavos: 44000,
    guias: 1,
    guiasCentavos: 22000,
  });
});
