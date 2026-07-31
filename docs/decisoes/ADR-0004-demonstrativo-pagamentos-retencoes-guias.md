# ADR-0004 — Separar pagamentos, retenções e guias

- Estado: aceito
- Data: 30/07/2026

## Contexto

O GIW apresenta no mesmo relatório pessoas físicas, pessoas jurídicas e linhas que
representam recolhimentos. A tentativa de resolver a ambiguidade excluindo toda PJ do
motor impediu pagamentos legítimos e não distinguiu beneficiário de obrigação fiscal.
O modelo de `folha_item` também exige campos previdenciários de PF e, portanto, não
serve como tabela genérica de pagamentos.

## Decisão

Manter `folha` como motor de PF e criar um agregado financeiro mensal separado:

- `demonstrativo_mensal`;
- `pagamento_prestador`, aceitando PF e PJ;
- `pagamento_retencao`, subordinada ao pagamento;
- `demonstrativo_obrigacao`, apontando para a obrigação/guia existente;
- `classificacao_operacional_legado`, para decisões humanas rastreáveis.

Não será criada uma coluna binária `participa_folha` para resolver a natureza do
registro. A classificação correta depende do fato gerador e da evidência.

## Consequências

- PJ não passa pelo cálculo previdenciário de contribuinte individual.
- Guia nunca precisa de cadastro falso de prestador.
- O demonstrativo pode reproduzir o relatório financeiro de Camamu sem contaminar a
  Folha ou a obrigação.
- Há mais um agregado para fechar e versionar, compensado por limites de domínio
  claros e auditoria melhor.
- Retenção automática de PJ permanece bloqueada até existir matriz fiscal homologada.

