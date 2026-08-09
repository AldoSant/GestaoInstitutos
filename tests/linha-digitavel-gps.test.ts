import assert from "node:assert/strict";
import test from "node:test";
import { gerarLinhaDigitavelGps, vencimentoNominalGps } from "../lib/linha-digitavel-gps";

test("reproduz a linha GPS histórica do GIW para competência mensal", () => {
  assert.equal(
    gerarLinhaDigitavelGps({
      codigoReceita: "1007",
      competencia: "2026-05",
      identificador: "20000000000",
      totalCentavos: 49_438,
    }),
    "85800000004-6 94380270100-1 70002000000-0 00002026050-0",
  );
});

test("preserva o indicador de competências consolidadas do layout GPS", () => {
  assert.equal(
    gerarLinhaDigitavelGps({
      codigoReceita: "1163",
      competencia: "2023-12",
      identificador: "13954495138",
      totalCentavos: 14_711,
      competenciasConsolidadas: 3,
    }),
    "85830000001-7 47110270116-9 30001395449-0 51382023123-5",
  );
});

test("calcula o vencimento nominal no dia 20 do mês seguinte", () => {
  assert.equal(vencimentoNominalGps("2026-06"), "2026-07-20");
});
