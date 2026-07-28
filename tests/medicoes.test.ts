import assert from "node:assert/strict";
import test from "node:test";
import { validarMedicaoMensal } from "../lib/medicoes";

const evidencia = {
  competencia: "2026-07",
  valorContratual: "4080.00",
  evidenciaReferencia: "Relatório mensal 07/2026",
  evidenciaHash: "a".repeat(64),
  conferente: "Gerente de RH",
  observacao: "",
};

test("apura medição percentual sem ponto flutuante", () => {
  const medicao = validarMedicaoMensal({
    ...evidencia,
    tipo: "PERCENTUAL",
    percentual: "87,5000",
  });
  assert.equal(medicao.percentual, "87.5000");
  assert.equal(medicao.valorApurado, "3570.00");
  assert.equal(medicao.quantidade, null);
});

test("apura produtividade por quantidade e valor unitário", () => {
  const medicao = validarMedicaoMensal({
    ...evidencia,
    tipo: "QUANTIDADE",
    quantidade: "12,5000",
    valorUnitario: "125,4320",
  });
  assert.equal(medicao.quantidade, "12.5000");
  assert.equal(medicao.valorUnitario, "125.4320");
  assert.equal(medicao.valorApurado, "1567.90");
});

test("aceita valor apurado explícito e exige evidência", () => {
  const medicao = validarMedicaoMensal({
    ...evidencia,
    tipo: "VALOR",
    valor: "1.234,56",
  });
  assert.equal(medicao.valorApurado, "1234.56");

  assert.throws(
    () =>
      validarMedicaoMensal({
        ...evidencia,
        tipo: "VALOR",
        valor: "100",
        evidenciaReferencia: "",
      }),
    /referência da evidência/,
  );
});

test("rejeita percentual acima de 100% e hash inválido", () => {
  assert.throws(
    () =>
      validarMedicaoMensal({
        ...evidencia,
        tipo: "PERCENTUAL",
        percentual: "100,0001",
      }),
    /entre 0% e 100%/,
  );
  assert.throws(
    () =>
      validarMedicaoMensal({
        ...evidencia,
        tipo: "VALOR",
        valor: "100",
        evidenciaHash: "hash-inválido",
      }),
    /SHA-256/,
  );
});
