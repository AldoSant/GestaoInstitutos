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
      nome: "Prestador de teste",
      identificador: "12345678901",
      codigoReceita: "1007",
      competencia: "2026-07-01",
      valorCentavos: 11_000,
    },
  ]);
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
