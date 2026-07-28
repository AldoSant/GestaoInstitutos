ALTER TABLE "obrigacao_fiscal_folha"
  ADD COLUMN "revisao" integer;--> statement-breakpoint
ALTER TABLE "obrigacao_fiscal_folha"
  ADD COLUMN "hash_folha" varchar(64);--> statement-breakpoint

UPDATE "obrigacao_fiscal_folha" fonte
   SET "revisao" = folha."revisao",
       "hash_folha" = folha."hash_resultado"
  FROM "folha"
 WHERE folha."id" = fonte."folha_id";--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "obrigacao_fiscal_folha"
     WHERE "revisao" IS NULL OR "hash_folha" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Não foi possível congelar revisão e hash de todas as Folhas das obrigações existentes.';
  END IF;
END;
$$;--> statement-breakpoint

ALTER TABLE "obrigacao_fiscal_folha"
  ALTER COLUMN "revisao" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "obrigacao_fiscal_folha"
  ALTER COLUMN "hash_folha" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "obrigacao_fiscal_folha"
  ADD CONSTRAINT "ck_obrigacao_folha_revisao"
  CHECK ("revisao" > 0);--> statement-breakpoint
ALTER TABLE "obrigacao_fiscal_folha"
  ADD CONSTRAINT "ck_obrigacao_folha_hash"
  CHECK ("hash_folha" ~ '^[0-9a-f]{64}$');
