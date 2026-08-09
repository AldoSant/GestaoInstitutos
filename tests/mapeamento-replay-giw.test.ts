import assert from "node:assert/strict";
import test from "node:test";
import { chaveMapeamentoReplayGiw, validarArquivoMapeamentoReplayGiw } from "../lib/mapeamento-replay-giw";

const empresaId = "6b71ab72-9888-41d2-9f6e-ce9118485b80";
const vinculoId = "f3f321ee-8b74-4442-a822-0f203a66eac8";

test("aceita um mapeamento histórico explícito e rastreável", () => {
  const arquivo = validarArquivoMapeamentoReplayGiw({
    schemaVersion: "1.0",
    source: "MAPEAMENTO_HISTORICO_CONFIRMADO",
    empresaId,
    mappings: [{
      folhaLegacyId: "FOLHA:2026-06:PSF",
      itemLegacyId: "ITEM:123",
      vinculoId,
      confirmadoPor: "RH",
      justificativa: "Relação confirmada no documento-fonte do contrato.",
    }],
  });
  assert.equal(arquivo.mappings.length, 1);
  assert.equal(chaveMapeamentoReplayGiw(arquivo.mappings[0]), "FOLHA:2026-06:PSF/ITEM:123");
});

test("recusa duplicidade e vínculo sem UUID", () => {
  assert.throws(() => validarArquivoMapeamentoReplayGiw({
    schemaVersion: "1.0", source: "MAPEAMENTO_HISTORICO_CONFIRMADO", empresaId,
    mappings: [
      { folhaLegacyId: "F", itemLegacyId: "I", vinculoId, confirmadoPor: "RH", justificativa: "Fonte" },
      { folhaLegacyId: "F", itemLegacyId: "I", vinculoId: "invalido", confirmadoPor: "RH", justificativa: "Fonte" },
    ],
  }), /mais de uma vez/);
});
