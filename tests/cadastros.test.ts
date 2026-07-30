import assert from "node:assert/strict";
import test from "node:test";
import {
  validarAtividadeCadastro,
  validarContaPessoaCadastro,
  validarDependenteCadastro,
  validarEnderecoPessoaCadastro,
  validarFichaPessoaCadastro,
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

test("normaliza a ficha operacional completa da pessoa", () => {
  const resultado = validarFichaPessoaCadastro({
    id: "4c8ebf4f-33ee-4a93-996b-707462aade6e",
    tipo: "FISICA",
    nome: " Maria da Silva ",
    documento: "529.982.247-25",
    nascimento: "1985-06-12",
    sexo: "feminino",
    rgUf: "ba",
    rgEmissao: "2003-01-10",
    estadoCivil: "Solteira",
    naturalidade: "Salvador",
    conselhoTipo: "COREN",
    conselhoNumero: "12345",
    aposentado: "on",
    cnhCategoria: "b",
    cnhValidade: "2030-06-12",
    nomeFantasia: "Maria Serviços",
    email: "maria@example.com",
    celular: "(71) 99999-9999",
    celularAlternativo: "(71) 98888-8888",
    papelPrestador: "on",
  });
  assert.equal(resultado.dados?.nascimento, "1985-06-12");
  assert.equal(resultado.dados?.sexo, "FEMININO");
  assert.equal(resultado.dados?.rgUf, "BA");
  assert.equal(resultado.dados?.rgEmissao, "2003-01-10");
  assert.equal(resultado.dados?.cnhCategoria, "B");
  assert.equal(resultado.dados?.aposentado, true);
  assert.equal(resultado.dados?.nomeFantasia, "Maria Serviços");
  assert.equal(resultado.dados?.papelPrestador, true);
  assert.equal(resultado.dados?.papelFornecedor, false);
});

test("rejeita datas e contatos inconsistentes na ficha", () => {
  const resultado = validarFichaPessoaCadastro({
    tipo: "FISICA",
    nome: "Pessoa",
    nascimento: "2026-02-30",
    sexo: "DESCONHECIDO",
    rgUf: "Bahia",
    email: "email-invalido",
  });
  assert.equal(resultado.dados, null);
  assert.match(resultado.erros.join(" "), /data válida/);
  assert.match(resultado.erros.join(" "), /e-mail válido/);
});

test("valida endereço, conta bancária e dependente", () => {
  const pessoaId = "4c8ebf4f-33ee-4a93-996b-707462aade6e";
  assert.equal(
    validarEnderecoPessoaCadastro({
      pessoaId,
      cep: "40.000-000",
      municipio: "Salvador",
      referencia: "Ao lado do posto de saúde",
    }).dados?.cep,
    "40000000",
  );
  assert.equal(
    validarEnderecoPessoaCadastro({
      pessoaId,
      referencia: "Ao lado do posto de saúde",
    }).dados?.referencia,
    "Ao lado do posto de saúde",
  );
  assert.equal(
    validarContaPessoaCadastro({
      pessoaId,
      agencia: "0012",
      numero: "12345",
      tipo: "CORRENTE",
    }).dados?.tipo,
    "CORRENTE",
  );
  assert.equal(
    validarDependenteCadastro({
      pessoaId,
      nome: "Dependente",
      cpf: "529.982.247-25",
      estudante: "on",
      baixaIrrf: "2026-07-01",
    }).dados?.estudante,
    true,
  );
  assert.equal(
    validarContaPessoaCadastro({
      pessoaId,
      agencia: "",
      numero: "",
      tipo: "INVALIDA",
    }).dados,
    null,
  );
});
