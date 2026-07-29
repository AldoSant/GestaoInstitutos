import assert from "node:assert/strict";
import test from "node:test";
import {
  hashSnapshotRetificacao,
  normalizarSolicitacaoRetificacao,
  retificacaoAtiva,
} from "../lib/retificacao-obrigacao";

test("normaliza solicitação formal de retificação", () => {
  assert.deepEqual(
    normalizarSolicitacaoRetificacao({
      motivo:
        "  Divergência confirmada no documento oficial e autorizada pelo setor contábil.  ",
      responsavel: "  Gerente contábil  ",
    }),
    {
      motivo:
        "Divergência confirmada no documento oficial e autorizada pelo setor contábil.",
      responsavel: "Gerente contábil",
    },
  );
});

test("retificação exige justificativa e responsável identificável", () => {
  assert.throws(
    () =>
      normalizarSolicitacaoRetificacao({
        motivo: "Corrigir.",
        responsavel: "RH",
      }),
    /20 e 3.000/,
  );
  assert.throws(
    () =>
      normalizarSolicitacaoRetificacao({
        motivo:
          "Divergência confirmada no documento oficial e autorizada formalmente.",
        responsavel: "X",
      }),
    /3 e 160/,
  );
});

test("snapshot anterior possui hash canônico e estados ativos explícitos", () => {
  const a = hashSnapshotRetificacao({
    obrigacao: { total: "100.00", status: "EMITIDA" },
    documentos: [{ tipo: "DARF", hash: "a".repeat(64) }],
  });
  const b = hashSnapshotRetificacao({
    documentos: [{ hash: "a".repeat(64), tipo: "DARF" }],
    obrigacao: { status: "EMITIDA", total: "100.00" },
  });
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(retificacaoAtiva("SOLICITADA"), true);
  assert.equal(retificacaoAtiva("EM_ANDAMENTO"), true);
  assert.equal(retificacaoAtiva("CONCLUIDA"), false);
});
