import assert from "node:assert/strict";
import test from "node:test";
import { mensagemOperacional } from "../lib/mensagem-operacional";

test("preserva mensagens operacionais e oculta detalhes técnicos", () => {
  assert.equal(
    mensagemOperacional(new Error("Informe a competência."), "Não foi possível concluir."),
    "Informe a competência.",
  );
  assert.equal(
    mensagemOperacional(
      Object.assign(new Error('relation "pessoa" does not exist'), { code: "42P01" }),
      "Não foi possível concluir.",
    ),
    "Não foi possível concluir.",
  );
});
