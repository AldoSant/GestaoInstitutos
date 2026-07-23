import assert from "node:assert/strict";
import test from "node:test";
import {
  checksum,
  somenteDigitos,
  validarSnapshotPessoas,
} from "../lib/importacao-giw";

function snapshot(records: unknown[]) {
  return {
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569402",
      extractedAt: "2026-07-22T12:00:00.000Z",
    },
    entity: "pessoas",
    records,
  };
}

test("normaliza documentos e classifica pessoa física", () => {
  const result = validarSnapshotPessoas(
    snapshot([{ legacyId: " 42 ", nome: " Maria   da Silva ", cpf: "123.456.789-01" }]),
  );

  assert.equal(result.issues.length, 0);
  assert.deepEqual(result.snapshot?.records[0], {
    legacyId: "42",
    nome: "Maria da Silva",
    tipo: "FISICA",
    cpf: "12345678901",
    cnpj: null,
  });
});

test("classifica pessoa jurídica pelo CNPJ", () => {
  const result = validarSnapshotPessoas(
    snapshot([{ legacyId: "9", nome: "Clínica Exemplo", cnpj: "12.345.678/0001-90" }]),
  );

  assert.equal(result.issues.length, 0);
  assert.equal(result.snapshot?.records[0].tipo, "JURIDICA");
  assert.equal(result.snapshot?.records[0].cnpj, "12345678000190");
});

test("rejeita IDs repetidos e documentos inválidos", () => {
  const result = validarSnapshotPessoas(
    snapshot([
      { legacyId: "1", nome: "Primeira" },
      { legacyId: "1", nome: "Segunda" },
      { legacyId: "2", nome: "Terceira", cpf: "123" },
    ]),
  );

  assert.equal(result.snapshot, null);
  assert.ok(result.issues.some((issue) => issue.field === "cpf"));
  assert.ok(result.issues.some((issue) => issue.field === "legacyId"));
});

test("checksum é estável independentemente da ordem das chaves", () => {
  assert.equal(checksum({ b: 2, a: 1 }), checksum({ a: 1, b: 2 }));
  assert.notEqual(checksum({ a: 1 }), checksum({ a: 2 }));
});

test("somenteDigitos aceita valores vazios sem inventar documento", () => {
  assert.equal(somenteDigitos(""), null);
  assert.equal(somenteDigitos(null), null);
  assert.equal(somenteDigitos("12.3"), "123");
});
