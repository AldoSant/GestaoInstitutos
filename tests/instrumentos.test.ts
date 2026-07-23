import assert from "node:assert/strict";
import test from "node:test";
import { validarMetaCadastro, validarTermoCadastro } from "../lib/instrumentos";

const termoId = "4c8ebf4f-33ee-4a93-996b-707462aade6e";

test("normaliza termo e valor monetário brasileiro", () => {
  const resultado = validarTermoCadastro({
    numero: "  12/2026 ",
    descricao: " Termo de colaboração ",
    modalidade: " Colaboração ",
    inicio: "2026-01-01",
    fim: "2026-12-31",
    valorGlobal: "1.234.567,89",
  });

  assert.deepEqual(resultado.dados, {
    id: null,
    numero: "12/2026",
    descricao: "Termo de colaboração",
    modalidade: "Colaboração",
    inicio: "2026-01-01",
    fim: "2026-12-31",
    valorGlobal: "1234567.89",
  });
});

test("rejeita vigência invertida e valor negativo", () => {
  const resultado = validarTermoCadastro({
    numero: "1",
    descricao: "Termo",
    modalidade: "Contrato",
    inicio: "2026-12-31",
    fim: "2026-01-01",
    valorGlobal: "-0,01",
  });

  assert.equal(resultado.dados, null);
  assert.equal(resultado.erros.length, 2);
});

test("rejeita datas impossíveis", () => {
  const resultado = validarTermoCadastro({
    numero: "1",
    descricao: "Termo",
    modalidade: "Contrato",
    inicio: "2026-02-30",
    valorGlobal: "0",
  });

  assert.equal(resultado.dados, null);
  assert.match(resultado.erros.join(" "), /data inicial válida/);
});

test("normaliza meta vinculada ao termo", () => {
  const resultado = validarMetaCadastro({
    termoId,
    codigo: "  META 01 ",
    descricao: " Atendimento especializado ",
  });

  assert.deepEqual(resultado.dados, {
    id: null,
    termoId,
    codigo: "META 01",
    descricao: "Atendimento especializado",
  });
});
