import { resolverEmpresaAtiva } from "../../db/cadastros";
import { getPool } from "../../db";
import { enfileirarTarefa } from "../../db/tarefas";

const competencia = process.argv[2];
if (!competencia || !/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
  throw new Error(
    "Informe a competência no formato AAAA-MM. Exemplo: npm run worker:validar-regra -- 2026-06",
  );
}

try {
  const empresa = await resolverEmpresaAtiva();
  const tarefa = await enfileirarTarefa({
    empresaId: empresa.id,
    tipo: "VALIDAR_REGRA_FISCAL",
    chaveIdempotencia: `validar-regra:${competencia}`,
    payload: { competencia },
  });
  console.log(
    `Tarefa ${tarefa.id} para ${competencia}: ${tarefa.status} (${tarefa.tentativas}/${tarefa.maxTentativas}).`,
  );
} finally {
  await getPool().end();
}
