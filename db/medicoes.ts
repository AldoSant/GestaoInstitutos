import type { PoolClient } from "pg";
import { validarMedicaoMensal } from "@/lib/medicoes";
import { getPool } from "./index";

function validarId(valor: string, campo: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)) {
    throw new Error(`${campo} inválido.`);
  }
  return valor;
}

async function transacao<T>(operacao: (client: PoolClient) => Promise<T>) {
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

export async function salvarMedicaoMensal({
  empresaId,
  vinculoId,
  competencia,
  tipo,
  percentual,
  quantidade,
  valorUnitario,
  valor,
  evidenciaReferencia,
  evidenciaHash,
  conferente,
  observacao,
}: {
  empresaId: string;
  vinculoId: string;
  competencia: string;
  tipo: string;
  percentual: string;
  quantidade: string;
  valorUnitario: string;
  valor: string;
  evidenciaReferencia: string;
  evidenciaHash: string;
  conferente: string;
  observacao: string;
}) {
  validarId(empresaId, "Empresa");
  validarId(vinculoId, "Vínculo");

  return transacao(async (client) => {
    const vinculo = await client.query<{
      valor_retribuicao: string;
      ativo: boolean;
    }>(
      `select valor_retribuicao::text, ativo
         from prestador_vinculo
        where id = $1 and empresa_id = $2
        for update`,
      [vinculoId, empresaId],
    );
    if (!vinculo.rows[0]) throw new Error("Vínculo não encontrado.");
    if (!vinculo.rows[0].ativo) {
      throw new Error("Não é possível medir um Vínculo inativo.");
    }

    const dados = validarMedicaoMensal({
      competencia,
      tipo,
      valorContratual: vinculo.rows[0].valor_retribuicao,
      percentual,
      quantidade,
      valorUnitario,
      valor,
      evidenciaReferencia,
      evidenciaHash,
      conferente,
      observacao,
    });
    await client.query(
      `select set_config('app.ator', $1, true),
              set_config('app.motivo', $2, true)`,
      [
        dados.conferente,
        `Medição mensal ${dados.competencia.slice(0, 7)} conferida.`,
      ],
    );
    const salva = await client.query(
      `insert into medicao_mensal
         (empresa_id, vinculo_id, competencia, tipo, valor_contratual,
          percentual, quantidade, valor_unitario, valor_apurado,
          evidencia_referencia, evidencia_hash, conferente, observacao)
       values ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       on conflict (vinculo_id, competencia) do update
         set tipo = excluded.tipo,
             valor_contratual = excluded.valor_contratual,
             percentual = excluded.percentual,
             quantidade = excluded.quantidade,
             valor_unitario = excluded.valor_unitario,
             valor_apurado = excluded.valor_apurado,
             evidencia_referencia = excluded.evidencia_referencia,
             evidencia_hash = excluded.evidencia_hash,
             conferente = excluded.conferente,
             conferida_em = now(),
             observacao = excluded.observacao,
             atualizado_em = now()
         where (
           medicao_mensal.tipo,
           medicao_mensal.valor_contratual,
           medicao_mensal.percentual,
           medicao_mensal.quantidade,
           medicao_mensal.valor_unitario,
           medicao_mensal.valor_apurado,
           medicao_mensal.evidencia_referencia,
           medicao_mensal.evidencia_hash,
           medicao_mensal.conferente,
           medicao_mensal.observacao
         ) is distinct from (
           excluded.tipo,
           excluded.valor_contratual,
           excluded.percentual,
           excluded.quantidade,
           excluded.valor_unitario,
           excluded.valor_apurado,
           excluded.evidencia_referencia,
           excluded.evidencia_hash,
           excluded.conferente,
           excluded.observacao
         )
       returning id, competencia::text, tipo, valor_contratual::text,
                 percentual::text, quantidade::text, valor_unitario::text,
                 valor_apurado::text, evidencia_referencia, evidencia_hash,
                 conferente, conferida_em, observacao`,
      [
        empresaId,
        vinculoId,
        dados.competencia,
        dados.tipo,
        dados.valorContratual,
        dados.percentual,
        dados.quantidade,
        dados.valorUnitario,
        dados.valorApurado,
        dados.evidenciaReferencia,
        dados.evidenciaHash,
        dados.conferente,
        dados.observacao,
      ],
    );
    if (salva.rows[0]) return salva.rows[0];
    const existente = await client.query(
      `select id, competencia::text, tipo, valor_contratual::text,
              percentual::text, quantidade::text, valor_unitario::text,
              valor_apurado::text, evidencia_referencia, evidencia_hash,
              conferente, conferida_em, observacao
         from medicao_mensal
        where vinculo_id = $1 and competencia = $2::date`,
      [vinculoId, dados.competencia],
    );
    return existente.rows[0];
  });
}

export async function carregarMedicoesMensais(
  empresaId: string,
  competencia: string,
) {
  validarId(empresaId, "Empresa");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
    throw new Error("Competência inválida.");
  }
  const data = `${competencia}-01`;
  const [medicoes, vinculos] = await Promise.all([
    getPool().query(
      `select mm.id, mm.vinculo_id, mm.competencia::text, mm.tipo,
              mm.valor_contratual::text, mm.percentual::text,
              mm.quantidade::text, mm.valor_unitario::text,
              mm.valor_apurado::text, mm.evidencia_referencia,
              mm.evidencia_hash, mm.conferente, mm.conferida_em, mm.observacao,
              p.nome_razao_social prestador_nome, pr.matricula,
              t.numero termo_numero, tm.codigo meta_codigo,
              v.atividade, v.exige_medicao_mensal
         from medicao_mensal mm
         join prestador_vinculo v
           on v.id = mm.vinculo_id and v.empresa_id = mm.empresa_id
         join prestador pr on pr.id = v.prestador_id
         join pessoa p on p.id = pr.pessoa_id
         join termo t on t.id = v.termo_id
         join termo_meta tm on tm.id = v.meta_id
        where mm.empresa_id = $1 and mm.competencia = $2::date
        order by p.nome_razao_social`,
      [empresaId, data],
    ),
    getPool().query(
      `select v.id, v.valor_retribuicao::text, v.exige_medicao_mensal,
              p.nome_razao_social prestador_nome, pr.matricula,
              t.numero termo_numero, tm.codigo meta_codigo, v.atividade,
              exists (
                select 1 from medicao_mensal mm
                 where mm.vinculo_id = v.id and mm.competencia = $2::date
              ) possui_medicao
         from prestador_vinculo v
         join prestador pr on pr.id = v.prestador_id and pr.ativo
         join pessoa p on p.id = pr.pessoa_id and p.ativo
         join termo t on t.id = v.termo_id and t.ativo
         join termo_meta tm on tm.id = v.meta_id and tm.ativo
        where v.empresa_id = $1 and v.ativo
          and v.inicio <= $2::date
          and (v.fim is null or v.fim >= $2::date)
        order by p.nome_razao_social`,
      [empresaId, data],
    ),
  ]);
  return { medicoes: medicoes.rows, vinculos: vinculos.rows };
}
