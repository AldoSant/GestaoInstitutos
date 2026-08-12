import assert from "node:assert/strict";
import test from "node:test";
import { montarMemoriasGpsIndividuais } from "../lib/memoria-gps";

const base = {
  instrumento: "GPS_EXCECAO" as const,
  codigoReceita: "1007",
  competencia: "2026-07-01",
  itens: [
    {
      id: "item-1",
      natureza: "SEGURADO",
      valor: "110.00",
      snapshot: {
        pessoa: { nome: "Prestador de teste" },
        prestador: { nitPisPasep: "123.45678.90-1" },
      },
    },
  ],
};

test("prepara uma memória individual de GPS a partir de item fechado", () => {
  const resultado = montarMemoriasGpsIndividuais(base);
  assert.deepEqual(resultado, [
    {
      itemId: "item-1",
      fonteItemIds: ["item-1"],
      nome: "Prestador de teste",
      identificador: "12345678901",
      codigoReceita: "1007",
      competencia: "2026-07-01",
      valorCentavos: 11_000,
      vencimento: "2026-08-20",
      linhaDigitavel: "85820000001-5 10000270100-2 70001234567-3 89012026073-1",
    },
  ]);
});

test("consolida itens da mesma pessoa em uma única GPS da competência", () => {
  const resultado = montarMemoriasGpsIndividuais({
    ...base,
    itens: [
      ...base.itens,
      {
        ...base.itens[0],
        id: "item-2",
        valor: "35.00",
      },
    ],
  });
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].valorCentavos, 14500);
  assert.deepEqual(resultado[0].fonteItemIds, ["item-1", "item-2"]);
});

test("recusa GPS fora do perfil ou sem identificador congelado", () => {
  assert.throws(
    () => montarMemoriasGpsIndividuais({ ...base, instrumento: "DCTFWEB_DARF" }),
    /GPS excepcional/,
  );
  assert.throws(
    () => montarMemoriasGpsIndividuais({
      ...base,
      itens: [{ ...base.itens[0], snapshot: { pessoa: { nome: "Sem NIT" } } }],
    }),
    /NIT\/PIS\/PASEP/,
  );
});
