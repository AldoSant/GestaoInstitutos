import assert from "node:assert/strict";
import test from "node:test";
import { validarRegistroGuiaGpsIndividual } from "../lib/guia-gps-individual";

const guiaId = "11111111-1111-4111-8111-111111111111";

test("aceita o registro de GPS oficial individual conferida", () => {
  const resultado = validarRegistroGuiaGpsIndividual({
    guiaId,
    referencia: "GPS-2026-07-001",
    emitidoEm: "2026-08-01",
    localizador: "documentos/2026-07/gps-001.pdf",
    juros: "1,25",
    multa: "0,00",
    verificado: "on",
  });
  assert.deepEqual(resultado.erros, []);
  assert.deepEqual(resultado.dados, {
    guiaId,
    referencia: "GPS-2026-07-001",
    emitidoEm: "2026-08-01",
    localizador: "documentos/2026-07/gps-001.pdf",
    hashSha256: null,
    juros: "1.25",
    multa: "0.00",
    verificado: true,
  });
});

test("recusa evidência sem conferência, identificação ou valor válido", () => {
  const resultado = validarRegistroGuiaGpsIndividual({
    guiaId: "invalido",
    referencia: "",
    emitidoEm: "2026-13-01",
    localizador: "",
    juros: "-1",
    verificado: false,
  });
  assert.equal(resultado.dados, null);
  assert.match(resultado.erros.join(" "), /conferida no canal oficial/);
  assert.match(resultado.erros.join(" "), /não podem ser negativos/);
});
