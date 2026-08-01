import assert from "node:assert/strict";
import test from "node:test";
import {
  nomeInstrumentoRecolhimento,
  validarPerfilRecolhimento,
} from "../lib/perfil-recolhimento";

const base = {
  inicioVigencia: "2026-01-01",
  fimVigencia: "2026-12-31",
  evidencia: "Nota técnica registrada e conferida para a vigência informada.",
  responsavel: "Equipe fiscal",
};

test("aceita DCTFWeb/DARF sem código de receita", () => {
  const resultado = validarPerfilRecolhimento({
    ...base,
    instrumento: "DCTFWEB_DARF",
    codigoReceita: "",
  });
  assert.deepEqual(resultado.erros, []);
  assert.equal(resultado.dados?.codigoReceita, null);
  assert.equal(nomeInstrumentoRecolhimento("DCTFWEB_DARF"), "DCTFWeb / DARF");
});

test("exige código e fundamentação para GPS excepcional", () => {
  const invalido = validarPerfilRecolhimento({
    ...base,
    instrumento: "GPS_EXCECAO",
    codigoReceita: "100",
  });
  assert.match(invalido.erros.join(" "), /quatro dígitos/);

  const valido = validarPerfilRecolhimento({
    ...base,
    instrumento: "GPS_EXCECAO",
    codigoReceita: "1007",
  });
  assert.deepEqual(valido.erros, []);
  assert.equal(valido.dados?.codigoReceita, "1007");
});
