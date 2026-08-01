import type { PoolClient } from "pg";
import {
  type InstrumentoRecolhimentoPrevidenciario,
  type PerfilRecolhimentoCadastro,
} from "@/lib/perfil-recolhimento";
import { getPool } from "./index";

export type LinhaPerfilRecolhimento = {
  id: string;
  empresa_id: string;
  instrumento: InstrumentoRecolhimentoPrevidenciario;
  codigo_receita: string | null;
  inicio_vigencia: string;
  fim_vigencia: string;
  evidencia: string;
  responsavel: string;
  publicado: boolean;
  criado_em: Date;
};

function validarId(valor: string, campo: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)) {
    throw new Error(`${campo} inválido.`);
  }
}

function competenciaNormalizada(valor: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])(-01)?$/.test(valor)) {
    throw new Error("Competência deve usar o formato AAAA-MM.");
  }
  return valor.length === 7 ? `${valor}-01` : valor;
}

const campos = `id, empresa_id, instrumento, codigo_receita,
  inicio_vigencia::text, fim_vigencia::text, evidencia, responsavel,
  publicado, criado_em`;

export async function carregarPerfilRecolhimentoPorCompetencia(
  empresaId: string,
  competencia: string,
  executor: Pick<PoolClient, "query"> = getPool(),
) {
  validarId(empresaId, "Empresa");
  const data = competenciaNormalizada(competencia);
  const resultado = await executor.query<LinhaPerfilRecolhimento>(
    `select ${campos}
       from perfil_recolhimento_previdenciario
      where empresa_id = $1 and publicado
        and inicio_vigencia <= $2::date and fim_vigencia >= $2::date
      limit 1`,
    [empresaId, data],
  );
  if (!resultado.rows[0]) {
    throw new Error(
      `Nenhum perfil de recolhimento publicado atende à competência ${data.slice(0, 7)}.`,
    );
  }
  return resultado.rows[0];
}

export async function listarPerfisRecolhimento(empresaId: string) {
  validarId(empresaId, "Empresa");
  const resultado = await getPool().query<LinhaPerfilRecolhimento>(
    `select ${campos}
       from perfil_recolhimento_previdenciario
      where empresa_id = $1
      order by inicio_vigencia desc, criado_em desc`,
    [empresaId],
  );
  return resultado.rows;
}

export async function publicarPerfilRecolhimento({
  empresaId,
  dados,
  ator = "OPERADOR_INTERNO",
}: {
  empresaId: string;
  dados: PerfilRecolhimentoCadastro;
  ator?: string;
}) {
  validarId(empresaId, "Empresa");
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `select set_config('app.ator', $1, true),
              set_config('app.motivo', $2, true)`,
      [
        ator.trim().slice(0, 160) || "OPERADOR_INTERNO",
        `Publicação do perfil de recolhimento ${dados.instrumento}.`,
      ],
    );
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      `PERFIL_RECOLHIMENTO:${empresaId}`,
    ]);
    const inserido = await client.query<LinhaPerfilRecolhimento>(
      `insert into perfil_recolhimento_previdenciario
         (empresa_id, instrumento, codigo_receita, inicio_vigencia,
          fim_vigencia, evidencia, responsavel, publicado)
       values ($1, $2, $3, $4::date, $5::date, $6, $7, true)
       returning ${campos}`,
      [
        empresaId,
        dados.instrumento,
        dados.codigoReceita,
        dados.inicioVigencia,
        dados.fimVigencia,
        dados.evidencia,
        dados.responsavel,
      ],
    );
    await client.query("commit");
    return inserido.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
