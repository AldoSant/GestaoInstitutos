CREATE TABLE "folha_homologacao" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "folha_id" uuid NOT NULL,
  "revisao" integer NOT NULL,
  "hash_folha" varchar(64) NOT NULL,
  "origem" varchar(30) NOT NULL,
  "referencia" varchar(200) NOT NULL,
  "nome_arquivo" varchar(255) NOT NULL,
  "hash_arquivo" varchar(64) NOT NULL,
  "status" varchar(20) NOT NULL,
  "total_linhas" integer NOT NULL,
  "conciliados" integer NOT NULL,
  "divergentes" integer NOT NULL,
  "resumo" jsonb NOT NULL,
  "criado_por" varchar(160) NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fk_folha_homologacao_empresa_folha"
    FOREIGN KEY ("empresa_id", "folha_id")
    REFERENCES "folha"("empresa_id", "id") ON DELETE cascade,
  CONSTRAINT "ck_folha_homologacao_revisao" CHECK ("revisao" > 0),
  CONSTRAINT "ck_folha_homologacao_hashes"
    CHECK ("hash_folha" ~ '^[0-9a-f]{64}$' AND "hash_arquivo" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ck_folha_homologacao_origem"
    CHECK ("origem" in ('GIW', 'PLANILHA_RH', 'OUTRO')),
  CONSTRAINT "ck_folha_homologacao_status"
    CHECK ("status" in ('CONCILIADA', 'DIVERGENTE')),
  CONSTRAINT "ck_folha_homologacao_contagens"
    CHECK (
      "total_linhas" > 0 AND "conciliados" >= 0 AND "divergentes" >= 0
      AND "total_linhas" = "conciliados" + "divergentes"
      AND (
        ("status" = 'CONCILIADA' AND "divergentes" = 0)
        OR ("status" = 'DIVERGENTE' AND "divergentes" > 0)
      )
    )
);--> statement-breakpoint

CREATE UNIQUE INDEX "uq_folha_homologacao_empresa_id"
  ON "folha_homologacao" ("empresa_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_folha_homologacao_arquivo"
  ON "folha_homologacao" ("folha_id", "hash_folha", "hash_arquivo");--> statement-breakpoint
CREATE INDEX "ix_folha_homologacao_folha"
  ON "folha_homologacao" ("folha_id", "criado_em");--> statement-breakpoint

CREATE TABLE "folha_homologacao_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "homologacao_id" uuid NOT NULL,
  "folha_item_id" uuid,
  "matricula" varchar(80) NOT NULL,
  "nome" varchar(180) NOT NULL,
  "situacao" varchar(30) NOT NULL,
  "esperado_proventos" numeric(18,2) NOT NULL,
  "esperado_inss" numeric(18,2) NOT NULL,
  "esperado_irrf" numeric(18,2) NOT NULL,
  "esperado_descontos" numeric(18,2) NOT NULL,
  "esperado_liquido" numeric(18,2) NOT NULL,
  "atual_proventos" numeric(18,2) NOT NULL,
  "atual_inss" numeric(18,2) NOT NULL,
  "atual_irrf" numeric(18,2) NOT NULL,
  "atual_descontos" numeric(18,2) NOT NULL,
  "atual_liquido" numeric(18,2) NOT NULL,
  "diferenca_proventos" numeric(18,2) NOT NULL,
  "diferenca_inss" numeric(18,2) NOT NULL,
  "diferenca_irrf" numeric(18,2) NOT NULL,
  "diferenca_descontos" numeric(18,2) NOT NULL,
  "diferenca_liquido" numeric(18,2) NOT NULL,
  CONSTRAINT "fk_folha_homologacao_item_empresa_lote"
    FOREIGN KEY ("empresa_id", "homologacao_id")
    REFERENCES "folha_homologacao"("empresa_id", "id") ON DELETE cascade,
  CONSTRAINT "fk_folha_homologacao_item_empresa_folha_item"
    FOREIGN KEY ("empresa_id", "folha_item_id")
    REFERENCES "folha_item"("empresa_id", "id"),
  CONSTRAINT "ck_folha_homologacao_item_situacao"
    CHECK ("situacao" in ('CONCILIADO', 'DIVERGENTE', 'AUSENTE_NOVO', 'AUSENTE_LEGADO')),
  CONSTRAINT "ck_folha_homologacao_item_nao_negativo"
    CHECK (
      "esperado_proventos" >= 0 AND "esperado_inss" >= 0
      AND "esperado_irrf" >= 0 AND "esperado_descontos" >= 0
      AND "esperado_liquido" >= 0 AND "atual_proventos" >= 0
      AND "atual_inss" >= 0 AND "atual_irrf" >= 0
      AND "atual_descontos" >= 0 AND "atual_liquido" >= 0
    ),
  CONSTRAINT "ck_folha_homologacao_item_diferencas"
    CHECK (
      "diferenca_proventos" = "atual_proventos" - "esperado_proventos"
      AND "diferenca_inss" = "atual_inss" - "esperado_inss"
      AND "diferenca_irrf" = "atual_irrf" - "esperado_irrf"
      AND "diferenca_descontos" = "atual_descontos" - "esperado_descontos"
      AND "diferenca_liquido" = "atual_liquido" - "esperado_liquido"
    )
);--> statement-breakpoint

CREATE UNIQUE INDEX "uq_folha_homologacao_item_matricula"
  ON "folha_homologacao_item" ("homologacao_id", "matricula");--> statement-breakpoint

CREATE OR REPLACE FUNCTION proteger_homologacao_folha()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Resultados de homologação são imutáveis; importe um novo lote.'
    USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint

CREATE TRIGGER "tr_proteger_folha_homologacao"
BEFORE UPDATE OR DELETE ON "folha_homologacao"
FOR EACH ROW EXECUTE FUNCTION proteger_homologacao_folha();--> statement-breakpoint
CREATE TRIGGER "tr_proteger_folha_homologacao_item"
BEFORE UPDATE OR DELETE ON "folha_homologacao_item"
FOR EACH ROW EXECUTE FUNCTION proteger_homologacao_folha();--> statement-breakpoint
CREATE TRIGGER "tr_auditar_folha_homologacao"
AFTER INSERT ON "folha_homologacao"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
