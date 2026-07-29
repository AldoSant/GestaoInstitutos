# Migração histórica de Folhas e guias

## Objetivo

Trazer o acervo operacional do GIW sem transformar um resultado legado em verdade
contábil do sistema novo. O dado importado é evidência para reconstrução, conferência e
operação paralela.

Se o portal estiver indisponível, os modelos CSV de Folhas e guias podem ser
preenchidos ou gerados a partir de uma exportação do RH. O comando
`giw:converter:historico` transforma esses arquivos em snapshots com a mesma validação,
mantendo nome do arquivo e SHA-256 como evidência. O CSV original e o snapshot
permanecem em `.private` e não devem ser versionados.

O mesmo CSV de Folhas pode gerar um snapshot de Pessoas. Essa derivação cria cadastros
parciais e deduplicados para reduzir a redigitação, mas não presume endereço, conta,
dependentes ou informação profissional que o relatório não contenha.

As rubricas também podem gerar o catálogo inicial de Eventos, desde que natureza,
incidência de INSS e incidência de IRRF estejam explícitas e consistentes em todas as
ocorrências. Ausência ou conflito bloqueia a derivação.

## Isolamento

| Tabela | Conteúdo | Efeito na operação oficial |
|---|---|---|
| `legado_folha` | Cabeçalho, competência, totais, checksum e snapshot original. | Nenhum. |
| `legado_folha_item` | Pessoa, matrícula, bases, tributos e líquido. | Nenhum. |
| `legado_folha_item_rubrica` | Eventos que explicam proventos, descontos e bases. | Nenhum. |
| `legado_guia_inss` | GPS/DARF/DCTFWeb histórica, valores e Folhas relacionadas. | Nenhum. |

As quatro tabelas são subordinadas à organização. Chaves compostas impedem ligar
itens de uma organização a cabeçalhos de outra. Valores são não negativos, competência
é sempre o primeiro dia do mês, líquido precisa fechar e checksum usa SHA-256.

## Idempotência

1. O snapshot inteiro é validado antes de abrir a transação.
2. `GIW + entidade + legacyId` resolve o UUID local em `legado_chave`.
3. Checksum igual produz `IGNORADO`.
4. Checksum diferente atualiza o cabeçalho e recria itens/rubricas atomicamente.
5. Cada registro usa savepoint; uma ficha problemática não esconde as demais.
6. Dry-run percorre o mesmo código e reverte a transação ao final.

## Reconciliação

`/migracoes` compara:

- contagem de Folhas, pessoas, rubricas, guias e obrigações;
- proventos, descontos, líquido, base de INSS e INSS dos segurados;
- total das guias históricas versus obrigação nova;
- mapeamento de pessoas e vínculos;
- diferenças individuais por pessoa.

O dossiê CSV preserva resumo, diferenças individuais, lotes e documentos. Diferença
zero é requisito de reprodução, mas não substitui a validação normativa: uma GPS antiga
pode ser evidência válida e, ainda assim, não ser o documento correto para a operação
atual submetida à DCTFWeb.

O mesmo painel apresenta a cobertura da cadeia anterior à Folha — Pessoas, Atividades,
Lotações, Termos, Vínculos, Eventos, Lançamentos e Produtividade — e as vinte execuções
mais recentes. Uma execução em dry-run é persistida depois que a transação simulada foi
revertida, de modo que a auditoria não transforma a simulação em dado operacional.

## Campanha de corte

Para cada uma das três competências:

1. coletar Pessoas, cadastros, instrumentos e movimentos;
2. validar todos os snapshots;
3. executar dry-run e resolver dependências sem chave;
4. aplicar a importação;
5. reexecutar dry-run e exigir 100% `IGNORADO`;
6. processar a mesma competência no motor novo;
7. exportar o dossiê e classificar cada divergência;
8. obter aprovação do RH e da contabilidade;
9. somente depois liberar o corte operacional.
