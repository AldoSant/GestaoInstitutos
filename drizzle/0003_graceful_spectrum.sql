ALTER TABLE "atividade" ADD CONSTRAINT "ck_atividade_carga_horaria" CHECK ("atividade"."carga_horaria" is null or "atividade"."carga_horaria" >= 0);--> statement-breakpoint
ALTER TABLE "atividade" ADD CONSTRAINT "ck_atividade_valor" CHECK ("atividade"."valor" is null or "atividade"."valor" >= 0);--> statement-breakpoint
ALTER TABLE "empresa" ADD CONSTRAINT "ck_empresa_cnpj_formato" CHECK ("empresa"."cnpj" ~ '^[0-9]{14}$');--> statement-breakpoint
ALTER TABLE "folha" ADD CONSTRAINT "ck_folha_numero" CHECK ("folha"."numero" > 0);--> statement-breakpoint
ALTER TABLE "folha" ADD CONSTRAINT "ck_folha_competencia_primeiro_dia" CHECK ("folha"."competencia" = date_trunc('month', "folha"."competencia")::date);--> statement-breakpoint
ALTER TABLE "folha" ADD CONSTRAINT "ck_folha_fechamento" CHECK ("folha"."status" <> 'FECHADA' or "folha"."fechada_em" is not null);--> statement-breakpoint
ALTER TABLE "importacao_registro" ADD CONSTRAINT "ck_importacao_registro_ordem" CHECK ("importacao_registro"."ordem" > 0);--> statement-breakpoint
ALTER TABLE "importacao_registro" ADD CONSTRAINT "ck_importacao_registro_status" CHECK ("importacao_registro"."status" in ('INSERIDO', 'ATUALIZADO', 'IGNORADO', 'ERRO'));--> statement-breakpoint
ALTER TABLE "importacao_registro" ADD CONSTRAINT "ck_importacao_registro_erro" CHECK (("importacao_registro"."status" = 'ERRO' and "importacao_registro"."erro" is not null)
          or ("importacao_registro"."status" <> 'ERRO' and "importacao_registro"."destino_id" is not null));--> statement-breakpoint
ALTER TABLE "importacao_execucao" ADD CONSTRAINT "ck_importacao_modo" CHECK ("importacao_execucao"."modo" in ('DRY_RUN', 'APLICAR'));--> statement-breakpoint
ALTER TABLE "importacao_execucao" ADD CONSTRAINT "ck_importacao_status" CHECK ("importacao_execucao"."status" in ('EM_ANDAMENTO', 'CONCLUIDA', 'CONCLUIDA_COM_ERROS', 'FALHA'));--> statement-breakpoint
ALTER TABLE "importacao_execucao" ADD CONSTRAINT "ck_importacao_totais" CHECK ("importacao_execucao"."total_lidos" >= 0 and "importacao_execucao"."total_inseridos" >= 0
          and "importacao_execucao"."total_atualizados" >= 0 and "importacao_execucao"."total_ignorados" >= 0
          and "importacao_execucao"."total_erros" >= 0
          and "importacao_execucao"."total_inseridos" + "importacao_execucao"."total_atualizados"
            + "importacao_execucao"."total_ignorados" + "importacao_execucao"."total_erros" <= "importacao_execucao"."total_lidos");--> statement-breakpoint
ALTER TABLE "folha_item" ADD CONSTRAINT "ck_folha_item_valores_nao_negativos" CHECK ("folha_item"."total_proventos" >= 0 and "folha_item"."total_descontos" >= 0
          and "folha_item"."base_inss" >= 0 and "folha_item"."valor_inss" >= 0
          and "folha_item"."base_irrf" >= 0 and "folha_item"."irrf_bruto" >= 0
          and "folha_item"."irrf_reducao" >= 0 and "folha_item"."valor_irrf" >= 0);--> statement-breakpoint
ALTER TABLE "folha_item" ADD CONSTRAINT "ck_folha_item_total_liquido" CHECK ("folha_item"."total_liquido" = round("folha_item"."total_proventos" - "folha_item"."total_descontos", 2));--> statement-breakpoint
ALTER TABLE "obrigacao_fiscal" ADD CONSTRAINT "ck_obrigacao_valores_nao_negativos" CHECK ("obrigacao_fiscal"."principal" >= 0 and "obrigacao_fiscal"."juros" >= 0
          and "obrigacao_fiscal"."multa" >= 0 and "obrigacao_fiscal"."total" >= 0);--> statement-breakpoint
ALTER TABLE "obrigacao_fiscal" ADD CONSTRAINT "ck_obrigacao_total" CHECK ("obrigacao_fiscal"."total" = round("obrigacao_fiscal"."principal" + "obrigacao_fiscal"."juros" + "obrigacao_fiscal"."multa", 2));--> statement-breakpoint
ALTER TABLE "obrigacao_fiscal" ADD CONSTRAINT "ck_obrigacao_bloqueio_motivo" CHECK ("obrigacao_fiscal"."status" <> 'BLOQUEADA' or "obrigacao_fiscal"."bloqueio_motivo" is not null);--> statement-breakpoint
ALTER TABLE "pessoa" ADD CONSTRAINT "ck_pessoa_cpf_formato" CHECK ("pessoa"."cpf" is null or "pessoa"."cpf" ~ '^[0-9]{11}$');--> statement-breakpoint
ALTER TABLE "pessoa" ADD CONSTRAINT "ck_pessoa_cnpj_formato" CHECK ("pessoa"."cnpj" is null or "pessoa"."cnpj" ~ '^[0-9]{14}$');--> statement-breakpoint
ALTER TABLE "pessoa" ADD CONSTRAINT "ck_pessoa_documento_exclusivo" CHECK (not ("pessoa"."cpf" is not null and "pessoa"."cnpj" is not null));--> statement-breakpoint
ALTER TABLE "pessoa" ADD CONSTRAINT "ck_pessoa_tipo_documento" CHECK (("pessoa"."tipo" = 'FISICA' and "pessoa"."cnpj" is null)
          or ("pessoa"."tipo" = 'JURIDICA' and "pessoa"."cpf" is null));--> statement-breakpoint
ALTER TABLE "regra_calculo_versao" ADD CONSTRAINT "ck_regra_versao" CHECK ("regra_calculo_versao"."versao" > 0);--> statement-breakpoint
ALTER TABLE "regra_calculo_versao" ADD CONSTRAINT "ck_regra_vigencia" CHECK ("regra_calculo_versao"."fim_vigencia" is null or "regra_calculo_versao"."fim_vigencia" >= "regra_calculo_versao"."inicio_vigencia");--> statement-breakpoint
ALTER TABLE "termo" ADD CONSTRAINT "ck_termo_vigencia" CHECK ("termo"."fim" is null or "termo"."fim" >= "termo"."inicio");--> statement-breakpoint
ALTER TABLE "termo" ADD CONSTRAINT "ck_termo_valor_global" CHECK ("termo"."valor_global" >= 0);--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "ck_usuario_cpf_formato" CHECK ("usuario"."cpf" ~ '^[0-9]{11}$');--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD CONSTRAINT "ck_vinculo_vigencia" CHECK ("prestador_vinculo"."fim" is null or "prestador_vinculo"."fim" >= "prestador_vinculo"."inicio");--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD CONSTRAINT "ck_vinculo_valor_retribuicao" CHECK ("prestador_vinculo"."valor_retribuicao" >= 0);