import assert from "node:assert/strict";
import test from "node:test";
import {
  competenciaCalendario,
  primeiraCompetencia,
  rotuloCompetencia,
} from "../lib/competencia";

test("aceita somente competências mensais válidas", () => {
  assert.equal(primeiraCompetencia("2026-07"), "2026-07");
  assert.equal(primeiraCompetencia(["2025-12", "2026-01"]), "2025-12");
  assert.equal(primeiraCompetencia("2026-13"), undefined);
  assert.equal(primeiraCompetencia("07/2026"), undefined);
  assert.equal(primeiraCompetencia(undefined), undefined);
});

test("calcula e apresenta a competência do calendário", () => {
  assert.equal(competenciaCalendario(new Date(2026, 6, 29)), "2026-07");
  assert.equal(rotuloCompetencia("2026-07"), "07/2026");
});

