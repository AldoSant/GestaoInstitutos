import assert from "node:assert/strict";
import test from "node:test";
import { normalizarConferenciaFolha } from "../lib/conferencia-folha";

test("aprova somente quando todo o checklist do RH foi confirmado", () => {
  const resultado = normalizarConferenciaFolha({
    resultado: "aprovada",
    conferente: "  Maria   da Silva  ",
    confirmouCadastros: true,
    confirmouValores: true,
    confirmouRubricas: true,
    observacao: "",
  });

  assert.deepEqual(resultado, {
    resultado: "APROVADA",
    conferente: "Maria da Silva",
    confirmouCadastros: true,
    confirmouValores: true,
    confirmouRubricas: true,
    observacao: "",
  });
});

test("rejeição exige justificativa, mas preserva itens não confirmados", () => {
  const resultado = normalizarConferenciaFolha({
    resultado: "REJEITADA",
    conferente: "Gerência de RH",
    confirmouCadastros: true,
    confirmouValores: false,
    confirmouRubricas: true,
    observacao: "Valor divergente do controle mensal.",
  });

  assert.equal(resultado.resultado, "REJEITADA");
  assert.equal(resultado.confirmouValores, false);
  assert.match(resultado.observacao, /divergente/);
});

test("bloqueia aprovação parcial e rejeição sem explicação", () => {
  assert.throws(
    () =>
      normalizarConferenciaFolha({
        resultado: "APROVADA",
        conferente: "Responsável RH",
        confirmouCadastros: true,
        confirmouValores: false,
        confirmouRubricas: true,
        observacao: "",
      }),
    /exige confirmar cadastros, valores e rubricas/,
  );

  assert.throws(
    () =>
      normalizarConferenciaFolha({
        resultado: "REJEITADA",
        conferente: "Responsável RH",
        confirmouCadastros: false,
        confirmouValores: false,
        confirmouRubricas: false,
        observacao: "Erro",
      }),
    /pelo menos 10 caracteres/,
  );
});
