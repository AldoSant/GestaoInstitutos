ALTER TABLE "obrigacao_fiscal"
  ADD COLUMN "valor_declarado" numeric(18,2),
  ADD COLUMN "diferenca" numeric(18,2),
  ADD COLUMN "conciliada_em" timestamp with time zone,
  ADD CONSTRAINT "ck_obrigacao_valor_declarado"
    CHECK ("valor_declarado" IS NULL OR "valor_declarado" >= 0);--> statement-breakpoint

CREATE TABLE "obrigacao_fiscal_documento" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "obrigacao_id" uuid NOT NULL,
  "tipo" varchar(30) NOT NULL,
  "referencia" varchar(160) NOT NULL,
  "valor_total" numeric(18,2) NOT NULL,
  "emitido_em" date NOT NULL,
  "localizador" text NOT NULL,
  "hash_sha256" varchar(64),
  "verificado" boolean DEFAULT false NOT NULL,
  "conteudo" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fk_obrigacao_documento_empresa"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id"),
  CONSTRAINT "fk_obrigacao_documento_obrigacao"
    FOREIGN KEY ("obrigacao_id") REFERENCES "obrigacao_fiscal"("id") ON DELETE cascade,
  CONSTRAINT "fk_obrigacao_documento_empresa_obrigacao"
    FOREIGN KEY ("empresa_id", "obrigacao_id")
    REFERENCES "obrigacao_fiscal"("empresa_id", "id") ON DELETE cascade,
  CONSTRAINT "ck_obrigacao_documento_tipo"
    CHECK ("tipo" in ('TOTALIZADOR_DCTFWEB', 'RECIBO_DCTFWEB', 'DARF')),
  CONSTRAINT "ck_obrigacao_documento_valor"
    CHECK ("valor_total" >= 0),
  CONSTRAINT "ck_obrigacao_documento_hash"
    CHECK ("hash_sha256" IS NULL OR "hash_sha256" ~ '^[0-9a-f]{64}$')
);--> statement-breakpoint

CREATE UNIQUE INDEX "uq_obrigacao_documento_referencia"
  ON "obrigacao_fiscal_documento"
  ("obrigacao_id", "tipo", "referencia");--> statement-breakpoint

CREATE INDEX "ix_obrigacao_documento_obrigacao"
  ON "obrigacao_fiscal_documento" ("obrigacao_id", "tipo");--> statement-breakpoint

CREATE TRIGGER "tr_auditar_obrigacao_documento"
AFTER INSERT OR UPDATE OR DELETE ON "obrigacao_fiscal_documento"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
