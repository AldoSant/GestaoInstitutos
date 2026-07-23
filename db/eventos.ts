import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { resolverEmpresaAtiva } from "./cadastros";
import { getDb } from "./index";
import {
  eventos,
  eventosRecorrentes,
  metas,
  pessoas,
  prestadores,
  termos,
  vinculos,
} from "./schema";

export async function carregarEventos(busca = "") {
  const db = getDb();
  const empresa = await resolverEmpresaAtiva();
  const textoBusca = busca.trim();
  const termoBusca = `%${textoBusca}%`;
  const filtroEvento = textoBusca
    ? and(
        eq(eventos.empresaId, empresa.id),
        or(ilike(eventos.codigo, termoBusca), ilike(eventos.descricao, termoBusca)),
      )
    : eq(eventos.empresaId, empresa.id);
  const filtroRecorrente = textoBusca
    ? and(
        eq(eventosRecorrentes.empresaId, empresa.id),
        or(
          ilike(eventos.codigo, termoBusca),
          ilike(eventos.descricao, termoBusca),
          ilike(pessoas.nomeRazaoSocial, termoBusca),
          ilike(prestadores.matricula, termoBusca),
          ilike(termos.numero, termoBusca),
          ilike(metas.descricao, termoBusca),
        ),
      )
    : eq(eventosRecorrentes.empresaId, empresa.id);

  const [listaEventos, recorrentes, opcoesEventos, opcoesVinculos, totais] =
    await Promise.all([
      db
        .select({
          id: eventos.id,
          codigo: eventos.codigo,
          descricao: eventos.descricao,
          natureza: eventos.natureza,
          tipoCalculo: eventos.tipoCalculo,
          incideInss: eventos.incideInss,
          incideIrrf: eventos.incideIrrf,
          ativo: eventos.ativo,
          totalRecorrentes: sql<number>`(
            select count(*)::int
              from lancamento_evento_recorrente ler
             where ler.evento_id = ${eventos.id}
          )`,
        })
        .from(eventos)
        .where(filtroEvento)
        .orderBy(desc(eventos.ativo), asc(eventos.codigo))
        .limit(300),
      db
        .select({
          id: eventosRecorrentes.id,
          vinculoId: eventosRecorrentes.vinculoId,
          eventoId: eventosRecorrentes.eventoId,
          valor: eventosRecorrentes.valor,
          inicioCompetencia: eventosRecorrentes.inicioCompetencia,
          fimCompetencia: eventosRecorrentes.fimCompetencia,
          ativo: eventosRecorrentes.ativo,
          eventoCodigo: eventos.codigo,
          eventoDescricao: eventos.descricao,
          tipoCalculo: eventos.tipoCalculo,
          prestadorNome: pessoas.nomeRazaoSocial,
          matricula: prestadores.matricula,
          termoNumero: termos.numero,
          metaCodigo: metas.codigo,
        })
        .from(eventosRecorrentes)
        .innerJoin(
          vinculos,
          and(
            eq(vinculos.id, eventosRecorrentes.vinculoId),
            eq(vinculos.empresaId, eventosRecorrentes.empresaId),
          ),
        )
        .innerJoin(
          eventos,
          and(
            eq(eventos.id, eventosRecorrentes.eventoId),
            eq(eventos.empresaId, eventosRecorrentes.empresaId),
          ),
        )
        .innerJoin(
          prestadores,
          and(
            eq(prestadores.id, vinculos.prestadorId),
            eq(prestadores.empresaId, eventosRecorrentes.empresaId),
          ),
        )
        .innerJoin(
          pessoas,
          and(
            eq(pessoas.id, prestadores.pessoaId),
            eq(pessoas.empresaId, eventosRecorrentes.empresaId),
          ),
        )
        .innerJoin(
          termos,
          and(
            eq(termos.id, vinculos.termoId),
            eq(termos.empresaId, eventosRecorrentes.empresaId),
          ),
        )
        .innerJoin(
          metas,
          and(
            eq(metas.id, vinculos.metaId),
            eq(metas.termoId, termos.id),
          ),
        )
        .where(filtroRecorrente)
        .orderBy(
          desc(eventosRecorrentes.ativo),
          asc(pessoas.nomeRazaoSocial),
          asc(eventos.codigo),
        )
        .limit(300),
      db
        .select({
          id: eventos.id,
          codigo: eventos.codigo,
          descricao: eventos.descricao,
          tipoCalculo: eventos.tipoCalculo,
        })
        .from(eventos)
        .where(and(eq(eventos.empresaId, empresa.id), eq(eventos.ativo, true)))
        .orderBy(asc(eventos.codigo))
        .limit(500),
      db
        .select({
          id: vinculos.id,
          prestadorNome: pessoas.nomeRazaoSocial,
          matricula: prestadores.matricula,
          termoNumero: termos.numero,
          metaCodigo: metas.codigo,
        })
        .from(vinculos)
        .innerJoin(prestadores, eq(prestadores.id, vinculos.prestadorId))
        .innerJoin(pessoas, eq(pessoas.id, prestadores.pessoaId))
        .innerJoin(termos, eq(termos.id, vinculos.termoId))
        .innerJoin(metas, eq(metas.id, vinculos.metaId))
        .where(
          and(
            eq(vinculos.empresaId, empresa.id),
            eq(vinculos.ativo, true),
            eq(prestadores.ativo, true),
            eq(termos.ativo, true),
            eq(metas.ativo, true),
          ),
        )
        .orderBy(asc(pessoas.nomeRazaoSocial), asc(termos.numero), asc(metas.codigo))
        .limit(1000),
      db.execute<{
        eventos_total: number;
        eventos_ativos: number;
        recorrentes_ativos: number;
        eventos_com_inss: number;
      }>(sql`
        select
          (select count(*)::int from evento e where e.empresa_id = ${empresa.id}) eventos_total,
          (select count(*)::int from evento e where e.empresa_id = ${empresa.id} and e.ativo) eventos_ativos,
          (select count(*)::int from lancamento_evento_recorrente ler where ler.empresa_id = ${empresa.id} and ler.ativo) recorrentes_ativos,
          (select count(*)::int from evento e where e.empresa_id = ${empresa.id} and e.ativo and e.incide_inss) eventos_com_inss
      `),
    ]);

  return {
    empresa,
    eventos: listaEventos,
    recorrentes,
    opcoesEventos,
    opcoesVinculos,
    totais: totais.rows[0],
  };
}
