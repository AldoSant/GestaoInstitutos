import assert from "node:assert/strict";
import test from "node:test";
import { normalizarAberturaRevisaoDemonstrativo } from "../lib/revisao-demonstrativo";

test("normaliza motivo e responsável da nova revisão", () => {
  assert.deepEqual(
    normalizarAberturaRevisaoDemonstrativo({
      motivo: "  Correção documentada após conferência do RH.  ",
      responsavel: "  Gerente do RH  ",
    }),
    {
      motivo: "Correção documentada após conferência do RH.",
      responsavel: "Gerente do RH",
    },
  );
});

test("recusa nova revisão sem justificativa auditável", () => {
  assert.throws(
    () =>
      normalizarAberturaRevisaoDemonstrativo({
        motivo: "Corrigir valor.",
        responsavel: "RH",
      }),
    /motivo da nova revisão/,
  );
  assert.throws(
    () =>
      normalizarAberturaRevisaoDemonstrativo({
        motivo: "Correção documentada após conferência do RH.",
        responsavel: "RH",
      }),
    /responsável/,
  );
});
