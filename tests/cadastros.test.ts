import assert from "node:assert/strict";
import test from "node:test";
import {
  validarAtividadeCadastro,
  validarLotacaoCadastro,
  validarPessoaCadastro,
} from "../lib/cadastros";

test("normaliza pessoa física para persistência", () => {
  const resultado = validarPessoaCadastro({
    tipo: "FISICA",
    nome: "  Maria   de Teste ",
    documento: "529.982.247-25",
  });

  assert.deepEqual(resultado, {
    dados: {
      id: null,
      tipo: "FISICA",
      nome: "Maria de Teste",
      cpf: "52998224725",
      cnpj: null,
    },
    erros: [],
  });
});

test("separa CPF e CNPJ conforme a natureza", () => {
  const resultado = validarPessoaCadastro({
    tipo: "JURIDICA",
    nome: "Empresa Sintética",
    documento: "12.345.678/0001-99",
  });

  assert.equal(resultado.dados?.cpf, null);
  assert.equal(resultado.dados?.cnpj, "12345678000199");
  assert.equal(
    validarPessoaCadastro({ tipo: "FISICA", nome: "Inválida", documento: "123" })
      .dados,
    null,
  );
  assert.equal(
    validarPessoaCadastro({ tipo: "OUTRA", nome: "Natureza inválida" }).dados,
    null,
  );
});

test("normaliza valores brasileiros da atividade e rejeita negativos", () => {
  const resultado = validarAtividadeCadastro({
    codigo: " 174 ",
    descricao: " Enfermeira ",
    cargaHoraria: "200",
    valor: "2.922,48",
  });
  assert.deepEqual(resultado.dados, {
    id: null,
    codigo: "174",
    descricao: "Enfermeira",
    cargaHoraria: "200",
    valor: "2922.48",
  });
  assert.equal(
    validarAtividadeCadastro({ codigo: "1", descricao: "Inválida", valor: "-0,01" })
      .dados,
    null,
  );
});

test("valida edição e limites da lotação", () => {
  const resultado = validarLotacaoCadastro({
    id: "4c8ebf4f-33ee-4a93-996b-707462aade6e",
    codigo: "10",
    descricao: " Hospital Central ",
  });
  assert.equal(resultado.dados?.descricao, "Hospital Central");
  assert.equal(
    validarLotacaoCadastro({ id: "inválido", codigo: "", descricao: "" }).erros.length,
    3,
  );
});

test("rejeita identificadores que apenas se parecem com UUID", () => {
  const resultado = validarAtividadeCadastro({
    id: "------------------------------------",
    codigo: "1",
    descricao: "Atividade",
  });

  assert.equal(resultado.dados, null);
  assert.match(resultado.erros.join(" "), /Identificador inválido/);
});
