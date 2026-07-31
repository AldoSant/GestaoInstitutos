import assert from "node:assert/strict";
import test from "node:test";
import {
  montarResumoRelatorioDemonstrativo,
  nomeBeneficiarioSnapshot,
} from "../lib/relatorio-demonstrativo";

test("resume pagamentos PF e PJ sem misturar guias", () => {
  const resumo = montarResumoRelatorioDemonstrativo({
    demonstrativo: {
      revisao: 2,
      total_bruto: "3000.00",
      total_retencoes: "300.00",
      total_liquido: "2700.00",
    },
    pagamentos: [
      {
        tipo_pessoa: "FISICA",
        beneficiario_snapshot: {
          pessoa: { nome: "Pessoa Física" },
          prestador: { matricula: "PF-1" },
        },
      },
      {
        tipo_pessoa: "JURIDICA",
        beneficiario_snapshot: { nome: "Pessoa Jurídica" },
      },
    ],
    retencoes: [{ tributo: "INSS" }],
    obrigacoes: [{ tipo: "INSS" }],
    documentos: [{ tipo: "DARF" }],
  });
  assert.equal(resumo.quantidadePf, 1);
  assert.equal(resumo.quantidadePj, 1);
  assert.equal(resumo.pagamentos.length, 2);
  assert.equal(resumo.obrigacoes.length, 1);
  assert.deepEqual(nomeBeneficiarioSnapshot(resumo.pagamentos[0]), {
    nome: "Pessoa Física",
    matricula: "PF-1",
  });
  assert.deepEqual(nomeBeneficiarioSnapshot(resumo.pagamentos[1]), {
    nome: "Pessoa Jurídica",
    matricula: null,
  });
});

test("recusa snapshot sem cabeçalho do demonstrativo", () => {
  assert.throws(
    () => montarResumoRelatorioDemonstrativo({ pagamentos: [] }),
    /cabeçalho do demonstrativo/,
  );
});
