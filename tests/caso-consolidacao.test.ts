import assert from "node:assert/strict";
import test from "node:test";
import {
  conteudoFontesConsolidacao,
  normalizarAtualizacaoCaso,
  rotuloDecisao,
  type FonteConsolidacao,
} from "../lib/caso-consolidacao";
import { hashJson } from "../lib/json-canonico";

const fonteA: FonteConsolidacao = {
  vinculoId: "00000000-0000-4000-8000-000000000001",
  termoId: "00000000-0000-4000-8000-000000000011",
  termoNumero: "1/2026",
  metaId: "00000000-0000-4000-8000-000000000021",
  metaCodigo: "M1",
  atividade: "Atendimento",
  valorContratual: "1000.00",
  valorPrevisto: "900.00",
  exigeMedicao: true,
  medicaoId: "00000000-0000-4000-8000-000000000031",
  medicaoTipo: "VALOR",
  folhaId: null,
  folhaNumero: null,
  folhaStatus: null,
};

const fonteB: FonteConsolidacao = {
  ...fonteA,
  vinculoId: "00000000-0000-4000-8000-000000000002",
  termoId: "00000000-0000-4000-8000-000000000012",
  termoNumero: "2/2026",
  metaId: "00000000-0000-4000-8000-000000000022",
  metaCodigo: "M2",
  valorContratual: "500.00",
  valorPrevisto: "500.00",
  exigeMedicao: false,
  medicaoId: null,
  medicaoTipo: null,
};

test("hash das fontes independe da ordem recebida", () => {
  const base = {
    competencia: "2026-07",
    pessoaId: "00000000-0000-4000-8000-000000000099",
    baseOutrasFontes: "250.00",
  };
  assert.equal(
    hashJson(conteudoFontesConsolidacao({ ...base, fontes: [fonteA, fonteB] })),
    hashJson(conteudoFontesConsolidacao({ ...base, fontes: [fonteB, fonteA] })),
  );
});

test("mudança material na fonte altera o hash", () => {
  const base = {
    competencia: "2026-07",
    pessoaId: "00000000-0000-4000-8000-000000000099",
    baseOutrasFontes: "250.00",
    fontes: [fonteA, fonteB],
  };
  assert.notEqual(
    hashJson(conteudoFontesConsolidacao(base)),
    hashJson(
      conteudoFontesConsolidacao({
        ...base,
        fontes: [{ ...fonteA, valorPrevisto: "901.00" }, fonteB],
      }),
    ),
  );
});

test("caso em análise não aceita decisão final antecipada", () => {
  assert.throws(
    () =>
      normalizarAtualizacaoCaso({
        status: "EM_ANALISE",
        decisao: "RATEIO_NECESSARIO",
        justificativa: "Conferência documental ainda em andamento.",
        responsavel: "Gerente de RH",
      }),
    /ainda não pode registrar decisão final/,
  );
});

test("resolução exige decisão e evidência textual suficiente", () => {
  assert.throws(
    () =>
      normalizarAtualizacaoCaso({
        status: "RESOLVIDO",
        justificativa: "Curta",
        responsavel: "RH",
      }),
    /justificativa/,
  );
  assert.throws(
    () =>
      normalizarAtualizacaoCaso({
        status: "RESOLVIDO",
        justificativa: "Documentação analisada e conferida pelo setor.",
        responsavel: "Gerente de RH",
      }),
    /decisão válida/,
  );
});

test("resolução normaliza os campos e registra o instante", () => {
  const resolucao = normalizarAtualizacaoCaso({
    status: "resolvido",
    decisao: "unificar_vinculos",
    justificativa: "  Mesma pessoa e mesma prestação continuada.  ",
    responsavel: "  Gerente de RH  ",
  });
  assert.equal(resolucao.status, "RESOLVIDO");
  assert.equal(resolucao.decisao, "UNIFICAR_VINCULOS");
  assert.equal(resolucao.responsavel, "Gerente de RH");
  assert.ok(resolucao.resolvidoEm instanceof Date);
  assert.equal(rotuloDecisao(resolucao.decisao), "Unificar vínculos");
});
