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

test("detecta obrigação exatamente duplicada", () => {
  assert.deepEqual(analisarConciliacaoPrevidenciaria(8_576.14, 17_152.28), {
    diferenca: 8_576.14,
    razao: 2,
    duplicacaoExata: true,
    conciliado: false,
  });
});
