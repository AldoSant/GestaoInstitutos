import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizarMotivoCancelamento,
  validarStatusCancelamentoFolha,
  validarStatusCancelamentoObrigacao,
} from "../lib/cancelamento";

test("normaliza justificativa administrativa de cancelamento", () => {
  assert.equal(
    normalizarMotivoCancelamento(
      "  Cancelamento autorizado pelo processo 123.  ",
      "Folha",
    ),
    "Cancelamento autorizado pelo processo 123.",
  );
  assert.throws(
    () => normalizarMotivoCancelamento("curto", "Obrigação"),
    /10 a 2.000/,
  );
});

test("Folha fechada ou em processamento não pode ser cancelada diretamente", () => {
  assert.doesNotThrow(() => validarStatusCancelamentoFolha("RASCUNHO"));
  assert.doesNotThrow(() => validarStatusCancelamentoFolha("ABERTA"));
  assert.throws(
    () => validarStatusCancelamentoFolha("FECHADA"),
    /reaberta primeiro/,
  );
  assert.throws(
    () => validarStatusCancelamentoFolha("PROCESSANDO"),
    /Somente uma Folha/,
  );
});

test("obrigação emitida ou já cancelada não aceita cancelamento", () => {
  assert.doesNotThrow(() => validarStatusCancelamentoObrigacao("BLOQUEADA"));
  assert.doesNotThrow(() => validarStatusCancelamentoObrigacao("APURADA"));
  assert.throws(
    () => validarStatusCancelamentoObrigacao("EMITIDA"),
    /ainda não emitida/,
  );
  assert.throws(
    () => validarStatusCancelamentoObrigacao("CANCELADA"),
    /ainda não emitida/,
  );
});
