create table "guia_gps_individual" (
  "id" uuid primary key default gen_random_uuid() not null,
  "empresa_id" uuid not null,
  "obrigacao_id" uuid not null,
  "obrigacao_item_id" uuid not null,
  "perfil_recolhimento_id" uuid not null,
  "competencia" date not null,
  "beneficiario_nome" varchar(180) not null,
  "identificador" varchar(14) not null,
  "codigo_receita" varchar(4) not null,
  "principal" numeric(18,2) not null,
  "juros" numeric(18,2) not null default 0,
  "multa" numeric(18,2) not null default 0,
  "total" numeric(18,2) not null,
  "status" varchar(20) not null default 'PREPARADA',
  "snapshot" jsonb not null,
  "criado_em" timestamp with time zone not null default now(),
  constraint "fk_guia_gps_empresa" foreign key ("empresa_id") references "empresa"("id"),
  constraint "fk_guia_gps_empresa_obrigacao" foreign key ("empresa_id", "obrigacao_id")
    references "obrigacao_fiscal"("empresa_id", "id") on delete cascade,
  constraint "fk_guia_gps_obrigacao_item" foreign key ("obrigacao_item_id")
    references "obrigacao_fiscal_item"("id") on delete cascade,
  constraint "fk_guia_gps_empresa_perfil" foreign key ("empresa_id", "perfil_recolhimento_id")
    references "perfil_recolhimento_previdenciario"("empresa_id", "id"),
  constraint "ck_guia_gps_competencia" check ("competencia" = date_trunc('month', "competencia")::date),
  constraint "ck_guia_gps_identificador" check ("identificador" ~ '^[0-9]{8,14}$'),
  constraint "ck_guia_gps_codigo" check ("codigo_receita" ~ '^[0-9]{4}$'),
  constraint "ck_guia_gps_status" check ("status" in ('PREPARADA', 'REGISTRADA', 'CANCELADA')),
  constraint "ck_guia_gps_valores" check (
    "principal" > 0 and "juros" >= 0 and "multa" >= 0
    and "total" = round("principal" + "juros" + "multa", 2)
  ),
  constraint "ck_guia_gps_snapshot" check (jsonb_typeof("snapshot") = 'object')
);--> statement-breakpoint

create unique index "uq_guia_gps_item" on "guia_gps_individual" ("obrigacao_item_id");--> statement-breakpoint
create unique index "uq_guia_gps_empresa_id" on "guia_gps_individual" ("empresa_id", "id");--> statement-breakpoint
create index "ix_guia_gps_obrigacao" on "guia_gps_individual" ("obrigacao_id", "status");--> statement-breakpoint

create function "proteger_guia_gps_registrada"()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'REGISTRADA' and (
    tg_op = 'DELETE' or new is distinct from old
  ) then
    raise exception 'Guia GPS registrada é imutável; use retificação da obrigação.'
      using errcode = '55000';
  end if;
  return new;
end;
$$;--> statement-breakpoint

create trigger "tr_proteger_guia_gps_registrada"
before update or delete on "guia_gps_individual"
for each row execute function proteger_guia_gps_registrada();--> statement-breakpoint

create trigger "tr_auditar_guia_gps_individual"
after insert or update or delete on "guia_gps_individual"
for each row execute function registrar_auditoria_automatica();
