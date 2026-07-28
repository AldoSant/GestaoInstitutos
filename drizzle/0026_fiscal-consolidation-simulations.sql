CREATE TABLE "consolidacao_fiscal_simulacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"caso_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"competencia" date NOT NULL,
	"regra_calculo_id" uuid NOT NULL,
	"enquadramento_previdenciario_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	"status" varchar(24) DEFAULT 'SIMULADA' NOT NULL,
	"hipotese_rateio" varchar(40) DEFAULT 'PROPORCIONAL_MAIOR_RESTO' NOT NULL,
	"hash_fontes" varchar(64) NOT NULL,
	"hash_regra" varchar(64) NOT NULL,
	"hash_enquadramento" varchar(64) NOT NULL,
	"hash_resultado" varchar(64) NOT NULL,
	"total_proventos" numeric(18, 2) NOT NULL,
	"total_descontos" numeric(18, 2) NOT NULL,
	"total_liquido" numeric(18, 2) NOT NULL,
	"base_inss_bruta" numeric(18, 2) NOT NULL,
	"base_inss" numeric(18, 2) NOT NULL,
	"valor_inss" numeric(18, 2) NOT NULL,
	"rendimentos_irrf" numeric(18, 2) NOT NULL,
	"base_irrf" numeric(18, 2) NOT NULL,
	"irrf_bruto" numeric(18, 2) NOT NULL,
	"irrf_reducao" numeric(18, 2) NOT NULL,
	"valor_irrf" numeric(18, 2) NOT NULL,
	"memoria" jsonb NOT NULL,
	"responsavel" varchar(160),
	"justificativa" text DEFAULT '' NOT NULL,
	"decidido_em" timestamp with time zone,
	"criado_por" varchar(160) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fk_simulacao_fiscal_empresa_caso"
		FOREIGN KEY ("empresa_id", "caso_id")
		REFERENCES "public"."consolidacao_mensal_caso"("empresa_id", "id"),
	CONSTRAINT "fk_simulacao_fiscal_empresa_pessoa"
		FOREIGN KEY ("empresa_id", "pessoa_id")
		REFERENCES "public"."pessoa"("empresa_id", "id"),
	CONSTRAINT "fk_simulacao_fiscal_regra"
		FOREIGN KEY ("regra_calculo_id")
		REFERENCES "public"."regra_calculo_versao"("id"),
	CONSTRAINT "fk_simulacao_fiscal_empresa_enquadramento"
		FOREIGN KEY ("empresa_id", "enquadramento_previdenciario_id")
		REFERENCES "public"."enquadramento_previdenciario"("empresa_id", "id"),
	CONSTRAINT "ck_simulacao_fiscal_competencia"
		CHECK ("competencia" = date_trunc('month', "competencia")::date),
	CONSTRAINT "ck_simulacao_fiscal_versao" CHECK ("versao" > 0),
	CONSTRAINT "ck_simulacao_fiscal_status"
		CHECK (
			"status" in (
				'SIMULADA', 'EM_HOMOLOGACAO', 'HOMOLOGADA', 'REJEITADA', 'INVALIDADA'
			)
		),
	CONSTRAINT "ck_simulacao_fiscal_hipotese"
		CHECK ("hipotese_rateio" = 'PROPORCIONAL_MAIOR_RESTO'),
	CONSTRAINT "ck_simulacao_fiscal_hashes"
		CHECK (
			"hash_fontes" ~ '^[0-9a-f]{64}$'
			AND "hash_regra" ~ '^[0-9a-f]{64}$'
			AND "hash_enquadramento" ~ '^[0-9a-f]{64}$'
			AND "hash_resultado" ~ '^[0-9a-f]{64}$'
		),
	CONSTRAINT "ck_simulacao_fiscal_valores"
		CHECK (
			"total_proventos" >= 0 AND "total_descontos" >= 0
			AND "total_liquido" >= 0 AND "base_inss_bruta" >= 0
			AND "base_inss" >= 0 AND "valor_inss" >= 0
			AND "rendimentos_irrf" >= 0 AND "base_irrf" >= 0
			AND "irrf_bruto" >= 0 AND "irrf_reducao" >= 0
			AND "valor_irrf" >= 0
			AND "total_liquido" = "total_proventos" - "total_descontos"
		),
	CONSTRAINT "ck_simulacao_fiscal_memoria"
		CHECK (
			jsonb_typeof("memoria") = 'object'
			AND "memoria" ->> 'modo' = 'SIMULACAO_NAO_HOMOLOGADA'
			AND "memoria" ->> 'hipoteseRateio' = 'PROPORCIONAL_MAIOR_RESTO'
		),
	CONSTRAINT "ck_simulacao_fiscal_decisao"
		CHECK (
			"status" not in ('HOMOLOGADA', 'REJEITADA', 'INVALIDADA')
			OR (
				length(btrim("justificativa")) BETWEEN 10 AND 3000
				AND length(btrim("responsavel")) BETWEEN 3 AND 160
				AND "decidido_em" IS NOT NULL
			)
		)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_simulacao_fiscal_empresa_id"
	ON "consolidacao_fiscal_simulacao" USING btree ("empresa_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_simulacao_fiscal_versao"
	ON "consolidacao_fiscal_simulacao" USING btree
	("empresa_id", "competencia", "pessoa_id", "versao");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_simulacao_fiscal_fontes"
	ON "consolidacao_fiscal_simulacao" USING btree
	("empresa_id", "competencia", "pessoa_id", "hash_fontes");
--> statement-breakpoint
CREATE INDEX "ix_simulacao_fiscal_competencia_status"
	ON "consolidacao_fiscal_simulacao" USING btree
	("empresa_id", "competencia", "status");
--> statement-breakpoint
CREATE TABLE "consolidacao_fiscal_simulacao_fonte" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"simulacao_id" uuid NOT NULL,
	"vinculo_id" uuid NOT NULL,
	"medicao_id" uuid,
	"folha_id" uuid,
	"ordem" integer NOT NULL,
	"hash_entrada" varchar(64) NOT NULL,
	"total_proventos" numeric(18, 2) NOT NULL,
	"descontos_eventos" numeric(18, 2) NOT NULL,
	"total_descontos" numeric(18, 2) NOT NULL,
	"total_liquido" numeric(18, 2) NOT NULL,
	"base_inss_bruta" numeric(18, 2) NOT NULL,
	"base_inss_rateada" numeric(18, 2) NOT NULL,
	"valor_inss_rateado" numeric(18, 2) NOT NULL,
	"base_irrf_bruta" numeric(18, 2) NOT NULL,
	"base_irrf_rateada" numeric(18, 2) NOT NULL,
	"irrf_bruto_rateado" numeric(18, 2) NOT NULL,
	"irrf_reducao_rateada" numeric(18, 2) NOT NULL,
	"valor_irrf_rateado" numeric(18, 2) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fk_simulacao_fonte_empresa_simulacao"
		FOREIGN KEY ("empresa_id", "simulacao_id")
		REFERENCES "public"."consolidacao_fiscal_simulacao"("empresa_id", "id")
		ON DELETE cascade,
	CONSTRAINT "fk_simulacao_fonte_empresa_vinculo"
		FOREIGN KEY ("empresa_id", "vinculo_id")
		REFERENCES "public"."prestador_vinculo"("empresa_id", "id"),
	CONSTRAINT "fk_simulacao_fonte_empresa_medicao"
		FOREIGN KEY ("empresa_id", "medicao_id")
		REFERENCES "public"."medicao_mensal"("empresa_id", "id"),
	CONSTRAINT "fk_simulacao_fonte_empresa_folha"
		FOREIGN KEY ("empresa_id", "folha_id")
		REFERENCES "public"."folha"("empresa_id", "id"),
	CONSTRAINT "ck_simulacao_fonte_ordem" CHECK ("ordem" > 0),
	CONSTRAINT "ck_simulacao_fonte_hash"
		CHECK ("hash_entrada" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_simulacao_fonte_valores"
		CHECK (
			"total_proventos" >= 0 AND "descontos_eventos" >= 0
			AND "total_descontos" >= 0 AND "total_liquido" >= 0
			AND "base_inss_bruta" >= 0 AND "base_inss_rateada" >= 0
			AND "valor_inss_rateado" >= 0 AND "base_irrf_bruta" >= 0
			AND "base_irrf_rateada" >= 0 AND "irrf_bruto_rateado" >= 0
			AND "irrf_reducao_rateada" >= 0 AND "valor_irrf_rateado" >= 0
			AND "total_liquido" = "total_proventos" - "total_descontos"
			AND "total_descontos" =
				"descontos_eventos" + "valor_inss_rateado" + "valor_irrf_rateado"
		),
	CONSTRAINT "ck_simulacao_fonte_snapshot"
		CHECK (jsonb_typeof("snapshot") = 'object')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_simulacao_fonte_vinculo"
	ON "consolidacao_fiscal_simulacao_fonte" USING btree
	("simulacao_id", "vinculo_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_simulacao_fonte_ordem"
	ON "consolidacao_fiscal_simulacao_fonte" USING btree
	("simulacao_id", "ordem");
--> statement-breakpoint
CREATE INDEX "ix_simulacao_fonte_simulacao"
	ON "consolidacao_fiscal_simulacao_fonte" USING btree ("simulacao_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION proteger_simulacao_fiscal()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION
			'Simulação fiscal não pode ser excluída; invalide-a preservando o histórico.'
			USING ERRCODE = '55000';
	END IF;

	IF
		OLD.status IN ('HOMOLOGADA', 'REJEITADA', 'INVALIDADA')
		AND NEW IS DISTINCT FROM OLD
	THEN
		RAISE EXCEPTION
			'Decisão terminal da simulação fiscal é imutável.'
			USING ERRCODE = '55000';
	END IF;

	IF
		(to_jsonb(NEW) - ARRAY[
			'status', 'responsavel', 'justificativa', 'decidido_em', 'atualizado_em'
		])
		IS DISTINCT FROM
		(to_jsonb(OLD) - ARRAY[
			'status', 'responsavel', 'justificativa', 'decidido_em', 'atualizado_em'
		])
	THEN
		RAISE EXCEPTION
			'Conteúdo calculado da simulação fiscal é imutável; crie uma nova versão.'
			USING ERRCODE = '55000';
	END IF;

	IF NOT (
		(OLD.status = 'SIMULADA' AND NEW.status IN ('SIMULADA', 'EM_HOMOLOGACAO', 'INVALIDADA'))
		OR (
			OLD.status = 'EM_HOMOLOGACAO'
			AND NEW.status IN ('EM_HOMOLOGACAO', 'HOMOLOGADA', 'REJEITADA', 'INVALIDADA')
		)
		OR (OLD.status = NEW.status AND OLD.status IN ('HOMOLOGADA', 'REJEITADA', 'INVALIDADA'))
	) THEN
		RAISE EXCEPTION
			'Transição inválida do estado da simulação fiscal: % para %.',
			OLD.status, NEW.status
			USING ERRCODE = '55000';
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION proteger_simulacao_fiscal_fonte()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION
		'Fonte congelada de simulação fiscal é imutável.'
		USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "tr_proteger_simulacao_fiscal"
	BEFORE UPDATE OR DELETE ON "consolidacao_fiscal_simulacao"
	FOR EACH ROW EXECUTE FUNCTION proteger_simulacao_fiscal();
--> statement-breakpoint
CREATE TRIGGER "tr_proteger_simulacao_fiscal_fonte"
	BEFORE UPDATE OR DELETE ON "consolidacao_fiscal_simulacao_fonte"
	FOR EACH ROW EXECUTE FUNCTION proteger_simulacao_fiscal_fonte();
--> statement-breakpoint
CREATE TRIGGER "tr_auditar_simulacao_fiscal"
	AFTER INSERT OR UPDATE ON "consolidacao_fiscal_simulacao"
	FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
--> statement-breakpoint
CREATE TRIGGER "tr_auditar_simulacao_fiscal_fonte"
	AFTER INSERT ON "consolidacao_fiscal_simulacao_fonte"
	FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
