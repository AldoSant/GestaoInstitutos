create table "demonstrativo_conferencia" (
  "id" uuid primary key default gen_random_uuid() not null,
  "empresa_id" uuid not null,
  "demonstrativo_id" uuid not null references "demonstrativo_mensal"("id") on delete cascade,
  "revisao" integer not null,
  "hash_resultado" varchar(64) not null,
  "resultado" varchar(16) not null,
  "conferente" varchar(160) not null,
  "confirmou_pagamentos" boolean not null,
  "confirmou_retencoes" boolean not null,
  "confirmou_guias" boolean not null,
  "observacao" text default '' not null,
  "criado_em" timestamp with time zone default now() not null,
  constraint "fk_demonstrativo_conferencia_empresa"
    foreign key ("empresa_id") references "empresa"("id"),
  constraint "fk_demonstrativo_conferencia_empresa_demonstrativo"
    foreign key ("empresa_id", "demonstrativo_id")
    references "demonstrativo_mensal"("empresa_id", "id") on delete cascade,
  constraint "ck_demonstrativo_conferencia_resultado"
    check ("resultado" in ('APROVADA', 'REJEITADA')),
  constraint "ck_demonstrativo_conferencia_revisao" check ("revisao" > 0),
  constraint "ck_demonstrativo_conferencia_hash"
    check ("hash_resultado" ~ '^[0-9a-f]{64}$'),
  constraint "ck_demonstrativo_conferencia_conferente"
    check (length(btrim("conferente")) between 3 and 160),
  constraint "ck_demonstrativo_conferencia_aprovacao" check (
    "resultado" <> 'APROVADA' or (
      "confirmou_pagamentos" and "confirmou_retencoes" and "confirmou_guias"
    )
  ),
  constraint "ck_demonstrativo_conferencia_rejeicao" check (
    "resultado" <> 'REJEITADA' or length(btrim("observacao")) >= 10
  )
);

create index "ix_demonstrativo_conferencia_hash"
  on "demonstrativo_conferencia" ("demonstrativo_id", "hash_resultado", "criado_em");

create unique index "uq_pagamento_pj_documento"
  on "pagamento_prestador" (
    "demonstrativo_id", "prestador_id", "documento_referencia"
  )
  where "origem" in ('NOTA_FISCAL_PJ', 'MANUAL');

create function "proteger_demonstrativo_conferencia"()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Conferência do demonstrativo é imutável';
end;
$$;

create trigger "tr_proteger_demonstrativo_conferencia"
before update or delete on "demonstrativo_conferencia"
for each row execute function "proteger_demonstrativo_conferencia"();
