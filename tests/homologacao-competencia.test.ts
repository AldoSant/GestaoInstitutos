import assert from "node:assert/strict";
import test from "node:test";
import {
  avaliarProntidaoCompetencia,
  competenciasCampanha,
  conteudoHomologacaoCompetencia,
  destinoItemCompetencia,
  normalizarDecisaoCompetencia,
  statusPorContagem,
  type ItemChecklistCompetencia,
} from "../lib/homologacao-competencia";
import { hashJson } from "../lib/json-canonico";

const itemOk: ItemChecklistCompetencia = {
  tipo: "FOLHAS",
  status: "OK",
  obrigatorio: true,
  total: 2,
  conformes: 2,
  pendentes: 0,
  hashEvidencia: "a".repeat(64),
  detalhes: {},
};

test("classifica ausência aplicável, pendência e bloqueio", () => {
  assert.equal(
    statusPorContagem({ total: 0, pendentes: 0, vazio: "NAO_APLICAVEL" }),
    "NAO_APLICAVEL",
  );
  assert.equal(
    statusPorContagem({ total: 2, pendentes: 1, vazio: "BLOQUEIO" }),
    "PENDENTE",
  );
  assert.equal(
    statusPorContagem({
      total: 2,
      pendentes: 1,
      vazio: "BLOQUEIO",
      bloqueio: true,
    }),
    "BLOQUEIO",
  );
});

test("campanha mensal atravessa a virada do ano", () => {
  assert.deepEqual(competenciasCampanha("2026-01"), [
    "2025-11",
    "2025-12",
    "2026-01",
  ]);
});

test("prontidão exige todos os controles obrigatórios", () => {
  assert.equal(avaliarProntidaoCompetencia([itemOk]).pronta, true);
  const pendente: ItemChecklistCompetencia = {
    ...itemOk,
    tipo: "PARALELO_GIW",
    status: "PENDENTE",
    pendentes: 1,
    conformes: 1,
  };
  const resultado = avaliarProntidaoCompetencia([itemOk, pendente]);
  assert.equal(resultado.pronta, false);
  assert.deepEqual(resultado.bloqueios, ["PARALELO_GIW"]);
});

test("hash mensal independe da ordem dos itens", () => {
  const outro: ItemChecklistCompetencia = {
    ...itemOk,
    tipo: "MEDICOES",
    hashEvidencia: "b".repeat(64),
  };
  assert.equal(
    hashJson(
      conteudoHomologacaoCompetencia({
        competencia: "2026-07",
        itens: [itemOk, outro],
      }),
    ),
    hashJson(
      conteudoHomologacaoCompetencia({
        competencia: "2026-07",
        itens: [outro, itemOk],
      }),
    ),
  );
});

test("aprovação é recusada enquanto houver bloqueios", () => {
  assert.throws(
    () =>
      normalizarDecisaoCompetencia({
        status: "APROVADA",
        justificativa: "Competência conferida integralmente pelo setor.",
        responsavel: "Gerente de RH",
        pronta: false,
      }),
    /possui bloqueios/,
  );
});

test("aprovação registra decisão normalizada", () => {
  const decisao = normalizarDecisaoCompetencia({
    status: "aprovada",
    justificativa: "  Competência conferida integralmente pelo setor.  ",
    responsavel: "  Gerente de RH  ",
    pronta: true,
  });
  assert.equal(decisao.status, "APROVADA");
  assert.equal(decisao.responsavel, "Gerente de RH");
  assert.ok(decisao.decididoEm instanceof Date);
});

test("direciona cada bloqueio ao módulo operacional responsável", () => {
  assert.equal(
    destinoItemCompetencia("PAGAMENTOS", "2026-07"),
    "/folhas",
  );
  assert.equal(
    destinoItemCompetencia("MEDICOES", "2026-07"),
    "/medicoes?competencia=2026-07",
  );
  assert.equal(
    destinoItemCompetencia("DOCUMENTOS_DCTFWEB", "2026-07"),
    "/obrigacoes",
  );
});
