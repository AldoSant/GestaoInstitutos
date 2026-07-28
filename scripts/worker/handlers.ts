import type { TarefaProcessamento } from "../../db/tarefas";
import { carregarRegraFiscalPorCompetencia } from "../../db/regras";
import { processarFolha } from "../../db/folhas";

export type HandlerTarefa = (
  tarefa: TarefaProcessamento,
) => Promise<Record<string, unknown>>;

function payloadObjeto(tarefa: TarefaProcessamento) {
  if (!tarefa.payload || typeof tarefa.payload !== "object") {
    throw new Error("O payload da tarefa deve ser um objeto.");
  }
  return tarefa.payload as Record<string, unknown>;
}

const validarRegraFiscal: HandlerTarefa = async (tarefa) => {
  const payload = payloadObjeto(tarefa);
  if (typeof payload.competencia !== "string") {
    throw new Error("A tarefa exige payload.competencia no formato AAAA-MM.");
  }
  const regra = await carregarRegraFiscalPorCompetencia(
    payload.competencia,
    tarefa.empresaId,
  );
  return {
    regraId: regra.id,
    codigo: regra.codigo,
    versao: regra.versao,
    competencia: payload.competencia,
    hashConteudo: regra.hashConteudo,
  };
};

const processarFolhaHandler: HandlerTarefa = async (tarefa) => {
  const payload = payloadObjeto(tarefa);
  if (typeof payload.folhaId !== "string") {
    throw new Error("A tarefa exige payload.folhaId.");
  }
  if (!Number.isSafeInteger(payload.revisao) || Number(payload.revisao) <= 0) {
    throw new Error("A tarefa exige payload.revisao como inteiro positivo.");
  }
  const resultado = await processarFolha(
    payload.folhaId,
    `WORKER:${tarefa.bloqueadaPor ?? "FOLHA"}`,
    tarefa.empresaId,
    Number(payload.revisao),
  );
  return resultado;
};

export const handlers: Record<string, HandlerTarefa> = {
  VALIDAR_REGRA_FISCAL: validarRegraFiscal,
  PROCESSAR_FOLHA: processarFolhaHandler,
};

export const tiposRegistrados = Object.freeze(Object.keys(handlers));
