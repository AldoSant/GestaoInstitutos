import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "./index";
import {
  atividades,
  chavesLegado,
  dependentes,
  empresas,
  lotacoes,
  pessoas,
  pessoasContasBancarias,
  pessoasEnderecos,
  prestadores,
} from "./schema";

export async function resolverEmpresaAtiva() {
  const registros = await getDb()
    .select({
      id: empresas.id,
      cnpj: empresas.cnpj,
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

export async function carregarCadastrosBase(
  busca = "",
  opcoes: {
    situacao?: "ativas" | "inativas" | "todas";
    pagina?: number;
    porPagina?: number;
  } = {},
) {
  const db = getDb();
  const empresa = await resolverEmpresaAtiva();
  const textoBusca = busca.trim();
  const termo = `%${textoBusca}%`;
  const digitos = textoBusca.replace(/\D/g, "");
  const situacao = opcoes.situacao ?? "ativas";
  const pagina = Math.max(1, Math.trunc(opcoes.pagina ?? 1));
  const porPagina = Math.min(100, Math.max(10, Math.trunc(opcoes.porPagina ?? 25)));
  const filtroSituacaoPessoa =
    situacao === "todas"
      ? undefined
      : eq(pessoas.ativo, situacao === "ativas");
  const filtroSituacaoAtividade =
    situacao === "todas"
      ? undefined
      : eq(atividades.ativo, situacao === "ativas");
  const filtroSituacaoLotacao =
    situacao === "todas"
      ? undefined
      : eq(lotacoes.ativo, situacao === "ativas");

  const filtroPessoa = and(
    eq(pessoas.empresaId, empresa.id),
    filtroSituacaoPessoa,
    textoBusca
      ? or(
          ilike(pessoas.nomeRazaoSocial, termo),
          ...(digitos
            ? [ilike(pessoas.cpf, `%${digitos}%`), ilike(pessoas.cnpj, `%${digitos}%`)]
            : []),
        )
      : undefined,
  );
  const filtroAtividade = and(
    eq(atividades.empresaId, empresa.id),
    filtroSituacaoAtividade,
    textoBusca
      ? or(ilike(atividades.codigo, termo), ilike(atividades.descricao, termo))
      : undefined,
  );
  const filtroLotacao = and(
    eq(lotacoes.empresaId, empresa.id),
    filtroSituacaoLotacao,
    textoBusca
      ? or(ilike(lotacoes.codigo, termo), ilike(lotacoes.descricao, termo))
      : undefined,
  );

  const [listaPessoas, listaAtividades, listaLotacoes, totais, totalPessoas] =
    await Promise.all([
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
      .limit(porPagina)
      .offset((pagina - 1) * porPagina),
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
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(pessoas)
      .where(filtroPessoa),
  ]);

  return {
    empresa,
    pessoas: listaPessoas,
    atividades: listaAtividades,
    lotacoes: listaLotacoes,
    totais: totais.rows[0],
    paginacaoPessoas: {
      pagina,
      porPagina,
      total: totalPessoas[0]?.total ?? 0,
      totalPaginas: Math.max(
        1,
        Math.ceil((totalPessoas[0]?.total ?? 0) / porPagina),
      ),
    },
    filtros: { busca: textoBusca, situacao },
  };
}

export async function carregarFichaPessoa(pessoaId: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      pessoaId,
    )
  ) {
    throw new Error("Pessoa inválida.");
  }
  const db = getDb();
  const empresa = await resolverEmpresaAtiva();
  const [registros, listaDependentes] = await Promise.all([
    db
      .select({
        pessoa: {
          id: pessoas.id,
          tipo: pessoas.tipo,
          nome: pessoas.nomeRazaoSocial,
          cpf: pessoas.cpf,
          cnpj: pessoas.cnpj,
          nascimento: pessoas.nascimento,
          sexo: pessoas.sexo,
          rg: pessoas.rg,
          rgOrgaoEmissor: pessoas.rgOrgaoEmissor,
          rgUf: pessoas.rgUf,
          inscricaoInss: pessoas.inscricaoInss,
          email: pessoas.email,
          telefone: pessoas.telefone,
          celular: pessoas.celular,
          papelPrestador: pessoas.papelPrestador,
          papelParceiro: pessoas.papelParceiro,
          papelFornecedor: pessoas.papelFornecedor,
          ativo: pessoas.ativo,
        },
        endereco: {
          id: pessoasEnderecos.id,
          cep: pessoasEnderecos.cep,
          logradouro: pessoasEnderecos.logradouro,
          numero: pessoasEnderecos.numero,
          bairro: pessoasEnderecos.bairro,
          municipio: pessoasEnderecos.municipio,
          complemento: pessoasEnderecos.complemento,
        },
        conta: {
          id: pessoasContasBancarias.id,
          agencia: pessoasContasBancarias.agencia,
          numero: pessoasContasBancarias.numero,
          digito: pessoasContasBancarias.digito,
          variacao: pessoasContasBancarias.variacao,
          tipo: pessoasContasBancarias.tipo,
        },
        prestador: {
          id: prestadores.id,
          matricula: prestadores.matricula,
          nitPisPasep: prestadores.nitPisPasep,
          categoriaContribuinte: prestadores.categoriaContribuinte,
          ativo: prestadores.ativo,
        },
        vinculosAtivos: sql<number>`(
          select count(*)::int
            from prestador_vinculo vinculo
           where vinculo.empresa_id = ${empresa.id}
             and vinculo.prestador_id = ${prestadores.id}
             and vinculo.ativo
        )`,
      })
      .from(pessoas)
      .leftJoin(
        pessoasEnderecos,
        and(
          eq(pessoasEnderecos.empresaId, empresa.id),
          eq(pessoasEnderecos.pessoaId, pessoas.id),
        ),
      )
      .leftJoin(
        pessoasContasBancarias,
        and(
          eq(pessoasContasBancarias.empresaId, empresa.id),
          eq(pessoasContasBancarias.pessoaId, pessoas.id),
        ),
      )
      .leftJoin(
        prestadores,
        and(
          eq(prestadores.empresaId, empresa.id),
          eq(prestadores.pessoaId, pessoas.id),
        ),
      )
      .where(and(eq(pessoas.empresaId, empresa.id), eq(pessoas.id, pessoaId)))
      .limit(1),
    db
      .select({
        id: dependentes.id,
        nome: dependentes.nome,
        cpf: dependentes.cpf,
        nascimento: dependentes.nascimento,
        parentesco: dependentes.parentesco,
        estudante: dependentes.estudante,
        ativo: dependentes.ativo,
      })
      .from(dependentes)
      .where(
        and(
          eq(dependentes.empresaId, empresa.id),
          eq(dependentes.pessoaId, pessoaId),
        ),
      )
      .orderBy(asc(dependentes.nome)),
  ]);
  const registro = registros[0];
  if (!registro) throw new Error("Pessoa não encontrada.");
  return {
    empresa,
    ...registro,
    dependentes: listaDependentes,
    prontidao: {
      documento: Boolean(registro.pessoa.cpf || registro.pessoa.cnpj),
      contato: Boolean(
        registro.pessoa.email ||
          registro.pessoa.celular ||
          registro.pessoa.telefone,
      ),
      endereco: Boolean(registro.endereco?.id),
      contaBancaria: Boolean(
        registro.conta?.id &&
          registro.conta.agencia &&
          registro.conta.numero &&
          ["CORRENTE", "POUPANCA"].includes(registro.conta.tipo ?? ""),
      ),
      prestador: Boolean(registro.prestador?.id && registro.prestador.ativo),
      vinculo: registro.vinculosAtivos > 0,
    },
  };
}
