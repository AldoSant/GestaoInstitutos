import assert from "node:assert/strict";
import test from "node:test";
import type { TarefaProcessamento } from "../db/tarefas";
import {
  handlers,
  tiposRegistrados,
} from "../scripts/worker/handlers";

function tarefa(payload: unknown): TarefaProcessamento {
  const agora = new Date();
  return {
    id: "00000000-0000-4000-8000-000000000001",
    empresaId: "00000000-0000-4000-8000-000000000002",
    tipo: "VALIDAR_REGRA_FISCAL",
    chaveIdempotencia: "teste",
    status: "EXECUTANDO",
    prioridade: 100,
    payload,
    resultado: null,
    tentativas: 1,
    maxTentativas: 3,
    disponivelEm: agora,
    bloqueadaEm: agora,
    bloqueadaPor: "teste",
    iniciadaEm: agora,
    concluidaEm: null,
    ultimoErro: null,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

test("registra somente tipos que possuem handler", () => {
  assert.deepEqual(tiposRegistrados, ["VALIDAR_REGRA_FISCAL"]);
  assert.equal(typeof handlers.VALIDAR_REGRA_FISCAL, "function");
});

test("handler rejeita payload sem competência antes de consultar o banco", async () => {
  await assert.rejects(
    handlers.VALIDAR_REGRA_FISCAL(tarefa({})),
    /payload.competencia/,
  );
  await assert.rejects(
    handlers.VALIDAR_REGRA_FISCAL(tarefa(null)),
    /payload da tarefa/,
  );
});
