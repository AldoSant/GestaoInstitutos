import assert from "node:assert/strict";
import test from "node:test";
import {
  aplicarFormulaLinear,
  aplicarProporcao,
  decimalParaInteiro,
  deCentavos,
  paraCentavos,
} from "../lib/dinheiro";

test("converte decimais críticos sem herdar erro binário", () => {
  assert.equal(paraCentavos(1.005), 101);
  assert.equal(paraCentavos(2.675), 268);
  assert.equal(paraCentavos(-1.005), -101);
  assert.equal(deCentavos(600_003), 6_000.03);
  assert.equal(decimalParaInteiro("6000.035", 2), 600_004);
  assert.equal(decimalParaInteiro("10.5000", 4), 105_000);
  assert.equal(decimalParaInteiro("-1.005", 2), -101);
});

test("aplica alíquotas e parcelas com arredondamento inteiro", () => {
  assert.equal(aplicarProporcao(600_003, 11, 100), 66_000);
  assert.equal(
    aplicarFormulaLinear({
      valor: 534_003,
      numerador: 275,
      denominador: 1_000,
      parcela: 90_873,
    }),
    55_978,
  );
});

test("rejeita valores monetários fora do intervalo seguro", () => {
  assert.throws(() => paraCentavos(Number.POSITIVE_INFINITY), RangeError);
  assert.throws(
    () => paraCentavos(Number.MAX_SAFE_INTEGER),
    /limite numérico seguro/,
  );
  assert.throws(() => deCentavos(1.5), RangeError);
  assert.throws(() => decimalParaInteiro("1,25", 2), RangeError);
});
