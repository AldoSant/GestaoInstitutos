import assert from "node:assert/strict";
import test from "node:test";
import { validarVinculoCadastro } from "../lib/vinculos";

const ids = {
  prestadorId: "4c8ebf4f-33ee-4a93-996b-707462aade6e",
  termoId: "e407fe67-4208-42f1-b25e-9007569c4938",
  metaId: "89d5dd52-a259-4611-8ef8-82828af1679b",
  atividadeId: "8770b12a-d345-4873-953d-941f90a38f79",
  lotacaoId: "777ff184-2276-4984-945d-848840c26579",
};

test("normaliza vínculo completo e valores brasileiros", () => {
  const result = validarVinculoCadastro({
    ...ids,
    numeroContrato: " 222/2026 ",
    inicio: "01/04/2026",
    fim: "31/08/2026",
    valorRetribuicao: "4.080,00",
    cargaHoraria: "200",
    descontaInss: true,
    descontaIrrf: false,
  });

  assert.equal(result.erros.length, 0);
  assert.deepEqual(result.dados, {
    id: null,
    ...ids,
    numeroContrato: "222/2026",
    inicio: "2026-04-01",
    fim: "2026-08-31",
    valorRetribuicao: "4080.00",
    cargaHoraria: "200",
    descontaInss: true,
    descontaIrrf: false,
  });
});

test("rejeita relação, vigência e valores inválidos", () => {
  const result = validarVinculoCadastro({
    ...ids,
    metaId: "fora-do-padrao",
    inicio: "2026-06-01",
    fim: "2026-05-31",
    valorRetribuicao: "-0,01",
    cargaHoraria: "-1",
  });

  assert.equal(result.dados, null);
  assert.ok(result.erros.some((erro) => erro.includes("meta")));
  assert.ok(result.erros.some((erro) => erro.includes("anteceder")));
  assert.ok(result.erros.some((erro) => erro.includes("retribuição")));
  assert.ok(result.erros.some((erro) => erro.includes("carga horária")));
});
