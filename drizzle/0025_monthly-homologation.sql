CREATE TABLE "homologacao_competencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"competencia" date NOT NULL,
	"versao" integer NOT NULL,
	"hash_fontes" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDENTE' NOT NULL,
	"resumo" jsonb NOT NULL,
	"justificativa" text DEFAULT '' NOT NULL,
	"responsavel" varchar(160),
	"decidido_em" timestamp with time zone,
	"criado_por" varchar(160) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fk_homologacao_competencia_empresa"
		FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id"),
	CONSTRAINT "ck_homologacao_competencia_mes"
		CHECK ("competencia" = date_trunc('month', "competencia")::date),
	CONSTRAINT "ck_homologacao_competencia_versao" CHECK ("versao" > 0),
	CONSTRAINT "ck_homologacao_competencia_hash"
		CHECK ("hash_fontes" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_homologacao_competencia_status"
		CHECK (
			"status" in (
				'PENDENTE', 'EM_ANALISE', 'APROVADA', 'REJEITADA', 'INVALIDADA'
			)
		),
	CONSTRAINT "ck_homologacao_competencia_resumo"
		CHECK (
			jsonb_typeof("resumo") = 'object'
			and "resumo" ?& array['pronta', 'bloqueios', 'conformes', 'total']
		),
	CONSTRAINT "ck_homologacao_competencia_decisao"
		CHECK (
			"status" not in ('APROVADA', 'REJEITADA')
			or (
				length(btrim("justificativa")) between 10 and 3000
				and length(btrim("responsavel")) between 3 and 160
				and "decidido_em" is not null
			)
		)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_homologacao_competencia_empresa_id"
	ON "homologacao_competencia" USING btree ("empresa_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_homologacao_competencia_versao"
	ON "homologacao_competencia" USING btree
	("empresa_id", "competencia", "versao");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_homologacao_competencia_fontes"
	ON "homologacao_competencia" USING btree
	("empresa_id", "competencia", "hash_fontes");
--> statement-breakpoint
CREATE INDEX "ix_homologacao_competencia_status"
	ON "homologacao_competencia" USING btree
	("empresa_id", "competencia", "status");
--> statement-breakpoint
CREATE TABLE "homologacao_competencia_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"homologacao_id" uuid NOT NULL,
	"tipo" varchar(40) NOT NULL,
	"status" varchar(20) NOT NULL,
	"obrigatorio" boolean DEFAULT true NOT NULL,
	"total" integer NOT NULL,
	"conformes" integer NOT NULL,
	"pendentes" integer NOT NULL,
	"hash_evidencia" varchar(64) NOT NULL,
	"detalhes" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fk_homologacao_item_empresa_lote"
		FOREIGN KEY ("empresa_id", "homologacao_id")
		REFERENCES "public"."homologacao_competencia"("empresa_id", "id")
		ON DELETE cascade,
	CONSTRAINT "ck_homologacao_item_tipo"
		CHECK (
			"tipo" in (
				'MEDICOES', 'CONSOLIDACAO', 'FOLHAS', 'CONFERENCIA_RH',
				'PARALELO_GIW', 'OBRIGACAO', 'DOCUMENTOS_DCTFWEB'
			)
		),
	CONSTRAINT "ck_homologacao_item_status"
		CHECK ("status" in ('OK', 'PENDENTE', 'BLOQUEIO', 'NAO_APLICAVEL')),
	CONSTRAINT "ck_homologacao_item_contagens"
		CHECK (
			"total" >= 0
			and "conformes" >= 0
			and "pendentes" >= 0
			and "conformes" + "pendentes" <= "total"
		),
	CONSTRAINT "ck_homologacao_item_estado_contagens"
		CHECK (
			(
				"status" = 'OK'
				and "total" > 0
				and "conformes" = "total"
				and "pendentes" = 0
			)
			or (
				"status" = 'NAO_APLICAVEL'
				and "total" = 0
				and "conformes" = 0
				and "pendentes" = 0
			)
			or (
				"status" in ('PENDENTE', 'BLOQUEIO')
				and (
					(
						"total" = 0
						and "conformes" = 0
						and "pendentes" = 0
					)
					or "pendentes" > 0
				)
			)
		),
	CONSTRAINT "ck_homologacao_item_hash"
		CHECK ("hash_evidencia" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_homologacao_item_detalhes"
		CHECK (jsonb_typeof("detalhes") = 'object')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_homologacao_competencia_item_tipo"
	ON "homologacao_competencia_item" USING btree
	("homologacao_id", "tipo");
--> statement-breakpoint
CREATE INDEX "ix_homologacao_competencia_item"
	ON "homologacao_competencia_item" USING btree
	("homologacao_id", "status");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION proteger_exclusao_homologacao_competencia()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION
		'Homologação de competência não pode ser excluída; invalide-a preservando o histórico.'
		USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION proteger_item_homologacao_competencia()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION
		'Item congelado da homologação de competência é imutável.'
		USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "tr_proteger_exclusao_homologacao_competencia"
	BEFORE DELETE ON "homologacao_competencia"
	FOR EACH ROW EXECUTE FUNCTION proteger_exclusao_homologacao_competencia();
--> statement-breakpoint
CREATE TRIGGER "tr_proteger_item_homologacao_competencia"
	BEFORE UPDATE OR DELETE ON "homologacao_competencia_item"
	FOR EACH ROW EXECUTE FUNCTION proteger_item_homologacao_competencia();
--> statement-breakpoint
CREATE TRIGGER "tr_auditar_homologacao_competencia"
	AFTER INSERT OR UPDATE ON "homologacao_competencia"
	FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
--> statement-breakpoint
CREATE TRIGGER "tr_auditar_homologacao_competencia_item"
	AFTER INSERT ON "homologacao_competencia_item"
	FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
