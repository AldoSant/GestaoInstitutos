CREATE TYPE "public"."status_tarefa" AS ENUM('PENDENTE', 'EXECUTANDO', 'CONCLUIDA', 'FALHA', 'CANCELADA');--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid,
	"ator" varchar(160) NOT NULL,
	"entidade" varchar(80) NOT NULL,
	"registro_id" uuid NOT NULL,
	"acao" varchar(30) NOT NULL,
	"motivo" text,
	"dados_anteriores" jsonb,
	"dados_posteriores" jsonb,
	"correlacao_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_auditoria_acao" CHECK ("auditoria"."acao" in (
        'CRIACAO', 'ALTERACAO', 'INATIVACAO', 'REATIVACAO',
        'PROCESSAMENTO', 'FECHAMENTO', 'REABERTURA',
        'CANCELAMENTO', 'ESTORNO', 'IMPORTACAO'
      )),
	CONSTRAINT "ck_auditoria_conteudo" CHECK ("auditoria"."dados_anteriores" is not null or "auditoria"."dados_posteriores" is not null)
);
--> statement-breakpoint
CREATE TABLE "tarefa_processamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"tipo" varchar(60) NOT NULL,
	"chave_idempotencia" varchar(180) NOT NULL,
	"status" "status_tarefa" DEFAULT 'PENDENTE' NOT NULL,
	"prioridade" integer DEFAULT 100 NOT NULL,
	"payload" jsonb NOT NULL,
	"resultado" jsonb,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"max_tentativas" integer DEFAULT 3 NOT NULL,
	"disponivel_em" timestamp with time zone DEFAULT now() NOT NULL,
	"bloqueada_em" timestamp with time zone,
	"bloqueada_por" varchar(120),
	"iniciada_em" timestamp with time zone,
	"concluida_em" timestamp with time zone,
	"ultimo_erro" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_tarefa_prioridade" CHECK ("tarefa_processamento"."prioridade" >= 0),
	CONSTRAINT "ck_tarefa_tentativas" CHECK ("tarefa_processamento"."tentativas" >= 0
          and "tarefa_processamento"."max_tentativas" > 0
          and "tarefa_processamento"."tentativas" <= "tarefa_processamento"."max_tentativas"),
	CONSTRAINT "ck_tarefa_execucao" CHECK ("tarefa_processamento"."status" <> 'EXECUTANDO'
          or ("tarefa_processamento"."bloqueada_em" is not null and "tarefa_processamento"."bloqueada_por" is not null)),
	CONSTRAINT "ck_tarefa_conclusao" CHECK ("tarefa_processamento"."status" <> 'CONCLUIDA'
          or ("tarefa_processamento"."concluida_em" is not null and "tarefa_processamento"."resultado" is not null)),
	CONSTRAINT "ck_tarefa_falha" CHECK ("tarefa_processamento"."status" <> 'FALHA' or "tarefa_processamento"."ultimo_erro" is not null)
);
--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_processamento" ADD CONSTRAINT "tarefa_processamento_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_auditoria_registro" ON "auditoria" USING btree ("empresa_id","entidade","registro_id","ocorrido_em");--> statement-breakpoint
CREATE INDEX "ix_auditoria_correlacao" ON "auditoria" USING btree ("correlacao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tarefa_idempotencia" ON "tarefa_processamento" USING btree ("empresa_id","tipo","chave_idempotencia");--> statement-breakpoint
CREATE INDEX "ix_tarefa_disponivel" ON "tarefa_processamento" USING btree ("status","disponivel_em","prioridade");--> statement-breakpoint
CREATE INDEX "ix_tarefa_empresa_data" ON "tarefa_processamento" USING btree ("empresa_id","criado_em");