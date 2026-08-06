import assert from "node:assert/strict";
import test from "node:test";
import { validarPrestadorCadastro } from "../lib/prestadores";

const pessoaId = "4c8ebf4f-33ee-4a93-996b-707462aade6e";

test("normaliza prestador para persistência sem duplicar dados da pessoa", () => {
  const resultado = validarPrestadorCadastro({
    pessoaId,
    matricula: "  MAT 001  ",
    isentoInss: "on",
  });

  assert.deepEqual(resultado, {
    dados: {
      id: null,
      pessoaId,
      matricula: "MAT 001",
      isentoInss: true,
    },
    erros: [],
  });
});

test("rejeita pessoa e matrícula inválidas", () => {
  const resultado = validarPrestadorCadastro({
    pessoaId: "inválida",
    matricula: "",
  });

  assert.equal(resultado.dados, null);
  assert.equal(resultado.erros.length, 2);
});

test("aceita campos previdenciários opcionais", () => {
  const resultado = validarPrestadorCadastro({ pessoaId, matricula: "0007" });

  assert.equal(resultado.dados?.isentoInss, false);
});
