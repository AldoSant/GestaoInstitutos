CREATE TABLE "contribuicao_outra_fonte" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "prestador_id" uuid NOT NULL,
  "competencia" date NOT NULL,
  "fonte_pagadora" varchar(180) NOT NULL,
  "documento_fonte" varchar(14) NOT NULL,
  "remuneracao" numeric(18,2) NOT NULL,
  "base_contribuicao" numeric(18,2) NOT NULL,
  "valor_contribuicao" numeric(18,2) NOT NULL,
  "documento_referencia" varchar(160) NOT NULL,
  "comprovante_verificado" boolean DEFAULT false NOT NULL,
  "observacao" text,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fk_outra_fonte_empresa"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id"),
  CONSTRAINT "fk_outra_fonte_prestador"
    FOREIGN KEY ("prestador_id") REFERENCES "prestador"("id"),
  CONSTRAINT "fk_outra_fonte_empresa_prestador"
    FOREIGN KEY ("empresa_id", "prestador_id")
    REFERENCES "prestador"("empresa_id", "id"),
  CONSTRAINT "ck_outra_fonte_competencia_mes"
    CHECK ("competencia" = date_trunc('month', "competencia")::date),
  CONSTRAINT "ck_outra_fonte_documento"
    CHECK ("documento_fonte" ~ '^([0-9]{11}|[0-9]{14})$'),
  CONSTRAINT "ck_outra_fonte_valores"
    CHECK (
      "remuneracao" >= 0
      AND "base_contribuicao" >= 0
      AND "valor_contribuicao" >= 0
      AND "valor_contribuicao" <= "base_contribuicao"
    )
);--> statement-breakpoint

CREATE UNIQUE INDEX "uq_outra_fonte_empresa_id"
  ON "contribuicao_outra_fonte" ("empresa_id", "id");--> statement-breakpoint

CREATE UNIQUE INDEX "uq_outra_fonte_comprovante"
  ON "contribuicao_outra_fonte"
  ("prestador_id", "competencia", "documento_fonte", "documento_referencia");--> statement-breakpoint

CREATE INDEX "ix_outra_fonte_empresa_competencia"
  ON "contribuicao_outra_fonte" ("empresa_id", "competencia");--> statement-breakpoint

CREATE TRIGGER "tr_auditar_contribuicao_outra_fonte"
AFTER INSERT OR UPDATE OR DELETE ON "contribuicao_outra_fonte"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
