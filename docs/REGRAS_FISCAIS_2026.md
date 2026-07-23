# Regras fiscais confirmadas para 2026

Verificação realizada em 22 de julho de 2026. Este documento registra as fontes do
motor inicial; ele não substitui homologação contábil nem transforma o protótipo em
emissor oficial de obrigação.

## IRRF mensal

Fonte primária: [Tributação de 2026 — Receita Federal](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026),
baseada na [Lei nº 15.270/2025](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15270.htm).

Parâmetros implementados em `lib/calculos.ts`:

- tabela progressiva mensal com faixas de R$ 2.428,80, R$ 2.826,65,
  R$ 3.751,05 e R$ 4.664,68;
- parcelas a deduzir de R$ 182,16, R$ 394,16, R$ 675,49 e R$ 908,73;
- dedução mensal por dependente de R$ 189,59;
- desconto simplificado mensal limitado a R$ 607,20;
- imposto reduzido a zero até R$ 5.000,00 de rendimentos tributáveis;
- redução gradual entre R$ 5.000,01 e R$ 7.350,00 pela fórmula
  `978,62 - (0,133145 × rendimentos tributáveis)`.

A redução usa os rendimentos tributáveis, não a base já reduzida por deduções. Os
valores de entrada são normalizados em centavos e entradas negativas, infinitas ou
`NaN` são rejeitadas.

## INSS do contribuinte individual que presta serviço à empresa

Fontes primárias:

- [Contribuições previdenciárias — Receita Federal](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/contribuicoes-previdenciarias-pj);
- [IN RFB nº 2.110/2022, texto compilado](https://normas.receita.fazenda.gov.br/sijut2consulta/normas..receita.fazenda.gov.br/sijut2consulta/link.action?idAto=126687);
- [Tabela de contribuição mensal — INSS](https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal).

Escopo implementado:

- retenção do segurado contribuinte individual à alíquota de 11% quando presta
  serviço a empresa em geral;
- limite máximo do salário de contribuição em R$ 8.475,55 a partir da competência
  janeiro de 2026;
- retenção máxima mensal de R$ 932,31;
- abatimento da base comprovadamente contribuída em outras fontes no mesmo mês.

O motor ainda não calcula contribuição patronal, RAT, terceiros, hipóteses de entidade
beneficente isenta, cessão de mão de obra ou demais incidências. Esses itens devem ser
modelados separadamente na obrigação fiscal, com tipo e origem próprios.

## Controles de mudança

1. Parâmetros são aplicáveis somente às competências de 2026.
2. Mudança de valor exige fonte oficial, vigência e teste de limite.
3. Competências anteriores não podem ser recalculadas silenciosamente com regra nova.
4. O resultado do GIW é evidência de comportamento, não fonte normativa.
5. Emissão/transmissão continua bloqueada até reconciliação e homologação formal.
