ALTER TABLE "prestador_vinculo"
  ADD COLUMN "participa_folha" boolean NOT NULL DEFAULT true;

-- A remuneração de pessoa jurídica e as guias/recolhimentos pertencem ao
-- financeiro/fiscal, não ao motor de folha de pessoas físicas.
UPDATE "prestador_vinculo" vinculo
   SET "participa_folha" = false
  FROM "prestador" prestador
  JOIN "pessoa" pessoa
    ON pessoa."id" = prestador."pessoa_id"
   AND pessoa."empresa_id" = prestador."empresa_id"
 WHERE prestador."id" = vinculo."prestador_id"
   AND prestador."empresa_id" = vinculo."empresa_id"
   AND pessoa."tipo" = 'JURIDICA';

CREATE OR REPLACE FUNCTION "impedir_pessoa_juridica_na_folha"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  tipo_pessoa "tipo_pessoa";
BEGIN
  IF NOT NEW."participa_folha" THEN
    RETURN NEW;
  END IF;

  SELECT pessoa."tipo"
    INTO tipo_pessoa
    FROM "prestador" prestador
    JOIN "pessoa" pessoa
      ON pessoa."id" = prestador."pessoa_id"
     AND pessoa."empresa_id" = prestador."empresa_id"
   WHERE prestador."id" = NEW."prestador_id"
     AND prestador."empresa_id" = NEW."empresa_id";

  IF tipo_pessoa = 'JURIDICA' THEN
    RAISE EXCEPTION
      'Pessoa jurídica não pode participar da folha. Registre a despesa ou recolhimento no fluxo financeiro/fiscal.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "tg_vinculo_impedir_pessoa_juridica_na_folha"
BEFORE INSERT OR UPDATE OF "prestador_id", "empresa_id", "participa_folha"
ON "prestador_vinculo"
FOR EACH ROW
EXECUTE FUNCTION "impedir_pessoa_juridica_na_folha"();
