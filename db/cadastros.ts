import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "./index";
import {
  atividades,
  chavesLegado,
  empresas,
  lotacoes,
  pessoas,
} from "./schema";

export async function resolverEmpresaAtiva() {
  const registros = await getDb()
    .select({
      id: empresas.id,
      razaoSocial: empresas.razaoSocial,
      nomeFantasia: empresas.nomeFantasia,
    })
    .from(empresas)
    .where(eq(empresas.ativo, true))
    .orderBy(asc(empresas.criadoEm))
    .limit(2);

  if (registros.length === 0) {
    throw new Error("Nenhuma empresa ativa foi configurada.");
  }
  if (registros.length > 1) {
    throw new Error(
      "Há mais de uma empresa ativa. O seletor de organização ainda não foi habilitado.",
    );
  }
  return registros[0];
}

export async function carregarCadastrosBase(busca = "") {
  const db = getDb();
  const empresa = await resolverEmpresaAtiva();
  const textoBusca = busca.trim();
  const termo = `%${textoBusca}%`;
  const digitos = textoBusca.replace(/\D/g, "");

  const filtroPessoa = textoBusca
    ? and(
        eq(pessoas.empresaId, empresa.id),
        or(
          ilike(pessoas.nomeRazaoSocial, termo),
          ...(digitos
            ? [ilike(pessoas.cpf, `%${digitos}%`), ilike(pessoas.cnpj, `%${digitos}%`)]
            : []),
        ),
      )
    : eq(pessoas.empresaId, empresa.id);
  const filtroAtividade = textoBusca
    ? and(
        eq(atividades.empresaId, empresa.id),
        or(ilike(atividades.codigo, termo), ilike(atividades.descricao, termo)),
      )
    : eq(atividades.empresaId, empresa.id);
  const filtroLotacao = textoBusca
    ? and(
        eq(lotacoes.empresaId, empresa.id),
        or(ilike(lotacoes.codigo, termo), ilike(lotacoes.descricao, termo)),
      )
    : eq(lotacoes.empresaId, empresa.id);

  const [listaPessoas, listaAtividades, listaLotacoes, totais] = await Promise.all([
    db
      .select({
        id: pessoas.id,
        tipo: pessoas.tipo,
        nome: pessoas.nomeRazaoSocial,
        cpf: pessoas.cpf,
        cnpj: pessoas.cnpj,
        nascimento: pessoas.nascimento,
        email: pessoas.email,
        telefone: pessoas.telefone,
        celular: pessoas.celular,
        inscricaoInss: pessoas.inscricaoInss,
        papelPrestador: pessoas.papelPrestador,
        dependentes: sql<number>`(
          select count(*)::int
            from dependente d
           where d.pessoa_id = ${pessoas.id} and d.ativo
        )`,
        temEndereco: sql<boolean>`exists(
          select 1 from pessoa_endereco pe where pe.pessoa_id = ${pessoas.id}
        )`,
        temContaBancaria: sql<boolean>`exists(
          select 1 from pessoa_conta_bancaria pcb where pcb.pessoa_id = ${pessoas.id}
        )`,
        ativo: pessoas.ativo,
        atualizadoEm: pessoas.atualizadoEm,
        legacyId: chavesLegado.legacyId,
      })
      .from(pessoas)
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
      .where(filtroPessoa)
      .orderBy(asc(pessoas.nomeRazaoSocial))
      .limit(200),
    db
      .select({
        id: atividades.id,
        codigo: atividades.codigo,
        descricao: atividades.descricao,
        cargaHoraria: atividades.cargaHoraria,
        valor: atividades.valor,
        ativo: atividades.ativo,
        legacyId: chavesLegado.legacyId,
      })
      .from(atividades)
      .leftJoin(
        chavesLegado,
        and(
          eq(chavesLegado.empresaId, empresa.id),
          eq(chavesLegado.origem, "GIW"),
          eq(chavesLegado.entidade, "atividades"),
          eq(chavesLegado.destinoTabela, "atividade"),
          eq(chavesLegado.destinoId, atividades.id),
        ),
      )
      .where(filtroAtividade)
      .orderBy(asc(atividades.descricao))
      .limit(200),
    db
      .select({
        id: lotacoes.id,
        codigo: lotacoes.codigo,
        descricao: lotacoes.descricao,
        ativo: lotacoes.ativo,
        legacyId: chavesLegado.legacyId,
      })
      .from(lotacoes)
      .leftJoin(
        chavesLegado,
        and(
          eq(chavesLegado.empresaId, empresa.id),
          eq(chavesLegado.origem, "GIW"),
          eq(chavesLegado.entidade, "lotacoes"),
          eq(chavesLegado.destinoTabela, "lotacao"),
          eq(chavesLegado.destinoId, lotacoes.id),
        ),
      )
      .where(filtroLotacao)
      .orderBy(asc(lotacoes.descricao))
      .limit(200),
    db.execute<{
      pessoas_total: number;
      pessoas_ativas: number;
      atividades_total: number;
      atividades_ativas: number;
      lotacoes_total: number;
      lotacoes_ativas: number;
    }>(sql`
      select
        (select count(*)::int from pessoa where empresa_id = ${empresa.id}) pessoas_total,
        (select count(*)::int from pessoa where empresa_id = ${empresa.id} and ativo) pessoas_ativas,
        (select count(*)::int from atividade where empresa_id = ${empresa.id}) atividades_total,
        (select count(*)::int from atividade where empresa_id = ${empresa.id} and ativo) atividades_ativas,
        (select count(*)::int from lotacao where empresa_id = ${empresa.id}) lotacoes_total,
        (select count(*)::int from lotacao where empresa_id = ${empresa.id} and ativo) lotacoes_ativas
    `),
  ]);

  return {
    empresa,
    pessoas: listaPessoas,
    atividades: listaAtividades,
    lotacoes: listaLotacoes,
    totais: totais.rows[0],
  };
}
