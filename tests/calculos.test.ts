import assert from "node:assert/strict";
import test from "node:test";
import {
  analisarConciliacaoPrevidenciaria,
  calcularInssPrestador,
  calcularIrrf2026,
} from "../lib/calculos";

test("calcula retenção previdenciária de 11%", () => {
  assert.deepEqual(calcularInssPrestador(6_000.03), {
    base: 6_000.03,
    aliquota: 0.11,
    valor: 660,
    tetoAtingido: false,
  });
});

test("limita INSS ao teto da competência", () => {
  assert.equal(calcularInssPrestador(20_000).valor, 932.31);
});

test("considera contribuições previdenciárias feitas em outras fontes", () => {
  assert.deepEqual(calcularInssPrestador(2_000, 8_000), {
    base: 475.55,
    aliquota: 0.11,
    valor: 52.31,
    tetoAtingido: true,
  });
  assert.equal(calcularInssPrestador(2_000, 8_475.55).valor, 0);
});

test("reproduz memória de IRRF observada no legado", () => {
  assert.deepEqual(
    calcularIrrf2026({ rendimentos: 6_000.03, inssDedutivel: 660 }),
    {
      rendimentos: 6_000.03,
      metodoDeducao: "LEGAL",
      deducaoUtilizada: 660,
      base: 5_340.03,
      impostoBruto: 559.78,
      reducao: 179.75,
      valor: 380.03,
    },
  );
});

test("usa desconto simplificado quando ele é mais benéfico", () => {
  const resultado = calcularIrrf2026({
    rendimentos: 3_325.84,
    inssDedutivel: 365.84,
  });
  assert.equal(resultado.metodoDeducao, "SIMPLIFICADA");
  assert.equal(resultado.base, 2_718.64);
  assert.equal(resultado.valor, 0);
});

test("respeita os limites da redução mensal do IRRF de 2026", () => {
  assert.equal(calcularIrrf2026({ rendimentos: 5_000, inssDedutivel: 0 }).valor, 0);
  assert.equal(
    calcularIrrf2026({ rendimentos: 7_350, inssDedutivel: 0 }).reducao,
    0,
  );
  assert.equal(
    calcularIrrf2026({ rendimentos: 7_350.01, inssDedutivel: 0 }).reducao,
    0,
  );
});

test("rejeita entradas financeiras inválidas", () => {
  assert.throws(() => calcularInssPrestador(Number.NaN), RangeError);
  assert.throws(() => calcularInssPrestador(100, -1), RangeError);
  assert.throws(
    () => calcularIrrf2026({ rendimentos: -1, inssDedutivel: 0 }),
    RangeError,
  );
  assert.throws(
    () => calcularIrrf2026({ rendimentos: 1_000, inssDedutivel: 0, dependentes: 1.5 }),
    RangeError,
  );
  assert.throws(
    () => analisarConciliacaoPrevidenciaria(100, Number.POSITIVE_INFINITY),
    RangeError,
  );
});

test("detecta obrigação exatamente duplicada", () => {
  assert.deepEqual(analisarConciliacaoPrevidenciaria(8_576.14, 17_152.28), {
    diferenca: 8_576.14,
    razao: 2,
    duplicacaoExata: true,
    conciliado: false,
  });
});
