import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { getPool } from "../db";
import {
  concluirTarefa,
  enfileirarTarefa,
  falharTarefa,
  reservarProximaTarefa,
} from "../db/tarefas";

const databaseUrl = process.env.DATABASE_URL;

test(
  "fila persiste idempotência, reserva exclusiva e retentativa",
  { skip: !databaseUrl },
  async () => {
    const pool = getPool();
    const empresaId = randomUUID();
    const sufixo = empresaId.replaceAll("-", "").slice(0, 14);
    const cnpj = [...sufixo]
      .map((caractere) => Number.parseInt(caractere, 16) % 10)
      .join("");
    const tipo = `TESTE_FILA_${sufixo}`;

    try {
      await pool.query(
        `insert into empresa (id, cnpj, razao_social)
         values ($1, $2, 'Empresa sintética da fila')`,
        [empresaId, cnpj],
      );

      const primeira = await enfileirarTarefa({
        empresaId,
        tipo,
        chaveIdempotencia: "primeira",
        payload: { valor: 1 },
      });
      const repetida = await enfileirarTarefa({
        empresaId,
        tipo,
        chaveIdempotencia: "primeira",
        payload: { valor: 999 },
      });
      assert.equal(repetida.id, primeira.id);
      assert.deepEqual(repetida.payload, { valor: 1 });

      await enfileirarTarefa({
        empresaId,
        tipo,
        chaveIdempotencia: "segunda",
        payload: { valor: 2 },
      });

      const [reservaA, reservaB] = await Promise.all([
        reservarProximaTarefa("worker-a", [tipo]),
        reservarProximaTarefa("worker-b", [tipo]),
      ]);
      assert.ok(reservaA);
      assert.ok(reservaB);
      assert.notEqual(reservaA.id, reservaB.id);

      const concluida = await concluirTarefa(
        reservaA.id,
        reservaA.bloqueadaPor!,
        { ok: true },
      );
      assert.equal(concluida.status, "CONCLUIDA");

      const falha = await falharTarefa(
        reservaB.id,
        reservaB.bloqueadaPor!,
        "Falha sintética",
        0,
      );
      assert.equal(falha.status, "FALHA");

      const novaReserva = await reservarProximaTarefa("worker-c", [tipo]);
      assert.equal(novaReserva?.id, reservaB.id);
      assert.equal(novaReserva?.tentativas, 2);
    } finally {
      await pool.query(
        `delete from tarefa_processamento where empresa_id = $1`,
        [empresaId],
      );
      await pool.query(`delete from empresa where id = $1`, [empresaId]);
      await pool.end();
    }
  },
);
