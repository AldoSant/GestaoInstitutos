import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
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
    email: varchar("email", { length: 180 }),
    telefone: varchar("telefone", { length: 20 }),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_pessoa_empresa_cpf").on(table.empresaId, table.cpf),
    uniqueIndex("uq_pessoa_empresa_cnpj").on(table.empresaId, table.cnpj),
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
    uniqueIndex("uq_prestador_empresa_pessoa").on(table.empresaId, table.pessoaId),
    uniqueIndex("uq_prestador_empresa_matricula").on(
      table.empresaId,
      table.matricula,
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
    uniqueIndex("uq_termo_empresa_numero").on(table.empresaId, table.numero),
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
    descontaInss: boolean("desconta_inss").notNull().default(true),
    descontaIrrf: boolean("desconta_irrf").notNull().default(true),
    ativo: boolean("ativo").notNull().default(true),
    ...auditoriaBasica,
  },
  (table) => [
    index("ix_vinculo_empresa_ativo").on(table.empresaId, table.ativo),
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
    uniqueIndex("uq_regra_empresa_codigo_versao").on(
      table.empresaId,
      table.codigo,
      table.versao,
    ),
    check("ck_regra_versao", sql`${table.versao} > 0`),
    check(
      "ck_regra_vigencia",
      sql`${table.fimVigencia} is null or ${table.fimVigencia} >= ${table.inicioVigencia}`,
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
    competencia: date("competencia").notNull(),
    numero: integer("numero").notNull(),
    status: statusFolha("status").notNull().default("RASCUNHO"),
    processadaEm: timestamp("processada_em", { withTimezone: true }),
    fechadaEm: timestamp("fechada_em", { withTimezone: true }),
    hashResultado: varchar("hash_resultado", { length: 64 }),
    ...auditoriaBasica,
  },
  (table) => [
    uniqueIndex("uq_folha_empresa_competencia_numero").on(
      table.empresaId,
      table.competencia,
      table.numero,
    ),
    index("ix_folha_empresa_status").on(table.empresaId, table.status),
    check("ck_folha_numero", sql`${table.numero} > 0`),
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

export const itensFolha = pgTable(
  "folha_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folhaId: uuid("folha_id")
      .notNull()
      .references(() => folhas.id, { onDelete: "cascade" }),
    vinculoId: uuid("vinculo_id")
      .notNull()
      .references(() => vinculos.id),
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
    uniqueIndex("uq_folha_item_vinculo").on(table.folhaId, table.vinculoId),
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
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id),
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
    bloqueioMotivo: text("bloqueio_motivo"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
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
      "ck_obrigacao_bloqueio_motivo",
      sql`${table.status} <> 'BLOQUEADA' or ${table.bloqueioMotivo} is not null`,
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
  },
  (table) => [primaryKey({ columns: [table.obrigacaoId, table.folhaId] })],
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
