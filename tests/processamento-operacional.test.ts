import assert from "node:assert/strict";
import test from "node:test";
import { descreverProcessamento } from "../lib/processamento-operacional";

test("apresenta estados da fila em linguagem operacional", () => {
  assert.equal(descreverProcessamento("PENDENTE", null).categoria, "FILA");
  assert.equal(descreverProcessamento("EXECUTANDO", null).categoria, "EXECUCAO");
  assert.equal(descreverProcessamento("CONCLUIDA", null).categoria, "CONCLUIDA");
});

test("traduz falhas cadastrais sem expor o erro técnico", () => {
  const resultado = descreverProcessamento(
    "FALHA",
    "error: NIT/PIS/PASEP não informado at processarFolha (db/folhas.ts:900)",
  );
  assert.equal(resultado.categoria, "CADASTRO");
  assert.equal(resultado.titulo, "NIT/PIS/PASEP pendente");
  assert.doesNotMatch(resultado.texto, /db\/folhas|:900/);
});

test("preserva uma mensagem segura para falha desconhecida", () => {
  const resultado = descreverProcessamento(
    "FALHA",
    "ECONNRESET postgres.internal.example",
  );
  assert.equal(resultado.categoria, "TECNICA");
  assert.doesNotMatch(resultado.texto, /postgres|ECONNRESET/i);
});

