ALTER TABLE "auditoria" DROP CONSTRAINT "ck_auditoria_acao";--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "ck_auditoria_acao" CHECK ("auditoria"."acao" in (
        'CRIACAO', 'ALTERACAO', 'INATIVACAO', 'REATIVACAO', 'EXCLUSAO',
        'PROCESSAMENTO', 'FECHAMENTO', 'REABERTURA',
        'CANCELAMENTO', 'ESTORNO', 'IMPORTACAO'
      ));