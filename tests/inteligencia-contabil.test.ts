import assert from "node:assert/strict";
import test from "node:test";
import {
  FONTES_NORMATIVAS,
  resolverEnquadramentoPrestador,
} from "../lib/inteligencia-contabil";

test("catálogo normativo possui fonte, vigência e data de consulta", () => {
  for (const fonte of Object.values(FONTES_NORMATIVAS)) {
    assert.match(fonte.codigo, /^[A-Z0-9_]+$/);
    assert.match(fonte.vigenciaInicio, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(fonte.consultadaEm, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(fonte.url, /^https:\/\//);
  }
});

test("aplica automaticamente o cenário 701 à pessoa física operacional", () => {
  const decisao = resolverEnquadramentoPrestador({
    tipoPessoa: "FISICA",
    categoriaContribuinte: "701",
  });
  assert.equal(decisao.suportado, true);
  assert.equal(decisao.cenario, "PF_CONTRIBUINTE_INDIVIDUAL_701");
  assert.equal(decisao.categoriaAplicada, "701");
});

test("dispensa categoria manual e classifica PJ sem previdência", () => {
  const pf = resolverEnquadramentoPrestador({
    tipoPessoa: "FISICA",
    categoriaContribuinte: null,
  });
  assert.equal(pf.suportado, true);
  assert.equal(pf.categoriaAplicada, "701");
  const pj = resolverEnquadramentoPrestador({
    tipoPessoa: "JURIDICA",
    categoriaContribuinte: null,
  });
  assert.equal(pj.suportado, true);
  assert.equal(pj.cenario, "PJ_PAGAMENTO_SEM_PREVIDENCIA");
  assert.equal(pj.categoriaAplicada, null);
});
