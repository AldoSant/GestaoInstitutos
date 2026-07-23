ALTER TABLE "termo_meta" ADD COLUMN "tipo_calculo" varchar(40);--> statement-breakpoint
ALTER TABLE "termo_meta" ADD COLUMN "valor_previsto" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD COLUMN "numero_contrato" varchar(60);--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD COLUMN "carga_horaria" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "termo_meta" ADD CONSTRAINT "ck_meta_valor_previsto" CHECK ("termo_meta"."valor_previsto" is null or "termo_meta"."valor_previsto" >= 0);--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD CONSTRAINT "ck_vinculo_carga_horaria" CHECK ("prestador_vinculo"."carga_horaria" is null or "prestador_vinculo"."carga_horaria" >= 0);