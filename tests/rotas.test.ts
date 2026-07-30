import assert from "node:assert/strict";
import test from "node:test";
import { ROTAS, rotaComCompetencia } from "../lib/rotas";

test("rotas canônicas são únicas, legíveis e não expõem nomes substituídos", () => {
  const rotas = Object.values(ROTAS);
  assert.equal(new Set(rotas).size, rotas.length);
  for (const rota of rotas) {
    assert.match(rota, /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/?)*$/);
    assert.doesNotMatch(
      rota,
      /\/(?:homologacoes|consolidacoes|instrumentos)(?:\/|$)/,
    );
  }
});

test("competência é adicionada sem produzir URL ambígua", () => {
  assert.equal(
    rotaComCompetencia(ROTAS.fechamentoMensal, "2026-06"),
    "/fechamento-mensal?competencia=2026-06",
  );
});
