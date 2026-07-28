ALTER TABLE "prestador_vinculo"
  ADD COLUMN "exige_medicao_mensal" boolean DEFAULT false NOT NULL;--> statement-breakpoint

CREATE TABLE "medicao_mensal" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "vinculo_id" uuid NOT NULL,
  "competencia" date NOT NULL,
  "tipo" varchar(20) NOT NULL,
  "valor_contratual" numeric(18,2) NOT NULL,
  "percentual" numeric(9,4),
  "quantidade" numeric(18,4),
  "valor_unitario" numeric(18,4),
  "valor_apurado" numeric(18,2) NOT NULL,
  "evidencia_referencia" varchar(200) NOT NULL,
  "evidencia_hash" varchar(64),
  "conferente" varchar(160) NOT NULL,
  "conferida_em" timestamp with time zone DEFAULT now() NOT NULL,
  "observacao" text DEFAULT '' NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fk_medicao_empresa"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id"),
  CONSTRAINT "fk_medicao_empresa_vinculo"
    FOREIGN KEY ("empresa_id", "vinculo_id")
    REFERENCES "prestador_vinculo"("empresa_id", "id") ON DELETE cascade,
  CONSTRAINT "ck_medicao_competencia_mes"
    CHECK ("competencia" = date_trunc('month', "competencia")::date),
  CONSTRAINT "ck_medicao_tipo"
    CHECK ("tipo" in ('PERCENTUAL', 'QUANTIDADE', 'VALOR')),
  CONSTRAINT "ck_medicao_valores_nao_negativos"
    CHECK (
      "valor_contratual" >= 0 AND "valor_apurado" >= 0
      AND ("percentual" IS NULL OR "percentual" >= 0)
      AND ("quantidade" IS NULL OR "quantidade" >= 0)
      AND ("valor_unitario" IS NULL OR "valor_unitario" >= 0)
    ),
  CONSTRAINT "ck_medicao_campos_tipo"
    CHECK (
      (
        "tipo" = 'PERCENTUAL'
        AND "percentual" BETWEEN 0 AND 100
        AND "quantidade" IS NULL AND "valor_unitario" IS NULL
        AND "valor_apurado" = round("valor_contratual" * "percentual" / 100, 2)
      ) OR (
        "tipo" = 'QUANTIDADE'
        AND "percentual" IS NULL
        AND "quantidade" IS NOT NULL AND "valor_unitario" IS NOT NULL
        AND "valor_apurado" = round("quantidade" * "valor_unitario", 2)
      ) OR (
        "tipo" = 'VALOR'
        AND "percentual" IS NULL
        AND "quantidade" IS NULL AND "valor_unitario" IS NULL
      )
    ),
  CONSTRAINT "ck_medicao_evidencia"
    CHECK (
      length(btrim("evidencia_referencia")) BETWEEN 3 AND 200
      AND length(btrim("conferente")) BETWEEN 3 AND 160
      AND ("evidencia_hash" IS NULL OR "evidencia_hash" ~ '^[0-9a-f]{64}$')
    )
);--> statement-breakpoint

CREATE UNIQUE INDEX "uq_medicao_empresa_id"
  ON "medicao_mensal" ("empresa_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_medicao_vinculo_competencia"
  ON "medicao_mensal" ("vinculo_id", "competencia");--> statement-breakpoint
CREATE INDEX "ix_medicao_empresa_competencia"
  ON "medicao_mensal" ("empresa_id", "competencia");--> statement-breakpoint

ALTER TABLE "folha_item"
  ADD COLUMN "medicao_id" uuid,
  ADD CONSTRAINT "fk_folha_item_medicao"
    FOREIGN KEY ("medicao_id") REFERENCES "medicao_mensal"("id"),
  ADD CONSTRAINT "fk_folha_item_empresa_medicao"
    FOREIGN KEY ("empresa_id", "medicao_id")
    REFERENCES "medicao_mensal"("empresa_id", "id");--> statement-breakpoint

CREATE OR REPLACE FUNCTION proteger_medicao_fechada()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM folha_item fi
      JOIN folha f ON f.id = fi.folha_id
     WHERE fi.medicao_id = OLD.id
       AND f.status = 'FECHADA'
  ) THEN
    RAISE EXCEPTION 'Medição utilizada em Folha fechada não pode ser alterada ou excluída.'
      USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "tr_proteger_medicao_fechada"
BEFORE UPDATE OR DELETE ON "medicao_mensal"
FOR EACH ROW EXECUTE FUNCTION proteger_medicao_fechada();--> statement-breakpoint

CREATE TRIGGER "tr_auditar_medicao_mensal"
AFTER INSERT OR UPDATE OR DELETE ON "medicao_mensal"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
