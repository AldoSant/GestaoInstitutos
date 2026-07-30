import assert from "node:assert/strict";
import test from "node:test";
import { normalizarBusca } from "@/lib/busca-textual";

test("normaliza caixa, acentos e espaços para a busca", () => {
  assert.equal(normalizarBusca("  INSTITUTO  DE GESTÃO  "), "instituto de gestao");
});

test("preserva texto útil ao normalizar uma busca com pequeno erro", () => {
  assert.equal(normalizarBusca("Instuto"), "instuto");
});
