import assert from "node:assert/strict";
import test from "node:test";
import { destinoInternoSeguro, orientarBloqueio } from "../lib/bloqueios-orientados";

test("orienta perfil de recolhimento ausente para o onboarding e preserva retorno", () => {
  const bloqueio = orientarBloqueio({
    erro: "Nenhum perfil de recolhimento publicado atende à competência 2026-06.",
    competencia: "2026-06",
    retorno: "/obrigacoes?competencia=2026-06",
  });

  assert.equal(bloqueio.acao.rotulo, "Configurar recolhimento da empresa");
  assert.match(bloqueio.acao.href, /etapa=recolhimento/);
  assert.match(bloqueio.acao.href, /competencia=2026-06/);
  assert.match(bloqueio.acao.href, /retorno=%2Fobrigacoes%3Fcompetencia%3D2026-06/);
  assert.match(bloqueio.impacto, /GPS/);
});

test("orienta enquadramento ausente para a configuração da empresa", () => {
  const bloqueio = orientarBloqueio({
    erro: "Nenhum enquadramento previdenciário publicado atende à competência 2026-06.",
    competencia: "2026-06",
    retorno: "/folhas/nova?competencia=2026-06",
  });

  assert.equal(bloqueio.acao.rotulo, "Configurar empresa");
  assert.match(bloqueio.acao.href, /configuracao-inicial/);
});

test("orienta fechamento multi-folha para a consolidação por CPF", () => {
  const bloqueio = orientarBloqueio({
    erro: "Todas as Folhas da Pessoa devem estar processadas com a mesma simulação homologada antes do fechamento.",
    competencia: "2026-06",
    retorno: "/folhas/fake",
  });

  assert.equal(bloqueio.acao.rotulo, "Consolidar impostos por CPF");
  assert.match(bloqueio.acao.href, /^\/conferencia-entre-folhas\?/);
  assert.match(bloqueio.impacto, /GPS/);
});

test("aceita apenas retornos internos", () => {
  assert.equal(destinoInternoSeguro("/obrigacoes?competencia=2026-06", "/folhas"), "/obrigacoes?competencia=2026-06");
  assert.equal(destinoInternoSeguro("https://exemplo.test", "/folhas"), "/folhas");
  assert.equal(destinoInternoSeguro("//exemplo.test", "/folhas"), "/folhas");
});
