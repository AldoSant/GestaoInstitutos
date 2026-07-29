CREATE TABLE "fgts_apuracao" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "competencia" date NOT NULL,
  "versao" integer NOT NULL,
  "status" varchar(24) DEFAULT 'RASCUNHO' NOT NULL,
  "base_interna" numeric(18,2) DEFAULT 0 NOT NULL,
  "valor_interno" numeric(18,2) DEFAULT 0 NOT NULL,
  "base_s5013" numeric(18,2),
  "valor_s5013" numeric(18,2),
  "diferenca" numeric(18,2),
  "snapshot_fontes" jsonb NOT NULL,
  "hash_fontes" varchar(64) NOT NULL,
  "responsavel" varchar(160) NOT NULL,
  "calculada_em" timestamp with time zone,
  "conciliada_em" timestamp with time zone,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fk_fgts_apuracao_empresa"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id"),
  CONSTRAINT "ck_fgts_apuracao_competencia"
    CHECK ("competencia" = date_trunc('month', "competencia")::date),
  CONSTRAINT "ck_fgts_apuracao_versao" CHECK ("versao" > 0),
  CONSTRAINT "ck_fgts_apuracao_status" CHECK (
    "status" in (
      'RASCUNHO', 'CALCULADA', 'TRANSMITIDA', 'CONCILIADA',
      'GUIA_REGISTRADA', 'PAGA', 'BLOQUEADA', 'CANCELADA'
    )
  ),
  CONSTRAINT "ck_fgts_apuracao_valores" CHECK (
    "base_interna" >= 0
    and "valor_interno" >= 0
    and ("base_s5013" is null or "base_s5013" >= 0)
    and ("valor_s5013" is null or "valor_s5013" >= 0)
  ),
  CONSTRAINT "ck_fgts_apuracao_hash"
    CHECK ("hash_fontes" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ck_fgts_apuracao_snapshot"
    CHECK (jsonb_typeof("snapshot_fontes") = 'object'),
  CONSTRAINT "ck_fgts_apuracao_responsavel"
    CHECK (length(btrim("responsavel")) between 3 and 160),
  CONSTRAINT "ck_fgts_apuracao_conciliacao" CHECK (
    (
      "status" in ('CONCILIADA', 'GUIA_REGISTRADA', 'PAGA')
      and "base_s5013" is not null
      and "valor_s5013" is not null
      and "diferenca" = 0
      and "conciliada_em" is not null
    )
    or "status" not in ('CONCILIADA', 'GUIA_REGISTRADA', 'PAGA')
  )
);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fgts_apuracao_empresa_id"
  ON "fgts_apuracao" ("empresa_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fgts_apuracao_competencia_versao"
  ON "fgts_apuracao" ("empresa_id", "competencia", "versao");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fgts_apuracao_ativa"
  ON "fgts_apuracao" ("empresa_id", "competencia")
  WHERE "status" not in ('CANCELADA');--> statement-breakpoint
CREATE INDEX "ix_fgts_apuracao_empresa_status"
  ON "fgts_apuracao" ("empresa_id", "status", "competencia");--> statement-breakpoint

CREATE TABLE "fgts_apuracao_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "apuracao_id" uuid NOT NULL,
  "pessoa_id" uuid,
  "trabalhador_referencia" varchar(160) NOT NULL,
  "matricula" varchar(40) NOT NULL,
  "categoria_esocial" varchar(3) NOT NULL,
  "tipo_valor" varchar(40) NOT NULL,
  "base_interna" numeric(18,2) NOT NULL,
  "aliquota_numerador" integer NOT NULL,
  "aliquota_denominador" integer NOT NULL,
  "valor_interno" numeric(18,2) NOT NULL,
  "base_s5003" numeric(18,2),
  "valor_s5003" numeric(18,2),
  "diferenca" numeric(18,2),
  "recibo_esocial" varchar(80),
  "hash_origem" varchar(64) NOT NULL,
  "snapshot" jsonb NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fk_fgts_item_empresa"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id"),
  CONSTRAINT "fk_fgts_item_empresa_apuracao"
    FOREIGN KEY ("empresa_id", "apuracao_id")
    REFERENCES "fgts_apuracao"("empresa_id", "id") ON DELETE CASCADE,
  CONSTRAINT "fk_fgts_item_empresa_pessoa"
    FOREIGN KEY ("empresa_id", "pessoa_id")
    REFERENCES "pessoa"("empresa_id", "id"),
  CONSTRAINT "ck_fgts_item_categoria"
    CHECK ("categoria_esocial" ~ '^[0-9]{3}$'),
  CONSTRAINT "ck_fgts_item_identificacao" CHECK (
    length(btrim("trabalhador_referencia")) between 1 and 160
    and length(btrim("matricula")) between 1 and 40
    and length(btrim("tipo_valor")) between 1 and 40
  ),
  CONSTRAINT "ck_fgts_item_valores" CHECK (
    "base_interna" >= 0
    and "valor_interno" >= 0
    and "aliquota_numerador" >= 0
    and "aliquota_denominador" > 0
    and "aliquota_numerador" <= "aliquota_denominador"
    and ("base_s5003" is null or "base_s5003" >= 0)
    and ("valor_s5003" is null or "valor_s5003" >= 0)
  ),
  CONSTRAINT "ck_fgts_item_totalizador" CHECK (
    ("base_s5003" is null and "valor_s5003" is null and "diferenca" is null)
    or ("base_s5003" is not null and "valor_s5003" is not null and "diferenca" is not null)
  ),
  CONSTRAINT "ck_fgts_item_hash"
    CHECK ("hash_origem" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ck_fgts_item_snapshot"
    CHECK (jsonb_typeof("snapshot") = 'object')
);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fgts_item_apuracao_chave"
  ON "fgts_apuracao_item"
  ("apuracao_id", "trabalhador_referencia", "categoria_esocial", "tipo_valor");--> statement-breakpoint
CREATE INDEX "ix_fgts_item_empresa_matricula"
  ON "fgts_apuracao_item" ("empresa_id", "matricula");--> statement-breakpoint

CREATE TABLE "integracao_esocial_evento" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "apuracao_fgts_id" uuid,
  "competencia" date,
  "ambiente" varchar(20) NOT NULL,
  "provedor" varchar(80) NOT NULL,
  "tipo" varchar(8) NOT NULL,
  "identificador" varchar(80) NOT NULL,
  "versao_leiaute" varchar(20) NOT NULL,
  "estado" varchar(20) DEFAULT 'RASCUNHO' NOT NULL,
  "payload" jsonb NOT NULL,
  "hash_payload" varchar(64) NOT NULL,
  "protocolo" varchar(160),
  "recibo" varchar(160),
  "codigo_resposta" varchar(40),
  "mensagem" text,
  "resposta" jsonb,
  "transmitido_em" timestamp with time zone,
  "concluido_em" timestamp with time zone,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fk_esocial_evento_empresa"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id"),
  CONSTRAINT "fk_esocial_evento_empresa_apuracao"
    FOREIGN KEY ("empresa_id", "apuracao_fgts_id")
    REFERENCES "fgts_apuracao"("empresa_id", "id"),
  CONSTRAINT "ck_esocial_evento_competencia" CHECK (
    "competencia" is null
    or "competencia" = date_trunc('month', "competencia")::date
  ),
  CONSTRAINT "ck_esocial_evento_ambiente"
    CHECK ("ambiente" in ('PRODUCAO_RESTRITA', 'PRODUCAO')),
  CONSTRAINT "ck_esocial_evento_tipo" CHECK (
    "tipo" in (
      'S-1000', 'S-1005', 'S-1010', 'S-1020', 'S-2200',
      'S-1200', 'S-1298', 'S-1299', 'S-2299', 'S-2399'
    )
  ),
  CONSTRAINT "ck_esocial_evento_estado" CHECK (
    "estado" in (
      'RASCUNHO', 'VALIDADO', 'ENFILEIRADO', 'TRANSMITIDO',
      'PROCESSANDO', 'ACEITO', 'REJEITADO', 'CANCELADO'
    )
  ),
  CONSTRAINT "ck_esocial_evento_payload"
    CHECK (jsonb_typeof("payload") = 'object'),
  CONSTRAINT "ck_esocial_evento_hash"
    CHECK ("hash_payload" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ck_esocial_evento_resposta"
    CHECK ("resposta" is null or jsonb_typeof("resposta") = 'object'),
  CONSTRAINT "ck_esocial_evento_transmissao" CHECK (
    (
      "estado" in ('TRANSMITIDO', 'PROCESSANDO', 'ACEITO', 'REJEITADO')
      and "protocolo" is not null
      and "transmitido_em" is not null
    )
    or "estado" not in ('TRANSMITIDO', 'PROCESSANDO', 'ACEITO', 'REJEITADO')
  ),
  CONSTRAINT "ck_esocial_evento_conclusao" CHECK (
    (
      "estado" in ('ACEITO', 'REJEITADO', 'CANCELADO')
      and "concluido_em" is not null
    )
    or (
      "estado" not in ('ACEITO', 'REJEITADO', 'CANCELADO')
      and "concluido_em" is null
    )
  ),
  CONSTRAINT "ck_esocial_evento_aceite" CHECK (
    "estado" <> 'ACEITO' or "recibo" is not null
  )
);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_esocial_evento_identificador"
  ON "integracao_esocial_evento" ("empresa_id", "ambiente", "identificador");--> statement-breakpoint
CREATE INDEX "ix_esocial_evento_empresa_estado"
  ON "integracao_esocial_evento" ("empresa_id", "estado", "criado_em");--> statement-breakpoint
CREATE INDEX "ix_esocial_evento_apuracao"
  ON "integracao_esocial_evento" ("apuracao_fgts_id", "tipo");--> statement-breakpoint

CREATE TABLE "fgts_guia" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "apuracao_id" uuid NOT NULL,
  "tipo" varchar(24) NOT NULL,
  "status" varchar(16) DEFAULT 'REGISTRADA' NOT NULL,
  "referencia_oficial" varchar(160) NOT NULL,
  "emitida_em" date NOT NULL,
  "vencimento" date NOT NULL,
  "valor_total" numeric(18,2) NOT NULL,
  "pix_copia_cola" text,
  "localizador_documento" text NOT NULL,
  "hash_documento" varchar(64) NOT NULL,
  "paga_em" timestamp with time zone,
  "valor_pago" numeric(18,2),
  "localizador_comprovante" text,
  "hash_comprovante" varchar(64),
  "conteudo" jsonb NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fk_fgts_guia_empresa"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id"),
  CONSTRAINT "fk_fgts_guia_empresa_apuracao"
    FOREIGN KEY ("empresa_id", "apuracao_id")
    REFERENCES "fgts_apuracao"("empresa_id", "id"),
  CONSTRAINT "ck_fgts_guia_tipo"
    CHECK ("tipo" in ('GFD_MENSAL', 'GFD_RESCISORIA', 'GFD_MISTA')),
  CONSTRAINT "ck_fgts_guia_status"
    CHECK ("status" in ('REGISTRADA', 'PAGA', 'VENCIDA', 'CANCELADA')),
  CONSTRAINT "ck_fgts_guia_datas"
    CHECK ("vencimento" >= "emitida_em"),
  CONSTRAINT "ck_fgts_guia_valores" CHECK (
    "valor_total" >= 0
    and ("valor_pago" is null or "valor_pago" >= 0)
  ),
  CONSTRAINT "ck_fgts_guia_hashes" CHECK (
    "hash_documento" ~ '^[0-9a-f]{64}$'
    and ("hash_comprovante" is null or "hash_comprovante" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "ck_fgts_guia_conteudo"
    CHECK (jsonb_typeof("conteudo") = 'object'),
  CONSTRAINT "ck_fgts_guia_pagamento" CHECK (
    (
      "status" = 'PAGA'
      and "paga_em" is not null
      and "valor_pago" = "valor_total"
      and "localizador_comprovante" is not null
      and "hash_comprovante" is not null
    )
    or (
      "status" <> 'PAGA'
      and "paga_em" is null
      and "valor_pago" is null
      and "localizador_comprovante" is null
      and "hash_comprovante" is null
    )
  )
);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fgts_guia_referencia"
  ON "fgts_guia" ("empresa_id", "referencia_oficial");--> statement-breakpoint
CREATE INDEX "ix_fgts_guia_empresa_status"
  ON "fgts_guia" ("empresa_id", "status", "vencimento");--> statement-breakpoint

CREATE OR REPLACE FUNCTION proteger_evento_esocial()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Evento eSocial nao pode ser excluido.'
      USING ERRCODE = '55000';
  END IF;
  IF OLD.estado IN ('ACEITO', 'CANCELADO') THEN
    RAISE EXCEPTION 'Evento eSocial aceito ou cancelado e imutavel.'
      USING ERRCODE = '55000';
  END IF;
  IF OLD.estado <> 'RASCUNHO' AND (
    NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
    OR NEW.apuracao_fgts_id IS DISTINCT FROM OLD.apuracao_fgts_id
    OR NEW.competencia IS DISTINCT FROM OLD.competencia
    OR NEW.ambiente IS DISTINCT FROM OLD.ambiente
    OR NEW.provedor IS DISTINCT FROM OLD.provedor
    OR NEW.tipo IS DISTINCT FROM OLD.tipo
    OR NEW.identificador IS DISTINCT FROM OLD.identificador
    OR NEW.versao_leiaute IS DISTINCT FROM OLD.versao_leiaute
    OR NEW.payload IS DISTINCT FROM OLD.payload
    OR NEW.hash_payload IS DISTINCT FROM OLD.hash_payload
  ) THEN
    RAISE EXCEPTION 'Conteudo validado do evento eSocial e imutavel.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "tr_proteger_evento_esocial"
BEFORE UPDATE OR DELETE ON "integracao_esocial_evento"
FOR EACH ROW EXECUTE FUNCTION proteger_evento_esocial();--> statement-breakpoint

CREATE OR REPLACE FUNCTION proteger_guia_fgts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'GFD registrada nao pode ser excluida.'
      USING ERRCODE = '55000';
  END IF;
  IF OLD.status IN ('PAGA', 'CANCELADA') THEN
    RAISE EXCEPTION 'GFD paga ou cancelada e imutavel.'
      USING ERRCODE = '55000';
  END IF;
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     OR NEW.apuracao_id IS DISTINCT FROM OLD.apuracao_id
     OR NEW.tipo IS DISTINCT FROM OLD.tipo
     OR NEW.referencia_oficial IS DISTINCT FROM OLD.referencia_oficial
     OR NEW.emitida_em IS DISTINCT FROM OLD.emitida_em
     OR NEW.vencimento IS DISTINCT FROM OLD.vencimento
     OR NEW.valor_total IS DISTINCT FROM OLD.valor_total
     OR NEW.localizador_documento IS DISTINCT FROM OLD.localizador_documento
     OR NEW.hash_documento IS DISTINCT FROM OLD.hash_documento
     OR NEW.conteudo IS DISTINCT FROM OLD.conteudo
  THEN
    RAISE EXCEPTION 'Dados originais da GFD sao imutaveis.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "tr_proteger_guia_fgts"
BEFORE UPDATE OR DELETE ON "fgts_guia"
FOR EACH ROW EXECUTE FUNCTION proteger_guia_fgts();--> statement-breakpoint

CREATE TRIGGER "tr_auditar_fgts_apuracao"
AFTER INSERT OR UPDATE OR DELETE ON "fgts_apuracao"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();--> statement-breakpoint
CREATE TRIGGER "tr_auditar_fgts_apuracao_item"
AFTER INSERT OR UPDATE OR DELETE ON "fgts_apuracao_item"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();--> statement-breakpoint
CREATE TRIGGER "tr_auditar_evento_esocial"
AFTER INSERT OR UPDATE OR DELETE ON "integracao_esocial_evento"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();--> statement-breakpoint
CREATE TRIGGER "tr_auditar_guia_fgts"
AFTER INSERT OR UPDATE OR DELETE ON "fgts_guia"
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria_automatica();
