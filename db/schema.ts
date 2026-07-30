import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const tipoPessoa = pgEnum("tipo_pessoa", ["FISICA", "JURIDICA"]);
export const perfilUsuario = pgEnum("perfil_usuario", [
  "ADMINISTRADOR",
  "OPERADOR",
  "CONSULTA",
]);
export const statusFolha = pgEnum("status_folha", [
  "RASCUNHO",
  "PROCESSANDO",
  "ABERTA",
  "FECHADA",
  "CANCELADA",
]);
export const statusObrigacao = pgEnum("status_obrigacao", [
  "RASCUNHO",
  "APURADA",
  "BLOQUEADA",
  "EMITIDA",
  "CANCELADA",
]);
export const statusTarefa = pgEnum("status_tarefa", [
  "PENDENTE",
  "EXECUTANDO",
  "CONCLUIDA",
  "FALHA",
  "CANCELADA",
]);

const auditoriaBasica = {
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const empresas = pgTable(
  "empresa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cnpj: varchar("cnpj", { length: 14 }).notNull(),
    razaoSocial: varchar("razao_social", { length: 180 }).notNull(),
    nomeFantasia: varchar("nome_fantasia", { length: 180 }),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_empresa_cnpj").on(table.cnpj),
    check("ck_empresa_cnpj_formato", sql`${table.cnpj} ~ '^[0-9]{14}$'`),
  ],
);

export const usuarios = pgTable(
  "usuario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cpf: varchar("cpf", { length: 11 }).notNull(),
    nome: varchar("nome", { length: 160 }).notNull(),
    email: varchar("email", { length: 180 }).notNull(),
    senhaHash: text("senha_hash").notNull(),
    ativo: boolean("ativo").notNull().default(true),
    ultimoLoginEm: timestamp("ultimo_login_em", { withTimezone: true }),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_usuario_cpf").on(table.cpf),
    uniqueIndex("uq_usuario_email").on(table.email),
    check("ck_usuario_cpf_formato", sql`${table.cpf} ~ '^[0-9]{11}$'`),
  ],
);

export const usuariosEmpresas = pgTable(
  "usuario_empresa",
  {
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    perfil: perfilUsuario("perfil").notNull(),
    ativo: boolean("ativo").notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.usuarioId, table.empresaId] })],
);

export const pessoas = pgTable(
  "pessoa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    tipo: tipoPessoa("tipo").notNull(),
    nomeRazaoSocial: varchar("nome_razao_social", { length: 180 }).notNull(),
    cpf: varchar("cpf", { length: 11 }),
    cnpj: varchar("cnpj", { length: 14 }),
    sexo: varchar("sexo", { length: 10 }),
    nascimento: date("nascimento"),
    rg: varchar("rg", { length: 40 }),
    rgOrgaoEmissor: varchar("rg_orgao_emissor", { length: 10 }),
    rgUf: varchar("rg_uf", { length: 2 }),
    rgEmissao: date("rg_emissao"),
    estadoCivil: varchar("estado_civil", { length: 40 }),
    naturalidade: varchar("naturalidade", { length: 120 }),
    inscricaoInss: varchar("inscricao_inss", { length: 30 }),
    conselhoTipo: varchar("conselho_tipo", { length: 20 }),
    conselhoNumero: varchar("conselho_numero", { length: 20 }),
    aposentado: boolean("aposentado").notNull().default(false),
    cnh: varchar("cnh", { length: 20 }),
    cnhCategoria: varchar("cnh_categoria", { length: 2 }),
    cnhValidade: date("cnh_validade"),
    nomeFantasia: varchar("nome_fantasia", { length: 180 }),
    representanteLegal: varchar("representante_legal", { length: 180 }),
    inscricaoMunicipal: varchar("inscricao_municipal", { length: 30 }),
    inscricaoEstadual: varchar("inscricao_estadual", { length: 30 }),
    papelPrestador: boolean("papel_prestador").notNull().default(false),
    papelParceiro: boolean("papel_parceiro").notNull().default(false),
    papelFornecedor: boolean("papel_fornecedor").notNull().default(false),
    email: varchar("email", { length: 180 }),
    telefone: varchar("telefone", { length: 20 }),
    celular: varchar("celular", { length: 20 }),
    celularAlternativo: varchar("celular_alternativo", { length: 20 }),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_pessoa_empresa_cpf").on(table.empresaId, table.cpf),
    uniqueIndex("uq_pessoa_empresa_cnpj").on(table.empresaId, table.cnpj),
    uniqueIndex("uq_pessoa_empresa_id").on(table.empresaId, table.id),
    index("ix_pessoa_empresa_nome").on(table.empresaId, table.nomeRazaoSocial),
    check(
      "ck_pessoa_cpf_formato",
      sql`${table.cpf} is null or ${table.cpf} ~ '^[0-9]{11}$'`,
    ),
    check(
      "ck_pessoa_cnpj_formato",
      sql`${table.cnpj} is null or ${table.cnpj} ~ '^[0-9]{14}$'`,
    ),
    check(
      "ck_pessoa_documento_exclusivo",
      sql`not (${table.cpf} is not null and ${table.cnpj} is not null)`,
    ),
    check(
      "ck_pessoa_tipo_documento",
      sql`(${table.tipo} = 'FISICA' and ${table.cnpj} is null)
          or (${table.tipo} = 'JURIDICA' and ${table.cpf} is null)`,
    ),
  ],
);

export const pessoasEnderecos = pgTable(
  "pessoa_endereco",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => pessoas.id),
    cep: varchar("cep", { length: 12 }),
    logradouro: varchar("logradouro", { length: 120 }),
    numero: varchar("numero", { length: 20 }),
    bairro: varchar("bairro", { length: 100 }),
    municipio: varchar("municipio", { length: 120 }),
    municipioLegacyId: varchar("municipio_legacy_id", { length: 60 }),
    complemento: varchar("complemento", { length: 200 }),
    referencia: varchar("referencia", { length: 200 }),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_pessoa_endereco_pessoa").on(table.empresaId, table.pessoaId),
    foreignKey({
      columns: [table.empresaId, table.pessoaId],
      foreignColumns: [pessoas.empresaId, pessoas.id],
      name: "fk_pessoa_endereco_empresa_pessoa",
    }),
  ],
);

export const pessoasContasBancarias = pgTable(
  "pessoa_conta_bancaria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => pessoas.id),
    agenciaLegacyId: varchar("agencia_legacy_id", { length: 60 }),
    agencia: varchar("agencia", { length: 120 }),
    numero: varchar("numero", { length: 20 }),
    digito: varchar("digito", { length: 5 }),
    variacao: varchar("variacao", { length: 5 }),
    tipo: varchar("tipo", { length: 20 }),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_pessoa_conta_pessoa").on(table.empresaId, table.pessoaId),
    foreignKey({
      columns: [table.empresaId, table.pessoaId],
      foreignColumns: [pessoas.empresaId, pessoas.id],
      name: "fk_pessoa_conta_empresa_pessoa",
    }),
    check(
      "ck_pessoa_conta_tipo",
      sql`${table.tipo} is null or ${table.tipo} in ('CORRENTE', 'POUPANCA')`,
    ),
  ],
);

export const dependentes = pgTable(
  "dependente",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => pessoas.id),
    origemLegacyKey: varchar("origem_legacy_key", { length: 180 }).notNull(),
    nome: varchar("nome", { length: 180 }).notNull(),
    nascimento: date("nascimento"),
    parentesco: varchar("parentesco", { length: 80 }),
    estudante: boolean("estudante").notNull().default(false),
    cpf: varchar("cpf", { length: 11 }),
    baixaSalarioFamilia: date("baixa_salario_familia"),
    baixaIrrf: date("baixa_irrf"),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_dependente_pessoa_origem").on(
      table.pessoaId,
      table.origemLegacyKey,
    ),
    uniqueIndex("uq_dependente_pessoa_cpf").on(table.pessoaId, table.cpf),
    index("ix_dependente_empresa_nome").on(table.empresaId, table.nome),
    foreignKey({
      columns: [table.empresaId, table.pessoaId],
      foreignColumns: [pessoas.empresaId, pessoas.id],
      name: "fk_dependente_empresa_pessoa",
    }),
    check(
      "ck_dependente_cpf",
      sql`${table.cpf} is null or ${table.cpf} ~ '^[0-9]{11}$'`,
    ),
  ],
);

export const prestadores = pgTable(
  "prestador",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => pessoas.id),
    matricula: varchar("matricula", { length: 40 }).notNull(),
    nitPisPasep: varchar("nit_pis_pasep", { length: 30 }),
    categoriaContribuinte: varchar("categoria_contribuinte", { length: 30 }),
    isentoInss: boolean("isento_inss").notNull().default(false),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_prestador_empresa_id").on(table.empresaId, table.id),
    uniqueIndex("uq_prestador_empresa_pessoa").on(table.empresaId, table.pessoaId),
    uniqueIndex("uq_prestador_empresa_matricula").on(
      table.empresaId,
      table.matricula,
    ),
    foreignKey({
      columns: [table.empresaId, table.pessoaId],
      foreignColumns: [pessoas.empresaId, pessoas.id],
      name: "fk_prestador_empresa_pessoa",
    }),
  ],
);

export const contribuicoesOutrasFontes = pgTable(
  "contribuicao_outra_fonte",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    prestadorId: uuid("prestador_id")
      .notNull()
      .references(() => prestadores.id),
    competencia: date("competencia").notNull(),
    fontePagadora: varchar("fonte_pagadora", { length: 180 }).notNull(),
    documentoFonte: varchar("documento_fonte", { length: 14 }).notNull(),
    remuneracao: numeric("remuneracao", { precision: 18, scale: 2 }).notNull(),
    baseContribuicao: numeric("base_contribuicao", {
      precision: 18,
      scale: 2,
    }).notNull(),
    valorContribuicao: numeric("valor_contribuicao", {
      precision: 18,
      scale: 2,
    }).notNull(),
    documentoReferencia: varchar("documento_referencia", {
      length: 160,
    }).notNull(),
    comprovanteVerificado: boolean("comprovante_verificado")
      .notNull()
      .default(false),
    observacao: text("observacao"),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_outra_fonte_empresa_id").on(table.empresaId, table.id),
    uniqueIndex("uq_outra_fonte_comprovante").on(
      table.prestadorId,
      table.competencia,
      table.documentoFonte,
      table.documentoReferencia,
    ),
    index("ix_outra_fonte_empresa_competencia").on(
      table.empresaId,
      table.competencia,
    ),
    foreignKey({
      columns: [table.empresaId, table.prestadorId],
      foreignColumns: [prestadores.empresaId, prestadores.id],
      name: "fk_outra_fonte_empresa_prestador",
    }),
    check(
      "ck_outra_fonte_competencia_mes",
      sql`${table.competencia} = date_trunc('month', ${table.competencia})::date`,
    ),
    check(
      "ck_outra_fonte_documento",
      sql`${table.documentoFonte} ~ '^([0-9]{11}|[0-9]{14})$'`,
    ),
    check(
      "ck_outra_fonte_valores",
      sql`${table.remuneracao} >= 0
          and ${table.baseContribuicao} >= 0
          and ${table.valorContribuicao} >= 0
          and ${table.valorContribuicao} <= ${table.baseContribuicao}`,
    ),
  ],
);

export const atividades = pgTable(
  "atividade",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    codigo: varchar("codigo", { length: 40 }).notNull(),
    descricao: varchar("descricao", { length: 180 }).notNull(),
    cargaHoraria: numeric("carga_horaria", { precision: 10, scale: 2 }),
    valor: numeric("valor", { precision: 18, scale: 2 }),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_atividade_empresa_id").on(table.empresaId, table.id),
    uniqueIndex("uq_atividade_empresa_codigo").on(table.empresaId, table.codigo),
    index("ix_atividade_empresa_descricao").on(table.empresaId, table.descricao),
    check(
      "ck_atividade_carga_horaria",
      sql`${table.cargaHoraria} is null or ${table.cargaHoraria} >= 0`,
    ),
    check(
      "ck_atividade_valor",
      sql`${table.valor} is null or ${table.valor} >= 0`,
    ),
  ],
);

export const lotacoes = pgTable(
  "lotacao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    codigo: varchar("codigo", { length: 40 }).notNull(),
    descricao: varchar("descricao", { length: 160 }).notNull(),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_lotacao_empresa_id").on(table.empresaId, table.id),
    uniqueIndex("uq_lotacao_empresa_codigo").on(table.empresaId, table.codigo),
    index("ix_lotacao_empresa_descricao").on(table.empresaId, table.descricao),
  ],
);

export const termos = pgTable(
  "termo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    numero: varchar("numero", { length: 60 }).notNull(),
    descricao: varchar("descricao", { length: 255 }).notNull(),
    modalidade: varchar("modalidade", { length: 80 }).notNull(),
    inicio: date("inicio").notNull(),
    fim: date("fim"),
    valorGlobal: numeric("valor_global", { precision: 18, scale: 2 }).notNull(),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_termo_empresa_id").on(table.empresaId, table.id),
    uniqueIndex("uq_termo_empresa_numero_inicio").on(
      table.empresaId,
      table.numero,
      table.inicio,
    ),
    check("ck_termo_vigencia", sql`${table.fim} is null or ${table.fim} >= ${table.inicio}`),
    check("ck_termo_valor_global", sql`${table.valorGlobal} >= 0`),
  ],
);

export const metas = pgTable(
  "termo_meta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    termoId: uuid("termo_id")
      .notNull()
      .references(() => termos.id),
    codigo: varchar("codigo", { length: 40 }).notNull(),
    descricao: varchar("descricao", { length: 255 }).notNull(),
    tipoCalculo: varchar("tipo_calculo", { length: 40 }),
    valorPrevisto: numeric("valor_previsto", { precision: 18, scale: 2 }),
    ativo: boolean("ativo").notNull().default(true),
  },
  (table) => [
    uniqueIndex("uq_meta_termo_id").on(table.termoId, table.id),
    uniqueIndex("uq_meta_termo_codigo").on(table.termoId, table.codigo),
    check(
      "ck_meta_valor_previsto",
      sql`${table.valorPrevisto} is null or ${table.valorPrevisto} >= 0`,
    ),
  ],
);

export const vinculos = pgTable(
  "prestador_vinculo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    prestadorId: uuid("prestador_id")
      .notNull()
      .references(() => prestadores.id),
    termoId: uuid("termo_id")
      .notNull()
      .references(() => termos.id),
    metaId: uuid("meta_id")
      .notNull()
      .references(() => metas.id),
    numeroContrato: varchar("numero_contrato", { length: 60 }),
    atividadeId: uuid("atividade_id").references(() => atividades.id),
    lotacaoId: uuid("lotacao_id").references(() => lotacoes.id),
    atividade: varchar("atividade", { length: 180 }).notNull(),
    lotacao: varchar("lotacao", { length: 160 }),
    inicio: date("inicio").notNull(),
    fim: date("fim"),
    valorRetribuicao: numeric("valor_retribuicao", { precision: 18, scale: 2 })
      .notNull(),
    cargaHoraria: numeric("carga_horaria", { precision: 10, scale: 2 }),
    exigeMedicaoMensal: boolean("exige_medicao_mensal").notNull().default(false),
    descontaInss: boolean("desconta_inss").notNull().default(true),
    descontaIrrf: boolean("desconta_irrf").notNull().default(true),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoriaBasica,
  },
  (table) => [
    index("ix_vinculo_empresa_ativo").on(table.empresaId, table.ativo),
    uniqueIndex("uq_vinculo_empresa_id").on(table.empresaId, table.id),
    foreignKey({
      columns: [table.empresaId, table.prestadorId],
      foreignColumns: [prestadores.empresaId, prestadores.id],
      name: "fk_vinculo_empresa_prestador",
    }),
    foreignKey({
      columns: [table.empresaId, table.termoId],
      foreignColumns: [termos.empresaId, termos.id],
      name: "fk_vinculo_empresa_termo",
    }),
    foreignKey({
      columns: [table.termoId, table.metaId],
      foreignColumns: [metas.termoId, metas.id],
      name: "fk_vinculo_termo_meta",
    }),
    foreignKey({
      columns: [table.empresaId, table.atividadeId],
      foreignColumns: [atividades.empresaId, atividades.id],
      name: "fk_vinculo_empresa_atividade",
    }),
    foreignKey({
      columns: [table.empresaId, table.lotacaoId],
      foreignColumns: [lotacoes.empresaId, lotacoes.id],
      name: "fk_vinculo_empresa_lotacao",
    }),
    check(
      "ck_vinculo_vigencia",
      sql`${table.fim} is null or ${table.fim} >= ${table.inicio}`,
    ),
    check("ck_vinculo_valor_retribuicao", sql`${table.valorRetribuicao} >= 0`),
    check(
      "ck_vinculo_carga_horaria",
      sql`${table.cargaHoraria} is null or ${table.cargaHoraria} >= 0`,
    ),
  ],
);

export const medicoesMensais = pgTable(
  "medicao_mensal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    vinculoId: uuid("vinculo_id").notNull(),
    competencia: date("competencia").notNull(),
    tipo: varchar("tipo", { length: 20 }).notNull(),
    valorContratual: numeric("valor_contratual", {
      precision: 18,
      scale: 2,
    }).notNull(),
    percentual: numeric("percentual", { precision: 9, scale: 4 }),
    quantidade: numeric("quantidade", { precision: 18, scale: 4 }),
    valorUnitario: numeric("valor_unitario", { precision: 18, scale: 4 }),
    valorApurado: numeric("valor_apurado", { precision: 18, scale: 2 }).notNull(),
    evidenciaReferencia: varchar("evidencia_referencia", { length: 200 }).notNull(),
    evidenciaHash: varchar("evidencia_hash", { length: 64 }),
    conferente: varchar("conferente", { length: 160 }).notNull(),
    conferidaEm: timestamp("conferida_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    observacao: text("observacao").notNull().default(""),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_medicao_empresa_id").on(table.empresaId, table.id),
    uniqueIndex("uq_medicao_vinculo_competencia").on(
      table.vinculoId,
      table.competencia,
    ),
    index("ix_medicao_empresa_competencia").on(
      table.empresaId,
      table.competencia,
    ),
    foreignKey({
      columns: [table.empresaId],
      foreignColumns: [empresas.id],
      name: "fk_medicao_empresa",
    }),
    foreignKey({
      columns: [table.empresaId, table.vinculoId],
      foreignColumns: [vinculos.empresaId, vinculos.id],
      name: "fk_medicao_empresa_vinculo",
    }).onDelete("cascade"),
    check(
      "ck_medicao_competencia_mes",
      sql`${table.competencia} = date_trunc('month', ${table.competencia})::date`,
    ),
    check(
      "ck_medicao_tipo",
      sql`${table.tipo} in ('PERCENTUAL', 'QUANTIDADE', 'VALOR')`,
    ),
    check(
      "ck_medicao_valores_nao_negativos",
      sql`${table.valorContratual} >= 0 and ${table.valorApurado} >= 0
          and (${table.percentual} is null or ${table.percentual} >= 0)
          and (${table.quantidade} is null or ${table.quantidade} >= 0)
          and (${table.valorUnitario} is null or ${table.valorUnitario} >= 0)`,
    ),
    check(
      "ck_medicao_campos_tipo",
      sql`(
        ${table.tipo} = 'PERCENTUAL'
        and ${table.percentual} between 0 and 100
        and ${table.quantidade} is null and ${table.valorUnitario} is null
        and ${table.valorApurado} = round(${table.valorContratual} * ${table.percentual} / 100, 2)
      ) or (
        ${table.tipo} = 'QUANTIDADE'
        and ${table.percentual} is null
        and ${table.quantidade} is not null and ${table.valorUnitario} is not null
        and ${table.valorApurado} = round(${table.quantidade} * ${table.valorUnitario}, 2)
      ) or (
        ${table.tipo} = 'VALOR'
        and ${table.percentual} is null
        and ${table.quantidade} is null and ${table.valorUnitario} is null
      )`,
    ),
    check(
      "ck_medicao_evidencia",
      sql`length(btrim(${table.evidenciaReferencia})) between 3 and 200
          and length(btrim(${table.conferente})) between 3 and 160
          and (${table.evidenciaHash} is null or ${table.evidenciaHash} ~ '^[0-9a-f]{64}$')`,
    ),
  ],
);

export const eventos = pgTable(
  "evento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    codigo: varchar("codigo", { length: 40 }).notNull(),
    descricao: varchar("descricao", { length: 180 }).notNull(),
    natureza: varchar("natureza", { length: 20 }).notNull(),
    tipoCalculo: varchar("tipo_calculo", { length: 20 }).notNull().default("VALOR"),
    incideInss: boolean("incide_inss").notNull().default(false),
    incideIrrf: boolean("incide_irrf").notNull().default(false),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_evento_empresa_id").on(table.empresaId, table.id),
    uniqueIndex("uq_evento_empresa_codigo").on(table.empresaId, table.codigo),
    index("ix_evento_empresa_descricao").on(table.empresaId, table.descricao),
    check(
      "ck_evento_natureza",
      sql`${table.natureza} in ('PROVENTO', 'DESCONTO', 'INFORMATIVO')`,
    ),
    check(
      "ck_evento_tipo_calculo",
      sql`${table.tipoCalculo} in ('VALOR', 'PERCENTUAL')`,
    ),
    check(
      "ck_evento_informativo_sem_incidencia",
      sql`${table.natureza} <> 'INFORMATIVO' or (not ${table.incideInss} and not ${table.incideIrrf})`,
    ),
  ],
);

export const eventosRecorrentes = pgTable(
  "lancamento_evento_recorrente",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    vinculoId: uuid("vinculo_id")
      .notNull()
      .references(() => vinculos.id),
    eventoId: uuid("evento_id")
      .notNull()
      .references(() => eventos.id),
    valor: numeric("valor", { precision: 18, scale: 4 }).notNull(),
    inicioCompetencia: date("inicio_competencia").notNull(),
    fimCompetencia: date("fim_competencia"),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_evento_recorrente_inicio").on(
      table.vinculoId,
      table.eventoId,
      table.inicioCompetencia,
    ),
    index("ix_evento_recorrente_empresa_ativo").on(table.empresaId, table.ativo),
    foreignKey({
      columns: [table.empresaId, table.vinculoId],
      foreignColumns: [vinculos.empresaId, vinculos.id],
      name: "fk_evento_recorrente_empresa_vinculo",
    }),
    foreignKey({
      columns: [table.empresaId, table.eventoId],
      foreignColumns: [eventos.empresaId, eventos.id],
      name: "fk_evento_recorrente_empresa_evento",
    }),
    check("ck_evento_recorrente_valor", sql`${table.valor} >= 0`),
    check(
      "ck_evento_recorrente_inicio_mes",
      sql`${table.inicioCompetencia} = date_trunc('month', ${table.inicioCompetencia})::date`,
    ),
    check(
      "ck_evento_recorrente_fim_mes",
      sql`${table.fimCompetencia} is null or ${table.fimCompetencia} = date_trunc('month', ${table.fimCompetencia})::date`,
    ),
    check(
      "ck_evento_recorrente_vigencia",
      sql`${table.fimCompetencia} is null or ${table.fimCompetencia} >= ${table.inicioCompetencia}`,
    ),
  ],
);

export const regrasCalculo = pgTable(
  "regra_calculo_versao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").references(() => empresas.id),
    codigo: varchar("codigo", { length: 80 }).notNull(),
    versao: integer("versao").notNull(),
    inicioVigencia: date("inicio_vigencia").notNull(),
    fimVigencia: date("fim_vigencia"),
    parametros: jsonb("parametros").notNull(),
    fonteNormativa: text("fonte_normativa").notNull(),
    hashConteudo: varchar("hash_conteudo", { length: 64 }).notNull(),
    publicada: boolean("publicada").notNull().default(false),
    criadaEm: timestamp("criada_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_regra_empresa_codigo_versao")
      .on(table.empresaId, table.codigo, table.versao)
      .nullsNotDistinct(),
    check("ck_regra_versao", sql`${table.versao} > 0`),
    check(
      "ck_regra_hash",
      sql`${table.hashConteudo} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "ck_regra_vigencia",
      sql`${table.fimVigencia} is null or ${table.fimVigencia} >= ${table.inicioVigencia}`,
    ),
  ],
);

export const enquadramentosPrevidenciarios = pgTable(
  "enquadramento_previdenciario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    regime: varchar("regime", { length: 40 }).notNull(),
    inicioVigencia: date("inicio_vigencia").notNull(),
    fimVigencia: date("fim_vigencia").notNull(),
    aliquotaSeguradoNumerador: integer("aliquota_segurado_numerador").notNull(),
    aliquotaSeguradoDenominador: integer("aliquota_segurado_denominador").notNull(),
    aliquotaPatronalNumerador: integer("aliquota_patronal_numerador").notNull(),
    aliquotaPatronalDenominador: integer("aliquota_patronal_denominador").notNull(),
    cebasNumero: varchar("cebas_numero", { length: 100 }),
    cebasInicio: date("cebas_inicio"),
    cebasFim: date("cebas_fim"),
    evidencia: text("evidencia").notNull(),
    fonteNormativa: text("fonte_normativa").notNull(),
    publicado: boolean("publicado").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_enquadramento_empresa_id").on(table.empresaId, table.id),
    index("ix_enquadramento_empresa_vigencia").on(
      table.empresaId,
      table.inicioVigencia,
      table.fimVigencia,
    ),
    check(
      "ck_enquadramento_regime",
      sql`${table.regime} in (
        'EMPRESA_GERAL', 'SIMPLES_SUBSTITUIDA', 'SIMPLES_ANEXO_IV',
        'BENEFICENTE_IMUNE', 'ADMINISTRACAO_PUBLICA', 'INSTITUICAO_FINANCEIRA'
      )`,
    ),
    check(
      "ck_enquadramento_vigencia",
      sql`${table.fimVigencia} >= ${table.inicioVigencia}`,
    ),
    check(
      "ck_enquadramento_aliquotas",
      sql`${table.aliquotaSeguradoNumerador} >= 0
          and ${table.aliquotaSeguradoDenominador} > 0
          and ${table.aliquotaSeguradoNumerador} <= ${table.aliquotaSeguradoDenominador}
          and ${table.aliquotaPatronalNumerador} >= 0
          and ${table.aliquotaPatronalDenominador} > 0
          and ${table.aliquotaPatronalNumerador} <= ${table.aliquotaPatronalDenominador}`,
    ),
    check(
      "ck_enquadramento_cenario",
      sql`(
        ${table.regime} = 'EMPRESA_GERAL'
        and ${table.aliquotaSeguradoNumerador} = 11
        and ${table.aliquotaSeguradoDenominador} = 100
        and ${table.aliquotaPatronalNumerador} = 20
        and ${table.aliquotaPatronalDenominador} = 100
        and ${table.cebasNumero} is null
        and ${table.cebasInicio} is null
        and ${table.cebasFim} is null
      ) or (
        ${table.regime} = 'SIMPLES_SUBSTITUIDA'
        and ${table.aliquotaSeguradoNumerador} = 11
        and ${table.aliquotaSeguradoDenominador} = 100
        and ${table.aliquotaPatronalNumerador} = 0
        and ${table.aliquotaPatronalDenominador} = 100
        and ${table.cebasNumero} is null
        and ${table.cebasInicio} is null
        and ${table.cebasFim} is null
      ) or (
        ${table.regime} = 'SIMPLES_ANEXO_IV'
        and ${table.aliquotaSeguradoNumerador} = 11
        and ${table.aliquotaSeguradoDenominador} = 100
        and ${table.aliquotaPatronalNumerador} = 20
        and ${table.aliquotaPatronalDenominador} = 100
        and ${table.cebasNumero} is null
        and ${table.cebasInicio} is null
        and ${table.cebasFim} is null
      ) or (
        ${table.regime} = 'BENEFICENTE_IMUNE'
        and ${table.aliquotaSeguradoNumerador} = 20
        and ${table.aliquotaSeguradoDenominador} = 100
        and ${table.aliquotaPatronalNumerador} = 0
        and ${table.aliquotaPatronalDenominador} = 100
        and ${table.cebasNumero} is not null
        and ${table.cebasInicio} is not null
        and ${table.cebasFim} is not null
        and ${table.cebasInicio} <= ${table.inicioVigencia}
        and ${table.cebasFim} >= ${table.fimVigencia}
      ) or (
        ${table.regime} = 'ADMINISTRACAO_PUBLICA'
        and ${table.aliquotaSeguradoNumerador} = 11
        and ${table.aliquotaSeguradoDenominador} = 100
        and ${table.aliquotaPatronalNumerador} = 20
        and ${table.aliquotaPatronalDenominador} = 100
        and ${table.cebasNumero} is null
        and ${table.cebasInicio} is null
        and ${table.cebasFim} is null
      ) or (
        ${table.regime} = 'INSTITUICAO_FINANCEIRA'
        and ${table.aliquotaSeguradoNumerador} = 11
        and ${table.aliquotaSeguradoDenominador} = 100
        and ${table.aliquotaPatronalNumerador} = 225
        and ${table.aliquotaPatronalDenominador} = 1000
        and ${table.cebasNumero} is null
        and ${table.cebasInicio} is null
        and ${table.cebasFim} is null
      )`,
    ),
  ],
);

export const folhas = pgTable(
  "folha",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    termoId: uuid("termo_id")
      .notNull()
      .references(() => termos.id),
    metaId: uuid("meta_id")
      .notNull()
      .references(() => metas.id),
    regraCalculoId: uuid("regra_calculo_id").references(() => regrasCalculo.id),
    enquadramentoPrevidenciarioId: uuid("enquadramento_previdenciario_id"),
    competencia: date("competencia").notNull(),
    numero: integer("numero").notNull(),
    revisao: integer("revisao").notNull().default(1),
    status: statusFolha("status").notNull().default("RASCUNHO"),
    processadaEm: timestamp("processada_em", { withTimezone: true }),
    fechadaEm: timestamp("fechada_em", { withTimezone: true }),
    hashResultado: varchar("hash_resultado", { length: 64 }),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_folha_empresa_id").on(table.empresaId, table.id),
    uniqueIndex("uq_folha_empresa_competencia_numero").on(
      table.empresaId,
      table.competencia,
      table.numero,
    ),
    index("ix_folha_empresa_status").on(table.empresaId, table.status),
    foreignKey({
      columns: [table.empresaId, table.termoId],
      foreignColumns: [termos.empresaId, termos.id],
      name: "fk_folha_empresa_termo",
    }),
    foreignKey({
      columns: [table.termoId, table.metaId],
      foreignColumns: [metas.termoId, metas.id],
      name: "fk_folha_termo_meta",
    }),
    foreignKey({
      columns: [table.empresaId, table.enquadramentoPrevidenciarioId],
      foreignColumns: [
        enquadramentosPrevidenciarios.empresaId,
        enquadramentosPrevidenciarios.id,
      ],
      name: "fk_folha_empresa_enquadramento",
    }),
    check("ck_folha_numero", sql`${table.numero} > 0`),
    check("ck_folha_revisao", sql`${table.revisao} > 0`),
    check(
      "ck_folha_competencia_primeiro_dia",
      sql`${table.competencia} = date_trunc('month', ${table.competencia})::date`,
    ),
    check(
      "ck_folha_fechamento",
      sql`${table.status} <> 'FECHADA' or ${table.fechadaEm} is not null`,
    ),
  ],
);

export const conferenciasFolha = pgTable(
  "folha_conferencia",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    folhaId: uuid("folha_id").notNull(),
    revisao: integer("revisao").notNull(),
    hashResultado: varchar("hash_resultado", { length: 64 }).notNull(),
    resultado: varchar("resultado", { length: 16 }).notNull(),
    conferente: varchar("conferente", { length: 160 }).notNull(),
    confirmouCadastros: boolean("confirmou_cadastros").notNull(),
    confirmouValores: boolean("confirmou_valores").notNull(),
    confirmouRubricas: boolean("confirmou_rubricas").notNull(),
    observacao: text("observacao").notNull().default(""),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_folha_conferencia_folha_hash").on(
      table.folhaId,
      table.hashResultado,
      table.criadoEm,
    ),
    foreignKey({
      columns: [table.empresaId],
      foreignColumns: [empresas.id],
      name: "fk_folha_conferencia_empresa",
    }),
    foreignKey({
      columns: [table.folhaId],
      foreignColumns: [folhas.id],
      name: "fk_folha_conferencia_folha",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.empresaId, table.folhaId],
      foreignColumns: [folhas.empresaId, folhas.id],
      name: "fk_folha_conferencia_empresa_folha",
    }).onDelete("cascade"),
    check(
      "ck_folha_conferencia_resultado",
      sql`${table.resultado} in ('APROVADA', 'REJEITADA')`,
    ),
    check("ck_folha_conferencia_revisao", sql`${table.revisao} > 0`),
    check(
      "ck_folha_conferencia_hash",
      sql`${table.hashResultado} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "ck_folha_conferencia_conferente",
      sql`length(btrim(${table.conferente})) between 3 and 160`,
    ),
    check(
      "ck_folha_conferencia_aprovacao",
      sql`${table.resultado} <> 'APROVADA' or
          (${table.confirmouCadastros} and ${table.confirmouValores}
           and ${table.confirmouRubricas})`,
    ),
    check(
      "ck_folha_conferencia_rejeicao",
      sql`${table.resultado} <> 'REJEITADA' or length(btrim(${table.observacao})) >= 10`,
    ),
  ],
);

export const itensFolha = pgTable(
  "folha_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    folhaId: uuid("folha_id")
      .notNull()
      .references(() => folhas.id, { onDelete: "cascade" }),
    vinculoId: uuid("vinculo_id")
      .notNull()
      .references(() => vinculos.id),
    medicaoId: uuid("medicao_id").references(() => medicoesMensais.id),
    totalProventos: numeric("total_proventos", { precision: 18, scale: 2 }).notNull(),
    totalDescontos: numeric("total_descontos", { precision: 18, scale: 2 }).notNull(),
    baseInss: numeric("base_inss", { precision: 18, scale: 2 }).notNull(),
    valorInss: numeric("valor_inss", { precision: 18, scale: 2 }).notNull(),
    baseIrrf: numeric("base_irrf", { precision: 18, scale: 2 }).notNull(),
    irrfBruto: numeric("irrf_bruto", { precision: 18, scale: 2 }).notNull(),
    irrfReducao: numeric("irrf_reducao", { precision: 18, scale: 2 }).notNull(),
    valorIrrf: numeric("valor_irrf", { precision: 18, scale: 2 }).notNull(),
    totalLiquido: numeric("total_liquido", { precision: 18, scale: 2 }).notNull(),
    snapshots: jsonb("snapshots").notNull(),
    memoria: jsonb("memoria").notNull(),
  },
  (table) => [
    uniqueIndex("uq_folha_item_empresa_id").on(table.empresaId, table.id),
    uniqueIndex("uq_folha_item_vinculo").on(table.folhaId, table.vinculoId),
    foreignKey({
      columns: [table.empresaId],
      foreignColumns: [empresas.id],
      name: "fk_folha_item_empresa",
    }),
    foreignKey({
      columns: [table.empresaId, table.folhaId],
      foreignColumns: [folhas.empresaId, folhas.id],
      name: "fk_folha_item_empresa_folha",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.empresaId, table.vinculoId],
      foreignColumns: [vinculos.empresaId, vinculos.id],
      name: "fk_folha_item_empresa_vinculo",
    }),
    foreignKey({
      columns: [table.empresaId, table.medicaoId],
      foreignColumns: [medicoesMensais.empresaId, medicoesMensais.id],
      name: "fk_folha_item_empresa_medicao",
    }),
    check(
      "ck_folha_item_valores_nao_negativos",
      sql`${table.totalProventos} >= 0 and ${table.totalDescontos} >= 0
          and ${table.baseInss} >= 0 and ${table.valorInss} >= 0
          and ${table.baseIrrf} >= 0 and ${table.irrfBruto} >= 0
          and ${table.irrfReducao} >= 0 and ${table.valorIrrf} >= 0`,
    ),
    check(
      "ck_folha_item_total_liquido",
      sql`${table.totalLiquido} = round(${table.totalProventos} - ${table.totalDescontos}, 2)`,
    ),
  ],
);

export const eventosItensFolha = pgTable(
  "folha_item_evento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    folhaItemId: uuid("folha_item_id").notNull(),
    eventoId: uuid("evento_id"),
    codigo: varchar("codigo", { length: 40 }).notNull(),
    descricao: varchar("descricao", { length: 180 }).notNull(),
    natureza: varchar("natureza", { length: 20 }).notNull(),
    origem: varchar("origem", { length: 20 }).notNull(),
    tipoCalculo: varchar("tipo_calculo", { length: 20 }).notNull(),
    referencia: varchar("referencia", { length: 40 }).notNull(),
    baseCalculo: numeric("base_calculo", { precision: 18, scale: 2 }).notNull(),
    valor: numeric("valor", { precision: 18, scale: 2 }).notNull(),
    incideInss: boolean("incide_inss").notNull().default(false),
    incideIrrf: boolean("incide_irrf").notNull().default(false),
    ordem: integer("ordem").notNull(),
    snapshot: jsonb("snapshot").notNull(),
  },
  (table) => [
    uniqueIndex("uq_folha_item_evento_ordem").on(
      table.folhaItemId,
      table.ordem,
    ),
    index("ix_folha_item_evento_item").on(table.folhaItemId, table.ordem),
    foreignKey({
      columns: [table.empresaId],
      foreignColumns: [empresas.id],
      name: "fk_folha_item_evento_empresa",
    }),
    foreignKey({
      columns: [table.folhaItemId],
      foreignColumns: [itensFolha.id],
      name: "fk_folha_item_evento_item",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.eventoId],
      foreignColumns: [eventos.id],
      name: "fk_folha_item_evento_evento",
    }),
    foreignKey({
      columns: [table.empresaId, table.folhaItemId],
      foreignColumns: [itensFolha.empresaId, itensFolha.id],
      name: "fk_folha_item_evento_empresa_item",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.empresaId, table.eventoId],
      foreignColumns: [eventos.empresaId, eventos.id],
      name: "fk_folha_item_evento_empresa_evento",
    }),
    check(
      "ck_folha_item_evento_natureza",
      sql`${table.natureza} in ('PROVENTO', 'DESCONTO', 'INFORMATIVO')`,
    ),
    check(
      "ck_folha_item_evento_origem",
      sql`${table.origem} in ('CONTRATUAL', 'RECORRENTE', 'SISTEMA')`,
    ),
    check(
      "ck_folha_item_evento_tipo_calculo",
      sql`${table.tipoCalculo} in ('VALOR', 'PERCENTUAL')`,
    ),
    check(
      "ck_folha_item_evento_valores",
      sql`${table.baseCalculo} >= 0 and ${table.valor} >= 0 and ${table.ordem} > 0`,
    ),
  ],
);

export const homologacoesFolha = pgTable(
  "folha_homologacao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    folhaId: uuid("folha_id").notNull(),
    revisao: integer("revisao").notNull(),
    hashFolha: varchar("hash_folha", { length: 64 }).notNull(),
    origem: varchar("origem", { length: 30 }).notNull(),
    referencia: varchar("referencia", { length: 200 }).notNull(),
    nomeArquivo: varchar("nome_arquivo", { length: 255 }).notNull(),
    hashArquivo: varchar("hash_arquivo", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    totalLinhas: integer("total_linhas").notNull(),
    conciliados: integer("conciliados").notNull(),
    divergentes: integer("divergentes").notNull(),
    resumo: jsonb("resumo").notNull(),
    criadoPor: varchar("criado_por", { length: 160 }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_folha_homologacao_empresa_id").on(
      table.empresaId,
      table.id,
    ),
    uniqueIndex("uq_folha_homologacao_arquivo").on(
      table.folhaId,
      table.hashFolha,
      table.hashArquivo,
    ),
    index("ix_folha_homologacao_folha").on(table.folhaId, table.criadoEm),
    foreignKey({
      columns: [table.empresaId, table.folhaId],
      foreignColumns: [folhas.empresaId, folhas.id],
      name: "fk_folha_homologacao_empresa_folha",
    }).onDelete("cascade"),
    check("ck_folha_homologacao_revisao", sql`${table.revisao} > 0`),
    check(
      "ck_folha_homologacao_hashes",
      sql`${table.hashFolha} ~ '^[0-9a-f]{64}$'
          and ${table.hashArquivo} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "ck_folha_homologacao_origem",
      sql`${table.origem} in ('GIW', 'PLANILHA_RH', 'OUTRO')`,
    ),
    check(
      "ck_folha_homologacao_status",
      sql`${table.status} in ('CONCILIADA', 'DIVERGENTE')`,
    ),
    check(
      "ck_folha_homologacao_contagens",
      sql`${table.totalLinhas} > 0 and ${table.conciliados} >= 0
          and ${table.divergentes} >= 0
          and ${table.totalLinhas} = ${table.conciliados} + ${table.divergentes}
          and (
            (${table.status} = 'CONCILIADA' and ${table.divergentes} = 0)
            or (${table.status} = 'DIVERGENTE' and ${table.divergentes} > 0)
          )`,
    ),
  ],
);

export const itensHomologacaoFolha = pgTable(
  "folha_homologacao_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    homologacaoId: uuid("homologacao_id").notNull(),
    folhaItemId: uuid("folha_item_id"),
    matricula: varchar("matricula", { length: 80 }).notNull(),
    nome: varchar("nome", { length: 180 }).notNull(),
    situacao: varchar("situacao", { length: 30 }).notNull(),
    esperadoProventos: numeric("esperado_proventos", { precision: 18, scale: 2 }).notNull(),
    esperadoInss: numeric("esperado_inss", { precision: 18, scale: 2 }).notNull(),
    esperadoIrrf: numeric("esperado_irrf", { precision: 18, scale: 2 }).notNull(),
    esperadoDescontos: numeric("esperado_descontos", { precision: 18, scale: 2 }).notNull(),
    esperadoLiquido: numeric("esperado_liquido", { precision: 18, scale: 2 }).notNull(),
    atualProventos: numeric("atual_proventos", { precision: 18, scale: 2 }).notNull(),
    atualInss: numeric("atual_inss", { precision: 18, scale: 2 }).notNull(),
    atualIrrf: numeric("atual_irrf", { precision: 18, scale: 2 }).notNull(),
    atualDescontos: numeric("atual_descontos", { precision: 18, scale: 2 }).notNull(),
    atualLiquido: numeric("atual_liquido", { precision: 18, scale: 2 }).notNull(),
    diferencaProventos: numeric("diferenca_proventos", { precision: 18, scale: 2 }).notNull(),
    diferencaInss: numeric("diferenca_inss", { precision: 18, scale: 2 }).notNull(),
    diferencaIrrf: numeric("diferenca_irrf", { precision: 18, scale: 2 }).notNull(),
    diferencaDescontos: numeric("diferenca_descontos", { precision: 18, scale: 2 }).notNull(),
    diferencaLiquido: numeric("diferenca_liquido", { precision: 18, scale: 2 }).notNull(),
  },
  (table) => [
    uniqueIndex("uq_folha_homologacao_item_matricula").on(
      table.homologacaoId,
      table.matricula,
    ),
    foreignKey({
      columns: [table.empresaId, table.homologacaoId],
      foreignColumns: [homologacoesFolha.empresaId, homologacoesFolha.id],
      name: "fk_folha_homologacao_item_empresa_lote",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.empresaId, table.folhaItemId],
      foreignColumns: [itensFolha.empresaId, itensFolha.id],
      name: "fk_folha_homologacao_item_empresa_folha_item",
    }),
    check(
      "ck_folha_homologacao_item_situacao",
      sql`${table.situacao} in
          ('CONCILIADO', 'DIVERGENTE', 'AUSENTE_NOVO', 'AUSENTE_LEGADO')`,
    ),
    check(
      "ck_folha_homologacao_item_nao_negativo",
      sql`${table.esperadoProventos} >= 0 and ${table.esperadoInss} >= 0
          and ${table.esperadoIrrf} >= 0 and ${table.esperadoDescontos} >= 0
          and ${table.esperadoLiquido} >= 0 and ${table.atualProventos} >= 0
          and ${table.atualInss} >= 0 and ${table.atualIrrf} >= 0
          and ${table.atualDescontos} >= 0 and ${table.atualLiquido} >= 0`,
    ),
    check(
      "ck_folha_homologacao_item_diferencas",
      sql`${table.diferencaProventos} = ${table.atualProventos} - ${table.esperadoProventos}
          and ${table.diferencaInss} = ${table.atualInss} - ${table.esperadoInss}
          and ${table.diferencaIrrf} = ${table.atualIrrf} - ${table.esperadoIrrf}
          and ${table.diferencaDescontos} = ${table.atualDescontos} - ${table.esperadoDescontos}
          and ${table.diferencaLiquido} = ${table.atualLiquido} - ${table.esperadoLiquido}`,
    ),
  ],
);

export const casosConsolidacaoMensal = pgTable(
  "consolidacao_mensal_caso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    pessoaId: uuid("pessoa_id").notNull(),
    competencia: date("competencia").notNull(),
    hashFontes: varchar("hash_fontes", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("PENDENTE"),
    decisao: varchar("decisao", { length: 30 }),
    justificativa: text("justificativa").notNull().default(""),
    responsavel: varchar("responsavel", { length: 160 }),
    resolvidoEm: timestamp("resolvido_em", { withTimezone: true }),
    criadoPor: varchar("criado_por", { length: 160 }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_consolidacao_caso_empresa_id").on(
      table.empresaId,
      table.id,
    ),
    uniqueIndex("uq_consolidacao_caso_fontes").on(
      table.empresaId,
      table.competencia,
      table.pessoaId,
      table.hashFontes,
    ),
    index("ix_consolidacao_caso_competencia").on(
      table.empresaId,
      table.competencia,
      table.status,
    ),
    foreignKey({
      columns: [table.empresaId, table.pessoaId],
      foreignColumns: [pessoas.empresaId, pessoas.id],
      name: "fk_consolidacao_caso_empresa_pessoa",
    }),
    check(
      "ck_consolidacao_caso_competencia",
      sql`${table.competencia} = date_trunc('month', ${table.competencia})::date`,
    ),
    check(
      "ck_consolidacao_caso_hash",
      sql`${table.hashFontes} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "ck_consolidacao_caso_status",
      sql`${table.status} in
          ('PENDENTE', 'EM_ANALISE', 'RESOLVIDO', 'INVALIDADO')`,
    ),
    check(
      "ck_consolidacao_caso_decisao",
      sql`${table.decisao} is null or ${table.decisao} in
          ('UNIFICAR_VINCULOS', 'RATEIO_NECESSARIO', 'NAO_APLICAVEL')`,
    ),
    check(
      "ck_consolidacao_caso_resolucao",
      sql`${table.status} <> 'RESOLVIDO' or (
        ${table.decisao} is not null
        and length(btrim(${table.justificativa})) between 10 and 2000
        and length(btrim(${table.responsavel})) between 3 and 160
        and ${table.resolvidoEm} is not null
      )`,
    ),
  ],
);

export const fontesConsolidacaoMensal = pgTable(
  "consolidacao_mensal_fonte",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    casoId: uuid("caso_id").notNull(),
    vinculoId: uuid("vinculo_id").notNull(),
    medicaoId: uuid("medicao_id"),
    folhaId: uuid("folha_id"),
    termoNumero: varchar("termo_numero", { length: 80 }).notNull(),
    metaCodigo: varchar("meta_codigo", { length: 80 }).notNull(),
    atividade: varchar("atividade", { length: 180 }).notNull(),
    valorContratual: numeric("valor_contratual", {
      precision: 18,
      scale: 2,
    }).notNull(),
    valorPrevisto: numeric("valor_previsto", {
      precision: 18,
      scale: 2,
    }).notNull(),
    exigeMedicao: boolean("exige_medicao").notNull(),
    medicaoTipo: varchar("medicao_tipo", { length: 20 }),
    folhaNumero: integer("folha_numero"),
    folhaStatus: varchar("folha_status", { length: 20 }),
    snapshot: jsonb("snapshot").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_consolidacao_fonte_caso_vinculo").on(
      table.casoId,
      table.vinculoId,
    ),
    index("ix_consolidacao_fonte_caso").on(table.casoId),
    foreignKey({
      columns: [table.empresaId, table.casoId],
      foreignColumns: [
        casosConsolidacaoMensal.empresaId,
        casosConsolidacaoMensal.id,
      ],
      name: "fk_consolidacao_fonte_empresa_caso",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.empresaId, table.vinculoId],
      foreignColumns: [vinculos.empresaId, vinculos.id],
      name: "fk_consolidacao_fonte_empresa_vinculo",
    }),
    foreignKey({
      columns: [table.empresaId, table.medicaoId],
      foreignColumns: [medicoesMensais.empresaId, medicoesMensais.id],
      name: "fk_consolidacao_fonte_empresa_medicao",
    }),
    foreignKey({
      columns: [table.empresaId, table.folhaId],
      foreignColumns: [folhas.empresaId, folhas.id],
      name: "fk_consolidacao_fonte_empresa_folha",
    }),
    check(
      "ck_consolidacao_fonte_valores",
      sql`${table.valorContratual} >= 0 and ${table.valorPrevisto} >= 0`,
    ),
  ],
);

export const simulacoesConsolidacaoFiscal = pgTable(
  "consolidacao_fiscal_simulacao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    casoId: uuid("caso_id").notNull(),
    pessoaId: uuid("pessoa_id").notNull(),
    competencia: date("competencia").notNull(),
    regraCalculoId: uuid("regra_calculo_id")
      .notNull()
      .references(() => regrasCalculo.id),
    enquadramentoPrevidenciarioId: uuid(
      "enquadramento_previdenciario_id",
    ).notNull(),
    versao: integer("versao").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("SIMULADA"),
    hipoteseRateio: varchar("hipotese_rateio", { length: 40 })
      .notNull()
      .default("PROPORCIONAL_MAIOR_RESTO"),
    hashFontes: varchar("hash_fontes", { length: 64 }).notNull(),
    hashRegra: varchar("hash_regra", { length: 64 }).notNull(),
    hashEnquadramento: varchar("hash_enquadramento", {
      length: 64,
    }).notNull(),
    hashResultado: varchar("hash_resultado", { length: 64 }).notNull(),
    totalProventos: numeric("total_proventos", {
      precision: 18,
      scale: 2,
    }).notNull(),
    totalDescontos: numeric("total_descontos", {
      precision: 18,
      scale: 2,
    }).notNull(),
    totalLiquido: numeric("total_liquido", {
      precision: 18,
      scale: 2,
    }).notNull(),
    baseInssBruta: numeric("base_inss_bruta", {
      precision: 18,
      scale: 2,
    }).notNull(),
    baseInss: numeric("base_inss", { precision: 18, scale: 2 }).notNull(),
    valorInss: numeric("valor_inss", { precision: 18, scale: 2 }).notNull(),
    rendimentosIrrf: numeric("rendimentos_irrf", {
      precision: 18,
      scale: 2,
    }).notNull(),
    baseIrrf: numeric("base_irrf", { precision: 18, scale: 2 }).notNull(),
    irrfBruto: numeric("irrf_bruto", { precision: 18, scale: 2 }).notNull(),
    irrfReducao: numeric("irrf_reducao", {
      precision: 18,
      scale: 2,
    }).notNull(),
    valorIrrf: numeric("valor_irrf", { precision: 18, scale: 2 }).notNull(),
    memoria: jsonb("memoria").notNull(),
    responsavel: varchar("responsavel", { length: 160 }),
    justificativa: text("justificativa").notNull().default(""),
    decididoEm: timestamp("decidido_em", { withTimezone: true }),
    criadoPor: varchar("criado_por", { length: 160 }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_simulacao_fiscal_empresa_id").on(
      table.empresaId,
      table.id,
    ),
    uniqueIndex("uq_simulacao_fiscal_versao").on(
      table.empresaId,
      table.competencia,
      table.pessoaId,
      table.versao,
    ),
    uniqueIndex("uq_simulacao_fiscal_fontes").on(
      table.empresaId,
      table.competencia,
      table.pessoaId,
      table.hashFontes,
    ),
    index("ix_simulacao_fiscal_competencia_status").on(
      table.empresaId,
      table.competencia,
      table.status,
    ),
    foreignKey({
      columns: [table.empresaId, table.casoId],
      foreignColumns: [
        casosConsolidacaoMensal.empresaId,
        casosConsolidacaoMensal.id,
      ],
      name: "fk_simulacao_fiscal_empresa_caso",
    }),
    foreignKey({
      columns: [table.empresaId, table.pessoaId],
      foreignColumns: [pessoas.empresaId, pessoas.id],
      name: "fk_simulacao_fiscal_empresa_pessoa",
    }),
    foreignKey({
      columns: [table.empresaId, table.enquadramentoPrevidenciarioId],
      foreignColumns: [
        enquadramentosPrevidenciarios.empresaId,
        enquadramentosPrevidenciarios.id,
      ],
      name: "fk_simulacao_fiscal_empresa_enquadramento",
    }),
    check(
      "ck_simulacao_fiscal_competencia",
      sql`${table.competencia} = date_trunc('month', ${table.competencia})::date`,
    ),
    check("ck_simulacao_fiscal_versao", sql`${table.versao} > 0`),
    check(
      "ck_simulacao_fiscal_status",
      sql`${table.status} in (
        'SIMULADA', 'EM_HOMOLOGACAO', 'HOMOLOGADA', 'REJEITADA', 'INVALIDADA'
      )`,
    ),
    check(
      "ck_simulacao_fiscal_hipotese",
      sql`${table.hipoteseRateio} = 'PROPORCIONAL_MAIOR_RESTO'`,
    ),
    check(
      "ck_simulacao_fiscal_hashes",
      sql`${table.hashFontes} ~ '^[0-9a-f]{64}$'
          and ${table.hashRegra} ~ '^[0-9a-f]{64}$'
          and ${table.hashEnquadramento} ~ '^[0-9a-f]{64}$'
          and ${table.hashResultado} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "ck_simulacao_fiscal_valores",
      sql`${table.totalProventos} >= 0 and ${table.totalDescontos} >= 0
          and ${table.totalLiquido} >= 0 and ${table.baseInssBruta} >= 0
          and ${table.baseInss} >= 0 and ${table.valorInss} >= 0
          and ${table.rendimentosIrrf} >= 0 and ${table.baseIrrf} >= 0
          and ${table.irrfBruto} >= 0 and ${table.irrfReducao} >= 0
          and ${table.valorIrrf} >= 0
          and ${table.totalLiquido} =
            ${table.totalProventos} - ${table.totalDescontos}`,
    ),
    check(
      "ck_simulacao_fiscal_memoria",
      sql`jsonb_typeof(${table.memoria}) = 'object'
          and ${table.memoria} ->> 'modo' = 'SIMULACAO_NAO_HOMOLOGADA'
          and ${table.memoria} ->> 'hipoteseRateio' =
            'PROPORCIONAL_MAIOR_RESTO'`,
    ),
    check(
      "ck_simulacao_fiscal_decisao",
      sql`${table.status} not in ('HOMOLOGADA', 'REJEITADA', 'INVALIDADA')
          or (
            length(btrim(${table.justificativa})) between 10 and 3000
            and length(btrim(${table.responsavel})) between 3 and 160
            and ${table.decididoEm} is not null
          )`,
    ),
  ],
);

export const fontesSimulacaoConsolidacaoFiscal = pgTable(
  "consolidacao_fiscal_simulacao_fonte",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    simulacaoId: uuid("simulacao_id").notNull(),
    vinculoId: uuid("vinculo_id").notNull(),
    medicaoId: uuid("medicao_id"),
    folhaId: uuid("folha_id"),
    ordem: integer("ordem").notNull(),
    hashEntrada: varchar("hash_entrada", { length: 64 }).notNull(),
    totalProventos: numeric("total_proventos", {
      precision: 18,
      scale: 2,
    }).notNull(),
    descontosEventos: numeric("descontos_eventos", {
      precision: 18,
      scale: 2,
    }).notNull(),
    totalDescontos: numeric("total_descontos", {
      precision: 18,
      scale: 2,
    }).notNull(),
    totalLiquido: numeric("total_liquido", {
      precision: 18,
      scale: 2,
    }).notNull(),
    baseInssBruta: numeric("base_inss_bruta", {
      precision: 18,
      scale: 2,
    }).notNull(),
    baseInssRateada: numeric("base_inss_rateada", {
      precision: 18,
      scale: 2,
    }).notNull(),
    valorInssRateado: numeric("valor_inss_rateado", {
      precision: 18,
      scale: 2,
    }).notNull(),
    baseIrrfBruta: numeric("base_irrf_bruta", {
      precision: 18,
      scale: 2,
    }).notNull(),
    baseIrrfRateada: numeric("base_irrf_rateada", {
      precision: 18,
      scale: 2,
    }).notNull(),
    irrfBrutoRateado: numeric("irrf_bruto_rateado", {
      precision: 18,
      scale: 2,
    }).notNull(),
    irrfReducaoRateada: numeric("irrf_reducao_rateada", {
      precision: 18,
      scale: 2,
    }).notNull(),
    valorIrrfRateado: numeric("valor_irrf_rateado", {
      precision: 18,
      scale: 2,
    }).notNull(),
    snapshot: jsonb("snapshot").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_simulacao_fonte_vinculo").on(
      table.simulacaoId,
      table.vinculoId,
    ),
    uniqueIndex("uq_simulacao_fonte_ordem").on(
      table.simulacaoId,
      table.ordem,
    ),
    index("ix_simulacao_fonte_simulacao").on(table.simulacaoId),
    foreignKey({
      columns: [table.empresaId, table.simulacaoId],
      foreignColumns: [
        simulacoesConsolidacaoFiscal.empresaId,
        simulacoesConsolidacaoFiscal.id,
      ],
      name: "fk_simulacao_fonte_empresa_simulacao",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.empresaId, table.vinculoId],
      foreignColumns: [vinculos.empresaId, vinculos.id],
      name: "fk_simulacao_fonte_empresa_vinculo",
    }),
    foreignKey({
      columns: [table.empresaId, table.medicaoId],
      foreignColumns: [medicoesMensais.empresaId, medicoesMensais.id],
      name: "fk_simulacao_fonte_empresa_medicao",
    }),
    foreignKey({
      columns: [table.empresaId, table.folhaId],
      foreignColumns: [folhas.empresaId, folhas.id],
      name: "fk_simulacao_fonte_empresa_folha",
    }),
    check("ck_simulacao_fonte_ordem", sql`${table.ordem} > 0`),
    check(
      "ck_simulacao_fonte_hash",
      sql`${table.hashEntrada} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "ck_simulacao_fonte_valores",
      sql`${table.totalProventos} >= 0 and ${table.descontosEventos} >= 0
          and ${table.totalDescontos} >= 0 and ${table.totalLiquido} >= 0
          and ${table.baseInssBruta} >= 0 and ${table.baseInssRateada} >= 0
          and ${table.valorInssRateado} >= 0 and ${table.baseIrrfBruta} >= 0
          and ${table.baseIrrfRateada} >= 0
          and ${table.irrfBrutoRateado} >= 0
          and ${table.irrfReducaoRateada} >= 0
          and ${table.valorIrrfRateado} >= 0
          and ${table.totalLiquido} =
            ${table.totalProventos} - ${table.totalDescontos}
          and ${table.totalDescontos} =
            ${table.descontosEventos} + ${table.valorInssRateado}
            + ${table.valorIrrfRateado}`,
    ),
    check(
      "ck_simulacao_fonte_snapshot",
      sql`jsonb_typeof(${table.snapshot}) = 'object'`,
    ),
  ],
);

export const homologacoesCompetencia = pgTable(
  "homologacao_competencia",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    competencia: date("competencia").notNull(),
    versao: integer("versao").notNull(),
    hashFontes: varchar("hash_fontes", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("PENDENTE"),
    resumo: jsonb("resumo").notNull(),
    justificativa: text("justificativa").notNull().default(""),
    responsavel: varchar("responsavel", { length: 160 }),
    decididoEm: timestamp("decidido_em", { withTimezone: true }),
    criadoPor: varchar("criado_por", { length: 160 }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_homologacao_competencia_empresa_id").on(
      table.empresaId,
      table.id,
    ),
    uniqueIndex("uq_homologacao_competencia_versao").on(
      table.empresaId,
      table.competencia,
      table.versao,
    ),
    uniqueIndex("uq_homologacao_competencia_fontes").on(
      table.empresaId,
      table.competencia,
      table.hashFontes,
    ),
    index("ix_homologacao_competencia_status").on(
      table.empresaId,
      table.competencia,
      table.status,
    ),
    foreignKey({
      columns: [table.empresaId],
      foreignColumns: [empresas.id],
      name: "fk_homologacao_competencia_empresa",
    }),
    check(
      "ck_homologacao_competencia_mes",
      sql`${table.competencia} = date_trunc('month', ${table.competencia})::date`,
    ),
    check("ck_homologacao_competencia_versao", sql`${table.versao} > 0`),
    check(
      "ck_homologacao_competencia_hash",
      sql`${table.hashFontes} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "ck_homologacao_competencia_status",
      sql`${table.status} in
          ('PENDENTE', 'EM_ANALISE', 'APROVADA', 'REJEITADA', 'INVALIDADA')`,
    ),
    check(
      "ck_homologacao_competencia_resumo",
      sql`jsonb_typeof(${table.resumo}) = 'object'
          and ${table.resumo} ?& array[
            'pronta', 'bloqueios', 'conformes', 'total'
          ]`,
    ),
    check(
      "ck_homologacao_competencia_decisao",
      sql`${table.status} not in ('APROVADA', 'REJEITADA') or (
        length(btrim(${table.justificativa})) between 10 and 3000
        and length(btrim(${table.responsavel})) between 3 and 160
        and ${table.decididoEm} is not null
      )`,
    ),
  ],
);

export const itensHomologacaoCompetencia = pgTable(
  "homologacao_competencia_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    homologacaoId: uuid("homologacao_id").notNull(),
    tipo: varchar("tipo", { length: 40 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    obrigatorio: boolean("obrigatorio").notNull().default(true),
    total: integer("total").notNull(),
    conformes: integer("conformes").notNull(),
    pendentes: integer("pendentes").notNull(),
    hashEvidencia: varchar("hash_evidencia", { length: 64 }).notNull(),
    detalhes: jsonb("detalhes").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_homologacao_competencia_item_tipo").on(
      table.homologacaoId,
      table.tipo,
    ),
    index("ix_homologacao_competencia_item").on(
      table.homologacaoId,
      table.status,
    ),
    foreignKey({
      columns: [table.empresaId, table.homologacaoId],
      foreignColumns: [
        homologacoesCompetencia.empresaId,
        homologacoesCompetencia.id,
      ],
      name: "fk_homologacao_item_empresa_lote",
    }).onDelete("cascade"),
    check(
      "ck_homologacao_item_tipo",
      sql`${table.tipo} in (
        'MEDICOES', 'CONSOLIDACAO', 'FOLHAS', 'CONFERENCIA_RH',
        'PARALELO_GIW', 'PAGAMENTOS', 'OBRIGACAO', 'DOCUMENTOS_DCTFWEB'
      )`,
    ),
    check(
      "ck_homologacao_item_status",
      sql`${table.status} in ('OK', 'PENDENTE', 'BLOQUEIO', 'NAO_APLICAVEL')`,
    ),
    check(
      "ck_homologacao_item_contagens",
      sql`${table.total} >= 0 and ${table.conformes} >= 0
          and ${table.pendentes} >= 0
          and ${table.conformes} + ${table.pendentes} <= ${table.total}`,
    ),
    check(
      "ck_homologacao_item_estado_contagens",
      sql`(
        ${table.status} = 'OK' and ${table.total} > 0
        and ${table.conformes} = ${table.total} and ${table.pendentes} = 0
      ) or (
        ${table.status} = 'NAO_APLICAVEL' and ${table.total} = 0
        and ${table.conformes} = 0 and ${table.pendentes} = 0
      ) or (
        ${table.status} in ('PENDENTE', 'BLOQUEIO')
        and (
          (${table.total} = 0 and ${table.conformes} = 0 and ${table.pendentes} = 0)
          or ${table.pendentes} > 0
        )
      )`,
    ),
    check(
      "ck_homologacao_item_hash",
      sql`${table.hashEvidencia} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "ck_homologacao_item_detalhes",
      sql`jsonb_typeof(${table.detalhes}) = 'object'`,
    ),
  ],
);

export const historicoFolha = pgTable(
  "folha_status_historico",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folhaId: uuid("folha_id")
      .notNull()
      .references(() => folhas.id, { onDelete: "cascade" }),
    statusAnterior: statusFolha("status_anterior"),
    statusNovo: statusFolha("status_novo").notNull(),
    motivo: text("motivo"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    ator: varchar("ator", { length: 160 }).notNull().default("SISTEMA"),
    ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ix_historico_folha_data").on(table.folhaId, table.ocorridoEm)],
);

export const obrigacoes = pgTable(
  "obrigacao_fiscal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    competencia: date("competencia").notNull(),
    tipo: varchar("tipo", { length: 40 }).notNull(),
    status: statusObrigacao("status").notNull().default("RASCUNHO"),
    principal: numeric("principal", { precision: 18, scale: 2 }).notNull(),
    juros: numeric("juros", { precision: 18, scale: 2 }).notNull().default("0"),
    multa: numeric("multa", { precision: 18, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 18, scale: 2 }).notNull(),
    valorDeclarado: numeric("valor_declarado", { precision: 18, scale: 2 }),
    diferenca: numeric("diferenca", { precision: 18, scale: 2 }),
    conciliadaEm: timestamp("conciliada_em", { withTimezone: true }),
    bloqueioMotivo: text("bloqueio_motivo"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_obrigacao_empresa_id").on(table.empresaId, table.id),
    uniqueIndex("uq_obrigacao_empresa_competencia_tipo").on(
      table.empresaId,
      table.competencia,
      table.tipo,
    ),
    index("ix_obrigacao_empresa_competencia").on(table.empresaId, table.competencia),
    check(
      "ck_obrigacao_valores_nao_negativos",
      sql`${table.principal} >= 0 and ${table.juros} >= 0
          and ${table.multa} >= 0 and ${table.total} >= 0`,
    ),
    check(
      "ck_obrigacao_total",
      sql`${table.total} = round(${table.principal} + ${table.juros} + ${table.multa}, 2)`,
    ),
    check(
      "ck_obrigacao_valor_declarado",
      sql`${table.valorDeclarado} is null or ${table.valorDeclarado} >= 0`,
    ),
    check(
      "ck_obrigacao_bloqueio_motivo",
      sql`${table.status} <> 'BLOQUEADA' or ${table.bloqueioMotivo} is not null`,
    ),
  ],
);

export const itensObrigacao = pgTable(
  "obrigacao_fiscal_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    obrigacaoId: uuid("obrigacao_id")
      .notNull()
      .references(() => obrigacoes.id, { onDelete: "cascade" }),
    folhaItemId: uuid("folha_item_id").references(() => itensFolha.id),
    natureza: varchar("natureza", { length: 30 }).notNull(),
    origem: varchar("origem", { length: 20 }).notNull(),
    descricao: varchar("descricao", { length: 240 }).notNull(),
    codigoReceita: varchar("codigo_receita", { length: 40 }),
    baseCalculo: numeric("base_calculo", { precision: 18, scale: 2 }).notNull(),
    aliquota: numeric("aliquota", { precision: 12, scale: 6 }),
    valor: numeric("valor", { precision: 18, scale: 2 }).notNull(),
    snapshot: jsonb("snapshot").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_obrigacao_item_folha_natureza").on(
      table.obrigacaoId,
      table.folhaItemId,
      table.natureza,
    ),
    index("ix_obrigacao_item_obrigacao").on(table.obrigacaoId, table.natureza),
    foreignKey({
      columns: [table.empresaId],
      foreignColumns: [empresas.id],
      name: "fk_obrigacao_item_empresa",
    }),
    foreignKey({
      columns: [table.empresaId, table.obrigacaoId],
      foreignColumns: [obrigacoes.empresaId, obrigacoes.id],
      name: "fk_obrigacao_item_empresa_obrigacao",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.empresaId, table.folhaItemId],
      foreignColumns: [itensFolha.empresaId, itensFolha.id],
      name: "fk_obrigacao_item_empresa_folha_item",
    }),
    check(
      "ck_obrigacao_item_natureza",
      sql`${table.natureza} in (
        'SEGURADO', 'PATRONAL', 'RAT', 'TERCEIROS',
        'JUROS', 'MULTA', 'COMPENSACAO', 'AJUSTE'
      )`,
    ),
    check(
      "ck_obrigacao_item_origem",
      sql`${table.origem} in ('FOLHA', 'MANUAL', 'IMPORTACAO', 'DCTFWEB')`,
    ),
    check(
      "ck_obrigacao_item_valores",
      sql`${table.baseCalculo} >= 0 and ${table.valor} >= 0
          and (${table.aliquota} is null or ${table.aliquota} >= 0)`,
    ),
  ],
);

export const documentosObrigacao = pgTable(
  "obrigacao_fiscal_documento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    obrigacaoId: uuid("obrigacao_id")
      .notNull()
      .references(() => obrigacoes.id, { onDelete: "cascade" }),
    tipo: varchar("tipo", { length: 30 }).notNull(),
    referencia: varchar("referencia", { length: 160 }).notNull(),
    valorTotal: numeric("valor_total", { precision: 18, scale: 2 }).notNull(),
    emitidoEm: date("emitido_em").notNull(),
    localizador: text("localizador").notNull(),
    hashSha256: varchar("hash_sha256", { length: 64 }),
    verificado: boolean("verificado").notNull().default(false),
    conteudo: jsonb("conteudo").notNull().default({}),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_obrigacao_documento_referencia").on(
      table.obrigacaoId,
      table.tipo,
      table.referencia,
    ),
    index("ix_obrigacao_documento_obrigacao").on(
      table.obrigacaoId,
      table.tipo,
    ),
    foreignKey({
      columns: [table.empresaId],
      foreignColumns: [empresas.id],
      name: "fk_obrigacao_documento_empresa",
    }),
    foreignKey({
      columns: [table.empresaId, table.obrigacaoId],
      foreignColumns: [obrigacoes.empresaId, obrigacoes.id],
      name: "fk_obrigacao_documento_empresa_obrigacao",
    }).onDelete("cascade"),
    check(
      "ck_obrigacao_documento_tipo",
      sql`${table.tipo} in ('TOTALIZADOR_DCTFWEB', 'RECIBO_DCTFWEB', 'DARF')`,
    ),
    check(
      "ck_obrigacao_documento_valor",
      sql`${table.valorTotal} >= 0`,
    ),
    check(
      "ck_obrigacao_documento_hash",
      sql`${table.hashSha256} is null or ${table.hashSha256} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const retificacoesObrigacao = pgTable(
  "obrigacao_fiscal_retificacao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    obrigacaoId: uuid("obrigacao_id").notNull(),
    versao: integer("versao").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("SOLICITADA"),
    motivo: text("motivo").notNull(),
    responsavel: varchar("responsavel", { length: 160 }).notNull(),
    protocolo: varchar("protocolo", { length: 160 }),
    snapshotAnterior: jsonb("snapshot_anterior").notNull(),
    hashSnapshotAnterior: varchar("hash_snapshot_anterior", {
      length: 64,
    }).notNull(),
    resultado: jsonb("resultado"),
    solicitadaEm: timestamp("solicitada_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    iniciadaEm: timestamp("iniciada_em", { withTimezone: true }),
    concluidaEm: timestamp("concluida_em", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("uq_retificacao_obrigacao_versao").on(
      table.obrigacaoId,
      table.versao,
    ),
    uniqueIndex("uq_retificacao_obrigacao_ativa")
      .on(table.obrigacaoId)
      .where(sql`${table.status} in ('SOLICITADA', 'EM_ANDAMENTO')`),
    index("ix_retificacao_empresa_status").on(
      table.empresaId,
      table.status,
      table.solicitadaEm,
    ),
    foreignKey({
      columns: [table.empresaId],
      foreignColumns: [empresas.id],
      name: "fk_retificacao_empresa",
    }),
    foreignKey({
      columns: [table.empresaId, table.obrigacaoId],
      foreignColumns: [obrigacoes.empresaId, obrigacoes.id],
      name: "fk_retificacao_empresa_obrigacao",
    }),
    check("ck_retificacao_versao", sql`${table.versao} > 0`),
    check(
      "ck_retificacao_status",
      sql`${table.status} in ('SOLICITADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')`,
    ),
    check(
      "ck_retificacao_motivo",
      sql`length(btrim(${table.motivo})) between 20 and 3000`,
    ),
    check(
      "ck_retificacao_responsavel",
      sql`length(btrim(${table.responsavel})) between 3 and 160`,
    ),
    check(
      "ck_retificacao_hash",
      sql`${table.hashSnapshotAnterior} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "ck_retificacao_snapshot",
      sql`jsonb_typeof(${table.snapshotAnterior}) = 'object'`,
    ),
    check(
      "ck_retificacao_resultado",
      sql`${table.resultado} is null or jsonb_typeof(${table.resultado}) = 'object'`,
    ),
    check(
      "ck_retificacao_conclusao",
      sql`(
        ${table.status} = 'CONCLUIDA'
        and ${table.concluidaEm} is not null
        and ${table.resultado} is not null
      ) or (
        ${table.status} <> 'CONCLUIDA' and ${table.concluidaEm} is null
      )`,
    ),
  ],
);

export const apuracoesFgts = pgTable(
  "fgts_apuracao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    competencia: date("competencia").notNull(),
    versao: integer("versao").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("RASCUNHO"),
    baseInterna: numeric("base_interna", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    valorInterno: numeric("valor_interno", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    baseS5013: numeric("base_s5013", { precision: 18, scale: 2 }),
    valorS5013: numeric("valor_s5013", { precision: 18, scale: 2 }),
    diferenca: numeric("diferenca", { precision: 18, scale: 2 }),
    snapshotFontes: jsonb("snapshot_fontes").notNull(),
    hashFontes: varchar("hash_fontes", { length: 64 }).notNull(),
    responsavel: varchar("responsavel", { length: 160 }).notNull(),
    calculadaEm: timestamp("calculada_em", { withTimezone: true }),
    conciliadaEm: timestamp("conciliada_em", { withTimezone: true }),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_fgts_apuracao_empresa_id").on(table.empresaId, table.id),
    uniqueIndex("uq_fgts_apuracao_competencia_versao").on(
      table.empresaId,
      table.competencia,
      table.versao,
    ),
    uniqueIndex("uq_fgts_apuracao_ativa")
      .on(table.empresaId, table.competencia)
      .where(sql`${table.status} not in ('CANCELADA')`),
    index("ix_fgts_apuracao_empresa_status").on(
      table.empresaId,
      table.status,
      table.competencia,
    ),
    check(
      "ck_fgts_apuracao_competencia",
      sql`${table.competencia} = date_trunc('month', ${table.competencia})::date`,
    ),
    check("ck_fgts_apuracao_versao", sql`${table.versao} > 0`),
    check(
      "ck_fgts_apuracao_status",
      sql`${table.status} in (
        'RASCUNHO', 'CALCULADA', 'TRANSMITIDA', 'CONCILIADA',
        'GUIA_REGISTRADA', 'PAGA', 'BLOQUEADA', 'CANCELADA'
      )`,
    ),
    check(
      "ck_fgts_apuracao_valores",
      sql`${table.baseInterna} >= 0
          and ${table.valorInterno} >= 0
          and (${table.baseS5013} is null or ${table.baseS5013} >= 0)
          and (${table.valorS5013} is null or ${table.valorS5013} >= 0)`,
    ),
    check("ck_fgts_apuracao_hash", sql`${table.hashFontes} ~ '^[0-9a-f]{64}$'`),
    check(
      "ck_fgts_apuracao_snapshot",
      sql`jsonb_typeof(${table.snapshotFontes}) = 'object'`,
    ),
    check(
      "ck_fgts_apuracao_responsavel",
      sql`length(btrim(${table.responsavel})) between 3 and 160`,
    ),
    check(
      "ck_fgts_apuracao_conciliacao",
      sql`(
        ${table.status} in ('CONCILIADA', 'GUIA_REGISTRADA', 'PAGA')
        and ${table.baseS5013} is not null
        and ${table.valorS5013} is not null
        and ${table.diferenca} = 0
        and ${table.conciliadaEm} is not null
      ) or ${table.status} not in ('CONCILIADA', 'GUIA_REGISTRADA', 'PAGA')`,
    ),
  ],
);

export const itensApuracaoFgts = pgTable(
  "fgts_apuracao_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    apuracaoId: uuid("apuracao_id").notNull(),
    pessoaId: uuid("pessoa_id"),
    trabalhadorReferencia: varchar("trabalhador_referencia", { length: 160 }).notNull(),
    matricula: varchar("matricula", { length: 40 }).notNull(),
    categoriaEsocial: varchar("categoria_esocial", { length: 3 }).notNull(),
    tipoValor: varchar("tipo_valor", { length: 40 }).notNull(),
    baseInterna: numeric("base_interna", { precision: 18, scale: 2 }).notNull(),
    aliquotaNumerador: integer("aliquota_numerador").notNull(),
    aliquotaDenominador: integer("aliquota_denominador").notNull(),
    valorInterno: numeric("valor_interno", { precision: 18, scale: 2 }).notNull(),
    baseS5003: numeric("base_s5003", { precision: 18, scale: 2 }),
    valorS5003: numeric("valor_s5003", { precision: 18, scale: 2 }),
    diferenca: numeric("diferenca", { precision: 18, scale: 2 }),
    reciboEsocial: varchar("recibo_esocial", { length: 80 }),
    hashOrigem: varchar("hash_origem", { length: 64 }).notNull(),
    snapshot: jsonb("snapshot").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_fgts_item_apuracao_chave").on(
      table.apuracaoId,
      table.trabalhadorReferencia,
      table.categoriaEsocial,
      table.tipoValor,
    ),
    index("ix_fgts_item_empresa_matricula").on(table.empresaId, table.matricula),
    foreignKey({
      columns: [table.empresaId],
      foreignColumns: [empresas.id],
      name: "fk_fgts_item_empresa",
    }),
    foreignKey({
      columns: [table.empresaId, table.apuracaoId],
      foreignColumns: [apuracoesFgts.empresaId, apuracoesFgts.id],
      name: "fk_fgts_item_empresa_apuracao",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.empresaId, table.pessoaId],
      foreignColumns: [pessoas.empresaId, pessoas.id],
      name: "fk_fgts_item_empresa_pessoa",
    }),
    check("ck_fgts_item_categoria", sql`${table.categoriaEsocial} ~ '^[0-9]{3}$'`),
    check(
      "ck_fgts_item_identificacao",
      sql`length(btrim(${table.trabalhadorReferencia})) between 1 and 160
          and length(btrim(${table.matricula})) between 1 and 40
          and length(btrim(${table.tipoValor})) between 1 and 40`,
    ),
    check(
      "ck_fgts_item_valores",
      sql`${table.baseInterna} >= 0
          and ${table.valorInterno} >= 0
          and ${table.aliquotaNumerador} >= 0
          and ${table.aliquotaDenominador} > 0
          and ${table.aliquotaNumerador} <= ${table.aliquotaDenominador}
          and (${table.baseS5003} is null or ${table.baseS5003} >= 0)
          and (${table.valorS5003} is null or ${table.valorS5003} >= 0)`,
    ),
    check(
      "ck_fgts_item_totalizador",
      sql`(${table.baseS5003} is null and ${table.valorS5003} is null and ${table.diferenca} is null)
          or (${table.baseS5003} is not null and ${table.valorS5003} is not null and ${table.diferenca} is not null)`,
    ),
    check("ck_fgts_item_hash", sql`${table.hashOrigem} ~ '^[0-9a-f]{64}$'`),
    check("ck_fgts_item_snapshot", sql`jsonb_typeof(${table.snapshot}) = 'object'`),
  ],
);

export const eventosEsocial = pgTable(
  "integracao_esocial_evento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    apuracaoFgtsId: uuid("apuracao_fgts_id"),
    competencia: date("competencia"),
    ambiente: varchar("ambiente", { length: 20 }).notNull(),
    provedor: varchar("provedor", { length: 80 }).notNull(),
    tipo: varchar("tipo", { length: 8 }).notNull(),
    identificador: varchar("identificador", { length: 80 }).notNull(),
    versaoLeiaute: varchar("versao_leiaute", { length: 20 }).notNull(),
    estado: varchar("estado", { length: 20 }).notNull().default("RASCUNHO"),
    payload: jsonb("payload").notNull(),
    hashPayload: varchar("hash_payload", { length: 64 }).notNull(),
    protocolo: varchar("protocolo", { length: 160 }),
    recibo: varchar("recibo", { length: 160 }),
    codigoResposta: varchar("codigo_resposta", { length: 40 }),
    mensagem: text("mensagem"),
    resposta: jsonb("resposta"),
    transmitidoEm: timestamp("transmitido_em", { withTimezone: true }),
    concluidoEm: timestamp("concluido_em", { withTimezone: true }),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_esocial_evento_identificador").on(
      table.empresaId,
      table.ambiente,
      table.identificador,
    ),
    index("ix_esocial_evento_empresa_estado").on(
      table.empresaId,
      table.estado,
      table.criadoEm,
    ),
    index("ix_esocial_evento_apuracao").on(table.apuracaoFgtsId, table.tipo),
    foreignKey({
      columns: [table.empresaId],
      foreignColumns: [empresas.id],
      name: "fk_esocial_evento_empresa",
    }),
    foreignKey({
      columns: [table.empresaId, table.apuracaoFgtsId],
      foreignColumns: [apuracoesFgts.empresaId, apuracoesFgts.id],
      name: "fk_esocial_evento_empresa_apuracao",
    }),
    check(
      "ck_esocial_evento_competencia",
      sql`${table.competencia} is null
          or ${table.competencia} = date_trunc('month', ${table.competencia})::date`,
    ),
    check(
      "ck_esocial_evento_ambiente",
      sql`${table.ambiente} in ('PRODUCAO_RESTRITA', 'PRODUCAO')`,
    ),
    check(
      "ck_esocial_evento_tipo",
      sql`${table.tipo} in (
        'S-1000', 'S-1005', 'S-1010', 'S-1020', 'S-2200',
        'S-1200', 'S-1298', 'S-1299', 'S-2299', 'S-2399'
      )`,
    ),
    check(
      "ck_esocial_evento_estado",
      sql`${table.estado} in (
        'RASCUNHO', 'VALIDADO', 'ENFILEIRADO', 'TRANSMITIDO',
        'PROCESSANDO', 'ACEITO', 'REJEITADO', 'CANCELADO'
      )`,
    ),
    check("ck_esocial_evento_payload", sql`jsonb_typeof(${table.payload}) = 'object'`),
    check("ck_esocial_evento_hash", sql`${table.hashPayload} ~ '^[0-9a-f]{64}$'`),
    check(
      "ck_esocial_evento_resposta",
      sql`${table.resposta} is null or jsonb_typeof(${table.resposta}) = 'object'`,
    ),
    check(
      "ck_esocial_evento_transmissao",
      sql`(
        ${table.estado} in ('TRANSMITIDO', 'PROCESSANDO', 'ACEITO', 'REJEITADO')
        and ${table.protocolo} is not null
        and ${table.transmitidoEm} is not null
      ) or ${table.estado} not in ('TRANSMITIDO', 'PROCESSANDO', 'ACEITO', 'REJEITADO')`,
    ),
    check(
      "ck_esocial_evento_conclusao",
      sql`(
        ${table.estado} in ('ACEITO', 'REJEITADO', 'CANCELADO')
        and ${table.concluidoEm} is not null
      ) or (
        ${table.estado} not in ('ACEITO', 'REJEITADO', 'CANCELADO')
        and ${table.concluidoEm} is null
      )`,
    ),
    check(
      "ck_esocial_evento_aceite",
      sql`${table.estado} <> 'ACEITO' or ${table.recibo} is not null`,
    ),
  ],
);

export const guiasFgts = pgTable(
  "fgts_guia",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    apuracaoId: uuid("apuracao_id").notNull(),
    tipo: varchar("tipo", { length: 24 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("REGISTRADA"),
    referenciaOficial: varchar("referencia_oficial", { length: 160 }).notNull(),
    emitidaEm: date("emitida_em").notNull(),
    vencimento: date("vencimento").notNull(),
    valorTotal: numeric("valor_total", { precision: 18, scale: 2 }).notNull(),
    pixCopiaCola: text("pix_copia_cola"),
    localizadorDocumento: text("localizador_documento").notNull(),
    hashDocumento: varchar("hash_documento", { length: 64 }).notNull(),
    pagaEm: timestamp("paga_em", { withTimezone: true }),
    valorPago: numeric("valor_pago", { precision: 18, scale: 2 }),
    localizadorComprovante: text("localizador_comprovante"),
    hashComprovante: varchar("hash_comprovante", { length: 64 }),
    conteudo: jsonb("conteudo").notNull(),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_fgts_guia_referencia").on(
      table.empresaId,
      table.referenciaOficial,
    ),
    index("ix_fgts_guia_empresa_status").on(
      table.empresaId,
      table.status,
      table.vencimento,
    ),
    foreignKey({
      columns: [table.empresaId],
      foreignColumns: [empresas.id],
      name: "fk_fgts_guia_empresa",
    }),
    foreignKey({
      columns: [table.empresaId, table.apuracaoId],
      foreignColumns: [apuracoesFgts.empresaId, apuracoesFgts.id],
      name: "fk_fgts_guia_empresa_apuracao",
    }),
    check(
      "ck_fgts_guia_tipo",
      sql`${table.tipo} in ('GFD_MENSAL', 'GFD_RESCISORIA', 'GFD_MISTA')`,
    ),
    check(
      "ck_fgts_guia_status",
      sql`${table.status} in ('REGISTRADA', 'PAGA', 'VENCIDA', 'CANCELADA')`,
    ),
    check("ck_fgts_guia_datas", sql`${table.vencimento} >= ${table.emitidaEm}`),
    check(
      "ck_fgts_guia_valores",
      sql`${table.valorTotal} >= 0
          and (${table.valorPago} is null or ${table.valorPago} >= 0)`,
    ),
    check(
      "ck_fgts_guia_hashes",
      sql`${table.hashDocumento} ~ '^[0-9a-f]{64}$'
          and (${table.hashComprovante} is null or ${table.hashComprovante} ~ '^[0-9a-f]{64}$')`,
    ),
    check("ck_fgts_guia_conteudo", sql`jsonb_typeof(${table.conteudo}) = 'object'`),
    check(
      "ck_fgts_guia_pagamento",
      sql`(
        ${table.status} = 'PAGA'
        and ${table.pagaEm} is not null
        and ${table.valorPago} = ${table.valorTotal}
        and ${table.localizadorComprovante} is not null
        and ${table.hashComprovante} is not null
      ) or (
        ${table.status} <> 'PAGA'
        and ${table.pagaEm} is null
        and ${table.valorPago} is null
        and ${table.localizadorComprovante} is null
        and ${table.hashComprovante} is null
      )`,
    ),
  ],
);

export const obrigacoesFolhas = pgTable(
  "obrigacao_fiscal_folha",
  {
    obrigacaoId: uuid("obrigacao_id")
      .notNull()
      .references(() => obrigacoes.id, { onDelete: "cascade" }),
    folhaId: uuid("folha_id")
      .notNull()
      .references(() => folhas.id),
    revisao: integer("revisao").notNull(),
    hashFolha: varchar("hash_folha", { length: 64 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.obrigacaoId, table.folhaId] }),
    check("ck_obrigacao_folha_revisao", sql`${table.revisao} > 0`),
    check(
      "ck_obrigacao_folha_hash",
      sql`${table.hashFolha} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const folhasLegado = pgTable(
  "legado_folha",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    origem: varchar("origem", { length: 40 }).notNull().default("GIW"),
    legacyId: varchar("legacy_id", { length: 100 }).notNull(),
    competencia: date("competencia").notNull(),
    numero: varchar("numero", { length: 60 }).notNull(),
    termoLegacyId: varchar("termo_legacy_id", { length: 100 }),
    metaLegacyId: varchar("meta_legacy_id", { length: 100 }),
    status: varchar("status", { length: 40 }).notNull(),
    dataPagamento: date("data_pagamento"),
    totalProventos: numeric("total_proventos", { precision: 18, scale: 2 }).notNull(),
    totalDescontos: numeric("total_descontos", { precision: 18, scale: 2 }).notNull(),
    baseInss: numeric("base_inss", { precision: 18, scale: 2 }).notNull(),
    valorInss: numeric("valor_inss", { precision: 18, scale: 2 }).notNull(),
    baseIrrf: numeric("base_irrf", { precision: 18, scale: 2 }).notNull(),
    valorIrrf: numeric("valor_irrf", { precision: 18, scale: 2 }).notNull(),
    totalLiquido: numeric("total_liquido", { precision: 18, scale: 2 }).notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    extraidoEm: timestamp("extraido_em", { withTimezone: true }).notNull(),
    snapshot: jsonb("snapshot").notNull(),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_legado_folha_empresa_id").on(table.empresaId, table.id),
    uniqueIndex("uq_legado_folha_origem_id").on(
      table.empresaId,
      table.origem,
      table.legacyId,
    ),
    index("ix_legado_folha_competencia").on(table.empresaId, table.competencia),
    foreignKey({
      columns: [table.empresaId],
      foreignColumns: [empresas.id],
      name: "fk_legado_folha_empresa",
    }),
    check(
      "ck_legado_folha_competencia",
      sql`${table.competencia} = date_trunc('month', ${table.competencia})::date`,
    ),
    check(
      "ck_legado_folha_valores",
      sql`${table.totalProventos} >= 0 and ${table.totalDescontos} >= 0
          and ${table.baseInss} >= 0 and ${table.valorInss} >= 0
          and ${table.baseIrrf} >= 0 and ${table.valorIrrf} >= 0
          and ${table.totalLiquido} >= 0
          and ${table.totalLiquido} =
            round(${table.totalProventos} - ${table.totalDescontos}, 2)`,
    ),
    check("ck_legado_folha_checksum", sql`${table.checksum} ~ '^[0-9a-f]{64}$'`),
    check(
      "ck_legado_folha_snapshot",
      sql`jsonb_typeof(${table.snapshot}) = 'object'`,
    ),
  ],
);

export const itensFolhaLegado = pgTable(
  "legado_folha_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    folhaLegadoId: uuid("folha_legado_id").notNull(),
    legacyId: varchar("legacy_id", { length: 100 }).notNull(),
    pessoaLegacyId: varchar("pessoa_legacy_id", { length: 100 }).notNull(),
    vinculoLegacyId: varchar("vinculo_legacy_id", { length: 100 }),
    matricula: varchar("matricula", { length: 80 }).notNull(),
    nome: varchar("nome", { length: 180 }).notNull(),
    cpf: varchar("cpf", { length: 11 }),
    cnpj: varchar("cnpj", { length: 14 }),
    totalProventos: numeric("total_proventos", { precision: 18, scale: 2 }).notNull(),
    totalDescontos: numeric("total_descontos", { precision: 18, scale: 2 }).notNull(),
    baseInss: numeric("base_inss", { precision: 18, scale: 2 }).notNull(),
    valorInss: numeric("valor_inss", { precision: 18, scale: 2 }).notNull(),
    baseIrrf: numeric("base_irrf", { precision: 18, scale: 2 }).notNull(),
    valorIrrf: numeric("valor_irrf", { precision: 18, scale: 2 }).notNull(),
    totalLiquido: numeric("total_liquido", { precision: 18, scale: 2 }).notNull(),
    snapshot: jsonb("snapshot").notNull(),
  },
  (table) => [
    uniqueIndex("uq_legado_folha_item_empresa_id").on(table.empresaId, table.id),
    uniqueIndex("uq_legado_folha_item_legacy").on(
      table.folhaLegadoId,
      table.legacyId,
    ),
    index("ix_legado_folha_item_pessoa").on(table.empresaId, table.pessoaLegacyId),
    foreignKey({
      columns: [table.empresaId, table.folhaLegadoId],
      foreignColumns: [folhasLegado.empresaId, folhasLegado.id],
      name: "fk_legado_folha_item_empresa_folha",
    }).onDelete("cascade"),
    check(
      "ck_legado_folha_item_cpf",
      sql`${table.cpf} is null or ${table.cpf} ~ '^[0-9]{11}$'`,
    ),
    check(
      "ck_legado_folha_item_cnpj",
      sql`${table.cnpj} is null or ${table.cnpj} ~ '^[0-9]{14}$'`,
    ),
    check(
      "ck_legado_folha_item_documento",
      sql`${table.cpf} is null or ${table.cnpj} is null`,
    ),
    check(
      "ck_legado_folha_item_valores",
      sql`${table.totalProventos} >= 0 and ${table.totalDescontos} >= 0
          and ${table.baseInss} >= 0 and ${table.valorInss} >= 0
          and ${table.baseIrrf} >= 0 and ${table.valorIrrf} >= 0
          and ${table.totalLiquido} >= 0
          and ${table.totalLiquido} =
            round(${table.totalProventos} - ${table.totalDescontos}, 2)`,
    ),
    check(
      "ck_legado_folha_item_snapshot",
      sql`jsonb_typeof(${table.snapshot}) = 'object'`,
    ),
  ],
);

export const rubricasFolhaLegado = pgTable(
  "legado_folha_item_rubrica",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    folhaItemLegadoId: uuid("folha_item_legado_id").notNull(),
    legacyId: varchar("legacy_id", { length: 100 }).notNull(),
    eventoLegacyId: varchar("evento_legacy_id", { length: 100 }),
    codigo: varchar("codigo", { length: 40 }).notNull(),
    descricao: varchar("descricao", { length: 180 }).notNull(),
    natureza: varchar("natureza", { length: 20 }).notNull(),
    referencia: varchar("referencia", { length: 60 }),
    baseCalculo: numeric("base_calculo", { precision: 18, scale: 2 }).notNull(),
    valor: numeric("valor", { precision: 18, scale: 2 }).notNull(),
    incideInss: boolean("incide_inss"),
    incideIrrf: boolean("incide_irrf"),
    snapshot: jsonb("snapshot").notNull(),
  },
  (table) => [
    uniqueIndex("uq_legado_folha_rubrica_legacy").on(
      table.folhaItemLegadoId,
      table.legacyId,
    ),
    index("ix_legado_folha_rubrica_codigo").on(table.empresaId, table.codigo),
    foreignKey({
      columns: [table.empresaId, table.folhaItemLegadoId],
      foreignColumns: [itensFolhaLegado.empresaId, itensFolhaLegado.id],
      name: "fk_legado_folha_rubrica_empresa_item",
    }).onDelete("cascade"),
    check(
      "ck_legado_folha_rubrica_natureza",
      sql`${table.natureza} in ('PROVENTO', 'DESCONTO', 'INFORMATIVO')`,
    ),
    check(
      "ck_legado_folha_rubrica_valores",
      sql`${table.baseCalculo} >= 0 and ${table.valor} >= 0`,
    ),
    check(
      "ck_legado_folha_rubrica_snapshot",
      sql`jsonb_typeof(${table.snapshot}) = 'object'`,
    ),
  ],
);

export const guiasInssLegado = pgTable(
  "legado_guia_inss",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull(),
    origem: varchar("origem", { length: 40 }).notNull().default("GIW"),
    legacyId: varchar("legacy_id", { length: 100 }).notNull(),
    competencia: date("competencia").notNull(),
    tipo: varchar("tipo", { length: 30 }).notNull(),
    status: varchar("status", { length: 40 }).notNull(),
    identificador: varchar("identificador", { length: 180 }),
    pessoaLegacyId: varchar("pessoa_legacy_id", { length: 100 }),
    beneficiarioNome: varchar("beneficiario_nome", { length: 180 }),
    lote: varchar("lote", { length: 80 }),
    codigoReceita: varchar("codigo_receita", { length: 40 }),
    vencimento: date("vencimento").notNull(),
    pagamento: date("pagamento"),
    principal: numeric("principal", { precision: 18, scale: 2 }).notNull(),
    juros: numeric("juros", { precision: 18, scale: 2 }).notNull(),
    multa: numeric("multa", { precision: 18, scale: 2 }).notNull(),
    compensacoes: numeric("compensacoes", { precision: 18, scale: 2 }).notNull(),
    total: numeric("total", { precision: 18, scale: 2 }).notNull(),
    folhaLegacyIds: jsonb("folha_legacy_ids").notNull().default([]),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    extraidoEm: timestamp("extraido_em", { withTimezone: true }).notNull(),
    snapshot: jsonb("snapshot").notNull(),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_legado_guia_empresa_id").on(table.empresaId, table.id),
    uniqueIndex("uq_legado_guia_origem_id").on(
      table.empresaId,
      table.origem,
      table.legacyId,
    ),
    index("ix_legado_guia_competencia").on(table.empresaId, table.competencia),
    index("ix_legado_guia_pessoa").on(table.empresaId, table.pessoaLegacyId),
    foreignKey({
      columns: [table.empresaId],
      foreignColumns: [empresas.id],
      name: "fk_legado_guia_empresa",
    }),
    check(
      "ck_legado_guia_competencia",
      sql`${table.competencia} = date_trunc('month', ${table.competencia})::date`,
    ),
    check(
      "ck_legado_guia_tipo",
      sql`${table.tipo} in ('GPS', 'DARF_PREVIDENCIARIO', 'DCTFWEB')`,
    ),
    check(
      "ck_legado_guia_valores",
      sql`${table.principal} >= 0 and ${table.juros} >= 0
          and ${table.multa} >= 0 and ${table.compensacoes} >= 0
          and ${table.total} >= 0
          and ${table.total} = round(
            ${table.principal} + ${table.juros} + ${table.multa} - ${table.compensacoes},
            2
          )`,
    ),
    check(
      "ck_legado_guia_folhas",
      sql`jsonb_typeof(${table.folhaLegacyIds}) = 'array'`,
    ),
    check("ck_legado_guia_checksum", sql`${table.checksum} ~ '^[0-9a-f]{64}$'`),
    check(
      "ck_legado_guia_snapshot",
      sql`jsonb_typeof(${table.snapshot}) = 'object'`,
    ),
  ],
);

export const importacoes = pgTable(
  "importacao_execucao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    origem: varchar("origem", { length: 40 }).notNull().default("GIW"),
    entidade: varchar("entidade", { length: 80 }).notNull(),
    arquivo: varchar("arquivo", { length: 255 }).notNull(),
    checksumArquivo: varchar("checksum_arquivo", { length: 64 }).notNull(),
    modo: varchar("modo", { length: 12 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    totalLidos: integer("total_lidos").notNull().default(0),
    totalInseridos: integer("total_inseridos").notNull().default(0),
    totalAtualizados: integer("total_atualizados").notNull().default(0),
    totalIgnorados: integer("total_ignorados").notNull().default(0),
    totalErros: integer("total_erros").notNull().default(0),
    resumo: jsonb("resumo").notNull().default({}),
    iniciadoEm: timestamp("iniciado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    concluidoEm: timestamp("concluido_em", { withTimezone: true }),
  },
  (table) => [
    index("ix_importacao_empresa_data").on(table.empresaId, table.iniciadoEm),
    index("ix_importacao_checksum").on(table.checksumArquivo),
    check(
      "ck_importacao_modo",
      sql`${table.modo} in ('DRY_RUN', 'APLICAR')`,
    ),
    check(
      "ck_importacao_status",
      sql`${table.status} in ('EM_ANDAMENTO', 'CONCLUIDA', 'CONCLUIDA_COM_ERROS', 'FALHA')`,
    ),
    check(
      "ck_importacao_totais",
      sql`${table.totalLidos} >= 0 and ${table.totalInseridos} >= 0
          and ${table.totalAtualizados} >= 0 and ${table.totalIgnorados} >= 0
          and ${table.totalErros} >= 0
          and ${table.totalInseridos} + ${table.totalAtualizados}
            + ${table.totalIgnorados} + ${table.totalErros} <= ${table.totalLidos}`,
    ),
  ],
);

export const importacaoRegistros = pgTable(
  "importacao_registro",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    execucaoId: uuid("execucao_id")
      .notNull()
      .references(() => importacoes.id, { onDelete: "cascade" }),
    ordem: integer("ordem").notNull(),
    legacyId: varchar("legacy_id", { length: 100 }).notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    destinoTabela: varchar("destino_tabela", { length: 80 }),
    destinoId: uuid("destino_id"),
    erro: text("erro"),
    payload: jsonb("payload").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_importacao_registro_ordem").on(table.execucaoId, table.ordem),
    index("ix_importacao_registro_legado").on(table.legacyId),
    check("ck_importacao_registro_ordem", sql`${table.ordem} > 0`),
    check(
      "ck_importacao_registro_status",
      sql`${table.status} in ('INSERIDO', 'ATUALIZADO', 'IGNORADO', 'ERRO')`,
    ),
    check(
      "ck_importacao_registro_erro",
      sql`(${table.status} = 'ERRO' and ${table.erro} is not null)
          or (${table.status} <> 'ERRO' and ${table.destinoId} is not null)`,
    ),
  ],
);

export const chavesLegado = pgTable(
  "legado_chave",
  {
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    origem: varchar("origem", { length: 40 }).notNull(),
    entidade: varchar("entidade", { length: 80 }).notNull(),
    legacyId: varchar("legacy_id", { length: 100 }).notNull(),
    destinoTabela: varchar("destino_tabela", { length: 80 }).notNull(),
    destinoId: uuid("destino_id").notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    primeiraExecucaoId: uuid("primeira_execucao_id")
      .notNull()
      .references(() => importacoes.id),
    ultimaExecucaoId: uuid("ultima_execucao_id")
      .notNull()
      .references(() => importacoes.id),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.empresaId, table.origem, table.entidade, table.legacyId],
    }),
    index("ix_legado_chave_destino").on(table.destinoTabela, table.destinoId),
  ],
);

export const auditorias = pgTable(
  "auditoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    ator: varchar("ator", { length: 160 }).notNull(),
    entidade: varchar("entidade", { length: 80 }).notNull(),
    registroId: uuid("registro_id").notNull(),
    acao: varchar("acao", { length: 30 }).notNull(),
    motivo: text("motivo"),
    dadosAnteriores: jsonb("dados_anteriores"),
    dadosPosteriores: jsonb("dados_posteriores"),
    correlacaoId: uuid("correlacao_id").notNull().defaultRandom(),
    ocorridoEm: timestamp("ocorrido_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_auditoria_registro").on(
      table.empresaId,
      table.entidade,
      table.registroId,
      table.ocorridoEm,
    ),
    index("ix_auditoria_correlacao").on(table.correlacaoId),
    check(
      "ck_auditoria_acao",
      sql`${table.acao} in (
        'CRIACAO', 'ALTERACAO', 'INATIVACAO', 'REATIVACAO', 'EXCLUSAO',
        'PROCESSAMENTO', 'FECHAMENTO', 'REABERTURA',
        'CANCELAMENTO', 'ESTORNO', 'IMPORTACAO'
      )`,
    ),
    check(
      "ck_auditoria_conteudo",
      sql`${table.dadosAnteriores} is not null or ${table.dadosPosteriores} is not null`,
    ),
  ],
);

export const tarefasProcessamento = pgTable(
  "tarefa_processamento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id),
    tipo: varchar("tipo", { length: 60 }).notNull(),
    chaveIdempotencia: varchar("chave_idempotencia", { length: 180 }).notNull(),
    status: statusTarefa("status").notNull().default("PENDENTE"),
    prioridade: integer("prioridade").notNull().default(100),
    payload: jsonb("payload").notNull(),
    resultado: jsonb("resultado"),
    tentativas: integer("tentativas").notNull().default(0),
    maxTentativas: integer("max_tentativas").notNull().default(3),
    disponivelEm: timestamp("disponivel_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    bloqueadaEm: timestamp("bloqueada_em", { withTimezone: true }),
    bloqueadaPor: varchar("bloqueada_por", { length: 120 }),
    iniciadaEm: timestamp("iniciada_em", { withTimezone: true }),
    concluidaEm: timestamp("concluida_em", { withTimezone: true }),
    ultimoErro: text("ultimo_erro"),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_tarefa_idempotencia").on(
      table.empresaId,
      table.tipo,
      table.chaveIdempotencia,
    ),
    index("ix_tarefa_disponivel").on(
      table.status,
      table.disponivelEm,
      table.prioridade,
    ),
    index("ix_tarefa_empresa_data").on(table.empresaId, table.criadoEm),
    check("ck_tarefa_prioridade", sql`${table.prioridade} >= 0`),
    check(
      "ck_tarefa_tentativas",
      sql`${table.tentativas} >= 0
          and ${table.maxTentativas} > 0
          and ${table.tentativas} <= ${table.maxTentativas}`,
    ),
    check(
      "ck_tarefa_execucao",
      sql`${table.status} <> 'EXECUTANDO'
          or (${table.bloqueadaEm} is not null and ${table.bloqueadaPor} is not null)`,
    ),
    check(
      "ck_tarefa_conclusao",
      sql`${table.status} <> 'CONCLUIDA'
          or (${table.concluidaEm} is not null and ${table.resultado} is not null)`,
    ),
    check(
      "ck_tarefa_falha",
      sql`${table.status} <> 'FALHA' or ${table.ultimoErro} is not null`,
    ),
  ],
);
