import assert from "node:assert/strict";
import test from "node:test";
import {
  construirExpectativaMigracaoGiw,
  formatarCentavos,
} from "../lib/auditoria-migracao-giw";
import {
  validarSnapshotFolhasHistoricas,
  validarSnapshotGuiasInssHistoricas,
} from "../lib/migracao-historica";

function folhaValidada() {
  const resultado = validarSnapshotFolhasHistoricas({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569390",
      extractedAt: "2026-07-29T12:00:00.000Z",
    },
    entity: "folhas_historicas",
    records: [
      {
        legacyId: "F-1",
        competencia: "06/2026",
        numero: "1",
        termoLegacyId: "T-1",
        metaLegacyId: "M-1",
        status: "FECHADA",
        dataPagamento: null,
        totalProventos: "1000.10",
        totalDescontos: "110.05",
        baseInss: "1000.10",
        valorInss: "110.01",
        baseIrrf: "890.09",
        valorIrrf: "0",
        totalLiquido: "890.05",
        itens: [
          {
            legacyId: "I-1",
            pessoaLegacyId: "P-1",
            vinculoLegacyId: "V-1",
            matricula: "1",
            nome: "Pessoa teste",
            cpf: "12345678901",
            totalProventos: "1000.10",
            totalDescontos: "110.05",
            baseInss: "1000.10",
            valorInss: "110.01",
            baseIrrf: "890.09",
            valorIrrf: "0",
            totalLiquido: "890.05",
            rubricas: [],
          },
        ],
      },
    ],
  });
  assert.ok(resultado.snapshot);
  return resultado.snapshot;
}

function guiaValidada() {
  const resultado = validarSnapshotGuiasInssHistoricas({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569421",
      extractedAt: "2026-07-29T12:00:00.000Z",
    },
    entity: "guias_inss_historicas",
    records: [
      {
        legacyId: "G-1",
        competencia: "06/2026",
        tipo: "GPS",
        status: "EMITIDA",
        identificador: "GPS-1",
        pessoaLegacyId: "P-1",
        beneficiarioNome: "Pessoa teste",
        lote: "1",
        codigoReceita: "1007",
        vencimento: "15/07/2026",
        pagamento: null,
        principal: "110.01",
        juros: "0",
        multa: "0",
        compensacoes: "0",
        total: "110.01",
        folhaLegacyIds: ["F-1"],
      },
    ],
  });
  assert.ok(resultado.snapshot);
  return resultado.snapshot;
}

test("monta prova determinística de chaves e totais históricos", () => {
  const expectativa = construirExpectativaMigracaoGiw([
    folhaValidada(),
    guiaValidada(),
  ]);

  assert.deepEqual(
    expectativa.chaves.map((item) => [
      item.entidade,
      item.legacyId,
      item.destinoTabela,
    ]),
    [
      ["folhas_historicas", "F-1", "legado_folha"],
      ["guias_inss_historicas", "G-1", "legado_guia_inss"],
    ],
  );
  assert.equal(expectativa.snapshots.length, 2);
  assert.deepEqual(
    {
      ...expectativa.financeiro[0],
      proventosCentavos: formatarCentavos(
        expectativa.financeiro[0].proventosCentavos,
      ),
      descontosCentavos: formatarCentavos(
        expectativa.financeiro[0].descontosCentavos,
      ),
      liquidoCentavos: formatarCentavos(
        expectativa.financeiro[0].liquidoCentavos,
      ),
      baseInssCentavos: formatarCentavos(
        expectativa.financeiro[0].baseInssCentavos,
      ),
      inssCentavos: formatarCentavos(
        expectativa.financeiro[0].inssCentavos,
      ),
      guiasCentavos: formatarCentavos(
        expectativa.financeiro[0].guiasCentavos,
      ),
    },
    {
      competencia: "2026-06",
      folhas: 1,
      itensFolha: 1,
      rubricas: 0,
      guias: 1,
      proventosCentavos: "1000.10",
      descontosCentavos: "110.05",
      liquidoCentavos: "890.05",
      baseInssCentavos: "1000.10",
      inssCentavos: "110.01",
      guiasCentavos: "110.01",
    },
  );
});
