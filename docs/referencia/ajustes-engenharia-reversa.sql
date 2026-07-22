-- Extensão do esquema mvp_folha_inss.sql após engenharia reversa do legado.
-- PostgreSQL 15+. Execute depois do arquivo-base, em banco de desenvolvimento.
-- Valores fiscais não são fixados aqui: devem ser carregados por vigência e fonte oficial.

BEGIN;

CREATE TYPE tipo_regra_calculo AS ENUM
  ('INSS_SEGURADO','INSS_PATRONAL','IRRF','SALARIO_FAMILIA','AUXILIO_TRIBUTOS','EVENTO');
CREATE TYPE origem_fonte_concomitante AS ENUM ('INTERNA','DECLARADA','IMPORTADA');
CREATE TYPE tipo_parcela_previdenciaria AS ENUM
  ('SEGURADO','PATRONAL','RAT_GILRAT','TERCEIROS','JUROS','MULTA','COMPENSACAO','OUTRA');
CREATE TYPE tipo_obrigacao_fiscal AS ENUM
  ('DCTFWEB','DARF_PREVIDENCIARIO','GPS_LEGADO','ESOCIAL','EFD_REINF','OUTRA');
CREATE TYPE status_obrigacao_fiscal AS ENUM
  ('RASCUNHO','APURADA','TRANSMITIDA','EM_ABERTO','PARCIAL','PAGA','RETIFICADA','CANCELADA');
CREATE TYPE status_transmissao AS ENUM ('PENDENTE','PROCESSANDO','ACEITA','REJEITADA','CANCELADA');
CREATE TYPE metodo_deducao_irrf AS ENUM ('LEGAL','SIMPLIFICADA');

-- Uma regra publicada é imutável. Nova vigência/correção gera nova versão.
CREATE TABLE regra_calculo_versao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresa(id),
  tipo tipo_regra_calculo NOT NULL,
  codigo varchar(80) NOT NULL,
  versao integer NOT NULL CHECK (versao > 0),
  inicio_vigencia date NOT NULL,
  fim_vigencia date,
  parametros jsonb NOT NULL,
  fonte_normativa text NOT NULL,
  hash_conteudo char(64) NOT NULL,
  publicada boolean NOT NULL DEFAULT false,
  publicada_em timestamptz,
  publicada_por uuid REFERENCES usuario(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (empresa_id, codigo, versao),
  CHECK (fim_vigencia IS NULL OR fim_vigencia >= inicio_vigencia),
  CHECK ((publicada = false) OR (publicada_em IS NOT NULL AND publicada_por IS NOT NULL))
);

ALTER TABLE folha
  ADD COLUMN regra_calculo_versao_id uuid REFERENCES regra_calculo_versao(id),
  ADD COLUMN reaberta_em timestamptz,
  ADD COLUMN reaberta_por uuid REFERENCES usuario(id),
  ADD COLUMN motivo_reabertura text,
  ADD COLUMN hash_resultado char(64);

CREATE TABLE folha_status_historico (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  folha_id uuid NOT NULL REFERENCES folha(id) ON DELETE CASCADE,
  status_anterior status_folha,
  status_novo status_folha NOT NULL,
  motivo text,
  usuario_id uuid NOT NULL REFERENCES usuario(id),
  ocorrido_em timestamptz NOT NULL DEFAULT now()
);

-- Campos explicitamente encontrados na memória de cálculo do legado.
ALTER TABLE folha_item
  ADD COLUMN base_retribuicao numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN irrf_bruto numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN irrf_reducao numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN desconto_simplificado_irrf numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN metodo_deducao_irrf metodo_deducao_irrf,
  ADD COLUMN deducao_dependentes_irrf numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN base_salario_familia numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN base_auxilio_tributos numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN data_admissao_snapshot date,
  ADD COLUMN data_desligamento_snapshot date,
  ADD COLUMN data_credito date,
  ADD COLUMN atividade_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN lotacao_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN pagamento_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Consolidação mensal é por pessoa/CPF, e não apenas por contrato ou folha.
CREATE TABLE folha_consolidacao_pessoa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa(id),
  competencia date NOT NULL,
  prestador_id uuid NOT NULL REFERENCES prestador(id),
  regra_calculo_versao_id uuid REFERENCES regra_calculo_versao(id),
  remuneracao_tributavel_interna numeric(18,2) NOT NULL DEFAULT 0,
  remuneracao_tributavel_externa numeric(18,2) NOT NULL DEFAULT 0,
  base_inss_total numeric(18,2) NOT NULL DEFAULT 0,
  inss_retido_total numeric(18,2) NOT NULL DEFAULT 0,
  base_irrf_total numeric(18,2) NOT NULL DEFAULT 0,
  irrf_bruto_total numeric(18,2) NOT NULL DEFAULT 0,
  irrf_reducao_total numeric(18,2) NOT NULL DEFAULT 0,
  irrf_retido_total numeric(18,2) NOT NULL DEFAULT 0,
  metodo_deducao_irrf metodo_deducao_irrf,
  memoria jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash_resultado char(64) NOT NULL,
  calculada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, competencia, prestador_id),
  CHECK (date_trunc('month', competencia) = competencia)
);

CREATE TABLE folha_consolidacao_item (
  consolidacao_id uuid NOT NULL REFERENCES folha_consolidacao_pessoa(id) ON DELETE CASCADE,
  folha_item_id uuid NOT NULL UNIQUE REFERENCES folha_item(id) ON DELETE CASCADE,
  ordem_rateio smallint NOT NULL CHECK (ordem_rateio > 0),
  base_inss_alocada numeric(18,2) NOT NULL DEFAULT 0,
  inss_alocado numeric(18,2) NOT NULL DEFAULT 0,
  base_irrf_alocada numeric(18,2) NOT NULL DEFAULT 0,
  irrf_alocado numeric(18,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (consolidacao_id, folha_item_id),
  UNIQUE (consolidacao_id, ordem_rateio)
);

CREATE TABLE folha_fonte_concomitante (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidacao_id uuid NOT NULL REFERENCES folha_consolidacao_pessoa(id) ON DELETE CASCADE,
  origem origem_fonte_concomitante NOT NULL,
  fonte_cnpj varchar(14),
  fonte_nome varchar(180) NOT NULL,
  remuneracao numeric(18,2) NOT NULL DEFAULT 0,
  base_inss numeric(18,2) NOT NULL DEFAULT 0,
  inss_retido numeric(18,2) NOT NULL DEFAULT 0,
  irrf_retido numeric(18,2) NOT NULL DEFAULT 0,
  documento_evidencia_id uuid,
  informado_em timestamptz NOT NULL DEFAULT now(),
  informado_por uuid NOT NULL REFERENCES usuario(id),
  CHECK (remuneracao >= 0 AND base_inss >= 0 AND inss_retido >= 0 AND irrf_retido >= 0)
);

-- Corrige a ambiguidade do legado: duas parcelas iguais só são válidas se tiverem
-- tipos/origens diferentes e comprováveis.
ALTER TABLE guia_inss_item
  DROP CONSTRAINT guia_inss_item_guia_id_folha_item_id_key,
  ADD COLUMN tipo_parcela tipo_parcela_previdenciaria NOT NULL DEFAULT 'SEGURADO',
  ADD COLUMN aliquota numeric(9,4),
  ADD COLUMN codigo_receita varchar(20),
  ADD COLUMN origem_descricao varchar(255),
  ADD COLUMN folha_lancamento_id uuid REFERENCES folha_lancamento(id),
  ADD CONSTRAINT uq_guia_item_origem UNIQUE NULLS NOT DISTINCT
    (guia_id, folha_item_id, tipo_parcela, codigo_receita),
  ADD CONSTRAINT ck_guia_item_aliquota CHECK (aliquota IS NULL OR aliquota >= 0);

CREATE TABLE documento_evidencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa(id),
  tipo varchar(60) NOT NULL,
  nome_arquivo varchar(255) NOT NULL,
  mime_type varchar(100) NOT NULL,
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes >= 0),
  storage_key text NOT NULL UNIQUE,
  hash_sha256 char(64) NOT NULL,
  classificacao varchar(30) NOT NULL DEFAULT 'RESTRITO',
  criado_por uuid NOT NULL REFERENCES usuario(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE folha_fonte_concomitante
  ADD CONSTRAINT fk_fonte_documento
  FOREIGN KEY (documento_evidencia_id) REFERENCES documento_evidencia(id);

-- Modelo genérico: DCTFWeb/DARF são o caminho atual quando aplicável; GPS fica
-- disponível somente para hipóteses legadas/excepcionais validadas.
CREATE TABLE obrigacao_fiscal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa(id),
  competencia date NOT NULL,
  tipo tipo_obrigacao_fiscal NOT NULL,
  status status_obrigacao_fiscal NOT NULL DEFAULT 'RASCUNHO',
  identificador_externo varchar(120),
  codigo_receita varchar(20),
  vencimento date,
  principal numeric(18,2) NOT NULL DEFAULT 0,
  juros numeric(18,2) NOT NULL DEFAULT 0,
  multa numeric(18,2) NOT NULL DEFAULT 0,
  compensacoes numeric(18,2) NOT NULL DEFAULT 0,
  total numeric(18,2) NOT NULL DEFAULT 0,
  recibo varchar(180),
  documento_evidencia_id uuid REFERENCES documento_evidencia(id),
  gerada_por uuid NOT NULL REFERENCES usuario(id),
  gerada_em timestamptz NOT NULL DEFAULT now(),
  CHECK (date_trunc('month', competencia) = competencia),
  CHECK (principal >= 0 AND juros >= 0 AND multa >= 0 AND compensacoes >= 0 AND total >= 0)
);

CREATE TABLE obrigacao_fiscal_folha (
  obrigacao_id uuid NOT NULL REFERENCES obrigacao_fiscal(id) ON DELETE CASCADE,
  folha_id uuid NOT NULL REFERENCES folha(id),
  PRIMARY KEY (obrigacao_id, folha_id)
);

CREATE TABLE obrigacao_fiscal_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obrigacao_id uuid NOT NULL REFERENCES obrigacao_fiscal(id) ON DELETE CASCADE,
  folha_item_id uuid REFERENCES folha_item(id),
  prestador_id uuid REFERENCES prestador(id),
  tipo_parcela tipo_parcela_previdenciaria NOT NULL,
  codigo_receita varchar(20),
  base_calculo numeric(18,2) NOT NULL DEFAULT 0,
  aliquota numeric(9,4),
  principal numeric(18,2) NOT NULL DEFAULT 0,
  juros numeric(18,2) NOT NULL DEFAULT 0,
  multa numeric(18,2) NOT NULL DEFAULT 0,
  compensacao numeric(18,2) NOT NULL DEFAULT 0,
  origem jsonb NOT NULL,
  CHECK (base_calculo >= 0 AND principal >= 0 AND juros >= 0 AND multa >= 0 AND compensacao >= 0),
  CHECK (aliquota IS NULL OR aliquota >= 0)
);

CREATE TABLE obrigacao_transmissao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obrigacao_id uuid NOT NULL REFERENCES obrigacao_fiscal(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL UNIQUE,
  status status_transmissao NOT NULL DEFAULT 'PENDENTE',
  protocolo varchar(180),
  requisicao_hash char(64) NOT NULL,
  resposta jsonb,
  tentativa integer NOT NULL DEFAULT 1 CHECK (tentativa > 0),
  enviada_em timestamptz,
  respondida_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pagamento_tributo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obrigacao_id uuid NOT NULL REFERENCES obrigacao_fiscal(id),
  data_pagamento date NOT NULL,
  autenticacao varchar(180),
  principal numeric(18,2) NOT NULL DEFAULT 0,
  juros numeric(18,2) NOT NULL DEFAULT 0,
  multa numeric(18,2) NOT NULL DEFAULT 0,
  valor_total numeric(18,2) NOT NULL,
  documento_evidencia_id uuid REFERENCES documento_evidencia(id),
  registrado_por uuid NOT NULL REFERENCES usuario(id),
  registrado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (principal >= 0 AND juros >= 0 AND multa >= 0 AND valor_total > 0),
  CHECK (valor_total = round(principal + juros + multa, 2))
);

CREATE INDEX ix_regra_vigencia ON regra_calculo_versao (tipo, inicio_vigencia, fim_vigencia);
CREATE INDEX ix_folha_status_historico ON folha_status_historico (folha_id, ocorrido_em);
CREATE INDEX ix_consolidacao_competencia ON folha_consolidacao_pessoa (empresa_id, competencia);
CREATE INDEX ix_fonte_concomitante_consolidacao ON folha_fonte_concomitante (consolidacao_id);
CREATE INDEX ix_obrigacao_competencia_status ON obrigacao_fiscal (empresa_id, competencia, status);
CREATE INDEX ix_obrigacao_item_origem ON obrigacao_fiscal_item (obrigacao_id, tipo_parcela, codigo_receita);
CREATE INDEX ix_pagamento_obrigacao ON pagamento_tributo (obrigacao_id, data_pagamento);

COMMIT;
