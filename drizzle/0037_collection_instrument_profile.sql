create table "perfil_recolhimento_previdenciario" (
  "id" uuid primary key default gen_random_uuid() not null,
  "empresa_id" uuid not null references "empresa"("id"),
  "instrumento" varchar(24) not null,
  "codigo_receita" varchar(10),
  "inicio_vigencia" date not null,
  "fim_vigencia" date not null,
  "evidencia" text not null,
  "responsavel" varchar(160) not null,
  "publicado" boolean default true not null,
  "criado_em" timestamp with time zone default now() not null,
  constraint "ck_perfil_recolhimento_instrumento"
    check ("instrumento" in ('DCTFWEB_DARF', 'GPS_EXCECAO')),
  constraint "ck_perfil_recolhimento_vigencia"
    check ("fim_vigencia" >= "inicio_vigencia"),
  constraint "ck_perfil_recolhimento_codigo"
    check (("instrumento" = 'GPS_EXCECAO' and "codigo_receita" ~ '^[0-9]{4}$')
      or ("instrumento" = 'DCTFWEB_DARF' and "codigo_receita" is null)),
  constraint "ck_perfil_recolhimento_evidencia"
    check (length(btrim("evidencia")) between 20 and 3000),
  constraint "ck_perfil_recolhimento_responsavel"
    check (length(btrim("responsavel")) between 3 and 160)
);--> statement-breakpoint

create unique index "uq_perfil_recolhimento_empresa_id"
  on "perfil_recolhimento_previdenciario" ("empresa_id", "id");--> statement-breakpoint
create index "ix_perfil_recolhimento_empresa_vigencia"
  on "perfil_recolhimento_previdenciario"
  ("empresa_id", "inicio_vigencia", "fim_vigencia");--> statement-breakpoint

alter table "perfil_recolhimento_previdenciario"
  add constraint "ex_perfil_recolhimento_publicado_sem_sobreposicao"
  exclude using gist (
    "empresa_id" with =,
    daterange("inicio_vigencia", "fim_vigencia", '[]') with &&
  ) where ("publicado");--> statement-breakpoint

alter table "obrigacao_fiscal"
  add column "perfil_recolhimento_id" uuid;--> statement-breakpoint
alter table "obrigacao_fiscal"
  add constraint "fk_obrigacao_empresa_perfil_recolhimento"
  foreign key ("empresa_id", "perfil_recolhimento_id")
  references "perfil_recolhimento_previdenciario" ("empresa_id", "id");--> statement-breakpoint

alter table "obrigacao_fiscal_documento"
  drop constraint "ck_obrigacao_documento_tipo";--> statement-breakpoint
alter table "obrigacao_fiscal_documento"
  add constraint "ck_obrigacao_documento_tipo"
  check ("tipo" in ('TOTALIZADOR_DCTFWEB', 'RECIBO_DCTFWEB', 'DARF', 'GPS'));--> statement-breakpoint

create function "proteger_perfil_recolhimento_utilizado"()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from obrigacao_fiscal
     where perfil_recolhimento_id = old.id
  ) then
    raise exception 'O perfil de recolhimento ja foi usado e e imutavel.'
      using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;--> statement-breakpoint

create trigger "tr_proteger_perfil_recolhimento_utilizado"
before update or delete on "perfil_recolhimento_previdenciario"
for each row execute function proteger_perfil_recolhimento_utilizado();--> statement-breakpoint
create trigger "tr_auditar_perfil_recolhimento_previdenciario"
after insert or update or delete on "perfil_recolhimento_previdenciario"
for each row execute function registrar_auditoria_automatica();
