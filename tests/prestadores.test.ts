import assert from "node:assert/strict";
import test from "node:test";
import { validarPrestadorCadastro } from "../lib/prestadores";

const pessoaId = "4c8ebf4f-33ee-4a93-996b-707462aade6e";

test("normaliza prestador para persistência", () => {
  const resultado = validarPrestadorCadastro({
    pessoaId,
    matricula: "  MAT 001  ",
    nitPisPasep: "123.45678.90-1",
    categoriaContribuinte: "  Contribuinte individual ",
    isentoInss: "on",
  });

  assert.deepEqual(resultado, {
    dados: {
      id: null,
      pessoaId,
      matricula: "MAT 001",
      nitPisPasep: "12345678901",
      categoriaContribuinte: "Contribuinte individual",
      isentoInss: true,
    },
    erros: [],
  });
});

test("rejeita pessoa, matrícula e NIT inválidos", () => {
  const resultado = validarPrestadorCadastro({
    pessoaId: "inválida",
    matricula: "",
    nitPisPasep: "123",
  });

  assert.equal(resultado.dados, null);
  assert.equal(resultado.erros.length, 3);
});

test("aceita campos previdenciários opcionais", () => {
  const resultado = validarPrestadorCadastro({ pessoaId, matricula: "0007" });

  assert.equal(resultado.dados?.nitPisPasep, null);
  assert.equal(resultado.dados?.categoriaContribuinte, null);
  assert.equal(resultado.dados?.isentoInss, false);
});
