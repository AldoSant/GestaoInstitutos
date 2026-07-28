CREATE TABLE "folha_conferencia" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "folha_id" uuid NOT NULL,
  "revisao" integer NOT NULL,
  "hash_resultado" varchar(64) NOT NULL,
  "resultado" varchar(16) NOT NULL,
  "conferente" varchar(160) NOT NULL,
  "confirmou_cadastros" boolean NOT NULL,
  "confirmou_valores" boolean NOT NULL,
  "confirmou_rubricas" boolean NOT NULL,
  "observacao" text DEFAULT '' NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fk_folha_conferencia_empresa"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id"),
  CONSTRAINT "fk_folha_conferencia_folha"
    FOREIGN KEY ("folha_id") REFERENCES "folha"("id") ON DELETE cascade,
  CONSTRAINT "fk_folha_conferencia_empresa_folha"
    FOREIGN KEY ("empresa_id", "folha_id")
    REFERENCES "folha"("empresa_id", "id") ON DELETE cascade,
  CONSTRAINT "ck_folha_conferencia_revisao" CHECK ("revisao" > 0),
  CONSTRAINT "ck_folha_conferencia_resultado"
    CHECK ("resultado" in ('APROVADA', 'REJEITADA')),
  CONSTRAINT "ck_folha_conferencia_hash"
    CHECK ("hash_resultado" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ck_folha_conferencia_conferente"
    CHECK (length(btrim("conferente")) between 3 and 160),
  CONSTRAINT "ck_folha_conferencia_aprovacao"
    CHECK (
      "resultado" <> 'APROVADA'
      OR ("confirmou_cadastros" AND "confirmou_valores" AND "confirmou_rubricas")
    ),
  CONSTRAINT "ck_folha_conferencia_rejeicao"
    CHECK (
      "resultado" <> 'REJEITADA'
      OR length(btrim("observacao")) >= 10
    )
);--> statement-breakpoint

CREATE INDEX "ix_folha_conferencia_folha_hash"
  ON "folha_conferencia" ("folha_id", "hash_resultado", "criado_em");--> statement-breakpoint

CREATE OR REPLACE FUNCTION proteger_conferencia_folha()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Decisões de conferência são imutáveis; registre uma nova decisão.'
    USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint

CREATE TRIGGER "tr_proteger_conferencia_folha"
BEFORE UPDATE OR DELETE ON "folha_conferencia"
FOR EACH ROW EXECUTE FUNCTION proteger_conferencia_folha();--> statement-breakpoint

CREATE TRIGGER "tr_auditar_conferencia_folha"
AFTER INSERT ON "folha_conferencia"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
