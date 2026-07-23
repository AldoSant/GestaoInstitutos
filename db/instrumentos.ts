import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { resolverEmpresaAtiva } from "./cadastros";
import { getDb } from "./index";
import { metas, termos } from "./schema";

export async function carregarInstrumentos(busca = "") {
  const db = getDb();
  const empresa = await resolverEmpresaAtiva();
  const textoBusca = busca.trim();
  const termoBusca = `%${textoBusca}%`;
  const filtroTermo = textoBusca
    ? and(
        eq(termos.empresaId, empresa.id),
        or(
          ilike(termos.numero, termoBusca),
          ilike(termos.descricao, termoBusca),
          ilike(termos.modalidade, termoBusca),
        ),
      )
    : eq(termos.empresaId, empresa.id);
  const filtroMeta = textoBusca
    ? and(
        eq(termos.empresaId, empresa.id),
        or(
          ilike(metas.codigo, termoBusca),
          ilike(metas.descricao, termoBusca),
          ilike(termos.numero, termoBusca),
          ilike(termos.descricao, termoBusca),
        ),
      )
    : eq(termos.empresaId, empresa.id);

  const [listaTermos, listaMetas, opcoesTermos, totais] = await Promise.all([
    db
      .select({
        id: termos.id,
        numero: termos.numero,
        descricao: termos.descricao,
        modalidade: termos.modalidade,
        inicio: termos.inicio,
        fim: termos.fim,
        valorGlobal: termos.valorGlobal,
        ativo: termos.ativo,
        totalMetas: sql<number>`(
          select count(*)::int from termo_meta tm where tm.termo_id = ${termos.id}
        )`,
        metasAtivas: sql<number>`(
          select count(*)::int from termo_meta tm
           where tm.termo_id = ${termos.id} and tm.ativo
        )`,
        totalVinculos: sql<number>`(
          select count(*)::int from prestador_vinculo pv
           where pv.termo_id = ${termos.id} and pv.empresa_id = ${empresa.id}
        )`,
      })
      .from(termos)
      .where(filtroTermo)
      .orderBy(desc(termos.inicio), asc(termos.numero))
      .limit(200),
    db
      .select({
        id: metas.id,
        termoId: metas.termoId,
        codigo: metas.codigo,
        descricao: metas.descricao,
        ativo: metas.ativo,
        termoNumero: termos.numero,
        termoDescricao: termos.descricao,
        termoAtivo: termos.ativo,
        totalVinculos: sql<number>`(
          select count(*)::int from prestador_vinculo pv
           where pv.meta_id = ${metas.id} and pv.empresa_id = ${empresa.id}
        )`,
      })
      .from(metas)
      .innerJoin(termos, eq(termos.id, metas.termoId))
      .where(filtroMeta)
      .orderBy(desc(termos.inicio), asc(termos.numero), asc(metas.codigo))
      .limit(300),
    db
      .select({
        id: termos.id,
        numero: termos.numero,
        descricao: termos.descricao,
        ativo: termos.ativo,
      })
      .from(termos)
      .where(eq(termos.empresaId, empresa.id))
      .orderBy(desc(termos.inicio), asc(termos.numero))
      .limit(500),
    db.execute<{
      termos_total: number;
      termos_ativos: number;
      metas_total: number;
      metas_ativas: number;
      termos_sem_meta: number;
    }>(sql`
      select
        (select count(*)::int from termo t where t.empresa_id = ${empresa.id}) termos_total,
        (select count(*)::int from termo t where t.empresa_id = ${empresa.id} and t.ativo) termos_ativos,
        (select count(*)::int from termo_meta tm join termo t on t.id = tm.termo_id where t.empresa_id = ${empresa.id}) metas_total,
        (select count(*)::int from termo_meta tm join termo t on t.id = tm.termo_id where t.empresa_id = ${empresa.id} and tm.ativo) metas_ativas,
        (select count(*)::int from termo t where t.empresa_id = ${empresa.id} and t.ativo and not exists (select 1 from termo_meta tm where tm.termo_id = t.id and tm.ativo)) termos_sem_meta
    `),
  ]);

  return {
    empresa,
    termos: listaTermos,
    metas: listaMetas,
    opcoesTermos,
    totais: totais.rows[0],
  };
}
