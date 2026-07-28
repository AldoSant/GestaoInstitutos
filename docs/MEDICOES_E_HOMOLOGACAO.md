# Medições mensais e homologação do RH

## Objetivo

A medição transforma a referência contratual do Vínculo no valor efetivamente devido
na competência, sem presumir calendário, dias úteis ou fórmula não documentada.

O Vínculo deve marcar **Exige medição mensal** quando o pagamento depender de
produtividade, entrega, frequência ou proporcionalização. Nesse caso, a criação da
Folha é bloqueada enquanto a competência não possuir uma medição conferida.

## Fórmulas disponíveis

| Tipo | Cálculo | Uso esperado |
|---|---|---|
| Percentual | valor contratual × percentual | execução parcial ou proporcionalização cujo percentual já foi validado |
| Quantidade | quantidade × valor unitário | produtividade medida em unidades, horas, atendimentos ou entregas |
| Valor | valor apurado informado | resultado proveniente de memória externa cuja fórmula ainda será homologada |

Todas as operações monetárias usam inteiros e escalas decimais explícitas. O
arredondamento ocorre uma única vez, para centavos.

## Evidência mínima

Cada medição exige:

- competência;
- Vínculo;
- fórmula e parâmetros;
- referência do relatório, processo, protocolo ou arquivo;
- responsável pela conferência;
- hash SHA-256, quando o arquivo estiver disponível;
- observação para exceções ou ressalvas.

O sistema guarda o valor contratual usado, o valor apurado e a evidência. Alterações
ficam na auditoria. Uma medição referenciada por Folha fechada não pode ser alterada.

## Fluxo operacional

1. Em **Vínculos**, marque os contratos que exigem medição.
2. Em **Medições**, selecione a competência e registre os valores conferidos.
3. Crie a Folha somente quando o painel não indicar medições obrigatórias pendentes.
4. Exporte o CSV de conferência da Folha.
5. O RH compara cadastros, rubricas, retenções e líquido.
6. Registre a decisão formal do RH na própria Folha.
7. Feche a Folha. O backend reconfere hash, medição vigente e aprovação.

Se uma medição mudar após o processamento, o fechamento é bloqueado. Reprocesse a
Folha e obtenha uma nova aprovação para o novo hash.

## Homologação com o GIW

Para cada uma das três competências de referência, compare por matrícula e CPF:

- valor contratual;
- fórmula e produtividade;
- proventos;
- base e retenção de INSS;
- base e retenção de IRRF;
- outros descontos;
- líquido.

Toda diferença deve ser classificada como dado cadastral, medição, rubrica, regra
fiscal, arredondamento ou comportamento incorreto do legado. Não ajuste o novo motor
para reproduzir uma diferença sem explicar sua origem.
