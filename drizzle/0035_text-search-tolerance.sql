CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION "normalizar_texto_busca"(entrada text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT unaccent('public.unaccent', lower(entrada));
$$;

CREATE INDEX IF NOT EXISTS "ix_pessoa_nome_busca_tolerante"
  ON "pessoa" USING gin (normalizar_texto_busca("nome_razao_social") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ix_prestador_matricula_busca_tolerante"
  ON "prestador" USING gin (normalizar_texto_busca("matricula") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ix_atividade_descricao_busca_tolerante"
  ON "atividade" USING gin (normalizar_texto_busca("descricao") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ix_lotacao_descricao_busca_tolerante"
  ON "lotacao" USING gin (normalizar_texto_busca("descricao") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ix_termo_descricao_busca_tolerante"
  ON "termo" USING gin (normalizar_texto_busca("descricao") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ix_meta_descricao_busca_tolerante"
  ON "termo_meta" USING gin (normalizar_texto_busca("descricao") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ix_evento_descricao_busca_tolerante"
  ON "evento" USING gin (normalizar_texto_busca("descricao") gin_trgm_ops);
