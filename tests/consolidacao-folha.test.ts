import assert from "node:assert/strict";
import test from "node:test";
import { validarAusenciaDeConflitoPessoaCompetencia } from "../lib/consolidacao-folha";

test("permite uma pessoa em uma única Folha da competência", () => {
  assert.doesNotThrow(() =>
    validarAusenciaDeConflitoPessoaCompetencia([]),
  );
});

test("bloqueia a mesma pessoa em Folhas separadas da competência", () => {
  assert.throws(
    () =>
      validarAusenciaDeConflitoPessoaCompetencia([
        {
          nome: "Prestadora de teste",
          matricula: "000123",
          folhaId: "12345678-1234-4123-8123-123456789012",
          termoNumero: "45/2026",
          metaCodigo: "META-02",
        },
      ]),
    /Consolidação mensal necessária.*Prestadora de teste.*000123.*12345678.*45\/2026.*META-02/,
  );
});
