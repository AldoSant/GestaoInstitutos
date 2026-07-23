import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "./index";
import { chavesLegado, pessoas, prestadores } from "./schema";
import { resolverEmpresaAtiva } from "./cadastros";

export async function carregarPrestadores(busca = "") {
  const db = getDb();
  const empresa = await resolverEmpresaAtiva();
  const textoBusca = busca.trim();
  const termo = `%${textoBusca}%`;
  const digitos = textoBusca.replace(/\D/g, "");
  const filtro = textoBusca
    ? and(
        eq(prestadores.empresaId, empresa.id),
        or(
          ilike(prestadores.matricula, termo),
          ilike(prestadores.nitPisPasep, termo),
          ilike(pessoas.nomeRazaoSocial, termo),
          ...(digitos
            ? [ilike(pessoas.cpf, `%${digitos}%`), ilike(pessoas.cnpj, `%${digitos}%`)]
            : []),
        ),
      )
    : eq(prestadores.empresaId, empresa.id);

  const [lista, opcoesPessoas, totais] = await Promise.all([
    db
      .select({
        id: prestadores.id,
        pessoaId: prestadores.pessoaId,
        matricula: prestadores.matricula,
        nitPisPasep: prestadores.nitPisPasep,
        categoriaContribuinte: prestadores.categoriaContribuinte,
        isentoInss: prestadores.isentoInss,
        ativo: prestadores.ativo,
        nome: pessoas.nomeRazaoSocial,
        tipo: pessoas.tipo,
        cpf: pessoas.cpf,
        cnpj: pessoas.cnpj,
        pessoaLegacyId: chavesLegado.legacyId,
        atividadeAtual: sql<string | null>`(
          select coalesce(a.descricao, pv.atividade)
            from prestador_vinculo pv
            left join atividade a on a.id = pv.atividade_id
           where pv.prestador_id = ${prestadores.id}
             and pv.empresa_id = ${empresa.id}
             and pv.ativo
           order by pv.inicio desc, pv.criado_em desc
           limit 1
        )`,
        retribuicaoAtual: sql<string | null>`(
          select pv.valor_retribuicao::text
            from prestador_vinculo pv
           where pv.prestador_id = ${prestadores.id}
             and pv.empresa_id = ${empresa.id}
             and pv.ativo
           order by pv.inicio desc, pv.criado_em desc
           limit 1
        )`,
        totalVinculos: sql<number>`(
          select count(*)::int
            from prestador_vinculo pv
           where pv.prestador_id = ${prestadores.id}
             and pv.empresa_id = ${empresa.id}
        )`,
      })
      .from(prestadores)
      .innerJoin(
        pessoas,
        and(
          eq(pessoas.id, prestadores.pessoaId),
          eq(pessoas.empresaId, prestadores.empresaId),
        ),
      )
      .leftJoin(
        chavesLegado,
        and(
          eq(chavesLegado.empresaId, empresa.id),
          eq(chavesLegado.origem, "GIW"),
          eq(chavesLegado.entidade, "pessoas"),
          eq(chavesLegado.destinoTabela, "pessoa"),
          eq(chavesLegado.destinoId, pessoas.id),
        ),
      )
      .where(filtro)
      .orderBy(asc(pessoas.nomeRazaoSocial))
      .limit(200),
    db
      .select({
        id: pessoas.id,
        nome: pessoas.nomeRazaoSocial,
        tipo: pessoas.tipo,
        cpf: pessoas.cpf,
        cnpj: pessoas.cnpj,
        ativo: pessoas.ativo,
        prestadorId: prestadores.id,
      })
      .from(pessoas)
      .leftJoin(
        prestadores,
        and(
          eq(prestadores.pessoaId, pessoas.id),
          eq(prestadores.empresaId, pessoas.empresaId),
        ),
      )
      .where(eq(pessoas.empresaId, empresa.id))
      .orderBy(asc(pessoas.nomeRazaoSocial))
      .limit(500),
    db.execute<{
      total: number;
      ativos: number;
      isentos_inss: number;
      sem_vinculo: number;
    }>(sql`
      select
        count(*)::int total,
        (count(*) filter (where p.ativo))::int ativos,
        (count(*) filter (where p.ativo and p.isento_inss))::int isentos_inss,
        (count(*) filter (
          where p.ativo and not exists (
            select 1 from prestador_vinculo pv
             where pv.prestador_id = p.id and pv.empresa_id = ${empresa.id} and pv.ativo
          )
        ))::int sem_vinculo
      from prestador p
      where p.empresa_id = ${empresa.id}
    `),
  ]);

  return {
    empresa,
    prestadores: lista,
    pessoas: opcoesPessoas,
    totais: totais.rows[0],
  };
}
