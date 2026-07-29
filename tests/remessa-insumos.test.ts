import assert from "node:assert/strict";
import test from "node:test";
import {
  classificarTipoInsumo,
  criarManifestoRemessaInsumos,
  type EntradaManifestoInsumo,
} from "../lib/remessa-insumos";

const entrada = (
  caminhoRelativo: string,
  sha256: string,
  tamanhoBytes = 100,
): EntradaManifestoInsumo => ({
  caminhoRelativo,
  tamanhoBytes,
  sha256,
  modificadoEm: "2026-07-30T00:00:00.000Z",
});

test("classifica os formatos de uma remessa sem presumir conversão", () => {
  assert.equal(classificarTipoInsumo("folha.pdf"), "PDF");
  assert.equal(classificarTipoInsumo("dados.XLSX"), "PLANILHA");
  assert.equal(classificarTipoInsumo("consulta.bin"), "DESCONHECIDO");
});

test("gera manifesto determinístico e pronto somente após confirmação", () => {
  const entradas = [
    entrada("maio/gps.pdf", "b".repeat(64), 20),
    entrada("maio/folha.csv", "a".repeat(64), 10),
  ];
  const primeiro = criarManifestoRemessaInsumos(entradas, {
    expectedDocumentCount: 2,
    confirmedComplete: true,
  });
  const segundo = criarManifestoRemessaInsumos([...entradas].reverse(), {
    expectedDocumentCount: 2,
    confirmedComplete: true,
  });
  assert.deepEqual(primeiro, segundo);
  assert.equal(primeiro.status, "PRONTA");
  assert.equal(primeiro.totalBytes, 30);
  assert.deepEqual(
    primeiro.documents.map((document) => document.caminhoRelativo),
    ["maio/folha.csv", "maio/gps.pdf"],
  );
});

test("expõe remessa incompleta, duplicada e formato sem adaptador", () => {
  const incompleta = criarManifestoRemessaInsumos([
    entrada("folha.pdf", "a".repeat(64)),
  ], {
    expectedDocumentCount: 2,
    confirmedComplete: true,
  });
  assert.equal(incompleta.status, "INCOMPLETA");

  const duplicada = criarManifestoRemessaInsumos([
    entrada("a.pdf", "b".repeat(64)),
    entrada("b.pdf", "b".repeat(64)),
  ], {
    confirmedComplete: true,
  });
  assert.equal(duplicada.status, "DUPLICADA");
  assert.deepEqual(duplicada.duplicateGroups[0].caminhos, ["a.pdf", "b.pdf"]);

  const requerClassificacao = criarManifestoRemessaInsumos([
    entrada("folha.xlsx", "c".repeat(64)),
  ], {
    confirmedComplete: true,
  });
  assert.equal(requerClassificacao.status, "REQUER_CLASSIFICACAO");
  assert.equal(requerClassificacao.unsupportedDocumentCount, 1);
});

test("recusa caminhos perigosos, hashes inválidos e caminhos repetidos", () => {
  assert.throws(
    () => criarManifestoRemessaInsumos([
      entrada("../segredo.pdf", "a".repeat(64)),
    ]),
    /não pode sair/,
  );
  assert.throws(
    () => criarManifestoRemessaInsumos([
      entrada("folha.pdf", "invalido"),
    ]),
    /SHA-256 inválido/,
  );
  assert.throws(
    () => criarManifestoRemessaInsumos([
      entrada("Maio/Folha.pdf", "a".repeat(64)),
      entrada("maio/folha.pdf", "b".repeat(64)),
    ]),
    /Caminho repetido/,
  );
});
