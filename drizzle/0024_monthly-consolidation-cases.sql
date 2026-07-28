CREATE TABLE "consolidacao_mensal_caso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"competencia" date NOT NULL,
	"hash_fontes" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDENTE' NOT NULL,
	"decisao" varchar(30),
	"justificativa" text DEFAULT '' NOT NULL,
	"responsavel" varchar(160),
	"resolvido_em" timestamp with time zone,
	"criado_por" varchar(160) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fk_consolidacao_caso_empresa_pessoa"
		FOREIGN KEY ("empresa_id", "pessoa_id")
		REFERENCES "public"."pessoa"("empresa_id", "id"),
	CONSTRAINT "ck_consolidacao_caso_competencia"
		CHECK ("competencia" = date_trunc('month', "competencia")::date),
	CONSTRAINT "ck_consolidacao_caso_hash"
		CHECK ("hash_fontes" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_consolidacao_caso_status"
		CHECK ("status" in ('PENDENTE', 'EM_ANALISE', 'RESOLVIDO', 'INVALIDADO')),
	CONSTRAINT "ck_consolidacao_caso_decisao"
		CHECK (
			"decisao" is null
			or "decisao" in ('UNIFICAR_VINCULOS', 'RATEIO_NECESSARIO', 'NAO_APLICAVEL')
		),
	CONSTRAINT "ck_consolidacao_caso_resolucao"
		CHECK (
			"status" <> 'RESOLVIDO'
			or (
				"decisao" is not null
				and length(btrim("justificativa")) between 10 and 2000
				and length(btrim("responsavel")) between 3 and 160
				and "resolvido_em" is not null
			)
		)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_consolidacao_caso_empresa_id"
	ON "consolidacao_mensal_caso" USING btree ("empresa_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_consolidacao_caso_fontes"
	ON "consolidacao_mensal_caso" USING btree
	("empresa_id", "competencia", "pessoa_id", "hash_fontes");
--> statement-breakpoint
CREATE INDEX "ix_consolidacao_caso_competencia"
	ON "consolidacao_mensal_caso" USING btree
	("empresa_id", "competencia", "status");
--> statement-breakpoint
CREATE TABLE "consolidacao_mensal_fonte" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"caso_id" uuid NOT NULL,
	"vinculo_id" uuid NOT NULL,
	"medicao_id" uuid,
	"folha_id" uuid,
	"termo_numero" varchar(80) NOT NULL,
	"meta_codigo" varchar(80) NOT NULL,
	"atividade" varchar(180) NOT NULL,
	"valor_contratual" numeric(18, 2) NOT NULL,
	"valor_previsto" numeric(18, 2) NOT NULL,
	"exige_medicao" boolean NOT NULL,
	"medicao_tipo" varchar(20),
	"folha_numero" integer,
	"folha_status" varchar(20),
	"snapshot" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fk_consolidacao_fonte_empresa_caso"
		FOREIGN KEY ("empresa_id", "caso_id")
		REFERENCES "public"."consolidacao_mensal_caso"("empresa_id", "id")
		ON DELETE cascade,
	CONSTRAINT "fk_consolidacao_fonte_empresa_vinculo"
		FOREIGN KEY ("empresa_id", "vinculo_id")
		REFERENCES "public"."prestador_vinculo"("empresa_id", "id"),
	CONSTRAINT "fk_consolidacao_fonte_empresa_medicao"
		FOREIGN KEY ("empresa_id", "medicao_id")
		REFERENCES "public"."medicao_mensal"("empresa_id", "id"),
	CONSTRAINT "fk_consolidacao_fonte_empresa_folha"
		FOREIGN KEY ("empresa_id", "folha_id")
		REFERENCES "public"."folha"("empresa_id", "id"),
	CONSTRAINT "ck_consolidacao_fonte_valores"
		CHECK ("valor_contratual" >= 0 and "valor_previsto" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_consolidacao_fonte_caso_vinculo"
	ON "consolidacao_mensal_fonte" USING btree ("caso_id", "vinculo_id");
--> statement-breakpoint
CREATE INDEX "ix_consolidacao_fonte_caso"
	ON "consolidacao_mensal_fonte" USING btree ("caso_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION proteger_exclusao_caso_consolidacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION
		'Caso de consolidação não pode ser excluído; invalide-o preservando o histórico.'
		USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION proteger_fonte_consolidacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION
		'Fonte congelada de consolidação é imutável.'
		USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "tr_proteger_exclusao_consolidacao_caso"
	BEFORE DELETE ON "consolidacao_mensal_caso"
	FOR EACH ROW EXECUTE FUNCTION proteger_exclusao_caso_consolidacao();
--> statement-breakpoint
CREATE TRIGGER "tr_proteger_consolidacao_fonte"
	BEFORE UPDATE OR DELETE ON "consolidacao_mensal_fonte"
	FOR EACH ROW EXECUTE FUNCTION proteger_fonte_consolidacao();
--> statement-breakpoint
CREATE TRIGGER "tr_auditar_consolidacao_caso"
	AFTER INSERT OR UPDATE ON "consolidacao_mensal_caso"
	FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
--> statement-breakpoint
CREATE TRIGGER "tr_auditar_consolidacao_fonte"
	AFTER INSERT ON "consolidacao_mensal_fonte"
	FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
