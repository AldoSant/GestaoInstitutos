ALTER TABLE "homologacao_competencia_item"
  DROP CONSTRAINT "ck_homologacao_item_tipo";--> statement-breakpoint
ALTER TABLE "homologacao_competencia_item"
  ADD CONSTRAINT "ck_homologacao_item_tipo"
  CHECK ("tipo" in (
    'MEDICOES', 'CONSOLIDACAO', 'FOLHAS', 'CONFERENCIA_RH',
    'PARALELO_GIW', 'PAGAMENTOS', 'OBRIGACAO', 'DOCUMENTOS_DCTFWEB'
  ));--> statement-breakpoint

CREATE TABLE "obrigacao_fiscal_retificacao" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "obrigacao_id" uuid NOT NULL,
  "versao" integer NOT NULL,
  "status" varchar(20) DEFAULT 'SOLICITADA' NOT NULL,
  "motivo" text NOT NULL,
  "responsavel" varchar(160) NOT NULL,
  "protocolo" varchar(160),
  "snapshot_anterior" jsonb NOT NULL,
  "hash_snapshot_anterior" varchar(64) NOT NULL,
  "resultado" jsonb,
  "solicitada_em" timestamp with time zone DEFAULT now() NOT NULL,
  "iniciada_em" timestamp with time zone,
  "concluida_em" timestamp with time zone,
  CONSTRAINT "fk_retificacao_empresa"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id"),
  CONSTRAINT "fk_retificacao_empresa_obrigacao"
    FOREIGN KEY ("empresa_id", "obrigacao_id")
    REFERENCES "obrigacao_fiscal"("empresa_id", "id"),
  CONSTRAINT "ck_retificacao_versao" CHECK ("versao" > 0),
  CONSTRAINT "ck_retificacao_status" CHECK (
    "status" in ('SOLICITADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')
  ),
  CONSTRAINT "ck_retificacao_motivo" CHECK (
    length(btrim("motivo")) between 20 and 3000
  ),
  CONSTRAINT "ck_retificacao_responsavel" CHECK (
    length(btrim("responsavel")) between 3 and 160
  ),
  CONSTRAINT "ck_retificacao_hash" CHECK (
    "hash_snapshot_anterior" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "ck_retificacao_snapshot" CHECK (
    jsonb_typeof("snapshot_anterior") = 'object'
  ),
  CONSTRAINT "ck_retificacao_resultado" CHECK (
    "resultado" is null or jsonb_typeof("resultado") = 'object'
  ),
  CONSTRAINT "ck_retificacao_conclusao" CHECK (
    ("status" = 'CONCLUIDA' and "concluida_em" is not null and "resultado" is not null)
    or ("status" <> 'CONCLUIDA' and "concluida_em" is null)
  )
);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_retificacao_obrigacao_versao"
  ON "obrigacao_fiscal_retificacao" ("obrigacao_id", "versao");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_retificacao_obrigacao_ativa"
  ON "obrigacao_fiscal_retificacao" ("obrigacao_id")
  WHERE "status" in ('SOLICITADA', 'EM_ANDAMENTO');--> statement-breakpoint
CREATE INDEX "ix_retificacao_empresa_status"
  ON "obrigacao_fiscal_retificacao" ("empresa_id", "status", "solicitada_em");--> statement-breakpoint
CREATE OR REPLACE FUNCTION proteger_retificacao_obrigacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Retificacao fiscal nao pode ser excluida.'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     OR NEW.obrigacao_id IS DISTINCT FROM OLD.obrigacao_id
     OR NEW.versao IS DISTINCT FROM OLD.versao
     OR NEW.motivo IS DISTINCT FROM OLD.motivo
     OR NEW.responsavel IS DISTINCT FROM OLD.responsavel
     OR NEW.snapshot_anterior IS DISTINCT FROM OLD.snapshot_anterior
     OR NEW.hash_snapshot_anterior IS DISTINCT FROM OLD.hash_snapshot_anterior
     OR NEW.solicitada_em IS DISTINCT FROM OLD.solicitada_em
  THEN
    RAISE EXCEPTION 'Evidencia original da retificacao e imutavel.'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.status IN ('CONCLUIDA', 'CANCELADA') THEN
    RAISE EXCEPTION 'Retificacao concluida ou cancelada e imutavel.'
      USING ERRCODE = '55000';
  END IF;

  IF NOT (
    NEW.status = OLD.status
    OR (OLD.status = 'SOLICITADA' AND NEW.status IN ('EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'))
    OR (OLD.status = 'EM_ANDAMENTO' AND NEW.status IN ('CONCLUIDA', 'CANCELADA'))
  ) THEN
    RAISE EXCEPTION 'Transicao de estado da retificacao invalida.'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "tr_proteger_retificacao_obrigacao"
BEFORE UPDATE OR DELETE ON "obrigacao_fiscal_retificacao"
FOR EACH ROW EXECUTE FUNCTION proteger_retificacao_obrigacao();--> statement-breakpoint
CREATE TRIGGER "tr_auditar_retificacao_obrigacao"
AFTER INSERT OR UPDATE OR DELETE ON "obrigacao_fiscal_retificacao"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
