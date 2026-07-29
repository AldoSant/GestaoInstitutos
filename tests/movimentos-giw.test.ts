import assert from "node:assert/strict";
import test from "node:test";
import { validarSnapshotGiw } from "../lib/importacao-giw";
import {
  validarSnapshotEventos,
  validarSnapshotLancamentosEventos,
  validarSnapshotProdutividade,
} from "../lib/movimentos-giw";

function source(formId: string) {
  return {
    system: "GIW",
    formId,
    extractedAt: "2026-07-28T12:00:00.000Z",
  };
}

test("normaliza Eventos e preserva incidências explícitas", () => {
  const result = validarSnapshotEventos({
    schemaVersion: "1.0",
    source: source("8716"),
    entity: "eventos",
    records: [
      {
        legacyId: "EV-1",
        codigo: "001",
        descricao: "Retribuição",
        natureza: "provento",
        tipoCalculo: "valor",
        incideInss: "sim",
        incideIrrf: "s",
        ativo: "ativo",
      },
    ],
  });
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.snapshot?.records[0], {
    legacyId: "EV-1",
    codigo: "001",
    descricao: "Retribuição",
    natureza: "PROVENTO",
    tipoCalculo: "VALOR",
    incideInss: true,
    incideIrrf: true,
    ativo: true,
  });
});

test("rejeita Evento informativo com incidência e código duplicado", () => {
  const registro = {
    legacyId: "EV-1",
    codigo: "900",
    descricao: "Informativo",
    natureza: "INFORMATIVO",
    tipoCalculo: "VALOR",
    incideInss: true,
    incideIrrf: false,
    ativo: true,
  };
  const result = validarSnapshotEventos({
    schemaVersion: "1.0",
    source: source("8716"),
    entity: "eventos",
    records: [registro, { ...registro, legacyId: "EV-2" }],
  });
  assert.equal(result.snapshot, null);
  assert.ok(result.issues.some((issue) => issue.field === "incidencias"));
  assert.ok(result.issues.some((issue) => issue.message.includes("duplicado")));
});

test("normaliza lançamento recorrente com valor e competências brasileiras", () => {
  const result = validarSnapshotLancamentosEventos({
    schemaVersion: "1.0",
    source: source("464569425"),
    entity: "lancamentos_eventos",
    records: [
      {
        legacyId: "LAN-1",
        vinculoLegacyId: "VIN-1",
        eventoLegacyId: "EV-1",
        valor: "1.234,5678",
        inicioCompetencia: "06/2026",
        fimCompetencia: "12/2026",
        ativo: true,
      },
    ],
  });
  assert.deepEqual(result.issues, []);
  assert.equal(result.snapshot?.records[0].valor, "1234.5678");
  assert.equal(result.snapshot?.records[0].inicioCompetencia, "2026-06-01");
  assert.equal(result.snapshot?.records[0].fimCompetencia, "2026-12-01");
});

test("rejeita lançamento com vigência invertida", () => {
  const result = validarSnapshotLancamentosEventos({
    schemaVersion: "1.0",
    source: source("464569425"),
    entity: "lancamentos_eventos",
    records: [
      {
        legacyId: "LAN-1",
        vinculoLegacyId: "VIN-1",
        eventoLegacyId: "EV-1",
        valor: "10,00",
        inicioCompetencia: "07/2026",
        fimCompetencia: "06/2026",
      },
    ],
  });
  assert.equal(result.snapshot, null);
  assert.ok(result.issues.some((issue) => issue.field === "fimCompetencia"));
});

test("normaliza produtividade percentual e cria referência GIW", () => {
  const result = validarSnapshotProdutividade({
    schemaVersion: "1.0",
    source: source("464569461"),
    entity: "produtividade",
    records: [
      {
        legacyId: "PROD-1",
        vinculoLegacyId: "VIN-1",
        competencia: "06/2026",
        tipo: "percentual",
        valorContratual: "2.000,00",
        percentual: "75,0000",
        quantidade: null,
        valorUnitario: null,
        valorApurado: "1.500,00",
      },
    ],
  });
  assert.deepEqual(result.issues, []);
  assert.equal(result.snapshot?.records[0].valorApurado, "1500.00");
  assert.equal(
    result.snapshot?.records[0].evidenciaReferencia,
    "GIW produtividade PROD-1",
  );
  assert.equal(result.snapshot?.records[0].conferente, "Importação GIW");
});

test("rejeita produtividade cuja memória não fecha", () => {
  const result = validarSnapshotProdutividade({
    schemaVersion: "1.0",
    source: source("464569461"),
    entity: "produtividade",
    records: [
      {
        legacyId: "PROD-1",
        vinculoLegacyId: "VIN-1",
        competencia: "2026-06-01",
        tipo: "QUANTIDADE",
        valorContratual: "2000.00",
        percentual: null,
        quantidade: "10",
        valorUnitario: "100",
        valorApurado: "999.99",
      },
    ],
  });
  assert.equal(result.snapshot, null);
  assert.ok(
    result.issues.some(
      (issue) => issue.field === "valorApurado" && issue.message.includes("quantidade"),
    ),
  );
});

test("dispatcher reconhece os três novos movimentos", () => {
  for (const [entity, formId] of [
    ["eventos", "8716"],
    ["lancamentos_eventos", "464569425"],
    ["produtividade", "464569461"],
  ]) {
    assert.equal(
      validarSnapshotGiw({
        schemaVersion: "1.0",
        source: source(formId),
        entity,
        records: [],
      }).snapshot?.entity,
      entity,
    );
  }
});
