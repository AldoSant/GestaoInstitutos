CREATE TABLE "dependente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"origem_legacy_key" varchar(180) NOT NULL,
	"nome" varchar(180) NOT NULL,
	"nascimento" date,
	"parentesco" varchar(80),
	"estudante" boolean DEFAULT false NOT NULL,
	"cpf" varchar(11),
	"baixa_salario_familia" date,
	"baixa_irrf" date,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_dependente_cpf" CHECK ("dependente"."cpf" is null or "dependente"."cpf" ~ '^[0-9]{11}$')
);
--> statement-breakpoint
CREATE TABLE "pessoa_conta_bancaria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"agencia_legacy_id" varchar(60),
	"agencia" varchar(120),
	"numero" varchar(20),
	"digito" varchar(5),
	"variacao" varchar(5),
	"tipo" varchar(20),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_pessoa_conta_tipo" CHECK ("pessoa_conta_bancaria"."tipo" is null or "pessoa_conta_bancaria"."tipo" in ('CORRENTE', 'POUPANCA'))
);
--> statement-breakpoint
CREATE TABLE "pessoa_endereco" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"cep" varchar(8),
	"logradouro" varchar(120),
	"numero" varchar(20),
	"bairro" varchar(100),
	"municipio" varchar(120),
	"municipio_legacy_id" varchar(60),
	"complemento" varchar(200),
	"referencia" varchar(200),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_pessoa_endereco_cep" CHECK ("pessoa_endereco"."cep" is null or "pessoa_endereco"."cep" ~ '^[0-9]{8}$')
);
--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "sexo" varchar(10);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "nascimento" date;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "rg" varchar(40);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "rg_orgao_emissor" varchar(10);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "rg_uf" varchar(2);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "rg_emissao" date;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "estado_civil" varchar(40);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "naturalidade" varchar(120);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "inscricao_inss" varchar(30);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "conselho_tipo" varchar(20);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "conselho_numero" varchar(20);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "aposentado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "cnh" varchar(20);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "cnh_categoria" varchar(2);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "cnh_validade" date;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "nome_fantasia" varchar(180);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "representante_legal" varchar(180);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "inscricao_municipal" varchar(30);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "inscricao_estadual" varchar(30);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "papel_prestador" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "papel_parceiro" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "papel_fornecedor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "celular" varchar(20);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "celular_alternativo" varchar(20);--> statement-breakpoint
ALTER TABLE "dependente" ADD CONSTRAINT "dependente_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependente" ADD CONSTRAINT "dependente_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa_conta_bancaria" ADD CONSTRAINT "pessoa_conta_bancaria_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa_conta_bancaria" ADD CONSTRAINT "pessoa_conta_bancaria_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa_endereco" ADD CONSTRAINT "pessoa_endereco_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa_endereco" ADD CONSTRAINT "pessoa_endereco_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_dependente_pessoa_origem" ON "dependente" USING btree ("pessoa_id","origem_legacy_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_dependente_pessoa_cpf" ON "dependente" USING btree ("pessoa_id","cpf");--> statement-breakpoint
CREATE INDEX "ix_dependente_empresa_nome" ON "dependente" USING btree ("empresa_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pessoa_conta_pessoa" ON "pessoa_conta_bancaria" USING btree ("empresa_id","pessoa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pessoa_endereco_pessoa" ON "pessoa_endereco" USING btree ("empresa_id","pessoa_id");