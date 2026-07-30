alter table enquadramento_previdenciario
  drop constraint if exists ck_enquadramento_regime,
  drop constraint if exists ck_enquadramento_cenario;

alter table enquadramento_previdenciario
  add constraint ck_enquadramento_regime check (
    regime in (
      'EMPRESA_GERAL',
      'SIMPLES_SUBSTITUIDA',
      'SIMPLES_ANEXO_IV',
      'BENEFICENTE_IMUNE',
      'ADMINISTRACAO_PUBLICA',
      'INSTITUICAO_FINANCEIRA'
    )
  ),
  add constraint ck_enquadramento_cenario check (
    (
      regime = 'EMPRESA_GERAL'
      and aliquota_segurado_numerador = 11
      and aliquota_segurado_denominador = 100
      and aliquota_patronal_numerador = 20
      and aliquota_patronal_denominador = 100
      and cebas_numero is null and cebas_inicio is null and cebas_fim is null
    ) or (
      regime = 'SIMPLES_SUBSTITUIDA'
      and aliquota_segurado_numerador = 11
      and aliquota_segurado_denominador = 100
      and aliquota_patronal_numerador = 0
      and aliquota_patronal_denominador = 100
      and cebas_numero is null and cebas_inicio is null and cebas_fim is null
    ) or (
      regime = 'SIMPLES_ANEXO_IV'
      and aliquota_segurado_numerador = 11
      and aliquota_segurado_denominador = 100
      and aliquota_patronal_numerador = 20
      and aliquota_patronal_denominador = 100
      and cebas_numero is null and cebas_inicio is null and cebas_fim is null
    ) or (
      regime = 'BENEFICENTE_IMUNE'
      and aliquota_segurado_numerador = 20
      and aliquota_segurado_denominador = 100
      and aliquota_patronal_numerador = 0
      and aliquota_patronal_denominador = 100
      and cebas_numero is not null
      and cebas_inicio is not null
      and cebas_fim is not null
      and cebas_fim >= cebas_inicio
      and cebas_inicio <= inicio_vigencia
      and cebas_fim >= fim_vigencia
    ) or (
      regime = 'ADMINISTRACAO_PUBLICA'
      and aliquota_segurado_numerador = 11
      and aliquota_segurado_denominador = 100
      and aliquota_patronal_numerador = 20
      and aliquota_patronal_denominador = 100
      and cebas_numero is null and cebas_inicio is null and cebas_fim is null
    ) or (
      regime = 'INSTITUICAO_FINANCEIRA'
      and aliquota_segurado_numerador = 11
      and aliquota_segurado_denominador = 100
      and aliquota_patronal_numerador = 225
      and aliquota_patronal_denominador = 1000
      and cebas_numero is null and cebas_inicio is null and cebas_fim is null
    )
  );
