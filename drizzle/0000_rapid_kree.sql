CREATE TYPE "public"."perfil_usuario" AS ENUM('ADMINISTRADOR', 'OPERADOR', 'CONSULTA');--> statement-breakpoint
CREATE TYPE "public"."status_folha" AS ENUM('RASCUNHO', 'PROCESSANDO', 'ABERTA', 'FECHADA', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "public"."status_obrigacao" AS ENUM('RASCUNHO', 'APURADA', 'BLOQUEADA', 'EMITIDA', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "public"."tipo_pessoa" AS ENUM('FISICA', 'JURIDICA');--> statement-breakpoint
CREATE TABLE "empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cnpj" varchar(14) NOT NULL,
	"razao_social" varchar(180) NOT NULL,
	"nome_fantasia" varchar(180),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folha" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"termo_id" uuid NOT NULL,
	"meta_id" uuid NOT NULL,
	"regra_calculo_id" uuid,
	"competencia" date NOT NULL,
	"numero" integer NOT NULL,
	"status" "status_folha" DEFAULT 'RASCUNHO' NOT NULL,
	"processada_em" timestamp with time zone,
	"fechada_em" timestamp with time zone,
	"hash_resultado" varchar(64),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folha_status_historico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folha_id" uuid NOT NULL,
	"status_anterior" "status_folha",
	"status_novo" "status_folha" NOT NULL,
	"motivo" text,
	"usuario_id" uuid NOT NULL,
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folha_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folha_id" uuid NOT NULL,
	"vinculo_id" uuid NOT NULL,
	"total_proventos" numeric(18, 2) NOT NULL,
	"total_descontos" numeric(18, 2) NOT NULL,
	"base_inss" numeric(18, 2) NOT NULL,
	"valor_inss" numeric(18, 2) NOT NULL,
	"base_irrf" numeric(18, 2) NOT NULL,
	"irrf_bruto" numeric(18, 2) NOT NULL,
	"irrf_reducao" numeric(18, 2) NOT NULL,
	"valor_irrf" numeric(18, 2) NOT NULL,
	"total_liquido" numeric(18, 2) NOT NULL,
	"snapshots" jsonb NOT NULL,
	"memoria" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "termo_meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"termo_id" uuid NOT NULL,
	"codigo" varchar(40) NOT NULL,
	"descricao" varchar(255) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obrigacao_fiscal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"competencia" date NOT NULL,
	"tipo" varchar(40) NOT NULL,
	"status" "status_obrigacao" DEFAULT 'RASCUNHO' NOT NULL,
	"principal" numeric(18, 2) NOT NULL,
	"juros" numeric(18, 2) DEFAULT '0' NOT NULL,
	"multa" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total" numeric(18, 2) NOT NULL,
	"bloqueio_motivo" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obrigacao_fiscal_folha" (
	"obrigacao_id" uuid NOT NULL,
	"folha_id" uuid NOT NULL,
	CONSTRAINT "obrigacao_fiscal_folha_obrigacao_id_folha_id_pk" PRIMARY KEY("obrigacao_id","folha_id")
);
--> statement-breakpoint
CREATE TABLE "pessoa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"tipo" "tipo_pessoa" NOT NULL,
	"nome_razao_social" varchar(180) NOT NULL,
	"cpf" varchar(11),
	"cnpj" varchar(14),
	"email" varchar(180),
	"telefone" varchar(20),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prestador" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"matricula" varchar(40) NOT NULL,
	"nit_pis_pasep" varchar(30),
	"categoria_contribuinte" varchar(30),
	"isento_inss" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regra_calculo_versao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid,
	"codigo" varchar(80) NOT NULL,
	"versao" integer NOT NULL,
	"inicio_vigencia" date NOT NULL,
	"fim_vigencia" date,
	"parametros" jsonb NOT NULL,
	"fonte_normativa" text NOT NULL,
	"hash_conteudo" varchar(64) NOT NULL,
	"publicada" boolean DEFAULT false NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "termo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"numero" varchar(60) NOT NULL,
	"descricao" varchar(255) NOT NULL,
	"modalidade" varchar(80) NOT NULL,
	"inicio" date NOT NULL,
	"fim" date,
	"valor_global" numeric(18, 2) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cpf" varchar(11) NOT NULL,
	"nome" varchar(160) NOT NULL,
	"email" varchar(180) NOT NULL,
	"senha_hash" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ultimo_login_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario_empresa" (
	"usuario_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"perfil" "perfil_usuario" NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "usuario_empresa_usuario_id_empresa_id_pk" PRIMARY KEY("usuario_id","empresa_id")
);
--> statement-breakpoint
CREATE TABLE "prestador_vinculo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"prestador_id" uuid NOT NULL,
	"termo_id" uuid NOT NULL,
	"meta_id" uuid NOT NULL,
	"atividade" varchar(180) NOT NULL,
	"lotacao" varchar(160),
	"inicio" date NOT NULL,
	"fim" date,
	"valor_retribuicao" numeric(18, 2) NOT NULL,
	"desconta_inss" boolean DEFAULT true NOT NULL,
	"desconta_irrf" boolean DEFAULT true NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "folha" ADD CONSTRAINT "folha_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folha" ADD CONSTRAINT "folha_termo_id_termo_id_fk" FOREIGN KEY ("termo_id") REFERENCES "public"."termo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folha" ADD CONSTRAINT "folha_meta_id_termo_meta_id_fk" FOREIGN KEY ("meta_id") REFERENCES "public"."termo_meta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folha" ADD CONSTRAINT "folha_regra_calculo_id_regra_calculo_versao_id_fk" FOREIGN KEY ("regra_calculo_id") REFERENCES "public"."regra_calculo_versao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folha_status_historico" ADD CONSTRAINT "folha_status_historico_folha_id_folha_id_fk" FOREIGN KEY ("folha_id") REFERENCES "public"."folha"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folha_status_historico" ADD CONSTRAINT "folha_status_historico_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folha_item" ADD CONSTRAINT "folha_item_folha_id_folha_id_fk" FOREIGN KEY ("folha_id") REFERENCES "public"."folha"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folha_item" ADD CONSTRAINT "folha_item_vinculo_id_prestador_vinculo_id_fk" FOREIGN KEY ("vinculo_id") REFERENCES "public"."prestador_vinculo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termo_meta" ADD CONSTRAINT "termo_meta_termo_id_termo_id_fk" FOREIGN KEY ("termo_id") REFERENCES "public"."termo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obrigacao_fiscal" ADD CONSTRAINT "obrigacao_fiscal_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obrigacao_fiscal_folha" ADD CONSTRAINT "obrigacao_fiscal_folha_obrigacao_id_obrigacao_fiscal_id_fk" FOREIGN KEY ("obrigacao_id") REFERENCES "public"."obrigacao_fiscal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obrigacao_fiscal_folha" ADD CONSTRAINT "obrigacao_fiscal_folha_folha_id_folha_id_fk" FOREIGN KEY ("folha_id") REFERENCES "public"."folha"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa" ADD CONSTRAINT "pessoa_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador" ADD CONSTRAINT "prestador_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador" ADD CONSTRAINT "prestador_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regra_calculo_versao" ADD CONSTRAINT "regra_calculo_versao_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termo" ADD CONSTRAINT "termo_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_empresa" ADD CONSTRAINT "usuario_empresa_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_empresa" ADD CONSTRAINT "usuario_empresa_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD CONSTRAINT "prestador_vinculo_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD CONSTRAINT "prestador_vinculo_prestador_id_prestador_id_fk" FOREIGN KEY ("prestador_id") REFERENCES "public"."prestador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD CONSTRAINT "prestador_vinculo_termo_id_termo_id_fk" FOREIGN KEY ("termo_id") REFERENCES "public"."termo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD CONSTRAINT "prestador_vinculo_meta_id_termo_meta_id_fk" FOREIGN KEY ("meta_id") REFERENCES "public"."termo_meta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_empresa_cnpj" ON "empresa" USING btree ("cnpj");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_folha_empresa_competencia_numero" ON "folha" USING btree ("empresa_id","competencia","numero");--> statement-breakpoint
CREATE INDEX "ix_folha_empresa_status" ON "folha" USING btree ("empresa_id","status");--> statement-breakpoint
CREATE INDEX "ix_historico_folha_data" ON "folha_status_historico" USING btree ("folha_id","ocorrido_em");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_folha_item_vinculo" ON "folha_item" USING btree ("folha_id","vinculo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_meta_termo_codigo" ON "termo_meta" USING btree ("termo_id","codigo");--> statement-breakpoint
CREATE INDEX "ix_obrigacao_empresa_competencia" ON "obrigacao_fiscal" USING btree ("empresa_id","competencia");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pessoa_empresa_cpf" ON "pessoa" USING btree ("empresa_id","cpf");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pessoa_empresa_cnpj" ON "pessoa" USING btree ("empresa_id","cnpj");--> statement-breakpoint
CREATE INDEX "ix_pessoa_empresa_nome" ON "pessoa" USING btree ("empresa_id","nome_razao_social");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_prestador_empresa_pessoa" ON "prestador" USING btree ("empresa_id","pessoa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_prestador_empresa_matricula" ON "prestador" USING btree ("empresa_id","matricula");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_regra_empresa_codigo_versao" ON "regra_calculo_versao" USING btree ("empresa_id","codigo","versao");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_termo_empresa_numero" ON "termo" USING btree ("empresa_id","numero");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_usuario_cpf" ON "usuario" USING btree ("cpf");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_usuario_email" ON "usuario" USING btree ("email");--> statement-breakpoint
CREATE INDEX "ix_vinculo_empresa_ativo" ON "prestador_vinculo" USING btree ("empresa_id","ativo");