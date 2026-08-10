import assert from "node:assert/strict";
import test from "node:test";
import { validarOutraFonte } from "../lib/outras-fontes";

test("normaliza comprovante de contribuição em outra fonte", () => {
  const resultado = validarOutraFonte({
    prestadorId: "00000000-0000-4000-8000-000000000001",
    competencia: "2026-07",
    fontePagadora: " Fonte Pagadora ",
    documentoFonte: "12.345.678/0001-99",
    remuneracao: "4.500,00",
    baseContribuicao: "4.000,00",
    valorContribuicao: "440,00",
    documentoReferencia: " REC-123 ",
    comprovanteVerificado: "on",
  });

  assert.deepEqual(resultado.erros, []);
  assert.deepEqual(resultado.dados, {
    prestadorId: "00000000-0000-4000-8000-000000000001",
    competencia: "2026-07",
    fontePagadora: "Fonte Pagadora",
    documentoFonte: "12345678000199",
    remuneracao: "4500.00",
    inssDedutivelIrrf: "0.00",
    irrfRetido: "0.00",
    baseContribuicao: "4000.00",
    valorContribuicao: "440.00",
    documentoReferencia: "REC-123",
    comprovanteVerificado: true,
    observacao: null,
  });
});

test("preserva os valores de IRRF já retidos em outra fonte", () => {
  const resultado = validarOutraFonte({
    prestadorId: "00000000-0000-4000-8000-000000000001",
    competencia: "2026-07",
    fontePagadora: "Fonte Pagadora",
    documentoFonte: "12.345.678/0001-99",
    remuneracao: "4.500,00",
    inssDedutivelIrrf: "495,00",
    irrfRetido: "350,00",
    baseContribuicao: "4.500,00",
    valorContribuicao: "495,00",
    documentoReferencia: "REC-124",
  });

  assert.deepEqual(resultado.erros, []);
  assert.equal(resultado.dados?.inssDedutivelIrrf, "495.00");
  assert.equal(resultado.dados?.irrfRetido, "350.00");
});

test("rejeita competência, documento e valores inconsistentes", () => {
  const resultado = validarOutraFonte({
    prestadorId: "inválido",
    competencia: "2026-13",
    fontePagadora: "",
    documentoFonte: "123",
    remuneracao: "-1",
    baseContribuicao: "100",
    valorContribuicao: "101",
    documentoReferencia: "",
  });

  assert.equal(resultado.dados, null);
  assert.ok(resultado.erros.length >= 7);
});
