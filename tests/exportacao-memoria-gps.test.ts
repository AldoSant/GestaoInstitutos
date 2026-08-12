import assert from "node:assert/strict";
import test from "node:test";
import { gerarCsvMemoriasGps } from "../lib/exportacao-memoria-gps";

test("exporta memórias GPS em CSV sem fórmulas de planilha", () => {
  const csv = gerarCsvMemoriasGps([
    {
      itemId: "item-1",
      fonteItemIds: ["item-1"],
      nome: "=Prestador de teste",
      identificador: "12345678901",
      codigoReceita: "1007",
      competencia: "2026-07-01",
      valorCentavos: 11_000,
      vencimento: "2026-08-20",
      linhaDigitavel: "85800000001-6 10000270100-2 70001234567-3 89012026070-6",
    },
  ]);
  assert.match(csv, /^\uFEFFordem;/);
  assert.match(csv, /"'=Prestador de teste"/);
  assert.match(csv, /110,00/);
});

test("recusa CSV sem memória ou com item repetido", () => {
  assert.throws(() => gerarCsvMemoriasGps([]), /Não há memórias/);
  const item = {
    itemId: "item-1", fonteItemIds: ["item-1"], nome: "Prestador", identificador: "12345678901",
    codigoReceita: "1007", competencia: "2026-07-01", valorCentavos: 1,
    vencimento: "2026-08-20", linhaDigitavel: "85800000000-0 01000270100-0 70001234567-8 89012026070-6",
  };
  assert.throws(() => gerarCsvMemoriasGps([item, item]), /duplicado/);
});
