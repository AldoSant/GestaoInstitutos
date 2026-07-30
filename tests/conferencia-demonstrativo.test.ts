import assert from "node:assert/strict";
import test from "node:test";
import { normalizarConferenciaDemonstrativo } from "../lib/conferencia-demonstrativo";

test("aprovação exige checklist financeiro completo", () => {
  assert.throws(
    () =>
      normalizarConferenciaDemonstrativo({
        resultado: "APROVADA",
        conferente: "Gerente do RH",
        confirmouPagamentos: true,
        confirmouRetencoes: false,
        confirmouGuias: true,
        observacao: "",
      }),
    /pagamentos, retenções e guias/,
  );
});

test("normaliza aprovação completa", () => {
  assert.deepEqual(
    normalizarConferenciaDemonstrativo({
      resultado: "aprovada",
      conferente: "  Gerente do RH  ",
      confirmouPagamentos: "on",
      confirmouRetencoes: "on",
      confirmouGuias: "on",
      observacao: "  Conferido com os documentos.  ",
    }),
    {
      resultado: "APROVADA",
      conferente: "Gerente do RH",
      confirmouPagamentos: true,
      confirmouRetencoes: true,
      confirmouGuias: true,
      observacao: "Conferido com os documentos.",
    },
  );
});

test("rejeição exige justificativa objetiva", () => {
  assert.throws(
    () =>
      normalizarConferenciaDemonstrativo({
        resultado: "REJEITADA",
        conferente: "Gerente do RH",
        confirmouPagamentos: false,
        confirmouRetencoes: false,
        confirmouGuias: false,
        observacao: "Erro",
      }),
    /ao menos 10 caracteres/,
  );
});
