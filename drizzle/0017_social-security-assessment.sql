CREATE UNIQUE INDEX "uq_obrigacao_empresa_id"
  ON "obrigacao_fiscal" ("empresa_id", "id");--> statement-breakpoint

CREATE UNIQUE INDEX "uq_obrigacao_empresa_competencia_tipo"
  ON "obrigacao_fiscal" ("empresa_id", "competencia", "tipo");--> statement-breakpoint

CREATE TABLE "obrigacao_fiscal_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "obrigacao_id" uuid NOT NULL,
  "folha_item_id" uuid,
  "natureza" varchar(30) NOT NULL,
  "origem" varchar(20) NOT NULL,
  "descricao" varchar(240) NOT NULL,
  "codigo_receita" varchar(40),
  "base_calculo" numeric(18,2) NOT NULL,
  "aliquota" numeric(12,6),
  "valor" numeric(18,2) NOT NULL,
  "snapshot" jsonb NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fk_obrigacao_item_empresa"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id"),
  CONSTRAINT "fk_obrigacao_item_obrigacao"
    FOREIGN KEY ("obrigacao_id") REFERENCES "obrigacao_fiscal"("id") ON DELETE cascade,
  CONSTRAINT "fk_obrigacao_item_folha_item"
    FOREIGN KEY ("folha_item_id") REFERENCES "folha_item"("id"),
  CONSTRAINT "fk_obrigacao_item_empresa_obrigacao"
    FOREIGN KEY ("empresa_id", "obrigacao_id")
    REFERENCES "obrigacao_fiscal"("empresa_id", "id") ON DELETE cascade,
  CONSTRAINT "fk_obrigacao_item_empresa_folha_item"
    FOREIGN KEY ("empresa_id", "folha_item_id")
    REFERENCES "folha_item"("empresa_id", "id"),
  CONSTRAINT "ck_obrigacao_item_natureza"
    CHECK ("natureza" in (
      'SEGURADO', 'PATRONAL', 'RAT', 'TERCEIROS',
      'JUROS', 'MULTA', 'COMPENSACAO', 'AJUSTE'
    )),
  CONSTRAINT "ck_obrigacao_item_origem"
    CHECK ("origem" in ('FOLHA', 'MANUAL', 'IMPORTACAO', 'DCTFWEB')),
  CONSTRAINT "ck_obrigacao_item_valores"
    CHECK (
      "base_calculo" >= 0 AND "valor" >= 0
      AND ("aliquota" IS NULL OR "aliquota" >= 0)
    )
);--> statement-breakpoint

CREATE UNIQUE INDEX "uq_obrigacao_item_folha_natureza"
  ON "obrigacao_fiscal_item"
  ("obrigacao_id", "folha_item_id", "natureza");--> statement-breakpoint

CREATE INDEX "ix_obrigacao_item_obrigacao"
  ON "obrigacao_fiscal_item" ("obrigacao_id", "natureza");--> statement-breakpoint

CREATE TRIGGER "tr_auditar_obrigacao_item"
AFTER INSERT OR UPDATE OR DELETE ON "obrigacao_fiscal_item"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
