import assert from "node:assert/strict";
import test from "node:test";
import { validarDocumentoObrigacao } from "../lib/documentos-obrigacao";

test("normaliza totalizador verificado da DCTFWeb", () => {
  const resultado = validarDocumentoObrigacao({
    obrigacaoId: "00000000-0000-4000-8000-000000000001",
    tipo: "TOTALIZADOR_DCTFWEB",
    referencia: " DCTF-2026-07 ",
    valorTotal: "1.234,56",
    emitidoEm: "2026-08-01",
    localizador: "Protocolo 123",
    hashSha256: "a".repeat(64).toUpperCase(),
    verificado: "on",
  });
  assert.deepEqual(resultado.erros, []);
  assert.equal(resultado.dados?.valorTotal, "1234.56");
  assert.equal(resultado.dados?.hashSha256, "a".repeat(64));
  assert.equal(resultado.dados?.verificado, true);
});

test("recibo pode omitir valor, mas exige referência e localizador", () => {
  const resultado = validarDocumentoObrigacao({
    obrigacaoId: "00000000-0000-4000-8000-000000000001",
    tipo: "RECIBO_DCTFWEB",
    referencia: "REC-1",
    emitidoEm: "2026-08-01",
    localizador: "Arquivo interno",
  });
  assert.equal(resultado.dados?.valorTotal, "0.00");
});

test("aceita GPS com valor obrigatório para conferência excepcional", () => {
  const resultado = validarDocumentoObrigacao({
    obrigacaoId: "00000000-0000-4000-8000-000000000001",
    tipo: "GPS",
    referencia: "GPS-1007-2026-07",
    valorTotal: "432,10",
    emitidoEm: "2026-08-01",
    localizador: "Arquivo de prestação de contas",
  });
  assert.deepEqual(resultado.erros, []);
  assert.equal(resultado.dados?.valorTotal, "432.10");
});
