CREATE UNIQUE INDEX "uq_atividade_empresa_id" ON "atividade" USING btree ("empresa_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_empresa_id" ON "evento" USING btree ("empresa_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lotacao_empresa_id" ON "lotacao" USING btree ("empresa_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_meta_termo_id" ON "termo_meta" USING btree ("termo_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pessoa_empresa_id" ON "pessoa" USING btree ("empresa_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_prestador_empresa_id" ON "prestador" USING btree ("empresa_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_termo_empresa_id" ON "termo" USING btree ("empresa_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vinculo_empresa_id" ON "prestador_vinculo" USING btree ("empresa_id","id");--> statement-breakpoint
ALTER TABLE "dependente" ADD CONSTRAINT "fk_dependente_empresa_pessoa" FOREIGN KEY ("empresa_id","pessoa_id") REFERENCES "public"."pessoa"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_evento_recorrente" ADD CONSTRAINT "fk_evento_recorrente_empresa_vinculo" FOREIGN KEY ("empresa_id","vinculo_id") REFERENCES "public"."prestador_vinculo"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_evento_recorrente" ADD CONSTRAINT "fk_evento_recorrente_empresa_evento" FOREIGN KEY ("empresa_id","evento_id") REFERENCES "public"."evento"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folha" ADD CONSTRAINT "fk_folha_empresa_termo" FOREIGN KEY ("empresa_id","termo_id") REFERENCES "public"."termo"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folha" ADD CONSTRAINT "fk_folha_termo_meta" FOREIGN KEY ("termo_id","meta_id") REFERENCES "public"."termo_meta"("termo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa_conta_bancaria" ADD CONSTRAINT "fk_pessoa_conta_empresa_pessoa" FOREIGN KEY ("empresa_id","pessoa_id") REFERENCES "public"."pessoa"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa_endereco" ADD CONSTRAINT "fk_pessoa_endereco_empresa_pessoa" FOREIGN KEY ("empresa_id","pessoa_id") REFERENCES "public"."pessoa"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador" ADD CONSTRAINT "fk_prestador_empresa_pessoa" FOREIGN KEY ("empresa_id","pessoa_id") REFERENCES "public"."pessoa"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD CONSTRAINT "fk_vinculo_empresa_prestador" FOREIGN KEY ("empresa_id","prestador_id") REFERENCES "public"."prestador"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD CONSTRAINT "fk_vinculo_empresa_termo" FOREIGN KEY ("empresa_id","termo_id") REFERENCES "public"."termo"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD CONSTRAINT "fk_vinculo_termo_meta" FOREIGN KEY ("termo_id","meta_id") REFERENCES "public"."termo_meta"("termo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD CONSTRAINT "fk_vinculo_empresa_atividade" FOREIGN KEY ("empresa_id","atividade_id") REFERENCES "public"."atividade"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_vinculo" ADD CONSTRAINT "fk_vinculo_empresa_lotacao" FOREIGN KEY ("empresa_id","lotacao_id") REFERENCES "public"."lotacao"("empresa_id","id") ON DELETE no action ON UPDATE no action;
