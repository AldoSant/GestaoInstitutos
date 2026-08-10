import assert from "node:assert/strict";
import test from "node:test";
import {
  compararFolhaParalelaGiw,
  compararGpsParalelaGiw,
} from "../lib/comparacao-paralela-giw";

test("aprova Folha por Pessoa somente quando todos os centavos conferem", () => {
  const esperado = [
    {
      pessoaLegacyId: "PESSOA:1",
      proventos: "1000.00",
      descontos: "110.00",
      liquido: "890.00",
      baseInss: "1000.00",
      inss: "110.00",
      baseIrrf: "890.00",
      irrf: "0.00",
    },
  ];
  const conciliado = compararFolhaParalelaGiw(esperado, esperado);
  assert.equal(conciliado.aprovado, true);
  assert.equal(conciliado.conciliados, 1);

  const divergente = compararFolhaParalelaGiw(esperado, [
    { ...esperado[0], inss: "109.99", descontos: "109.99", liquido: "890.01" },
  ]);
  assert.equal(divergente.aprovado, false);
  assert.equal(divergente.itens[0].situacao, "DIVERGENTE");
  assert.equal(divergente.itens[0].diferencas?.inss, -1);

  const irrfDivergente = compararFolhaParalelaGiw(esperado, [
    { ...esperado[0], irrf: "0.01", descontos: "110.01", liquido: "889.99" },
  ]);
  assert.equal(irrfDivergente.aprovado, false);
  assert.equal(irrfDivergente.itens[0].diferencas?.irrf, 1);
});

test("reprova ausência de pessoa tanto no GIW quanto no resultado novo", () => {
  const linha = {
    pessoaLegacyId: "PESSOA:1",
    proventos: "1000.00",
    descontos: "0.00",
    liquido: "1000.00",
    baseInss: "0.00",
    inss: "0.00",
    baseIrrf: "0.00",
    irrf: "0.00",
  };
  const resultado = compararFolhaParalelaGiw([linha], [
    { ...linha, pessoaLegacyId: "PESSOA:2" },
  ]);
  assert.deepEqual(
    resultado.itens.map((item) => item.situacao),
    ["AUSENTE_NOVO", "AUSENTE_GIW"],
  );
});

test("compara GPS por beneficiário, quantidade e valores", () => {
  const esperado = [
    {
      pessoaLegacyId: "PESSOA:1",
      identificador: "11122233344",
      principal: "110.00",
      total: "110.00",
    },
  ];
  assert.equal(compararGpsParalelaGiw(esperado, esperado).aprovado, true);
  const resultado = compararGpsParalelaGiw(esperado, [
    { ...esperado[0], principal: "109.99", total: "109.99" },
  ]);
  assert.equal(resultado.aprovado, false);
  assert.equal(resultado.itens[0].situacao, "DIVERGENTE");
  assert.equal(resultado.itens[0].diferencas?.principal, -1);
});
