import type { PoolClient } from "pg";
import { getPool } from "./index";

export type StatusTarefa =
  | "PENDENTE"
  | "EXECUTANDO"
  | "CONCLUIDA"
  | "FALHA"
  | "CANCELADA";

export type TarefaProcessamento = {
  id: string;
  empresaId: string;
  tipo: string;
  chaveIdempotencia: string;
  status: StatusTarefa;
  prioridade: number;
  payload: unknown;
  resultado: unknown | null;
  tentativas: number;
  maxTentativas: number;
  disponivelEm: Date;
  bloqueadaEm: Date | null;
  bloqueadaPor: string | null;
  iniciadaEm: Date | null;
  concluidaEm: Date | null;
  ultimoErro: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
};

type LinhaTarefa = {
  id: string;
  empresa_id: string;
  tipo: string;
  chave_idempotencia: string;
  status: StatusTarefa;
  prioridade: number;
  payload: unknown;
  resultado: unknown | null;
  tentativas: number;
  max_tentativas: number;
  disponivel_em: Date;
  bloqueada_em: Date | null;
  bloqueada_por: string | null;
  iniciada_em: Date | null;
  concluida_em: Date | null;
  ultimo_erro: string | null;
  criado_em: Date;
  atualizado_em: Date;
};

const colunasTarefa = `
  id, empresa_id, tipo, chave_idempotencia, status, prioridade, payload,
  resultado, tentativas, max_tentativas, disponivel_em, bloqueada_em,
  bloqueada_por, iniciada_em, concluida_em, ultimo_erro, criado_em, atualizado_em
`;

function mapearTarefa(linha: LinhaTarefa): TarefaProcessamento {
  return {
    id: linha.id,
    empresaId: linha.empresa_id,
    tipo: linha.tipo,
    chaveIdempotencia: linha.chave_idempotencia,
    status: linha.status,
    prioridade: linha.prioridade,
    payload: linha.payload,
    resultado: linha.resultado,
    tentativas: linha.tentativas,
    maxTentativas: linha.max_tentativas,
    disponivelEm: linha.disponivel_em,
    bloqueadaEm: linha.bloqueada_em,
    bloqueadaPor: linha.bloqueada_por,
    iniciadaEm: linha.iniciada_em,
    concluidaEm: linha.concluida_em,
    ultimoErro: linha.ultimo_erro,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

function validarTexto(valor: string, campo: string, limite: number) {
  const normalizado = valor.trim();
  if (!normalizado || normalizado.length > limite) {
    throw new Error(`${campo} deve ter entre 1 e ${limite} caracteres.`);
  }
  return normalizado;
}

export async function enfileirarTarefa({
  empresaId,
  tipo,
  chaveIdempotencia,
  payload,
  prioridade = 100,
  maxTentativas = 3,
  disponivelEm = new Date(),
}: {
  empresaId: string;
  tipo: string;
  chaveIdempotencia: string;
  payload: unknown;
  prioridade?: number;
  maxTentativas?: number;
  disponivelEm?: Date;
}) {
  const tipoNormalizado = validarTexto(tipo, "tipo", 60);
  const chaveNormalizada = validarTexto(
    chaveIdempotencia,
    "chaveIdempotencia",
    180,
  );
  if (!Number.isSafeInteger(prioridade) || prioridade < 0) {
    throw new Error("prioridade deve ser um inteiro não negativo.");
  }
  if (!Number.isSafeInteger(maxTentativas) || maxTentativas <= 0) {
    throw new Error("maxTentativas deve ser um inteiro positivo.");
  }
  if (Number.isNaN(disponivelEm.getTime())) {
    throw new Error("disponivelEm deve ser uma data válida.");
  }

  const resultado = await getPool().query<LinhaTarefa>(
    `insert into tarefa_processamento
       (empresa_id, tipo, chave_idempotencia, payload, prioridade,
        max_tentativas, disponivel_em)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (empresa_id, tipo, chave_idempotencia)
     do update set chave_idempotencia = excluded.chave_idempotencia
     returning ${colunasTarefa}`,
    [
      empresaId,
      tipoNormalizado,
      chaveNormalizada,
      payload,
      prioridade,
      maxTentativas,
      disponivelEm,
    ],
  );
  return mapearTarefa(resultado.rows[0]);
}

async function emTransacao<T>(
  operacao: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const resultado = await operacao(client);
    await client.query("commit");
    return resultado;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function reservarProximaTarefa(
  trabalhadorId: string,
  tipos: string[] = [],
) {
  const trabalhador = validarTexto(trabalhadorId, "trabalhadorId", 120);
  const tiposNormalizados = tipos.map((tipo) => validarTexto(tipo, "tipo", 60));

  return emTransacao(async (client) => {
    const resultado = await client.query<LinhaTarefa>(
      `with proxima as (
         select id
           from tarefa_processamento
          where status in ('PENDENTE', 'FALHA')
            and tentativas < max_tentativas
            and disponivel_em <= now()
            and (cardinality($2::text[]) = 0 or tipo = any($2::text[]))
          order by prioridade asc, disponivel_em asc, criado_em asc
          for update skip locked
          limit 1
       )
       update tarefa_processamento tarefa
          set status = 'EXECUTANDO',
              tentativas = tarefa.tentativas + 1,
              bloqueada_em = now(),
              bloqueada_por = $1,
              iniciada_em = coalesce(tarefa.iniciada_em, now()),
              concluida_em = null,
              atualizado_em = now()
         from proxima
        where tarefa.id = proxima.id
       returning ${colunasTarefa
         .split(",")
         .map((coluna) => `tarefa.${coluna.trim()}`)
         .join(", ")}`,
      [trabalhador, tiposNormalizados],
    );
    return resultado.rows[0] ? mapearTarefa(resultado.rows[0]) : null;
  });
}

export async function concluirTarefa(
  tarefaId: string,
  trabalhadorId: string,
  resultado: unknown,
) {
  const trabalhador = validarTexto(trabalhadorId, "trabalhadorId", 120);
  const atualizado = await getPool().query<LinhaTarefa>(
    `update tarefa_processamento
        set status = 'CONCLUIDA',
            resultado = $3,
            concluida_em = now(),
            bloqueada_em = null,
            bloqueada_por = null,
            ultimo_erro = null,
            atualizado_em = now()
      where id = $1
        and status = 'EXECUTANDO'
        and bloqueada_por = $2
      returning ${colunasTarefa}`,
    [tarefaId, trabalhador, resultado],
  );
  if (!atualizado.rows[0]) {
    throw new Error("A tarefa não está reservada por este trabalhador.");
  }
  return mapearTarefa(atualizado.rows[0]);
}

export async function falharTarefa(
  tarefaId: string,
  trabalhadorId: string,
  erro: string,
  tentarNovamenteEmSegundos = 30,
) {
  const trabalhador = validarTexto(trabalhadorId, "trabalhadorId", 120);
  const mensagem = validarTexto(erro, "erro", 10_000);
  if (
    !Number.isSafeInteger(tentarNovamenteEmSegundos) ||
    tentarNovamenteEmSegundos < 0
  ) {
    throw new Error(
      "tentarNovamenteEmSegundos deve ser um inteiro não negativo.",
    );
  }

  const atualizado = await getPool().query<LinhaTarefa>(
    `update tarefa_processamento
        set status = 'FALHA',
            ultimo_erro = $3,
            disponivel_em = now() + make_interval(secs => $4),
            bloqueada_em = null,
            bloqueada_por = null,
            atualizado_em = now()
      where id = $1
        and status = 'EXECUTANDO'
        and bloqueada_por = $2
      returning ${colunasTarefa}`,
    [tarefaId, trabalhador, mensagem, tentarNovamenteEmSegundos],
  );
  if (!atualizado.rows[0]) {
    throw new Error("A tarefa não está reservada por este trabalhador.");
  }
  return mapearTarefa(atualizado.rows[0]);
}

export async function recuperarTarefasExpiradas(
  limiteMinutos = 15,
): Promise<number> {
  if (!Number.isSafeInteger(limiteMinutos) || limiteMinutos <= 0) {
    throw new Error("limiteMinutos deve ser um inteiro positivo.");
  }
  const resultado = await getPool().query(
    `update tarefa_processamento
        set status = 'FALHA',
            ultimo_erro = 'Reserva expirada; tarefa liberada para nova tentativa.',
            disponivel_em = now(),
            bloqueada_em = null,
            bloqueada_por = null,
            atualizado_em = now()
      where status = 'EXECUTANDO'
        and bloqueada_em < now() - make_interval(mins => $1)`,
    [limiteMinutos],
  );
  return resultado.rowCount ?? 0;
}
