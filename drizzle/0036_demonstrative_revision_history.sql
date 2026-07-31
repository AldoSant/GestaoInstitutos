create table "demonstrativo_revisao_historico" (
  "id" uuid primary key default gen_random_uuid() not null,
  "empresa_id" uuid not null,
  "demonstrativo_id" uuid not null,
  "revisao_origem" integer not null,
  "revisao_destino" integer not null,
  "hash_resultado" varchar(64) not null,
  "motivo" text not null,
  "responsavel" varchar(160) not null,
  "snapshot_anterior" jsonb not null,
  "criado_em" timestamp with time zone default now() not null,
  constraint "fk_demonstrativo_revisao_empresa"
    foreign key ("empresa_id") references "empresa"("id"),
  constraint "fk_demonstrativo_revisao_empresa_demonstrativo"
    foreign key ("empresa_id", "demonstrativo_id")
    references "demonstrativo_mensal"("empresa_id", "id") on delete cascade,
  constraint "ck_demonstrativo_revisao_sequencia" check (
    "revisao_origem" > 0 and "revisao_destino" = "revisao_origem" + 1
  ),
  constraint "ck_demonstrativo_revisao_hash" check (
    "hash_resultado" ~ '^[0-9a-f]{64}$'
  ),
  constraint "ck_demonstrativo_revisao_motivo" check (
    length(btrim("motivo")) between 20 and 3000
  ),
  constraint "ck_demonstrativo_revisao_responsavel" check (
    length(btrim("responsavel")) between 3 and 160
  ),
  constraint "ck_demonstrativo_revisao_snapshot" check (
    jsonb_typeof("snapshot_anterior") = 'object'
  )
);

create unique index "uq_demonstrativo_revisao_origem"
  on "demonstrativo_revisao_historico" ("demonstrativo_id", "revisao_origem");
create unique index "uq_demonstrativo_revisao_destino"
  on "demonstrativo_revisao_historico" ("demonstrativo_id", "revisao_destino");
create index "ix_demonstrativo_revisao_empresa_data"
  on "demonstrativo_revisao_historico" ("empresa_id", "criado_em");

create function "proteger_demonstrativo_revisao"()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Histórico de revisão do demonstrativo é imutável';
end;
$$;

create trigger "tr_proteger_demonstrativo_revisao"
before update or delete on "demonstrativo_revisao_historico"
for each row execute function "proteger_demonstrativo_revisao"();

create trigger "tr_auditar_demonstrativo_revisao"
after insert or update or delete on "demonstrativo_revisao_historico"
for each row execute function registrar_auditoria_automatica();
