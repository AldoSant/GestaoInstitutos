alter table "guia_gps_individual"
  add column "referencia" varchar(160),
  add column "emitido_em" date,
  add column "localizador" text,
  add column "hash_sha256" varchar(64),
  add column "verificado" boolean not null default false,
  add column "registrado_em" timestamp with time zone;--> statement-breakpoint

alter table "guia_gps_individual"
  add constraint "ck_guia_gps_hash"
  check ("hash_sha256" is null or "hash_sha256" ~ '^[0-9a-f]{64}$');--> statement-breakpoint

alter table "guia_gps_individual"
  add constraint "ck_guia_gps_registro_documental"
  check (
    "status" <> 'REGISTRADA'
    or (
      "verificado"
      and "referencia" is not null
      and "emitido_em" is not null
      and "localizador" is not null
      and length(btrim("localizador")) > 0
      and "registrado_em" is not null
    )
  );
