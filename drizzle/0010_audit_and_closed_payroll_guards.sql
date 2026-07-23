CREATE OR REPLACE FUNCTION registrar_auditoria_automatica()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  empresa uuid;
  registro uuid;
  ator_atual text;
  acao_atual text;
  anterior jsonb;
  posterior jsonb;
BEGIN
  anterior := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  posterior := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  empresa := coalesce(
    (posterior ->> 'empresa_id')::uuid,
    (anterior ->> 'empresa_id')::uuid
  );
  registro := coalesce(
    (posterior ->> 'id')::uuid,
    (anterior ->> 'id')::uuid
  );
  ator_atual := left(
    coalesce(nullif(current_setting('app.ator', true), ''), 'SISTEMA'),
    160
  );
  acao_atual := CASE TG_OP
    WHEN 'INSERT' THEN 'CRIACAO'
    WHEN 'UPDATE' THEN
      CASE
        WHEN anterior ->> 'ativo' = 'true' AND posterior ->> 'ativo' = 'false'
          THEN 'INATIVACAO'
        WHEN anterior ->> 'ativo' = 'false' AND posterior ->> 'ativo' = 'true'
          THEN 'REATIVACAO'
        WHEN anterior ->> 'status' <> 'FECHADA' AND posterior ->> 'status' = 'FECHADA'
          THEN 'FECHAMENTO'
        WHEN anterior ->> 'status' = 'FECHADA' AND posterior ->> 'status' <> 'FECHADA'
          THEN 'REABERTURA'
        ELSE 'ALTERACAO'
      END
    ELSE 'EXCLUSAO'
  END;

  INSERT INTO auditoria (
    empresa_id,
    ator,
    entidade,
    registro_id,
    acao,
    motivo,
    dados_anteriores,
    dados_posteriores
  )
  VALUES (
    empresa,
    ator_atual,
    TG_TABLE_NAME,
    registro,
    acao_atual,
    nullif(current_setting('app.motivo', true), ''),
    anterior,
    posterior
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint

CREATE TRIGGER "tr_auditar_vinculo"
AFTER INSERT OR UPDATE OR DELETE ON "prestador_vinculo"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();--> statement-breakpoint

CREATE TRIGGER "tr_auditar_evento"
AFTER INSERT OR UPDATE OR DELETE ON "evento"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();--> statement-breakpoint

CREATE TRIGGER "tr_auditar_evento_recorrente"
AFTER INSERT OR UPDATE OR DELETE ON "lancamento_evento_recorrente"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();--> statement-breakpoint

CREATE TRIGGER "tr_auditar_folha"
AFTER INSERT OR UPDATE OR DELETE ON "folha"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();--> statement-breakpoint

CREATE TRIGGER "tr_auditar_obrigacao"
AFTER INSERT OR UPDATE OR DELETE ON "obrigacao_fiscal"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();--> statement-breakpoint

CREATE OR REPLACE FUNCTION proteger_folha_fechada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  reabertura_permitida boolean;
  motivo_atual text;
BEGIN
  IF OLD.status <> 'FECHADA' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  reabertura_permitida :=
    coalesce(current_setting('app.permitir_reabertura', true), 'false') = 'true';
  motivo_atual := nullif(current_setting('app.motivo', true), '');

  IF TG_OP = 'UPDATE'
     AND NEW.status = 'ABERTA'
     AND reabertura_permitida
     AND motivo_atual IS NOT NULL
  THEN
    NEW.fechada_em := NULL;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Folha fechada e imutavel. Use a reabertura auditada com motivo.'
    USING ERRCODE = '55000';
END
$$;--> statement-breakpoint

CREATE TRIGGER "tr_proteger_folha_fechada"
BEFORE UPDATE OR DELETE ON "folha"
FOR EACH ROW EXECUTE FUNCTION proteger_folha_fechada();
