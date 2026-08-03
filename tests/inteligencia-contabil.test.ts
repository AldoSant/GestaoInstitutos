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

test("libera somente o cenário 701 atualmente homologado", () => {
  const decisao = resolverEnquadramentoPrestador({
    tipoPessoa: "FISICA",
    categoriaContribuinte: "701",
  });
  assert.equal(decisao.suportado, true);
  assert.equal(decisao.cenario, "PF_CONTRIBUINTE_INDIVIDUAL_701");
});

test("bloqueia categorias PF ausentes ou não homologadas e classifica PJ sem previdência", () => {
  assert.equal(
    resolverEnquadramentoPrestador({
      tipoPessoa: "FISICA",
      categoriaContribuinte: null,
    }).cenario,
    "CATEGORIA_AUSENTE",
  );
  assert.equal(
    resolverEnquadramentoPrestador({
      tipoPessoa: "FISICA",
      categoriaContribuinte: "723",
    }).cenario,
    "CATEGORIA_PF_NAO_HOMOLOGADA",
  );
  const pj = resolverEnquadramentoPrestador({
    tipoPessoa: "JURIDICA",
    categoriaContribuinte: null,
  });
  assert.equal(pj.suportado, true);
  assert.equal(pj.cenario, "PJ_PAGAMENTO_SEM_PREVIDENCIA");
});
