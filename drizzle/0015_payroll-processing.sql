ALTER TABLE "folha"
  ADD COLUMN "revisao" integer DEFAULT 1 NOT NULL;--> statement-breakpoint

ALTER TABLE "folha_item"
  ADD COLUMN "empresa_id" uuid;--> statement-breakpoint

UPDATE "folha_item" item
   SET "empresa_id" = folha."empresa_id"
  FROM "folha"
 WHERE folha."id" = item."folha_id";--> statement-breakpoint

ALTER TABLE "folha_item"
  ALTER COLUMN "empresa_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "folha_status_historico"
  ALTER COLUMN "usuario_id" DROP NOT NULL,
  ADD COLUMN "ator" varchar(160) DEFAULT 'SISTEMA' NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX "uq_folha_empresa_id"
  ON "folha" USING btree ("empresa_id", "id");--> statement-breakpoint

CREATE UNIQUE INDEX "uq_folha_item_empresa_id"
  ON "folha_item" USING btree ("empresa_id", "id");--> statement-breakpoint

ALTER TABLE "folha"
  ADD CONSTRAINT "ck_folha_revisao"
  CHECK ("revisao" > 0);--> statement-breakpoint

ALTER TABLE "folha_item"
  ADD CONSTRAINT "fk_folha_item_empresa"
  FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "folha_item"
  ADD CONSTRAINT "fk_folha_item_empresa_folha"
  FOREIGN KEY ("empresa_id", "folha_id")
  REFERENCES "folha"("empresa_id", "id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "folha_item"
  ADD CONSTRAINT "fk_folha_item_empresa_vinculo"
  FOREIGN KEY ("empresa_id", "vinculo_id")
  REFERENCES "prestador_vinculo"("empresa_id", "id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE TABLE "folha_item_evento" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "folha_item_id" uuid NOT NULL,
  "evento_id" uuid,
  "codigo" varchar(40) NOT NULL,
  "descricao" varchar(180) NOT NULL,
  "natureza" varchar(20) NOT NULL,
  "origem" varchar(20) NOT NULL,
  "tipo_calculo" varchar(20) NOT NULL,
  "referencia" varchar(40) NOT NULL,
  "base_calculo" numeric(18,2) NOT NULL,
  "valor" numeric(18,2) NOT NULL,
  "incide_inss" boolean DEFAULT false NOT NULL,
  "incide_irrf" boolean DEFAULT false NOT NULL,
  "ordem" integer NOT NULL,
  "snapshot" jsonb NOT NULL,
  CONSTRAINT "fk_folha_item_evento_empresa"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id"),
  CONSTRAINT "fk_folha_item_evento_item"
    FOREIGN KEY ("folha_item_id") REFERENCES "folha_item"("id") ON DELETE cascade,
  CONSTRAINT "fk_folha_item_evento_evento"
    FOREIGN KEY ("evento_id") REFERENCES "evento"("id"),
  CONSTRAINT "fk_folha_item_evento_empresa_item"
    FOREIGN KEY ("empresa_id", "folha_item_id")
    REFERENCES "folha_item"("empresa_id", "id") ON DELETE cascade,
  CONSTRAINT "fk_folha_item_evento_empresa_evento"
    FOREIGN KEY ("empresa_id", "evento_id")
    REFERENCES "evento"("empresa_id", "id"),
  CONSTRAINT "ck_folha_item_evento_natureza"
    CHECK ("natureza" in ('PROVENTO', 'DESCONTO', 'INFORMATIVO')),
  CONSTRAINT "ck_folha_item_evento_origem"
    CHECK ("origem" in ('CONTRATUAL', 'RECORRENTE', 'SISTEMA')),
  CONSTRAINT "ck_folha_item_evento_tipo_calculo"
    CHECK ("tipo_calculo" in ('VALOR', 'PERCENTUAL')),
  CONSTRAINT "ck_folha_item_evento_valores"
    CHECK ("base_calculo" >= 0 AND "valor" >= 0 AND "ordem" > 0)
);--> statement-breakpoint

CREATE UNIQUE INDEX "uq_folha_item_evento_ordem"
  ON "folha_item_evento" USING btree ("folha_item_id", "ordem");--> statement-breakpoint

CREATE INDEX "ix_folha_item_evento_item"
  ON "folha_item_evento" USING btree ("folha_item_id", "ordem");--> statement-breakpoint

CREATE OR REPLACE FUNCTION proteger_conteudo_folha_fechada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  folha_anterior uuid;
  folha_nova uuid;
BEGIN
  IF TG_TABLE_NAME = 'folha_item' THEN
    folha_anterior := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.folha_id END;
    folha_nova := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.folha_id END;
  ELSE
    IF TG_OP <> 'INSERT' THEN
      SELECT item.folha_id INTO folha_anterior
        FROM folha_item item
       WHERE item.id = OLD.folha_item_id;
    END IF;
    IF TG_OP <> 'DELETE' THEN
      SELECT item.folha_id INTO folha_nova
        FROM folha_item item
       WHERE item.id = NEW.folha_item_id;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM folha
     WHERE id in (folha_anterior, folha_nova)
       AND status = 'FECHADA'
  ) THEN
    RAISE EXCEPTION 'O conteúdo de uma Folha fechada é imutável.'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint

CREATE TRIGGER "tr_proteger_folha_item_fechado"
BEFORE INSERT OR UPDATE OR DELETE ON "folha_item"
FOR EACH ROW EXECUTE FUNCTION proteger_conteudo_folha_fechada();--> statement-breakpoint

CREATE TRIGGER "tr_proteger_folha_evento_fechado"
BEFORE INSERT OR UPDATE OR DELETE ON "folha_item_evento"
FOR EACH ROW EXECUTE FUNCTION proteger_conteudo_folha_fechada();--> statement-breakpoint

CREATE OR REPLACE FUNCTION proteger_regra_calculo_utilizada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM folha WHERE regra_calculo_id = OLD.id) THEN
    RAISE EXCEPTION 'A regra fiscal já foi vinculada a uma Folha e é imutável.'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint

CREATE TRIGGER "tr_proteger_regra_calculo_utilizada"
BEFORE UPDATE OR DELETE ON "regra_calculo_versao"
FOR EACH ROW EXECUTE FUNCTION proteger_regra_calculo_utilizada();--> statement-breakpoint

CREATE TRIGGER "tr_auditar_folha_item"
AFTER INSERT OR UPDATE OR DELETE ON "folha_item"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();--> statement-breakpoint

CREATE TRIGGER "tr_auditar_folha_item_evento"
AFTER INSERT OR UPDATE OR DELETE ON "folha_item_evento"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
