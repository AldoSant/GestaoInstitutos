-- O CNPJ institucional do INSS não é beneficiário bancário de prestador. A
-- importação do GIW preserva o vínculo antigo, mas a classificação explícita
-- impede que ele componha folhas e relações de pagamento futuras.
insert into classificacao_operacional_legado (
  empresa_id, origem, entidade, legacy_id, natureza, status,
  responsavel, evidencia_referencia, observacao, decidido_em
)
select chave.empresa_id, 'GIW', 'prestador', chave.legacy_id,
       'GUIA_RECOLHIMENTO', 'CONFIRMADA',
       'MIGRACAO_0041',
       'CNPJ 29.979.036/0001-40 identificado como Instituto Nacional do Seguro Social.',
       'Classificação de migração: guia/recolhimento não é pagamento a prestador.',
       now()
  from prestador prestador
  join pessoa pessoa
    on pessoa.id = prestador.pessoa_id and pessoa.empresa_id = prestador.empresa_id
  join legado_chave chave
    on chave.empresa_id = prestador.empresa_id
   and chave.origem = 'GIW'
   and chave.entidade = 'prestadores'
   and chave.destino_tabela = 'prestador'
   and chave.destino_id = prestador.id
 where regexp_replace(coalesce(pessoa.cnpj, ''), '\\D', '', 'g') = '29979036000140'
on conflict (empresa_id, origem, entidade, legacy_id) do nothing;
