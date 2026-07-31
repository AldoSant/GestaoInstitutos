create table "demonstrativo_mensal" (
  "id" uuid primary key default gen_random_uuid() not null,
  "empresa_id" uuid not null references "empresa"("id"),
  "competencia" date not null,
  "numero" integer not null,
  "revisao" integer default 1 not null,
  "status" varchar(20) default 'RASCUNHO' not null,
  "total_bruto" numeric(18,2) default 0 not null,
  "total_retencoes" numeric(18,2) default 0 not null,
  "total_liquido" numeric(18,2) default 0 not null,
  "hash_resultado" varchar(64),
  "fechado_em" timestamp with time zone,
  "fechado_por" varchar(160),
  "criado_em" timestamp with time zone default now() not null,
  "atualizado_em" timestamp with time zone default now() not null,
  constraint "ck_demonstrativo_numero" check ("numero" > 0),
  constraint "ck_demonstrativo_revisao" check ("revisao" > 0),
  constraint "ck_demonstrativo_competencia"
    check ("competencia" = date_trunc('month', "competencia")::date),
  constraint "ck_demonstrativo_status"
    check ("status" in ('RASCUNHO', 'EM_CONFERENCIA', 'FECHADO', 'CANCELADO')),
  constraint "ck_demonstrativo_totais" check (
    "total_bruto" >= 0 and "total_retencoes" >= 0 and "total_liquido" >= 0
    and "total_liquido" = round("total_bruto" - "total_retencoes", 2)
  ),
  constraint "ck_demonstrativo_fechamento" check (
    "status" <> 'FECHADO' or (
      "fechado_em" is not null and "fechado_por" is not null
      and "hash_resultado" ~ '^[0-9a-f]{64}$'
    )
  )
);

create unique index "uq_demonstrativo_empresa_id"
  on "demonstrativo_mensal" ("empresa_id", "id");
create unique index "uq_demonstrativo_empresa_competencia_numero"
  on "demonstrativo_mensal" ("empresa_id", "competencia", "numero");
create index "ix_demonstrativo_empresa_competencia"
  on "demonstrativo_mensal" ("empresa_id", "competencia", "status");

create table "pagamento_prestador" (
  "id" uuid primary key default gen_random_uuid() not null,
  "empresa_id" uuid not null,
  "demonstrativo_id" uuid not null references "demonstrativo_mensal"("id") on delete cascade,
  "prestador_id" uuid references "prestador"("id"),
  "vinculo_id" uuid references "prestador_vinculo"("id"),
  "folha_item_id" uuid references "folha_item"("id"),
  "tipo_pessoa" "tipo_pessoa" not null,
  "origem" varchar(24) not null,
  "documento_referencia" varchar(160),
  "documento_hash" varchar(64),
  "beneficiario_snapshot" jsonb not null,
  "valor_bruto" numeric(18,2) not null,
  "total_retencoes" numeric(18,2) default 0 not null,
  "valor_liquido" numeric(18,2) not null,
  "observacao" text,
  "criado_em" timestamp with time zone default now() not null,
  "atualizado_em" timestamp with time zone default now() not null,
  constraint "fk_pagamento_empresa_demonstrativo"
    foreign key ("empresa_id", "demonstrativo_id")
    references "demonstrativo_mensal"("empresa_id", "id") on delete cascade,
  constraint "fk_pagamento_empresa_prestador"
    foreign key ("empresa_id", "prestador_id")
    references "prestador"("empresa_id", "id"),
  constraint "fk_pagamento_empresa_vinculo"
    foreign key ("empresa_id", "vinculo_id")
    references "prestador_vinculo"("empresa_id", "id"),
  constraint "fk_pagamento_empresa_folha_item"
    foreign key ("empresa_id", "folha_item_id")
    references "folha_item"("empresa_id", "id"),
  constraint "ck_pagamento_origem"
    check ("origem" in ('FOLHA_PF', 'NOTA_FISCAL_PJ', 'IMPORTACAO_GIW', 'MANUAL')),
  constraint "ck_pagamento_tipo_origem" check (not (
    ("tipo_pessoa" = 'FISICA' and "origem" = 'NOTA_FISCAL_PJ') or
    ("tipo_pessoa" = 'JURIDICA' and "origem" = 'FOLHA_PF')
  )),
  constraint "ck_pagamento_beneficiario"
    check ("prestador_id" is not null or "origem" = 'IMPORTACAO_GIW'),
  constraint "ck_pagamento_valores" check (
    "valor_bruto" >= 0 and "total_retencoes" >= 0 and "valor_liquido" >= 0
    and "valor_liquido" = round("valor_bruto" - "total_retencoes", 2)
  ),
  constraint "ck_pagamento_documento_hash"
    check ("documento_hash" is null or "documento_hash" ~ '^[0-9a-f]{64}$'),
  constraint "ck_pagamento_beneficiario_snapshot"
    check (jsonb_typeof("beneficiario_snapshot") = 'object')
);

create unique index "uq_pagamento_prestador_empresa_id"
  on "pagamento_prestador" ("empresa_id", "id");
create unique index "uq_pagamento_prestador_folha_item"
  on "pagamento_prestador" ("demonstrativo_id", "folha_item_id")
  where "folha_item_id" is not null;
create index "ix_pagamento_prestador_demonstrativo"
  on "pagamento_prestador" ("demonstrativo_id", "tipo_pessoa");

create table "pagamento_retencao" (
  "id" uuid primary key default gen_random_uuid() not null,
  "empresa_id" uuid not null,
  "pagamento_id" uuid not null references "pagamento_prestador"("id") on delete cascade,
  "tributo" varchar(16) not null,
  "codigo_receita" varchar(40),
  "base_calculo" numeric(18,2),
  "aliquota" numeric(12,6),
  "valor" numeric(18,2) not null,
  "origem" varchar(24) not null,
  "regra_calculo_id" uuid references "regra_calculo_versao"("id"),
  "evidencia_referencia" varchar(240),
  "evidencia_hash" varchar(64),
  "snapshot" jsonb default '{}'::jsonb not null,
  "criado_em" timestamp with time zone default now() not null,
  constraint "fk_pagamento_retencao_empresa"
    foreign key ("empresa_id") references "empresa"("id"),
  constraint "fk_pagamento_retencao_empresa_pagamento"
    foreign key ("empresa_id", "pagamento_id")
    references "pagamento_prestador"("empresa_id", "id") on delete cascade,
  constraint "ck_pagamento_retencao_tributo"
    check ("tributo" in ('INSS', 'IRRF', 'ISS', 'PIS', 'COFINS', 'CSLL', 'OUTRO')),
  constraint "ck_pagamento_retencao_origem"
    check ("origem" in (
      'CALCULO_FOLHA_PF', 'DOCUMENTO_FISCAL', 'IMPORTACAO_GIW', 'MATRIZ_FISCAL'
    )),
  constraint "ck_pagamento_retencao_valores" check (
    "valor" >= 0 and ("base_calculo" is null or "base_calculo" >= 0)
    and ("aliquota" is null or "aliquota" >= 0)
  ),
  constraint "ck_pagamento_retencao_matriz" check (
    "origem" <> 'MATRIZ_FISCAL' or (
      "regra_calculo_id" is not null
      and length(btrim(coalesce("evidencia_referencia", ''))) > 0
    )
  ),
  constraint "ck_pagamento_retencao_evidencia_hash"
    check ("evidencia_hash" is null or "evidencia_hash" ~ '^[0-9a-f]{64}$'),
  constraint "ck_pagamento_retencao_snapshot"
    check (jsonb_typeof("snapshot") = 'object')
);

create index "ix_pagamento_retencao_pagamento"
  on "pagamento_retencao" ("pagamento_id", "tributo");

create table "demonstrativo_obrigacao" (
  "empresa_id" uuid not null,
  "demonstrativo_id" uuid not null,
  "obrigacao_id" uuid not null,
  "natureza" varchar(24) default 'GUIA_RECOLHIMENTO' not null,
  constraint "demonstrativo_obrigacao_pkey"
    primary key ("demonstrativo_id", "obrigacao_id"),
  constraint "fk_demonstrativo_obrigacao_demonstrativo"
    foreign key ("empresa_id", "demonstrativo_id")
    references "demonstrativo_mensal"("empresa_id", "id") on delete cascade,
  constraint "fk_demonstrativo_obrigacao_obrigacao"
    foreign key ("empresa_id", "obrigacao_id")
    references "obrigacao_fiscal"("empresa_id", "id"),
  constraint "ck_demonstrativo_obrigacao_natureza"
    check ("natureza" = 'GUIA_RECOLHIMENTO')
);

create table "classificacao_operacional_legado" (
  "id" uuid primary key default gen_random_uuid() not null,
  "empresa_id" uuid not null references "empresa"("id"),
  "origem" varchar(40) default 'GIW' not null,
  "entidade" varchar(40) not null,
  "legacy_id" varchar(100) not null,
  "natureza" varchar(30) not null,
  "status" varchar(16) default 'PENDENTE' not null,
  "responsavel" varchar(160),
  "evidencia_referencia" varchar(240),
  "observacao" text,
  "decidido_em" timestamp with time zone,
  "criado_em" timestamp with time zone default now() not null,
  "atualizado_em" timestamp with time zone default now() not null,
  constraint "ck_classificacao_legado_natureza" check ("natureza" in (
    'PAGAMENTO_PRESTADOR', 'RETENCAO_TRIBUTARIA', 'GUIA_RECOLHIMENTO'
  )),
  constraint "ck_classificacao_legado_status"
    check ("status" in ('PENDENTE', 'CONFIRMADA', 'REJEITADA')),
  constraint "ck_classificacao_legado_decisao" check (
    "status" = 'PENDENTE' or (
      length(btrim(coalesce("responsavel", ''))) > 0
      and length(btrim(coalesce("evidencia_referencia", ''))) > 0
      and "decidido_em" is not null
    )
  )
);

create unique index "uq_classificacao_legado_origem"
  on "classificacao_operacional_legado"
  ("empresa_id", "origem", "entidade", "legacy_id");
create index "ix_classificacao_legado_pendencia"
  on "classificacao_operacional_legado" ("empresa_id", "status", "natureza");

create function "validar_totais_pagamento_prestador"()
returns trigger
language plpgsql
as $$
declare
  pagamento_id_alvo uuid;
  pagamento "pagamento_prestador"%rowtype;
  soma_retencoes numeric(18,2);
begin
  if tg_table_name = 'pagamento_prestador' then
    pagamento_id_alvo := new.id;
  elsif tg_op = 'DELETE' then
    pagamento_id_alvo := old.pagamento_id;
  else
    pagamento_id_alvo := new.pagamento_id;
  end if;

  select * into pagamento
  from "pagamento_prestador"
  where "id" = pagamento_id_alvo;

  if not found then
    return null;
  end if;

  select coalesce(sum("valor"), 0)
  into soma_retencoes
  from "pagamento_retencao"
  where "pagamento_id" = pagamento_id_alvo;

  if pagamento."total_retencoes" <> round(soma_retencoes, 2) then
    raise exception 'Total de retenções do pagamento % diverge dos itens', pagamento_id_alvo;
  end if;
  return null;
end;
$$;

create constraint trigger "ct_pagamento_retencoes_total"
after insert or update or delete on "pagamento_retencao"
deferrable initially deferred
for each row execute function "validar_totais_pagamento_prestador"();

create constraint trigger "ct_pagamento_total_retencoes"
after insert or update on "pagamento_prestador"
deferrable initially deferred
for each row execute function "validar_totais_pagamento_prestador"();

create function "validar_totais_demonstrativo"()
returns trigger
language plpgsql
as $$
declare
  demonstrativo_id_alvo uuid;
  demonstrativo "demonstrativo_mensal"%rowtype;
  soma_bruto numeric(18,2);
  soma_retencoes numeric(18,2);
  soma_liquido numeric(18,2);
begin
  if tg_table_name = 'demonstrativo_mensal' then
    demonstrativo_id_alvo := new.id;
  elsif tg_op = 'DELETE' then
    demonstrativo_id_alvo := old.demonstrativo_id;
  else
    demonstrativo_id_alvo := new.demonstrativo_id;
  end if;

  select * into demonstrativo
  from "demonstrativo_mensal"
  where "id" = demonstrativo_id_alvo;

  if not found then
    return null;
  end if;

  select
    coalesce(sum("valor_bruto"), 0),
    coalesce(sum("total_retencoes"), 0),
    coalesce(sum("valor_liquido"), 0)
  into soma_bruto, soma_retencoes, soma_liquido
  from "pagamento_prestador"
  where "demonstrativo_id" = demonstrativo_id_alvo;

  if demonstrativo."total_bruto" <> round(soma_bruto, 2)
     or demonstrativo."total_retencoes" <> round(soma_retencoes, 2)
     or demonstrativo."total_liquido" <> round(soma_liquido, 2) then
    raise exception 'Totais do demonstrativo % divergem dos pagamentos', demonstrativo_id_alvo;
  end if;
  return null;
end;
$$;

create constraint trigger "ct_demonstrativo_pagamentos_total"
after insert or update or delete on "pagamento_prestador"
deferrable initially deferred
for each row execute function "validar_totais_demonstrativo"();

create constraint trigger "ct_demonstrativo_total_pagamentos"
after insert or update on "demonstrativo_mensal"
deferrable initially deferred
for each row execute function "validar_totais_demonstrativo"();

create function "bloquear_alteracao_demonstrativo_fechado"()
returns trigger
language plpgsql
as $$
declare
  demonstrativo_id_alvo uuid;
begin
  if tg_op = 'UPDATE' and new.demonstrativo_id <> old.demonstrativo_id then
    raise exception 'Pagamento não pode ser movido entre demonstrativos';
  end if;
  if tg_op = 'DELETE' then
    demonstrativo_id_alvo := old.demonstrativo_id;
  else
    demonstrativo_id_alvo := new.demonstrativo_id;
  end if;

  if exists (
    select 1 from "demonstrativo_mensal"
    where "id" = demonstrativo_id_alvo and "status" = 'FECHADO'
  ) then
    raise exception 'Demonstrativo fechado é imutável; crie uma nova revisão';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger "tr_pagamento_demonstrativo_fechado"
before insert or update or delete on "pagamento_prestador"
for each row execute function "bloquear_alteracao_demonstrativo_fechado"();

create function "bloquear_retencao_demonstrativo_fechado"()
returns trigger
language plpgsql
as $$
declare
  pagamento_id_alvo uuid;
begin
  if tg_op = 'UPDATE' and new.pagamento_id <> old.pagamento_id then
    raise exception 'Retenção não pode ser movida entre pagamentos';
  end if;
  if tg_op = 'DELETE' then
    pagamento_id_alvo := old.pagamento_id;
  else
    pagamento_id_alvo := new.pagamento_id;
  end if;

  if exists (
    select 1
    from "pagamento_prestador" p
    join "demonstrativo_mensal" d on d."id" = p."demonstrativo_id"
    where p."id" = pagamento_id_alvo and d."status" = 'FECHADO'
  ) then
    raise exception 'Demonstrativo fechado é imutável; crie uma nova revisão';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger "tr_retencao_demonstrativo_fechado"
before insert or update or delete on "pagamento_retencao"
for each row execute function "bloquear_retencao_demonstrativo_fechado"();
