ALTER TABLE "legado_folha_item"
  ADD COLUMN "cnpj" varchar(14);--> statement-breakpoint
ALTER TABLE "legado_folha_item"
  ADD CONSTRAINT "ck_legado_folha_item_cnpj"
  CHECK ("cnpj" is null or "cnpj" ~ '^[0-9]{14}$');--> statement-breakpoint
ALTER TABLE "legado_folha_item"
  ADD CONSTRAINT "ck_legado_folha_item_documento"
  CHECK ("cpf" is null or "cnpj" is null);--> statement-breakpoint

ALTER TABLE "legado_guia_inss"
  ADD COLUMN "pessoa_legacy_id" varchar(100);--> statement-breakpoint
ALTER TABLE "legado_guia_inss"
  ADD COLUMN "beneficiario_nome" varchar(180);--> statement-breakpoint
ALTER TABLE "legado_guia_inss"
  ADD COLUMN "lote" varchar(80);--> statement-breakpoint
CREATE INDEX "ix_legado_guia_pessoa"
  ON "legado_guia_inss" ("empresa_id", "pessoa_legacy_id");
