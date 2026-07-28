# Homologação paralela da Folha

## Objetivo

Comparar uma Folha processada pelo novo sistema com a mesma competência apurada no
GIW ou em uma planilha controlada pelo RH. A comparação é feita por matrícula e por
valor monetário exato, em centavos. O arquivo de referência nunca altera o resultado
do motor novo: uma diferença deve ser investigada e explicada, não mascarada.

Esse fluxo fornece a ferramenta de homologação. A liberação operacional ainda depende
de executar e aprovar pelo menos três competências reais representativas.

## Contrato do CSV

Baixe o modelo na própria página de detalhe da Folha. UTF-8 é a codificação
recomendada; arquivos antigos em Windows-1252 também são aceitos. O arquivo deve ter
até 5 MB e no máximo 10.000 prestadores. Ponto e vírgula é o separador recomendado,
pois evita conflito com a vírgula decimal brasileira.

| Coluna | Obrigatória | Finalidade |
|---|---|---|
| `matricula` | Sim | Chave exata de conciliação com a matrícula congelada na Folha. |
| `nome` | Não | Identificação visual; não participa da associação. |
| `total_proventos` | Sim | Total bruto da referência. |
| `inss` | Sim | Retenção previdenciária da pessoa. |
| `irrf` | Sim | Retenção de IRRF. |
| `total_descontos` | Sim | Soma de todos os descontos. |
| `liquido` | Sim | Valor líquido. |

Os valores aceitam `1234,56`, `1.234,56`, `1234.56` e o prefixo `R$`. Valores
negativos, matrícula duplicada e coluna obrigatória ausente bloqueiam o lote inteiro.
Preserve zeros à esquerda da matrícula; ao trabalhar no Excel, mantenha essa coluna
como texto.

Aliases aceitos facilitam exportações legadas:

- matrícula: `matricula`, `matrícula` ou `registro`;
- proventos: `total_proventos`, `proventos`, `bruto` ou `total_bruto`;
- INSS e IRRF: o nome simples ou `valor_inss`/`valor_irrf`;
- descontos: `total_descontos` ou `descontos`;
- líquido: `liquido`, `líquido`, `valor_liquido` ou `valor_líquido`.

## Classificação

| Situação | Significado | Tratamento |
|---|---|---|
| `CONCILIADO` | Matrícula presente nos dois lados e cinco valores idênticos. | Nenhuma ação. |
| `DIVERGENTE` | Matrícula presente nos dois lados, com pelo menos um valor diferente. | Investigar eventos, bases, parâmetros e arredondamentos. |
| `AUSENTE_NOVO` | Existe na referência, mas não na Folha nova. | Revisar cadastro, vínculo, vigência, Termo, Meta e filtros. |
| `AUSENTE_LEGADO` | Existe na Folha nova, mas não na referência. | Revisar escopo do relatório legado e elegibilidade. |

Para cada valor, a diferença segue a fórmula:

```text
diferença = valor do sistema novo - valor de referência
```

## Fluxo operacional

1. No GIW, gere ou transcreva um relatório da mesma competência, Termo e Meta da
   Folha nova.
2. Ajuste somente os nomes das colunas ao contrato; não corrija valores para fazê-los
   coincidir.
3. Processe a Folha nova e abra sua tela de detalhe.
4. Em **Homologação paralela**, registre origem, referência e responsável e importe o
   CSV.
5. Analise primeiro ausências, depois diferenças de proventos, INSS, IRRF, descontos
   e líquido.
6. Corrija cadastro ou regra na fonte adequada, crie uma nova revisão e importe
   novamente a mesma referência.
7. Preserve a explicação das diferenças legítimas no registro de testes ou na ata de
   homologação do RH.

Reimportar exatamente o mesmo arquivo para o mesmo hash da Folha é idempotente: o lote
existente é reutilizado. Uma revisão nova possui outro hash e exige nova comparação.

## Evidência e auditoria

As tabelas `folha_homologacao` e `folha_homologacao_item` guardam:

- revisão e SHA-256 da Folha calculada;
- SHA-256 e nome do CSV;
- origem, referência, responsável e instante;
- valores esperados, atuais e diferenças por matrícula;
- totais e classificação do lote.

Lotes e itens são imutáveis no PostgreSQL. Novas análises criam novos lotes; não
sobrescrevem evidência anterior. A migração responsável é
`0022_payroll-reconciliation`.

## Critério para o corte do GIW

O módulo técnico pronto não encerra a homologação. Antes do corte, o RH e a
contabilidade devem confirmar:

1. três competências reais, incluindo uma com variações ou casos excepcionais;
2. mesma população de prestadores ou ausências formalmente justificadas;
3. proventos, INSS, IRRF, descontos e líquido conciliados por matrícula;
4. total da Folha reconciliado com DCTFWeb e documentos de arrecadação aplicáveis;
5. casos com a mesma pessoa em múltiplos Termos/Metas homologados no agregado mensal,
   antes de retirar o bloqueio conservador;
6. backup restaurável e plano de retorno ao legado durante a janela de corte.

Diferenças legítimas por erro conhecido do GIW devem ser documentadas com causa,
evidência e aprovação; o motor novo não deve reproduzir um erro apenas para zerar a
comparação.
