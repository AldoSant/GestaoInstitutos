ALTER TABLE "prestador_vinculo"
  DROP CONSTRAINT "ex_vinculo_sem_sobreposicao";

ALTER TABLE "prestador_vinculo"
  ADD CONSTRAINT "ex_vinculo_sem_sobreposicao"
  EXCLUDE USING gist (
    "empresa_id" WITH =,
    "prestador_id" WITH =,
    "termo_id" WITH =,
    "meta_id" WITH =,
    coalesce("numero_contrato", '') WITH =,
    daterange("inicio", coalesce("fim", 'infinity'::date), '[]') WITH &&
  )
  WHERE ("ativo");
