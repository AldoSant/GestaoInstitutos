-- MVP Folha de Pagamento + Guia de INSS
-- PostgreSQL 15+. Valores fiscais de exemplo NÃO são inseridos: carregue apenas
-- tabelas oficiais validadas para cada vigência.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE tipo_pessoa AS ENUM ('FISICA','JURIDICA');
CREATE TYPE perfil_codigo AS ENUM ('ADMINISTRADOR','OPERADOR','CONSULTA');
CREATE TYPE tipo_evento AS ENUM ('PROVENTO','DESCONTO','INFORMATIVO');
CREATE TYPE modo_calculo AS ENUM ('VALOR_INFORMADO','VALOR_FIXO','PERCENTUAL','QUANTIDADE_X_VALOR','FORMULA');
CREATE TYPE origem_lancamento AS ENUM ('MANUAL','RECORRENTE','PRODUTIVIDADE','CALCULO');
CREATE TYPE tipo_folha AS ENUM ('NORMAL','COMPLEMENTAR','DECIMO_TERCEIRO');
CREATE TYPE status_folha AS ENUM ('RASCUNHO','PROCESSANDO','ABERTA','FECHADA','PAGA','CANCELADA');
CREATE TYPE status_guia AS ENUM ('RASCUNHO','EM_ABERTO','PARCIAL','PAGA','CANCELADA');

CREATE TABLE empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj varchar(14) NOT NULL UNIQUE,
  razao_social varchar(180) NOT NULL,
  nome_fantasia varchar(180),
  inscricao varchar(40),
  identificador varchar(40),
  cep varchar(8), endereco varchar(180), numero varchar(20), bairro varchar(100),
  municipio_codigo varchar(10), telefone_1 varchar(20), telefone_2 varchar(20),
  email varchar(180), site varchar(255), ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf varchar(11) NOT NULL UNIQUE,
  nome varchar(160) NOT NULL,
  email varchar(180),
  senha_hash text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_login_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuario_empresa (
  usuario_id uuid NOT NULL REFERENCES usuario(id),
  empresa_id uuid NOT NULL REFERENCES empresa(id),
  perfil perfil_codigo NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  PRIMARY KEY (usuario_id, empresa_id)
);

CREATE TABLE sessao_operacional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuario(id),
  empresa_id uuid NOT NULL REFERENCES empresa(id),
  ano_ativo smallint NOT NULL CHECK (ano_ativo BETWEEN 2000 AND 2200),
  ativar_carimbo boolean NOT NULL DEFAULT false,
  iniciada_em timestamptz NOT NULL DEFAULT now(), encerrada_em timestamptz
);

CREATE TABLE pessoa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa(id),
  codigo bigint GENERATED ALWAYS AS IDENTITY,
  tipo tipo_pessoa NOT NULL,
  nome_razao_social varchar(180) NOT NULL,
  nome_fantasia varchar(180), cpf varchar(11), cnpj varchar(14),
  rg varchar(30), orgao_emissor varchar(20), uf_emissor char(2), data_emissao date,
  nascimento date, sexo char(1) CHECK (sexo IN ('M','F') OR sexo IS NULL),
  inscricao_inss varchar(30), conselho_tipo varchar(30), conselho_numero varchar(40),
  email varchar(180), telefone varchar(20), celular varchar(20),
  eh_prestador boolean NOT NULL DEFAULT false,
  eh_parceiro boolean NOT NULL DEFAULT false,
  eh_fornecedor boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo), UNIQUE NULLS NOT DISTINCT (empresa_id, cpf),
  UNIQUE NULLS NOT DISTINCT (empresa_id, cnpj),
  CHECK ((tipo='FISICA' AND cnpj IS NULL) OR (tipo='JURIDICA' AND cpf IS NULL))
);

CREATE TABLE pessoa_endereco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pessoa_id uuid NOT NULL REFERENCES pessoa(id) ON DELETE CASCADE,
  cep varchar(8), logradouro varchar(180), numero varchar(20), complemento varchar(100),
  bairro varchar(100), municipio_codigo varchar(10), referencia varchar(180), principal boolean NOT NULL DEFAULT true
);

CREATE TABLE pessoa_conta_bancaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pessoa_id uuid NOT NULL REFERENCES pessoa(id) ON DELETE CASCADE,
  banco_codigo varchar(10) NOT NULL, agencia varchar(20) NOT NULL, conta varchar(30) NOT NULL,
  digito varchar(5), variacao varchar(10), principal boolean NOT NULL DEFAULT true, ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE parceiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresa(id),
  pessoa_id uuid NOT NULL REFERENCES pessoa(id), ativo boolean NOT NULL DEFAULT true,
  UNIQUE (empresa_id, pessoa_id)
);

CREATE TABLE prestador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresa(id),
  pessoa_id uuid NOT NULL REFERENCES pessoa(id), matricula varchar(40) NOT NULL,
  nit_pis_pasep varchar(30), aposentado boolean NOT NULL DEFAULT false,
  isento_inss boolean NOT NULL DEFAULT false, categoria_contribuinte varchar(30),
  ativo boolean NOT NULL DEFAULT true,
  UNIQUE (empresa_id, pessoa_id), UNIQUE (empresa_id, matricula)
);

CREATE TABLE dependente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), prestador_id uuid NOT NULL REFERENCES prestador(id) ON DELETE CASCADE,
  nome varchar(180) NOT NULL, cpf varchar(11), nascimento date NOT NULL,
  parentesco varchar(40) NOT NULL, estudante boolean NOT NULL DEFAULT false,
  considera_irrf boolean NOT NULL DEFAULT true, considera_salario_familia boolean NOT NULL DEFAULT false,
  inicio_validade date NOT NULL, fim_validade date
);

CREATE TABLE lotacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresa(id),
  codigo varchar(20) NOT NULL, descricao varchar(160) NOT NULL, ativo boolean NOT NULL DEFAULT true,
  UNIQUE (empresa_id, codigo)
);

CREATE TABLE tabela_atividade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresa(id),
  codigo varchar(30) NOT NULL, descricao varchar(160) NOT NULL, inicio_vigencia date NOT NULL,
  fim_vigencia date, ativo boolean NOT NULL DEFAULT true, UNIQUE (empresa_id, codigo, inicio_vigencia)
);

CREATE TABLE atividade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tabela_atividade_id uuid NOT NULL REFERENCES tabela_atividade(id),
  codigo varchar(30) NOT NULL, descricao varchar(180) NOT NULL,
  carga_horaria numeric(10,2), valor_retribuicao numeric(18,2) NOT NULL CHECK (valor_retribuicao >= 0),
  ativo boolean NOT NULL DEFAULT true, UNIQUE (tabela_atividade_id, codigo)
);

CREATE TABLE termo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresa(id),
  parceiro_id uuid NOT NULL REFERENCES parceiro(id), numero varchar(60) NOT NULL,
  descricao varchar(255) NOT NULL, modalidade varchar(80) NOT NULL,
  taxa_percentual numeric(9,4) NOT NULL DEFAULT 0, taxa_sobre_liquido boolean NOT NULL DEFAULT false,
  inicio date NOT NULL, fim date, valor_global numeric(18,2) NOT NULL,
  objetivos text, ativo boolean NOT NULL DEFAULT true,
  UNIQUE (empresa_id, numero), CHECK (fim IS NULL OR fim >= inicio), CHECK (valor_global >= 0)
);

CREATE TABLE termo_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), termo_id uuid NOT NULL REFERENCES termo(id) ON DELETE CASCADE,
  codigo varchar(40) NOT NULL, descricao varchar(255) NOT NULL, inicio date, fim date,
  valor_previsto numeric(18,2) NOT NULL DEFAULT 0, ativo boolean NOT NULL DEFAULT true,
  UNIQUE (termo_id, codigo)
);

CREATE TABLE prestador_vinculo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresa(id),
  prestador_id uuid NOT NULL REFERENCES prestador(id), termo_id uuid NOT NULL REFERENCES termo(id),
  meta_id uuid NOT NULL REFERENCES termo_meta(id), atividade_id uuid NOT NULL REFERENCES atividade(id),
  lotacao_id uuid REFERENCES lotacao(id), numero_contrato varchar(60),
  inicio date NOT NULL, fim date, valor_retribuicao numeric(18,2) NOT NULL,
  carga_horaria numeric(10,2), desconta_inss boolean NOT NULL DEFAULT true,
  desconta_irrf boolean NOT NULL DEFAULT true, ativo boolean NOT NULL DEFAULT true,
  CHECK (fim IS NULL OR fim >= inicio), CHECK (valor_retribuicao >= 0)
);

CREATE TABLE evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresa(id),
  numero varchar(20) NOT NULL, descricao varchar(180) NOT NULL, tipo tipo_evento NOT NULL,
  modo modo_calculo NOT NULL, valor_referencia numeric(18,6),
  incide_inss boolean NOT NULL DEFAULT false, incide_irrf boolean NOT NULL DEFAULT false,
  incide_salario_familia boolean NOT NULL DEFAULT false, incide_auxilio_tributos boolean NOT NULL DEFAULT false,
  gera_prestacao_contas boolean NOT NULL DEFAULT false, ativo boolean NOT NULL DEFAULT true,
  UNIQUE (empresa_id, numero)
);

CREATE TABLE evento_composicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), evento_id uuid NOT NULL REFERENCES evento(id) ON DELETE CASCADE,
  ordem smallint NOT NULL, modo modo_calculo NOT NULL, operacao char(1) NOT NULL CHECK (operacao IN ('+','-','*','/')),
  valor_fracao numeric(18,6), evento_base_id uuid REFERENCES evento(id), UNIQUE (evento_id, ordem)
);

CREATE TABLE parametro_folha_empresa (
  empresa_id uuid PRIMARY KEY REFERENCES empresa(id), aliquota_inss_prestador numeric(9,4) NOT NULL,
  aliquota_inss_patronal numeric(9,4) NOT NULL DEFAULT 0, codigo_pagamento_gps varchar(10),
  evento_retribuicao_id uuid REFERENCES evento(id), evento_inss_id uuid REFERENCES evento(id),
  evento_irrf_id uuid REFERENCES evento(id), evento_salario_familia_id uuid REFERENCES evento(id),
  evento_auxilio_tributos_id uuid REFERENCES evento(id),
  conciliar_individualmente boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inss_limite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), inicio_vigencia date NOT NULL, fim_vigencia date NOT NULL,
  valor_limite_contribuicao numeric(18,2) NOT NULL CHECK (valor_limite_contribuicao >= 0),
  UNIQUE (inicio_vigencia), CHECK (fim_vigencia >= inicio_vigencia)
);

CREATE TABLE irrf_tabela (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), inicio_vigencia date NOT NULL, fim_vigencia date,
  deducao_dependente numeric(18,2) NOT NULL DEFAULT 0, deducao_aposentadoria numeric(18,2) NOT NULL DEFAULT 0,
  publicado_por varchar(120), UNIQUE (inicio_vigencia)
);
CREATE TABLE irrf_faixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tabela_id uuid NOT NULL REFERENCES irrf_tabela(id) ON DELETE CASCADE,
  faixa smallint NOT NULL, valor_inicial numeric(18,2) NOT NULL, valor_final numeric(18,2),
  aliquota numeric(9,4) NOT NULL, deducao numeric(18,2) NOT NULL DEFAULT 0, UNIQUE (tabela_id, faixa)
);

CREATE TABLE salario_familia_tabela (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), inicio_vigencia date NOT NULL, fim_vigencia date,
  UNIQUE (inicio_vigencia)
);
CREATE TABLE salario_familia_faixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tabela_id uuid NOT NULL REFERENCES salario_familia_tabela(id) ON DELETE CASCADE,
  faixa smallint NOT NULL, valor_inicial numeric(18,2) NOT NULL, valor_final numeric(18,2),
  valor_cota numeric(18,2) NOT NULL, UNIQUE (tabela_id, faixa)
);
CREATE TABLE salario_minimo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), inicio_vigencia date NOT NULL, fim_vigencia date,
  valor numeric(18,2) NOT NULL, UNIQUE (inicio_vigencia)
);

CREATE TABLE lancamento_evento_recorrente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresa(id),
  vinculo_id uuid NOT NULL REFERENCES prestador_vinculo(id), evento_id uuid NOT NULL REFERENCES evento(id),
  inicio_competencia date NOT NULL, fim_competencia date, quantidade numeric(18,6), valor numeric(18,2),
  ativo boolean NOT NULL DEFAULT true, CHECK (date_trunc('month',inicio_competencia)=inicio_competencia)
);

CREATE TABLE produtividade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresa(id),
  vinculo_id uuid NOT NULL REFERENCES prestador_vinculo(id), competencia date NOT NULL,
  quantidade numeric(18,6) NOT NULL CHECK (quantidade >= 0),
  valor_unitario numeric(18,6) NOT NULL CHECK (valor_unitario >= 0),
  valor_total numeric(18,2) GENERATED ALWAYS AS (round(quantidade * valor_unitario, 2)) STORED,
  criado_por uuid NOT NULL REFERENCES usuario(id), criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vinculo_id, competencia), CHECK (date_trunc('month',competencia)=competencia)
);

CREATE TABLE folha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresa(id),
  termo_id uuid NOT NULL REFERENCES termo(id), meta_id uuid NOT NULL REFERENCES termo_meta(id),
  competencia date NOT NULL, tipo tipo_folha NOT NULL DEFAULT 'NORMAL', numero bigint NOT NULL,
  status status_folha NOT NULL DEFAULT 'RASCUNHO', processada_em timestamptz, fechada_em timestamptz,
  processada_por uuid REFERENCES usuario(id), versao_calculo integer NOT NULL DEFAULT 1,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, competencia, tipo, numero),
  CHECK (date_trunc('month',competencia)=competencia)
);

CREATE TABLE folha_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), folha_id uuid NOT NULL REFERENCES folha(id) ON DELETE CASCADE,
  vinculo_id uuid NOT NULL REFERENCES prestador_vinculo(id),
  total_proventos numeric(18,2) NOT NULL DEFAULT 0, total_descontos numeric(18,2) NOT NULL DEFAULT 0,
  base_inss numeric(18,2) NOT NULL DEFAULT 0, valor_inss numeric(18,2) NOT NULL DEFAULT 0,
  base_irrf numeric(18,2) NOT NULL DEFAULT 0, valor_irrf numeric(18,2) NOT NULL DEFAULT 0,
  salario_familia numeric(18,2) NOT NULL DEFAULT 0, liquido numeric(18,2) NOT NULL DEFAULT 0,
  UNIQUE (folha_id, vinculo_id)
);

CREATE TABLE folha_lancamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), folha_item_id uuid NOT NULL REFERENCES folha_item(id) ON DELETE CASCADE,
  evento_id uuid NOT NULL REFERENCES evento(id), origem origem_lancamento NOT NULL,
  quantidade numeric(18,6), referencia numeric(18,6), valor numeric(18,2) NOT NULL,
  descricao_snapshot varchar(180) NOT NULL, tipo_snapshot tipo_evento NOT NULL,
  incide_inss_snapshot boolean NOT NULL, incide_irrf_snapshot boolean NOT NULL,
  memoria jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE folha_calculo_memoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), folha_item_id uuid NOT NULL REFERENCES folha_item(id) ON DELETE CASCADE,
  regra varchar(80) NOT NULL, entrada jsonb NOT NULL, resultado jsonb NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE guia_inss (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresa(id),
  folha_id uuid NOT NULL UNIQUE REFERENCES folha(id), competencia date NOT NULL,
  codigo_pagamento varchar(10), vencimento date NOT NULL, status status_guia NOT NULL DEFAULT 'RASCUNHO',
  total_segurados numeric(18,2) NOT NULL DEFAULT 0, total_patronal numeric(18,2) NOT NULL DEFAULT 0,
  total_juros_multa numeric(18,2) NOT NULL DEFAULT 0, total_guia numeric(18,2) NOT NULL DEFAULT 0,
  gerada_em timestamptz NOT NULL DEFAULT now(), gerada_por uuid NOT NULL REFERENCES usuario(id)
);

CREATE TABLE guia_inss_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guia_id uuid NOT NULL REFERENCES guia_inss(id) ON DELETE CASCADE,
  folha_item_id uuid NOT NULL REFERENCES folha_item(id), inscricao_inss_snapshot varchar(30),
  base_inss numeric(18,2) NOT NULL, valor_inss numeric(18,2) NOT NULL,
  juros_multa numeric(18,2) NOT NULL DEFAULT 0, isento boolean NOT NULL DEFAULT false,
  valor_pago numeric(18,2) NOT NULL DEFAULT 0, pago_em date,
  UNIQUE (guia_id, folha_item_id)
);

CREATE TABLE guia_inss_baixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guia_id uuid NOT NULL REFERENCES guia_inss(id),
  data_pagamento date NOT NULL, documento varchar(80), valor_total numeric(18,2) NOT NULL,
  registrado_por uuid NOT NULL REFERENCES usuario(id), registrado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE guia_inss_baixa_item (
  baixa_id uuid NOT NULL REFERENCES guia_inss_baixa(id) ON DELETE CASCADE,
  guia_item_id uuid NOT NULL REFERENCES guia_inss_item(id), valor_principal numeric(18,2) NOT NULL,
  valor_juros_multa numeric(18,2) NOT NULL DEFAULT 0, PRIMARY KEY (baixa_id, guia_item_id)
);

CREATE TABLE auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, empresa_id uuid REFERENCES empresa(id),
  usuario_id uuid REFERENCES usuario(id), entidade varchar(80) NOT NULL, registro_id uuid,
  acao varchar(20) NOT NULL, antes jsonb, depois jsonb, ocorrido_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_pessoa_empresa_nome ON pessoa (empresa_id, nome_razao_social);
CREATE INDEX ix_vinculo_folha ON prestador_vinculo (empresa_id, termo_id, meta_id, ativo);
CREATE INDEX ix_recorrente_competencia ON lancamento_evento_recorrente (empresa_id, inicio_competencia, fim_competencia);
CREATE INDEX ix_folha_competencia_status ON folha (empresa_id, competencia, status);
CREATE INDEX ix_folha_item_vinculo ON folha_item (vinculo_id);
CREATE INDEX ix_lancamento_evento ON folha_lancamento (evento_id);
CREATE INDEX ix_guia_competencia_status ON guia_inss (empresa_id, competencia, status);
CREATE INDEX ix_auditoria_registro ON auditoria (empresa_id, entidade, registro_id, ocorrido_em DESC);

CREATE VIEW vw_folha_resumo AS
SELECT f.id folha_id, f.empresa_id, f.competencia, f.numero, f.tipo, f.status,
       count(fi.id) prestadores, coalesce(sum(fi.total_proventos),0) proventos,
       coalesce(sum(fi.total_descontos),0) descontos, coalesce(sum(fi.valor_inss),0) inss,
       coalesce(sum(fi.valor_irrf),0) irrf, coalesce(sum(fi.liquido),0) liquido
FROM folha f LEFT JOIN folha_item fi ON fi.folha_id=f.id GROUP BY f.id;

COMMIT;
