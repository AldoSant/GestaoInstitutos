import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularHashResultadoFolha,
  type FonteHashFolha,
} from "../lib/hash-folha";

function fonte(): FonteHashFolha {
  return {
    folha: {
      empresaId: "00000000-0000-4000-8000-000000000001",
      termoId: "00000000-0000-4000-8000-000000000002",
      metaId: "00000000-0000-4000-8000-000000000003",
      competencia: "2026-07-01",
      numero: 1,
      revisao: 1,
    },
    regra: {
      id: "00000000-0000-4000-8000-000000000004",
      codigo: "FOLHA_PRESTADOR",
      versao: 1,
      hashConteudo: "a".repeat(64),
    },
    enquadramentoPrevidenciario: {
      id: "00000000-0000-4000-8000-000000000005",
      regime: "EMPRESA_GERAL",
      aliquotaSeguradoNumerador: 11,
      aliquotaSeguradoDenominador: 100,
      aliquotaPatronalNumerador: 20,
      aliquotaPatronalDenominador: 100,
    },
    itens: [{ vinculoId: "V-1", totalLiquido: "890.00" }],
  };
}

test("processamento e fechamento reproduzem o mesmo hash canônico", () => {
  const entrada = fonte();
  assert.equal(
    calcularHashResultadoFolha(entrada),
    calcularHashResultadoFolha(structuredClone(entrada)),
  );
});

test("mudança no enquadramento previdenciário altera o hash da Folha", () => {
  const original = fonte();
  const alterado = fonte();
  alterado.enquadramentoPrevidenciario.aliquotaPatronalNumerador = 0;
  assert.notEqual(
    calcularHashResultadoFolha(original),
    calcularHashResultadoFolha(alterado),
  );
});
