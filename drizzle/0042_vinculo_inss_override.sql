-- Alguns vínculos históricos possuem alíquota de segurado específica. Nulo
-- preserva a alíquota do enquadramento previdenciário da empresa.
alter table prestador_vinculo
  add column if not exists aliquota_inss_percentual numeric(7, 4);

alter table prestador_vinculo
  drop constraint if exists ck_vinculo_aliquota_inss_percentual;

alter table prestador_vinculo
  add constraint ck_vinculo_aliquota_inss_percentual
  check (
    aliquota_inss_percentual is null
    or (aliquota_inss_percentual >= 0 and aliquota_inss_percentual <= 100)
  );
