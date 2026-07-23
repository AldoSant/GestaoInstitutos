import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "./index";
import {
  atividades,
  lotacoes,
  metas,
  pessoas,
  prestadores,
  termos,
  vinculos,
} from "./schema";
import { resolverEmpresaAtiva } from "./cadastros";

export async function carregarVinculos(busca = "") {
  const db = getDb();
  const empresa = await resolverEmpresaAtiva();
  const textoBusca = busca.trim();
  const termoBusca = `%${textoBusca}%`;
  const filtro = textoBusca
    ? and(
        eq(vinculos.empresaId, empresa.id),
        or(
          ilike(pessoas.nomeRazaoSocial, termoBusca),
          ilike(prestadores.matricula, termoBusca),
          ilike(vinculos.numeroContrato, termoBusca),
          ilike(termos.numero, termoBusca),
          ilike(metas.descricao, termoBusca),
          ilike(atividades.descricao, termoBusca),
          ilike(lotacoes.descricao, termoBusca),
        ),
      )
    : eq(vinculos.empresaId, empresa.id);

  const [lista, prestadoresAtivos, instrumentos, atividadesAtivas, lotacoesAtivas, totais] =
    await Promise.all([
      db
        .select({
          id: vinculos.id,
          prestadorId: vinculos.prestadorId,
          termoId: vinculos.termoId,
          metaId: vinculos.metaId,
          atividadeId: vinculos.atividadeId,
          lotacaoId: vinculos.lotacaoId,
          numeroContrato: vinculos.numeroContrato,
          inicio: vinculos.inicio,
          fim: vinculos.fim,
          valorRetribuicao: vinculos.valorRetribuicao,
          cargaHoraria: vinculos.cargaHoraria,
          descontaInss: vinculos.descontaInss,
          descontaIrrf: vinculos.descontaIrrf,
          ativo: vinculos.ativo,
          prestadorNome: pessoas.nomeRazaoSocial,
          matricula: prestadores.matricula,
          termoNumero: termos.numero,
          metaCodigo: metas.codigo,
          metaDescricao: metas.descricao,
          atividadeDescricao: atividades.descricao,
          lotacaoDescricao: lotacoes.descricao,
        })
        .from(vinculos)
        .innerJoin(
          prestadores,
          and(
            eq(prestadores.id, vinculos.prestadorId),
            eq(prestadores.empresaId, vinculos.empresaId),
          ),
        )
        .innerJoin(pessoas, eq(pessoas.id, prestadores.pessoaId))
        .innerJoin(
          termos,
          and(eq(termos.id, vinculos.termoId), eq(termos.empresaId, vinculos.empresaId)),
        )
        .innerJoin(
          metas,
          and(eq(metas.id, vinculos.metaId), eq(metas.termoId, vinculos.termoId)),
        )
        .leftJoin(atividades, eq(atividades.id, vinculos.atividadeId))
        .leftJoin(lotacoes, eq(lotacoes.id, vinculos.lotacaoId))
        .where(filtro)
        .orderBy(desc(vinculos.ativo), asc(pessoas.nomeRazaoSocial), desc(vinculos.inicio))
        .limit(300),
      db
        .select({
          id: prestadores.id,
          nome: pessoas.nomeRazaoSocial,
          matricula: prestadores.matricula,
        })
        .from(prestadores)
        .innerJoin(pessoas, eq(pessoas.id, prestadores.pessoaId))
        .where(
          and(
            eq(prestadores.empresaId, empresa.id),
            eq(prestadores.ativo, true),
            eq(pessoas.ativo, true),
          ),
        )
        .orderBy(asc(pessoas.nomeRazaoSocial))
        .limit(500),
      db
        .select({
          metaId: metas.id,
          metaCodigo: metas.codigo,
          metaDescricao: metas.descricao,
          termoId: termos.id,
          termoNumero: termos.numero,
          termoDescricao: termos.descricao,
        })
        .from(metas)
        .innerJoin(termos, eq(termos.id, metas.termoId))
        .where(
          and(
            eq(termos.empresaId, empresa.id),
            eq(termos.ativo, true),
            eq(metas.ativo, true),
          ),
        )
        .orderBy(asc(termos.numero), asc(metas.codigo))
        .limit(500),
      db
        .select({ id: atividades.id, codigo: atividades.codigo, descricao: atividades.descricao })
        .from(atividades)
        .where(and(eq(atividades.empresaId, empresa.id), eq(atividades.ativo, true)))
        .orderBy(asc(atividades.descricao))
        .limit(500),
      db
        .select({ id: lotacoes.id, codigo: lotacoes.codigo, descricao: lotacoes.descricao })
        .from(lotacoes)
        .where(and(eq(lotacoes.empresaId, empresa.id), eq(lotacoes.ativo, true)))
        .orderBy(asc(lotacoes.descricao))
        .limit(500),
      db.execute<{
        total: number;
        ativos: number;
        sem_inss: number;
        encerrando: number;
      }>(sql`
        select
          count(*)::int total,
          (count(*) filter (where ativo))::int ativos,
          (count(*) filter (where ativo and not desconta_inss))::int sem_inss,
          (count(*) filter (
            where ativo and fim is not null and fim between current_date and current_date + 30
          ))::int encerrando
        from prestador_vinculo
        where empresa_id = ${empresa.id}
      `),
    ]);

  return {
    empresa,
    vinculos: lista,
    prestadores: prestadoresAtivos,
    instrumentos,
    atividades: atividadesAtivas,
    lotacoes: lotacoesAtivas,
    totais: totais.rows[0],
  };
}
