CREATE EXTENSION IF NOT EXISTS "btree_gist";--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM prestador_vinculo atual
      JOIN prestador_vinculo outro
        ON outro.id > atual.id
       AND outro.empresa_id = atual.empresa_id
       AND outro.prestador_id = atual.prestador_id
       AND outro.termo_id = atual.termo_id
       AND outro.meta_id = atual.meta_id
       AND outro.ativo
       AND atual.ativo
       AND daterange(atual.inicio, coalesce(atual.fim, 'infinity'::date), '[]')
           && daterange(outro.inicio, coalesce(outro.fim, 'infinity'::date), '[]')
  ) THEN
    RAISE EXCEPTION
      'Existem vinculos ativos com vigencias sobrepostas. Corrija-os antes de aplicar esta migracao.'
      USING ERRCODE = '23514';
  END IF;
END
$$;--> statement-breakpoint

ALTER TABLE "prestador_vinculo"
  ADD CONSTRAINT "ex_vinculo_sem_sobreposicao"
  EXCLUDE USING gist (
    "empresa_id" WITH =,
    "prestador_id" WITH =,
    "termo_id" WITH =,
    "meta_id" WITH =,
    daterange("inicio", coalesce("fim", 'infinity'::date), '[]') WITH &&
  )
  WHERE ("ativo");--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM lancamento_evento_recorrente atual
      JOIN lancamento_evento_recorrente outro
        ON outro.id > atual.id
       AND outro.empresa_id = atual.empresa_id
       AND outro.vinculo_id = atual.vinculo_id
       AND outro.evento_id = atual.evento_id
       AND outro.ativo
       AND atual.ativo
       AND daterange(
             atual.inicio_competencia,
             coalesce(atual.fim_competencia, 'infinity'::date),
             '[]'
           )
           && daterange(
                outro.inicio_competencia,
                coalesce(outro.fim_competencia, 'infinity'::date),
                '[]'
              )
  ) THEN
    RAISE EXCEPTION
      'Existem lancamentos recorrentes ativos com vigencias sobrepostas. Corrija-os antes de aplicar esta migracao.'
      USING ERRCODE = '23514';
  END IF;
END
$$;--> statement-breakpoint

ALTER TABLE "lancamento_evento_recorrente"
  ADD CONSTRAINT "ex_evento_recorrente_sem_sobreposicao"
  EXCLUDE USING gist (
    "empresa_id" WITH =,
    "vinculo_id" WITH =,
    "evento_id" WITH =,
    daterange(
      "inicio_competencia",
      coalesce("fim_competencia", 'infinity'::date),
      '[]'
    ) WITH &&
  )
  WHERE ("ativo");
