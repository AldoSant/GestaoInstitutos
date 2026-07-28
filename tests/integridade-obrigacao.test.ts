import assert from "node:assert/strict";
import test from "node:test";
import {
  validarEstadoFolhasParaApuracao,
  validarIntegridadeFontesObrigacao,
} from "../lib/integridade-obrigacao";

test("aceita apuração somente com todas as Folhas fechadas", () => {
  assert.doesNotThrow(() =>
    validarEstadoFolhasParaApuracao({
      fechadas: 2,
      pendentes: 0,
      itens: 15,
      semEnquadramento: 0,
    }),
  );
  assert.throws(
    () =>
      validarEstadoFolhasParaApuracao({
        fechadas: 1,
        pendentes: 1,
        itens: 8,
        semEnquadramento: 0,
      }),
    /apuração parcial foi bloqueada/,
  );
});

test("exige reapuração quando as fontes mudam", () => {
  assert.throws(
    () =>
      validarIntegridadeFontesObrigacao({
        vinculadas: 2,
        pendentes: 1,
        fechadasNovas: 1,
        alteradas: 1,
      }),
    /Reapure a obrigação.*não fechada.*após a última apuração.*reaberta/,
  );
});

test("aceita documentos somente com fontes congeladas e atuais", () => {
  assert.doesNotThrow(() =>
    validarIntegridadeFontesObrigacao({
      vinculadas: 2,
      pendentes: 0,
      fechadasNovas: 0,
      alteradas: 0,
    }),
  );
});
