import assert from "node:assert/strict";
import test from "node:test";
import { validarEventoCadastro, validarEventoRecorrente } from "../lib/eventos";

const vinculoId = "4c8ebf4f-33ee-4a93-996b-707462aade6e";
const eventoId = "e407fe67-4208-42f1-b25e-9007569c4938";

test("normaliza Evento com incidências", () => {
  const result = validarEventoCadastro({
    codigo: " prod ",
    descricao: " Produtividade mensal ",
    natureza: "provento",
    tipoCalculo: "valor",
    incideInss: true,
    incideIrrf: true,
  });

  assert.deepEqual(result.dados, {
    id: null,
    codigo: "PROD",
    descricao: "Produtividade mensal",
    natureza: "PROVENTO",
    tipoCalculo: "VALOR",
    incideInss: true,
    incideIrrf: true,
  });
});

test("rejeita Evento informativo com incidência", () => {
  const result = validarEventoCadastro({
    codigo: "INFO",
    descricao: "Somente memória",
    natureza: "INFORMATIVO",
    tipoCalculo: "VALOR",
    incideInss: true,
  });
  assert.equal(result.dados, null);
  assert.ok(result.erros.some((erro) => erro.includes("informativo")));
});

test("normaliza lançamento recorrente por competência", () => {
  const result = validarEventoRecorrente({
    vinculoId,
    eventoId,
    valor: "1.250,50",
    inicioCompetencia: "2026-01",
    fimCompetencia: "2026-12",
  });

  assert.deepEqual(result.dados, {
    id: null,
    vinculoId,
    eventoId,
    valor: "1250.50",
    inicioCompetencia: "2026-01-01",
    fimCompetencia: "2026-12-01",
  });
});
