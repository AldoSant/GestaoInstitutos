CREATE TABLE "enquadramento_previdenciario" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "regime" varchar(40) NOT NULL,
  "inicio_vigencia" date NOT NULL,
  "fim_vigencia" date NOT NULL,
  "aliquota_segurado_numerador" integer NOT NULL,
  "aliquota_segurado_denominador" integer NOT NULL,
  "aliquota_patronal_numerador" integer NOT NULL,
  "aliquota_patronal_denominador" integer NOT NULL,
  "cebas_numero" varchar(100),
  "cebas_inicio" date,
  "cebas_fim" date,
  "evidencia" text NOT NULL,
  "fonte_normativa" text NOT NULL,
  "publicado" boolean DEFAULT true NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fk_enquadramento_empresa"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id"),
  CONSTRAINT "ck_enquadramento_regime"
    CHECK ("regime" in ('EMPRESA_GERAL', 'BENEFICENTE_IMUNE')),
  CONSTRAINT "ck_enquadramento_vigencia"
    CHECK ("fim_vigencia" >= "inicio_vigencia"),
  CONSTRAINT "ck_enquadramento_aliquotas"
    CHECK (
      "aliquota_segurado_numerador" >= 0
      AND "aliquota_segurado_denominador" > 0
      AND "aliquota_segurado_numerador" <= "aliquota_segurado_denominador"
      AND "aliquota_patronal_numerador" >= 0
      AND "aliquota_patronal_denominador" > 0
      AND "aliquota_patronal_numerador" <= "aliquota_patronal_denominador"
    ),
  CONSTRAINT "ck_enquadramento_cenario"
    CHECK (
      (
        "regime" = 'EMPRESA_GERAL'
        AND "aliquota_segurado_numerador" = 11
        AND "aliquota_segurado_denominador" = 100
        AND "aliquota_patronal_numerador" = 20
        AND "aliquota_patronal_denominador" = 100
      ) OR (
        "regime" = 'BENEFICENTE_IMUNE'
        AND "aliquota_segurado_numerador" = 20
        AND "aliquota_segurado_denominador" = 100
        AND "aliquota_patronal_numerador" = 0
        AND "aliquota_patronal_denominador" = 100
        AND "cebas_numero" IS NOT NULL
        AND "cebas_inicio" IS NOT NULL
        AND "cebas_fim" IS NOT NULL
        AND "cebas_inicio" <= "inicio_vigencia"
        AND "cebas_fim" >= "fim_vigencia"
      )
    )
);--> statement-breakpoint

CREATE UNIQUE INDEX "uq_enquadramento_empresa_id"
  ON "enquadramento_previdenciario" ("empresa_id", "id");--> statement-breakpoint

CREATE INDEX "ix_enquadramento_empresa_vigencia"
  ON "enquadramento_previdenciario"
  ("empresa_id", "inicio_vigencia", "fim_vigencia");--> statement-breakpoint

ALTER TABLE "enquadramento_previdenciario"
  ADD CONSTRAINT "ex_enquadramento_publicado_sem_sobreposicao"
  EXCLUDE USING gist (
    "empresa_id" WITH =,
    daterange("inicio_vigencia", "fim_vigencia", '[]') WITH &&
  )
  WHERE ("publicado");--> statement-breakpoint

ALTER TABLE "folha"
  ADD COLUMN "enquadramento_previdenciario_id" uuid;--> statement-breakpoint

ALTER TABLE "folha"
  ADD CONSTRAINT "fk_folha_empresa_enquadramento"
  FOREIGN KEY ("empresa_id", "enquadramento_previdenciario_id")
  REFERENCES "enquadramento_previdenciario"("empresa_id", "id");--> statement-breakpoint

CREATE OR REPLACE FUNCTION proteger_enquadramento_utilizado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM folha
     WHERE enquadramento_previdenciario_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'O enquadramento previdenciario ja foi usado e e imutavel.'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint

CREATE TRIGGER "tr_proteger_enquadramento_utilizado"
BEFORE UPDATE OR DELETE ON "enquadramento_previdenciario"
FOR EACH ROW EXECUTE FUNCTION proteger_enquadramento_utilizado();
--> statement-breakpoint

CREATE TRIGGER "tr_auditar_enquadramento_previdenciario"
AFTER INSERT OR UPDATE OR DELETE ON "enquadramento_previdenciario"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
