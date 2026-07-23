CREATE TABLE "evento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" varchar(40) NOT NULL,
	"descricao" varchar(180) NOT NULL,
	"natureza" varchar(20) NOT NULL,
	"tipo_calculo" varchar(20) DEFAULT 'VALOR' NOT NULL,
	"incide_inss" boolean DEFAULT false NOT NULL,
	"incide_irrf" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_evento_natureza" CHECK ("evento"."natureza" in ('PROVENTO', 'DESCONTO', 'INFORMATIVO')),
	CONSTRAINT "ck_evento_tipo_calculo" CHECK ("evento"."tipo_calculo" in ('VALOR', 'PERCENTUAL')),
	CONSTRAINT "ck_evento_informativo_sem_incidencia" CHECK ("evento"."natureza" <> 'INFORMATIVO' or (not "evento"."incide_inss" and not "evento"."incide_irrf"))
);
--> statement-breakpoint
CREATE TABLE "lancamento_evento_recorrente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"vinculo_id" uuid NOT NULL,
	"evento_id" uuid NOT NULL,
	"valor" numeric(18, 4) NOT NULL,
	"inicio_competencia" date NOT NULL,
	"fim_competencia" date,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_evento_recorrente_valor" CHECK ("lancamento_evento_recorrente"."valor" >= 0),
	CONSTRAINT "ck_evento_recorrente_inicio_mes" CHECK ("lancamento_evento_recorrente"."inicio_competencia" = date_trunc('month', "lancamento_evento_recorrente"."inicio_competencia")::date),
	CONSTRAINT "ck_evento_recorrente_fim_mes" CHECK ("lancamento_evento_recorrente"."fim_competencia" is null or "lancamento_evento_recorrente"."fim_competencia" = date_trunc('month', "lancamento_evento_recorrente"."fim_competencia")::date),
	CONSTRAINT "ck_evento_recorrente_vigencia" CHECK ("lancamento_evento_recorrente"."fim_competencia" is null or "lancamento_evento_recorrente"."fim_competencia" >= "lancamento_evento_recorrente"."inicio_competencia")
);
--> statement-breakpoint
ALTER TABLE "evento" ADD CONSTRAINT "evento_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_evento_recorrente" ADD CONSTRAINT "lancamento_evento_recorrente_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_evento_recorrente" ADD CONSTRAINT "lancamento_evento_recorrente_vinculo_id_prestador_vinculo_id_fk" FOREIGN KEY ("vinculo_id") REFERENCES "public"."prestador_vinculo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_evento_recorrente" ADD CONSTRAINT "lancamento_evento_recorrente_evento_id_evento_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."evento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_empresa_codigo" ON "evento" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE INDEX "ix_evento_empresa_descricao" ON "evento" USING btree ("empresa_id","descricao");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_recorrente_inicio" ON "lancamento_evento_recorrente" USING btree ("vinculo_id","evento_id","inicio_competencia");--> statement-breakpoint
CREATE INDEX "ix_evento_recorrente_empresa_ativo" ON "lancamento_evento_recorrente" USING btree ("empresa_id","ativo");