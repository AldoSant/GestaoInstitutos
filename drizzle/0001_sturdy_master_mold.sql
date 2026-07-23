CREATE TABLE "legado_chave" (
	"empresa_id" uuid NOT NULL,
	"origem" varchar(40) NOT NULL,
	"entidade" varchar(80) NOT NULL,
	"legacy_id" varchar(100) NOT NULL,
	"destino_tabela" varchar(80) NOT NULL,
	"destino_id" uuid NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"primeira_execucao_id" uuid NOT NULL,
	"ultima_execucao_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legado_chave_empresa_id_origem_entidade_legacy_id_pk" PRIMARY KEY("empresa_id","origem","entidade","legacy_id")
);
--> statement-breakpoint
CREATE TABLE "importacao_registro" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execucao_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"legacy_id" varchar(100) NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"status" varchar(20) NOT NULL,
	"destino_tabela" varchar(80),
	"destino_id" uuid,
	"erro" text,
	"payload" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "importacao_execucao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"origem" varchar(40) DEFAULT 'GIW' NOT NULL,
	"entidade" varchar(80) NOT NULL,
	"arquivo" varchar(255) NOT NULL,
	"checksum_arquivo" varchar(64) NOT NULL,
	"modo" varchar(12) NOT NULL,
	"status" varchar(20) NOT NULL,
	"total_lidos" integer DEFAULT 0 NOT NULL,
	"total_inseridos" integer DEFAULT 0 NOT NULL,
	"total_atualizados" integer DEFAULT 0 NOT NULL,
	"total_ignorados" integer DEFAULT 0 NOT NULL,
	"total_erros" integer DEFAULT 0 NOT NULL,
	"resumo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"iniciado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluido_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "legado_chave" ADD CONSTRAINT "legado_chave_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legado_chave" ADD CONSTRAINT "legado_chave_primeira_execucao_id_importacao_execucao_id_fk" FOREIGN KEY ("primeira_execucao_id") REFERENCES "public"."importacao_execucao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legado_chave" ADD CONSTRAINT "legado_chave_ultima_execucao_id_importacao_execucao_id_fk" FOREIGN KEY ("ultima_execucao_id") REFERENCES "public"."importacao_execucao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacao_registro" ADD CONSTRAINT "importacao_registro_execucao_id_importacao_execucao_id_fk" FOREIGN KEY ("execucao_id") REFERENCES "public"."importacao_execucao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacao_execucao" ADD CONSTRAINT "importacao_execucao_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_legado_chave_destino" ON "legado_chave" USING btree ("destino_tabela","destino_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_importacao_registro_ordem" ON "importacao_registro" USING btree ("execucao_id","ordem");--> statement-breakpoint
CREATE INDEX "ix_importacao_registro_legado" ON "importacao_registro" USING btree ("legacy_id");--> statement-breakpoint
CREATE INDEX "ix_importacao_empresa_data" ON "importacao_execucao" USING btree ("empresa_id","iniciado_em");--> statement-breakpoint
CREATE INDEX "ix_importacao_checksum" ON "importacao_execucao" USING btree ("checksum_arquivo");