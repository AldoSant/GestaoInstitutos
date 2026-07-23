import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularInssPrestador,
  calcularIrrf2026,
} from "../lib/calculos";
import { hashJson } from "../lib/json-canonico";
import {
  REGRA_FISCAL_2026,
  validarRegraFiscal,
} from "../lib/regras-fiscais";

test("valida e torna estável o conteúdo da regra fiscal", () => {
  assert.equal(validarRegraFiscal(REGRA_FISCAL_2026), REGRA_FISCAL_2026);
  assert.equal(
    hashJson({ b: REGRA_FISCAL_2026, a: 1 }),
    hashJson({ a: 1, b: REGRA_FISCAL_2026 }),
  );
});

test("rejeita faixas fiscais ambíguas ou fora de ordem", () => {
  const regra = structuredClone(REGRA_FISCAL_2026);
  regra.irrf.faixas[1].limiteSuperiorCentavos = 100;
  assert.throws(() => validarRegraFiscal(regra), /limites crescentes/);

  const semFaixaFinal = structuredClone(REGRA_FISCAL_2026);
  semFaixaFinal.irrf.faixas.at(-1)!.limiteSuperiorCentavos = 999_999;
  assert.throws(() => validarRegraFiscal(semFaixaFinal), /Faixa de IRRF/);
});

test("o motor usa a versão de regra recebida sem constantes ocultas", () => {
  const regra = structuredClone(REGRA_FISCAL_2026);
  regra.inss.aliquotaNumerador = 10;
  regra.inss.tetoContribuicaoCentavos = 100_000;
  regra.irrf.descontoSimplificadoCentavos = 0;

  assert.equal(calcularInssPrestador(1_000, 0, regra).valor, 100);
  assert.equal(
    calcularIrrf2026({
      rendimentos: 3_000,
      inssDedutivel: 0,
      regra,
    }).metodoDeducao,
    "LEGAL",
  );
});
