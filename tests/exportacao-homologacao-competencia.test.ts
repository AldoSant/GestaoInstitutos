import assert from "node:assert/strict";
import test from "node:test";
import type { HomologacaoCompetencia } from "../db/homologacoes-competencia";
import { gerarCsvHomologacaoCompetencia } from "../lib/exportacao-homologacao-competencia";

const homologacao: HomologacaoCompetencia = {
  id: "00000000-0000-4000-8000-000000000001",
  competencia: "2026-07-01",
  versao: 2,
  hash_fontes: "a".repeat(64),
  status: "APROVADA",
  resumo: { pronta: true, bloqueios: [], conformes: 7, total: 7 },
  justificativa: "Competência conferida integralmente.",
  responsavel: "Gerente de RH",
  decidido_em: new Date("2026-08-05T12:00:00.000Z"),
  criado_por: "Operador",
  criado_em: new Date("2026-08-05T10:00:00.000Z"),
  atualizado_em: new Date("2026-08-05T12:00:00.000Z"),
  itens: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      tipo: "PARALELO_GIW",
      status: "OK",
      obrigatorio: true,
      total: 2,
      conformes: 2,
      pendentes: 0,
      hashEvidencia: "b".repeat(64),
      detalhes: { referencia: "Folha oficial GIW" },
    },
  ],
};

test("exporta o dossiê com hashes e decisão", () => {
  const csv = gerarCsvHomologacaoCompetencia(homologacao);
  assert.match(csv, /PARALELO_GIW/);
  assert.match(csv, /Gerente de RH/);
  assert.match(csv, new RegExp("a{64}"));
  assert.match(csv, new RegExp("b{64}"));
  assert.equal(csv.trim().split(/\r?\n/).length, 2);
});

test("neutraliza fórmulas dentro da justificativa", () => {
  const csv = gerarCsvHomologacaoCompetencia({
    ...homologacao,
    justificativa: "=HIPERLINK(\"malicioso\")",
  });
  assert.match(csv, /"'=HIPERLINK/);
});
