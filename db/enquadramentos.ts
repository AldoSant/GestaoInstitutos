import type { PoolClient } from "pg";
import {
  CENARIOS_PREVIDENCIARIOS,
  type EnquadramentoCadastro,
  type RegimePrevidenciario,
} from "@/lib/enquadramento-previdenciario";
import { getPool } from "./index";

export type LinhaEnquadramentoPrevidenciario = {
  id: string;
  empresa_id: string;
  regime: RegimePrevidenciario;
  inicio_vigencia: string;
  fim_vigencia: string;
  aliquota_segurado_numerador: number;
  aliquota_segurado_denominador: number;
  aliquota_patronal_numerador: number;
  aliquota_patronal_denominador: number;
  cebas_numero: string | null;
  cebas_inicio: string | null;
  cebas_fim: string | null;
  evidencia: string;
  fonte_normativa: string;
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

export async function carregarEnquadramentoPorCompetencia(
  empresaId: string,
  competencia: string,
  executor: Pick<PoolClient, "query"> = getPool(),
) {
  validarId(empresaId, "Empresa");
  const data = competenciaNormalizada(competencia);
  const resultado = await executor.query<LinhaEnquadramentoPrevidenciario>(
    `select id, empresa_id, regime, inicio_vigencia::text, fim_vigencia::text,
            aliquota_segurado_numerador, aliquota_segurado_denominador,
            aliquota_patronal_numerador, aliquota_patronal_denominador,
            cebas_numero, cebas_inicio::text, cebas_fim::text, evidencia,
            fonte_normativa, publicado, criado_em
       from enquadramento_previdenciario
      where empresa_id = $1 and publicado
        and inicio_vigencia <= $2::date and fim_vigencia >= $2::date
      limit 1`,
    [empresaId, data],
  );
  if (!resultado.rows[0]) {
    throw new Error(
      `Nenhum enquadramento previdenciário publicado atende à competência ${data.slice(0, 7)}.`,
    );
  }
  return resultado.rows[0];
}

export async function carregarEnquadramentoPorId(
  empresaId: string,
  enquadramentoId: string,
  executor: Pick<PoolClient, "query"> = getPool(),
) {
  validarId(empresaId, "Empresa");
  validarId(enquadramentoId, "Enquadramento");
  const resultado = await executor.query<LinhaEnquadramentoPrevidenciario>(
    `select id, empresa_id, regime, inicio_vigencia::text, fim_vigencia::text,
            aliquota_segurado_numerador, aliquota_segurado_denominador,
            aliquota_patronal_numerador, aliquota_patronal_denominador,
            cebas_numero, cebas_inicio::text, cebas_fim::text, evidencia,
            fonte_normativa, publicado, criado_em
       from enquadramento_previdenciario
      where empresa_id = $1 and id = $2`,
    [empresaId, enquadramentoId],
  );
  if (!resultado.rows[0]) {
    throw new Error("Enquadramento previdenciário congelado não encontrado.");
  }
  return resultado.rows[0];
}

export async function listarEnquadramentos(empresaId: string) {
  validarId(empresaId, "Empresa");
  const resultado = await getPool().query<LinhaEnquadramentoPrevidenciario>(
    `select id, empresa_id, regime, inicio_vigencia::text, fim_vigencia::text,
            aliquota_segurado_numerador, aliquota_segurado_denominador,
            aliquota_patronal_numerador, aliquota_patronal_denominador,
            cebas_numero, cebas_inicio::text, cebas_fim::text, evidencia,
            fonte_normativa, publicado, criado_em
       from enquadramento_previdenciario
      where empresa_id = $1
      order by inicio_vigencia desc, criado_em desc`,
    [empresaId],
  );
  return resultado.rows;
}

export async function publicarEnquadramento({
  empresaId,
  dados,
  ator = "OPERADOR_INTERNO",
}: {
  empresaId: string;
  dados: EnquadramentoCadastro;
  ator?: string;
}) {
  validarId(empresaId, "Empresa");
  const cenario = CENARIOS_PREVIDENCIARIOS[dados.regime];
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `select set_config('app.ator', $1, true),
              set_config('app.motivo', $2, true)`,
      [
        ator.trim().slice(0, 160) || "OPERADOR_INTERNO",
        `Publicação do enquadramento ${dados.regime}.`,
      ],
    );
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      `ENQUADRAMENTO:${empresaId}`,
    ]);
    const inserido = await client.query<LinhaEnquadramentoPrevidenciario>(
      `insert into enquadramento_previdenciario
         (empresa_id, regime, inicio_vigencia, fim_vigencia,
          aliquota_segurado_numerador, aliquota_segurado_denominador,
          aliquota_patronal_numerador, aliquota_patronal_denominador,
          cebas_numero, cebas_inicio, cebas_fim, evidencia,
          fonte_normativa, publicado)
       values ($1, $2, $3::date, $4::date, $5, $6, $7, $8,
               $9, $10::date, $11::date, $12, $13, true)
       returning id, empresa_id, regime, inicio_vigencia::text,
                 fim_vigencia::text, aliquota_segurado_numerador,
                 aliquota_segurado_denominador, aliquota_patronal_numerador,
                 aliquota_patronal_denominador, cebas_numero,
                 cebas_inicio::text, cebas_fim::text, evidencia,
                 fonte_normativa, publicado, criado_em`,
      [
        empresaId,
        dados.regime,
        dados.inicioVigencia,
        dados.fimVigencia,
        cenario.aliquotaSeguradoNumerador,
        cenario.aliquotaSeguradoDenominador,
        cenario.aliquotaPatronalNumerador,
        cenario.aliquotaPatronalDenominador,
        dados.cebasNumero,
        dados.cebasInicio,
        dados.cebasFim,
        dados.evidencia,
        cenario.fonteNormativa,
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
