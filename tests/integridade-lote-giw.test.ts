import assert from "node:assert/strict";
import test from "node:test";
import type { GiwSnapshot } from "../lib/importacao-giw";
import { validarIntegridadeLoteGiw } from "../lib/integridade-lote-giw";

const source = (formId: string) => ({
  system: "GIW" as const,
  formId,
  extractedAt: "2026-07-29T12:00:00.000Z",
});

test("aceita cadeia relacional completa de cadastro e Vínculo", () => {
  const snapshots = [
    {
      schemaVersion: "1.0",
      source: source("464569402"),
      entity: "pessoas",
      records: [{ legacyId: "P1" }],
    },
    {
      schemaVersion: "1.0",
      source: source("464569252"),
      entity: "atividades",
      records: [{ legacyId: "A1" }],
    },
    {
      schemaVersion: "1.0",
      source: source("464569449"),
      entity: "lotacoes",
      records: [{ legacyId: "L1" }],
    },
    {
      schemaVersion: "1.0",
      source: source("464569250"),
      entity: "termos",
      records: [{ legacyId: "T1", metas: [{ legacyId: "M1" }] }],
    },
    {
      schemaVersion: "1.0",
      source: source("464569258"),
      entity: "vinculos",
      records: [
        {
          legacyId: "V1",
          pessoaLegacyId: "P1",
          atividadeLegacyId: "A1",
          lotacaoLegacyId: "L1",
          termoLegacyId: "T1",
          metaLegacyId: "M1",
        },
      ],
    },
  ] as GiwSnapshot[];

  assert.deepEqual(validarIntegridadeLoteGiw(snapshots), []);
});

test("expõe dependências ausentes e chaves duplicadas entre snapshots", () => {
  const snapshots = [
    {
      schemaVersion: "1.0",
      source: source("464569402"),
      entity: "pessoas",
      records: [{ legacyId: "P1" }],
    },
    {
      schemaVersion: "1.0",
      source: source("464569402"),
      entity: "pessoas",
      records: [{ legacyId: "P1" }],
    },
    {
      schemaVersion: "1.0",
      source: source("464569258"),
      entity: "vinculos",
      records: [
        {
          legacyId: "V1",
          pessoaLegacyId: "P2",
          atividadeLegacyId: "A1",
          lotacaoLegacyId: "L1",
          termoLegacyId: "T1",
          metaLegacyId: "M1",
        },
      ],
    },
  ] as GiwSnapshot[];

  const issues = validarIntegridadeLoteGiw(snapshots);
  assert.equal(issues.filter((issue) => issue.reason === "CHAVE_DUPLICADA").length, 1);
  assert.equal(
    issues.filter((issue) => issue.reason === "DEPENDENCIA_AUSENTE").length,
    5,
  );
});
