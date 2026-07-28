CREATE TABLE "legado_folha" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"origem" varchar(40) DEFAULT 'GIW' NOT NULL,
	"legacy_id" varchar(100) NOT NULL,
	"competencia" date NOT NULL,
	"numero" varchar(60) NOT NULL,
	"termo_legacy_id" varchar(100),
	"meta_legacy_id" varchar(100),
	"status" varchar(40) NOT NULL,
	"data_pagamento" date,
	"total_proventos" numeric(18, 2) NOT NULL,
	"total_descontos" numeric(18, 2) NOT NULL,
	"base_inss" numeric(18, 2) NOT NULL,
	"valor_inss" numeric(18, 2) NOT NULL,
	"base_irrf" numeric(18, 2) NOT NULL,
	"valor_irrf" numeric(18, 2) NOT NULL,
	"total_liquido" numeric(18, 2) NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"extraido_em" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_legado_folha_competencia" CHECK ("legado_folha"."competencia" = date_trunc('month', "legado_folha"."competencia")::date),
	CONSTRAINT "ck_legado_folha_valores" CHECK ("legado_folha"."total_proventos" >= 0 and "legado_folha"."total_descontos" >= 0
          and "legado_folha"."base_inss" >= 0 and "legado_folha"."valor_inss" >= 0
          and "legado_folha"."base_irrf" >= 0 and "legado_folha"."valor_irrf" >= 0
          and "legado_folha"."total_liquido" >= 0
          and "legado_folha"."total_liquido" =
            round("legado_folha"."total_proventos" - "legado_folha"."total_descontos", 2)),
	CONSTRAINT "ck_legado_folha_checksum" CHECK ("legado_folha"."checksum" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_legado_folha_snapshot" CHECK (jsonb_typeof("legado_folha"."snapshot") = 'object')
);
--> statement-breakpoint
CREATE TABLE "legado_folha_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"folha_legado_id" uuid NOT NULL,
	"legacy_id" varchar(100) NOT NULL,
	"pessoa_legacy_id" varchar(100) NOT NULL,
	"vinculo_legacy_id" varchar(100),
	"matricula" varchar(80) NOT NULL,
	"nome" varchar(180) NOT NULL,
	"cpf" varchar(11),
	"total_proventos" numeric(18, 2) NOT NULL,
	"total_descontos" numeric(18, 2) NOT NULL,
	"base_inss" numeric(18, 2) NOT NULL,
	"valor_inss" numeric(18, 2) NOT NULL,
	"base_irrf" numeric(18, 2) NOT NULL,
	"valor_irrf" numeric(18, 2) NOT NULL,
	"total_liquido" numeric(18, 2) NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "ck_legado_folha_item_cpf" CHECK ("legado_folha_item"."cpf" is null or "legado_folha_item"."cpf" ~ '^[0-9]{11}$'),
	CONSTRAINT "ck_legado_folha_item_valores" CHECK ("legado_folha_item"."total_proventos" >= 0 and "legado_folha_item"."total_descontos" >= 0
          and "legado_folha_item"."base_inss" >= 0 and "legado_folha_item"."valor_inss" >= 0
          and "legado_folha_item"."base_irrf" >= 0 and "legado_folha_item"."valor_irrf" >= 0
          and "legado_folha_item"."total_liquido" >= 0
          and "legado_folha_item"."total_liquido" =
            round("legado_folha_item"."total_proventos" - "legado_folha_item"."total_descontos", 2)),
	CONSTRAINT "ck_legado_folha_item_snapshot" CHECK (jsonb_typeof("legado_folha_item"."snapshot") = 'object')
);
--> statement-breakpoint
CREATE TABLE "legado_folha_item_rubrica" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"folha_item_legado_id" uuid NOT NULL,
	"legacy_id" varchar(100) NOT NULL,
	"evento_legacy_id" varchar(100),
	"codigo" varchar(40) NOT NULL,
	"descricao" varchar(180) NOT NULL,
	"natureza" varchar(20) NOT NULL,
	"referencia" varchar(60),
	"base_calculo" numeric(18, 2) NOT NULL,
	"valor" numeric(18, 2) NOT NULL,
	"incide_inss" boolean,
	"incide_irrf" boolean,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "ck_legado_folha_rubrica_natureza" CHECK ("legado_folha_item_rubrica"."natureza" in ('PROVENTO', 'DESCONTO', 'INFORMATIVO')),
	CONSTRAINT "ck_legado_folha_rubrica_valores" CHECK ("legado_folha_item_rubrica"."base_calculo" >= 0 and "legado_folha_item_rubrica"."valor" >= 0),
	CONSTRAINT "ck_legado_folha_rubrica_snapshot" CHECK (jsonb_typeof("legado_folha_item_rubrica"."snapshot") = 'object')
);
--> statement-breakpoint
CREATE TABLE "legado_guia_inss" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"origem" varchar(40) DEFAULT 'GIW' NOT NULL,
	"legacy_id" varchar(100) NOT NULL,
	"competencia" date NOT NULL,
	"tipo" varchar(30) NOT NULL,
	"status" varchar(40) NOT NULL,
	"identificador" varchar(180),
	"codigo_receita" varchar(40),
	"vencimento" date NOT NULL,
	"pagamento" date,
	"principal" numeric(18, 2) NOT NULL,
	"juros" numeric(18, 2) NOT NULL,
	"multa" numeric(18, 2) NOT NULL,
	"compensacoes" numeric(18, 2) NOT NULL,
	"total" numeric(18, 2) NOT NULL,
	"folha_legacy_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"extraido_em" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_legado_guia_competencia" CHECK ("legado_guia_inss"."competencia" = date_trunc('month', "legado_guia_inss"."competencia")::date),
	CONSTRAINT "ck_legado_guia_tipo" CHECK ("legado_guia_inss"."tipo" in ('GPS', 'DARF_PREVIDENCIARIO', 'DCTFWEB')),
	CONSTRAINT "ck_legado_guia_valores" CHECK ("legado_guia_inss"."principal" >= 0 and "legado_guia_inss"."juros" >= 0
          and "legado_guia_inss"."multa" >= 0 and "legado_guia_inss"."compensacoes" >= 0
          and "legado_guia_inss"."total" >= 0
          and "legado_guia_inss"."total" = round(
            "legado_guia_inss"."principal" + "legado_guia_inss"."juros" + "legado_guia_inss"."multa" - "legado_guia_inss"."compensacoes",
            2
          )),
	CONSTRAINT "ck_legado_guia_folhas" CHECK (jsonb_typeof("legado_guia_inss"."folha_legacy_ids") = 'array'),
	CONSTRAINT "ck_legado_guia_checksum" CHECK ("legado_guia_inss"."checksum" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_legado_guia_snapshot" CHECK (jsonb_typeof("legado_guia_inss"."snapshot") = 'object')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_legado_folha_empresa_id" ON "legado_folha" USING btree ("empresa_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_legado_folha_origem_id" ON "legado_folha" USING btree ("empresa_id","origem","legacy_id");
--> statement-breakpoint
CREATE INDEX "ix_legado_folha_competencia" ON "legado_folha" USING btree ("empresa_id","competencia");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_legado_folha_item_empresa_id" ON "legado_folha_item" USING btree ("empresa_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_legado_folha_item_legacy" ON "legado_folha_item" USING btree ("folha_legado_id","legacy_id");
--> statement-breakpoint
CREATE INDEX "ix_legado_folha_item_pessoa" ON "legado_folha_item" USING btree ("empresa_id","pessoa_legacy_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_legado_folha_rubrica_legacy" ON "legado_folha_item_rubrica" USING btree ("folha_item_legado_id","legacy_id");
--> statement-breakpoint
CREATE INDEX "ix_legado_folha_rubrica_codigo" ON "legado_folha_item_rubrica" USING btree ("empresa_id","codigo");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_legado_guia_empresa_id" ON "legado_guia_inss" USING btree ("empresa_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_legado_guia_origem_id" ON "legado_guia_inss" USING btree ("empresa_id","origem","legacy_id");
--> statement-breakpoint
CREATE INDEX "ix_legado_guia_competencia" ON "legado_guia_inss" USING btree ("empresa_id","competencia");
--> statement-breakpoint
ALTER TABLE "legado_folha" ADD CONSTRAINT "fk_legado_folha_empresa" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legado_folha_item" ADD CONSTRAINT "fk_legado_folha_item_empresa_folha" FOREIGN KEY ("empresa_id","folha_legado_id") REFERENCES "public"."legado_folha"("empresa_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legado_folha_item_rubrica" ADD CONSTRAINT "fk_legado_folha_rubrica_empresa_item" FOREIGN KEY ("empresa_id","folha_item_legado_id") REFERENCES "public"."legado_folha_item"("empresa_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legado_guia_inss" ADD CONSTRAINT "fk_legado_guia_empresa" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;
