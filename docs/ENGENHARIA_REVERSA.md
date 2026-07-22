# Engenharia reversa e evidências

## Escopo autorizado

A análise foi realizada em modo de leitura sobre o sistema e dados fornecidos pelo responsável. Este repositório não contém credenciais, CPFs, nomes de prestadores ou cópias de documentos reais.

## Evidências obtidas

- cadeia de empresa, pessoas, prestadores, termos, metas, vínculos e eventos;
- fluxo de montagem, fechamento e reabertura da folha;
- memória individual e campos de cálculo;
- três competências consecutivas, 37 registros por folha;
- consolidação mensal por pessoa/CPF;
- retenção previdenciária de 11% nos casos observados;
- faixas e redução do IRRF de 2026;
- duplicação sistemática na obrigação previdenciária do legado.

O diagnóstico completo, incluindo totais agregados e lacunas, está em [`referencia/diagnostico-legado.md`](referencia/diagnostico-legado.md).

## Níveis de evidência

| Nível | Definição | Pode virar regra? |
|---|---|---|
| Observado | Campo, valor ou fluxo visto diretamente. | Somente com teste e contexto. |
| Reproduzido | Fórmula produz o mesmo resultado do legado. | Sim, se houver fonte e aceite. |
| Reconciliado | Legado, documento oficial e contabilidade fecham. | Sim. |
| Normativo | Regra possui fonte legal vigente. | Sim, respeitando enquadramento. |
| Inferido | Hipótese plausível sem documento suficiente. | Não; registrar como pendência. |

## Regra para o legado

O legado não é automaticamente a fonte de verdade. Ele funciona como oráculo apenas quando seu resultado estiver conciliado com documentação e norma.

Exemplo: nas três competências, a obrigação exibiu 52 linhas para 26 pessoas tributadas e total exatamente igual a duas vezes a retenção de INSS. O novo sistema bloqueia essa situação até que cada parcela tenha natureza e origem comprovadas.

## Como acrescentar uma regra fiscal

1. Identificar vigência e enquadramento.
2. Registrar fonte normativa ou documento aprovado.
3. Criar uma versão de regra, sem alterar competências passadas.
4. Implementar entrada, fórmula, arredondamento e memória.
5. Criar testes de exemplo e de fronteira.
6. Comparar com competência real anonimizada.
7. Obter aceite do responsável contábil/operacional.

## Dados pessoais

- não adicionar dados reais a fixtures, issues ou pull requests;
- mascarar logs e capturas;
- usar um usuário somente leitura na descoberta;
- trocar imediatamente qualquer credencial exposta;
- armazenar documentos reais apenas em ambiente autorizado e protegido.
