# Modelo de dados

## Modelo implementado

As migrações Drizzle criam 46 tabelas, agrupadas em:

- organização e acesso: `empresa`, `usuario`, `usuario_empresa`;
- pessoas: `pessoa`, `pessoa_endereco`, `pessoa_conta_bancaria`, `dependente`,
  `prestador`;
- contratos: `atividade`, `lotacao`, `termo`, `termo_meta`,
  `prestador_vinculo`;
- cálculo e parâmetros: `evento`, `lancamento_evento_recorrente`,
  `regra_calculo_versao`, `enquadramento_previdenciario`, `medicao_mensal`,
  `contribuicao_outra_fonte`;
- folha: `folha`, `folha_item`, `folha_item_evento`,
  `folha_status_historico`, `folha_conferencia`, `folha_homologacao`,
  `folha_homologacao_item`;
- obrigação: `obrigacao_fiscal`, `obrigacao_fiscal_folha`,
  `obrigacao_fiscal_item`, `obrigacao_fiscal_documento`;
- migração: `importacao_execucao`, `importacao_registro`, `legado_chave`,
  `legado_folha`, `legado_folha_item`, `legado_folha_item_rubrica`,
  `legado_guia_inss`;
- operação: `auditoria`, `tarefa_processamento`;
- homologação mensal: `consolidacao_mensal_caso`,
  `consolidacao_mensal_fonte`, `homologacao_competencia`,
  `homologacao_competencia_item`, `consolidacao_fiscal_simulacao`,
  `consolidacao_fiscal_simulacao_fonte`.

As três estruturas de importação guardam a execução, a decisão por registro e a
correspondência durável entre o código do GIW e o UUID local. Isso permite simular,
reexecutar e auditar a migração sem duplicar cadastros.

A migração `0003` adiciona restrições de domínio para documentos, vigências, valores
não negativos, competência no primeiro dia do mês, consistência dos totais da folha e
da obrigação e estados da importação. Essas regras protegem o banco inclusive quando
uma gravação não passa pela interface web.

```mermaid
erDiagram
  EMPRESA ||--o{ ATIVIDADE : possui
  EMPRESA ||--o{ LOTACAO : possui
  ATIVIDADE ||--o{ PRESTADOR_VINCULO : classifica
  LOTACAO ||--o{ PRESTADOR_VINCULO : aloca
  EMPRESA ||--o{ EVENTO : configura
  PRESTADOR_VINCULO ||--o{ LANCAMENTO_EVENTO_RECORRENTE : recebe
  EVENTO ||--o{ LANCAMENTO_EVENTO_RECORRENTE : aplica
  PESSOA ||--o| PESSOA_ENDERECO : reside
  PESSOA ||--o| PESSOA_CONTA_BANCARIA : recebe
  PESSOA ||--o{ DEPENDENTE : declara
  PESSOA ||--o{ CONSOLIDACAO_MENSAL_CASO : exige
  CONSOLIDACAO_MENSAL_CASO ||--|{ CONSOLIDACAO_MENSAL_FONTE : congela
  PRESTADOR_VINCULO ||--o{ CONSOLIDACAO_MENSAL_FONTE : origina
  CONSOLIDACAO_MENSAL_CASO ||--o{ CONSOLIDACAO_FISCAL_SIMULACAO : autoriza
  PESSOA ||--o{ CONSOLIDACAO_FISCAL_SIMULACAO : agrega
  CONSOLIDACAO_FISCAL_SIMULACAO ||--|{ CONSOLIDACAO_FISCAL_SIMULACAO_FONTE : rateia
  PRESTADOR_VINCULO ||--o{ CONSOLIDACAO_FISCAL_SIMULACAO_FONTE : compoe
  EMPRESA ||--o{ HOMOLOGACAO_COMPETENCIA : executa
  HOMOLOGACAO_COMPETENCIA ||--|{ HOMOLOGACAO_COMPETENCIA_ITEM : verifica
  EMPRESA ||--o{ IMPORTACAO_EXECUCAO : executa
  IMPORTACAO_EXECUCAO ||--o{ IMPORTACAO_REGISTRO : detalha
  IMPORTACAO_EXECUCAO ||--o{ LEGADO_CHAVE : atualiza
  EMPRESA ||--o{ LEGADO_FOLHA : preserva
  LEGADO_FOLHA ||--|{ LEGADO_FOLHA_ITEM : detalha
  LEGADO_FOLHA_ITEM ||--o{ LEGADO_FOLHA_ITEM_RUBRICA : explica
  EMPRESA ||--o{ LEGADO_GUIA_INSS : preserva
```

Esse recorte sustenta a cadeia operacional do MVP. O rateio já pode ser simulado,
versionado e homologado, mas continua propositalmente fora do processamento produtivo
da Folha até a validação com competências reais.

## Modelo completo de referência

Consulte:

- [`referencia/modelo-relacional-completo.md`](referencia/modelo-relacional-completo.md): UML, descrição e obrigatoriedade;
- [`referencia/schema-mvp-completo.sql`](referencia/schema-mvp-completo.sql): SQL-base completo;
- [`referencia/ajustes-engenharia-reversa.sql`](referencia/ajustes-engenharia-reversa.sql): extensões descobertas nas três competências.

## Regras de modelagem

1. UUID para identificadores de domínio.
2. Dinheiro em `numeric(18,2)`, nunca ponto flutuante no banco.
3. Competência armazenada no primeiro dia do mês.
4. Chaves e índices sempre incluem organização quando aplicável.
5. Dados de cálculo fechados usam snapshot e hash.
6. Alterações de estado possuem tabela histórica.
7. Migrações aplicadas não são reescritas; correções geram nova migração.
8. Parcelas previdenciárias precisam de tipo, base, alíquota, código e origem.

## Próximas tabelas prioritárias

- composições de eventos/rubricas;
- ativação produtiva do agregado fiscal mensal já implementado em modo de simulação;
- fontes pagadoras concomitantes;
- lançamentos e memória granular;
- itens da obrigação fiscal;
- documentos/evidências;
- auditoria genérica;
- tentativas de transmissão e pagamentos.

## Migrações

Após alterar `db/schema.ts`:

```bash
npm run db:generate
```

Revise o SQL gerado antes de aplicar:

```bash
npm run db:migrate
```

Mudanças destrutivas exigem plano de migração, backup e revisão adicional.
