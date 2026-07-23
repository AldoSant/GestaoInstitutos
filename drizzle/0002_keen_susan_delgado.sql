CREATE TABLE "atividade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" varchar(40) NOT NULL,
	"descricao" varchar(180) NOT NULL,
	"carga_horaria" numeric(10, 2),
	"valor" numeric(18, 2),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lotacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" varchar(40) NOT NULL,
	"descricao" varchar(160) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD COLUMN "atividade_id" uuid;--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD COLUMN "lotacao_id" uuid;--> statement-breakpoint
ALTER TABLE "atividade" ADD CONSTRAINT "atividade_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotacao" ADD CONSTRAINT "lotacao_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_atividade_empresa_codigo" ON "atividade" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE INDEX "ix_atividade_empresa_descricao" ON "atividade" USING btree ("empresa_id","descricao");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lotacao_empresa_codigo" ON "lotacao" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE INDEX "ix_lotacao_empresa_descricao" ON "lotacao" USING btree ("empresa_id","descricao");--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD CONSTRAINT "prestador_vinculo_atividade_id_atividade_id_fk" FOREIGN KEY ("atividade_id") REFERENCES "public"."atividade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD CONSTRAINT "prestador_vinculo_lotacao_id_lotacao_id_fk" FOREIGN KEY ("lotacao_id") REFERENCES "public"."lotacao"("id") ON DELETE no action ON UPDATE no action;