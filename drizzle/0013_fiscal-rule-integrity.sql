DROP INDEX "uq_regra_empresa_codigo_versao";--> statement-breakpoint
ALTER TABLE "regra_calculo_versao" ADD CONSTRAINT "uq_regra_empresa_codigo_versao" UNIQUE NULLS NOT DISTINCT("empresa_id","codigo","versao");--> statement-breakpoint
ALTER TABLE "regra_calculo_versao" ADD CONSTRAINT "ck_regra_hash" CHECK ("regra_calculo_versao"."hash_conteudo" ~ '^[0-9a-f]{64}$');