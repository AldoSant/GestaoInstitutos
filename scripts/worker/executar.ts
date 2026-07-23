import { hostname } from "node:os";
import { getPool } from "../../db";
import {
  concluirTarefa,
  falharTarefa,
  recuperarTarefasExpiradas,
  reservarProximaTarefa,
} from "../../db/tarefas";
import { handlers, tiposRegistrados } from "./handlers";

function inteiroPositivo(nome: string, padrao: number) {
  const texto = process.env[nome];
  if (!texto) return padrao;
  const valor = Number(texto);
  if (!Number.isSafeInteger(valor) || valor <= 0) {
    throw new Error(`${nome} deve ser um inteiro positivo.`);
  }
  return valor;
}

const intervaloMs = inteiroPositivo("WORKER_POLL_INTERVAL_MS", 2_000);
const reservaExpiraMinutos = inteiroPositivo(
  "WORKER_LEASE_TIMEOUT_MINUTES",
  15,
);
const trabalhadorId =
  process.env.WORKER_ID?.trim() || `${hostname()}:${process.pid}`;
let encerrando = false;

function solicitarEncerramento(sinal: string) {
  if (encerrando) return;
  encerrando = true;
  console.log(`Worker recebeu ${sinal}; encerrando após a tarefa atual.`);
}

process.once("SIGTERM", () => solicitarEncerramento("SIGTERM"));
process.once("SIGINT", () => solicitarEncerramento("SIGINT"));

function esperar(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function executar() {
  console.log(
    `Worker ${trabalhadorId} iniciado para: ${tiposRegistrados.join(", ")}.`,
  );
  const recuperadas = await recuperarTarefasExpiradas(
    reservaExpiraMinutos,
  );
  if (recuperadas > 0) {
    console.warn(`${recuperadas} tarefa(s) com reserva expirada foram liberadas.`);
  }

  while (!encerrando) {
    try {
      const tarefa = await reservarProximaTarefa(
        trabalhadorId,
        [...tiposRegistrados],
      );
      if (!tarefa) {
        await esperar(intervaloMs);
        continue;
      }

      const handler = handlers[tarefa.tipo];
      if (!handler) {
        await falharTarefa(
          tarefa.id,
          trabalhadorId,
          `Nenhum handler registrado para ${tarefa.tipo}.`,
          900,
        );
        continue;
      }

      try {
        const resultado = await handler(tarefa);
        await concluirTarefa(tarefa.id, trabalhadorId, resultado);
        console.log(`Tarefa ${tarefa.id} (${tarefa.tipo}) concluída.`);
      } catch (error) {
        const mensagem =
          error instanceof Error ? error.message : "Falha desconhecida.";
        const esperaSegundos = Math.min(
          900,
          30 * 2 ** Math.max(0, tarefa.tentativas - 1),
        );
        await falharTarefa(
          tarefa.id,
          trabalhadorId,
          mensagem,
          esperaSegundos,
        );
        console.error(`Tarefa ${tarefa.id} (${tarefa.tipo}) falhou: ${mensagem}`);
      }
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Falha desconhecida.";
      console.error(`Ciclo do worker falhou: ${mensagem}`);
      await esperar(intervaloMs);
    }
  }
}

try {
  await executar();
} finally {
  await getPool().end();
  console.log(`Worker ${trabalhadorId} encerrado.`);
}
