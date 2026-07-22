# Modelo de dados

## Implementado no primeiro incremento

A migração `drizzle/0000_rapid_kree.sql` cria 14 tabelas:

- `empresa`;
- `usuario` e `usuario_empresa`;
- `pessoa` e `prestador`;
- `termo`, `termo_meta` e `prestador_vinculo`;
- `regra_calculo_versao`;
- `folha`, `folha_item` e `folha_status_historico`;
- `obrigacao_fiscal` e `obrigacao_fiscal_folha`.

Esse recorte sustenta o primeiro vertical slice. Não representa ainda todas as 47 estruturas do modelo aprofundado.

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

- eventos/rubricas e composições;
- dependentes;
- consolidação mensal por pessoa e rateio por vínculo;
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
