import assert from "node:assert/strict";
import test from "node:test";
import { gerarCsvDiagnosticoConsolidacao } from "../lib/exportacao-consolidacao";

test("exporta uma linha por fonte do conflito mensal", () => {
  const csv = gerarCsvDiagnosticoConsolidacao({
    competencia: "2026-07",
    conflitos: [
      {
        pessoa_id: "00000000-0000-4000-8000-000000000001",
        nome: "Prestadora",
        documento: "12345678900",
        matricula: "0007",
        quantidade_vinculos: 2,
        retribuicao_prevista: "3000.00",
        base_outras_fontes: "500.00",
        medicao_pendente: false,
        hash_fontes: "a".repeat(64),
        fontes: [
          {
            vinculoId: "vinculo-1",
            termoNumero: "1/2026",
            metaCodigo: "M1",
            atividade: "Atividade 1",
            valorContratual: "1000.00",
            valorPrevisto: "1000.00",
            exigeMedicao: false,
            medicaoTipo: null,
            folhaNumero: 1,
            folhaStatus: "ABERTA",
          },
          {
            vinculoId: "vinculo-2",
            termoNumero: "2/2026",
            metaCodigo: "M2",
            atividade: "Atividade 2",
            valorContratual: "2000.00",
            valorPrevisto: "2000.00",
            exigeMedicao: true,
            medicaoTipo: "VALOR",
            folhaNumero: null,
            folhaStatus: null,
          },
        ],
      },
    ],
  }, [
    {
      hash_fontes: "a".repeat(64),
      status: "RESOLVIDO",
      decisao: "UNIFICAR_VINCULOS",
      justificativa: "Fontes conferidas pelo setor responsável.",
      responsavel: "Gerente de RH",
      resolvido_em: "2026-07-31T12:00:00.000Z",
    },
  ]);
  assert.equal(csv.trim().split(/\r?\n/).length, 3);
  assert.match(csv, /0007/);
  assert.match(csv, /3000,00/);
  assert.match(csv, /vinculo-1/);
  assert.match(csv, /vinculo-2/);
  assert.match(csv, /UNIFICAR_VINCULOS/);
  assert.match(csv, /Gerente de RH/);
});

test("neutraliza fórmulas no diagnóstico exportado", () => {
  const csv = gerarCsvDiagnosticoConsolidacao({
    competencia: "2026-07",
    conflitos: [
      {
        pessoa_id: "pessoa",
        nome: "+Fórmula",
        documento: "",
        matricula: "1",
        quantidade_vinculos: 2,
        retribuicao_prevista: "0",
        base_outras_fontes: "0",
        medicao_pendente: true,
        fontes: [
          {
            vinculoId: "v",
            termoNumero: "t",
            metaCodigo: "m",
            atividade: "=SOMA(A1:A2)",
            valorContratual: "0",
            valorPrevisto: "0",
            exigeMedicao: true,
            medicaoTipo: null,
            folhaNumero: null,
            folhaStatus: null,
          },
        ],
      },
    ],
  });
  assert.match(csv, /"'\+Fórmula"/);
  assert.match(csv, /"'=SOMA\(A1:A2\)"/);
});
