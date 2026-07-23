DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM regra_calculo_versao atual
      JOIN regra_calculo_versao outra
        ON outra.id > atual.id
       AND coalesce(outra.empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = coalesce(atual.empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND outra.codigo = atual.codigo
       AND outra.publicada
       AND atual.publicada
       AND daterange(
             atual.inicio_vigencia,
             coalesce(atual.fim_vigencia, 'infinity'::date),
             '[]'
           )
           && daterange(
                outra.inicio_vigencia,
                coalesce(outra.fim_vigencia, 'infinity'::date),
                '[]'
              )
  ) THEN
    RAISE EXCEPTION
      'Existem regras fiscais publicadas com vigencias sobrepostas.'
      USING ERRCODE = '23514';
  END IF;
END
$$;--> statement-breakpoint

ALTER TABLE "regra_calculo_versao"
  ADD CONSTRAINT "ex_regra_publicada_sem_sobreposicao"
  EXCLUDE USING gist (
    coalesce(
      "empresa_id",
      '00000000-0000-0000-0000-000000000000'::uuid
    ) WITH =,
    "codigo" WITH =,
    daterange(
      "inicio_vigencia",
      coalesce("fim_vigencia", 'infinity'::date),
      '[]'
    ) WITH &&
  )
  WHERE ("publicada");
