# Importação do GIW

Este documento é o roteiro operacional para copiar cadastros e movimentos do GIW sem
digitação manual. A migração é incremental: cada entidade passa por coleta, validação,
simulação, aplicação e conferência antes de liberar a próxima.

## Situação atual

Os fluxos implementados coletam e importam **Pessoas**, **Atividades**, **Lotações**,
**Termos**, **Metas** e **Vínculos**. Eles estabelecem o padrão que será reutilizado por
eventos, tabelas fiscais, produtividade, folhas e guias.

Dados reais nunca são versionados. O coletor grava em `.private/importacoes/giw`, pasta
ignorada pelo Git. Usuário e senha são lidos exclusivamente de variáveis de ambiente.

## Sequência obrigatória

1. Atualizar o código e executar `npm install`.
2. Aplicar as migrações com `npm run db:migrate`.
3. Cadastrar ou atualizar a empresa-base.
4. Instalar o Chromium do coletor com `npx playwright install chromium`.
5. Coletar Pessoas, Atividades, Lotações, Termos, Metas e Vínculos do GIW.
6. Validar o snapshot sem banco.
7. Executar um dry-run contra o banco de destino.
8. Conferir contagens e erros.
9. Aplicar a importação.
10. Executar novamente em dry-run: todos os registros inalterados devem aparecer como
   `ignorar`.
11. Comparar total, documentos ausentes e duplicidades entre GIW e sistema novo.

O modo padrão do importador é sempre `dry-run`. Só há gravação quando `--aplicar` é
informado explicitamente.

## Preparar a empresa-base

O banco precisa ter uma empresa ativa antes da importação. O comando é repetível e
atualiza a mesma empresa quando o CNPJ já existe:

```bash
DATABASE_URL='postgresql://...' npm run db:bootstrap:empresa -- \
  --cnpj 00000000000000 \
  --razao-social "Nome da entidade" \
  --nome-fantasia "Nome curto"
```

O comando retorna o UUID usado opcionalmente em `--empresa-id`.

## Coletar Pessoas

PowerShell:

```powershell
$env:GIW_USUARIO="seu-usuario"
$env:GIW_SENHA="sua-senha"
npm run giw:coletar:pessoas
```

Linux/VPS:

```bash
GIW_USUARIO='seu-usuario' GIW_SENHA='sua-senha' npm run giw:coletar:pessoas
```

Variáveis opcionais:

- `GIW_URL`: altera o endereço de entrada do legado;
- `GIW_OUTPUT`: define o arquivo JSON de saída;
- `GIW_HEADLESS=false`: mostra o navegador para diagnóstico local.

O coletor entra no GIW, abre Cadastro > Pessoa > Localizar, percorre todas as páginas
de 100 registros e produz um snapshot com versão e origem. Nenhuma tela de inclusão,
edição ou exclusão é acionada.

## Coletar Atividades e Lotações

Com as mesmas variáveis `GIW_USUARIO` e `GIW_SENHA` configuradas:

```bash
npm run giw:coletar:cadastros
```

Uma única sessão coleta os grids Cadastro > Atividade e Cadastro > Lotação. São
produzidos dois snapshots independentes para que cada importação possa ser simulada,
aplicada ou repetida separadamente.

Saídas opcionais:

- `GIW_OUTPUT_ATIVIDADES`: caminho do snapshot de Atividades;
- `GIW_OUTPUT_LOTACOES`: caminho do snapshot de Lotações.

## Coletar Termos e Metas

Com a mesma sessão configurada:

```bash
npm run giw:coletar:instrumentos
```

O coletor abre Movimentação > Termo, percorre a listagem do ano selecionado, inclui as
Metas e visita os Prestadores associados a cada Meta. São produzidos snapshots separados
para Termos/Metas e Vínculos. Eles preservam códigos internos do GIW, vigências, valores,
atividade, lotação, contrato, carga horária e incidências.

Os caminhos podem ser alterados com `GIW_OUTPUT_TERMOS` e `GIW_OUTPUT_VINCULOS`.

## Validar e importar

Validação estrutural, sem consultar o banco, funciona para qualquer uma das entidades
entidades suportadas:

```bash
npm run giw:importar -- --arquivo .private/importacoes/giw/pessoas-ARQUIVO.json
```

Dry-run completo contra o PostgreSQL:

```bash
DATABASE_URL='postgresql://...' npm run giw:importar -- \
  --arquivo .private/importacoes/giw/pessoas-ARQUIVO.json \
  --empresa-id UUID-DA-EMPRESA
```

Aplicação:

```bash
DATABASE_URL='postgresql://...' npm run giw:importar -- \
  --arquivo .private/importacoes/giw/pessoas-ARQUIVO.json \
  --empresa-id UUID-DA-EMPRESA \
  --aplicar
```

Se existir exatamente uma empresa ativa, `--empresa-id` pode ser omitido.

## Como a repetição segura funciona

- `importacao_execucao` registra arquivo, checksum, modo, totais e resultado;
- `importacao_registro` registra a decisão tomada para cada linha;
- `legado_chave` relaciona `GIW + entidade + código legado` ao UUID local;
- o checksum normalizado identifica registros que não mudaram;
- CPF/CNPJ ajuda a reaproveitar uma pessoa já cadastrada antes da primeira importação;
- reexecutar o mesmo snapshot não cria uma segunda pessoa.

Em dry-run, todas as alterações são executadas dentro de uma transação e revertidas no
final. Assim a simulação usa as mesmas consultas e validações da aplicação real.

## Mapeamento confirmado no GIW

| Ordem | Entidade | Formulário GIW | Dependência local | Estado |
|---:|---|---:|---|---|
| 1 | Parâmetros | 464569255 | empresa e regras | mapeado |
| 2 | Pessoas | 464569402 | empresa | coletor e importador prontos |
| 3 | Atividades | 464569252 | empresa | coletor e importador prontos |
| 4 | Lotações | 464569449 | empresa | coletor e importador prontos |
| 5 | Eventos/rubricas | 8716 | parâmetros | mapeado |
| 6 | Tabela de IRRF | 8733 | regras por vigência | mapeado |
| 7 | Limites de INSS | 464569398 | regras por vigência | mapeado |
| 8 | Termos e Metas | 464569250 | empresa | coletor e importador prontos |
| 9 | Vínculos | 464569258 | pessoa, termo, meta, atividade e lotação | coletor e importador prontos |
| 10 | Lançamentos de eventos | 464569425 | pessoa, termo e evento | mapeado |
| 11 | Produtividade | 464569461 | vínculo e competência | mapeado |
| 12 | Folhas | 464569390 | todos os anteriores | mapeado |
| 13 | Emissão de GPS | 464569421 | folha fechada | mapeado |

As listagens Webrun usam `basic_query.jsp`, paginação própria e grids com campos
identificados. IDs de formulário são tratados como adaptadores do legado, nunca como
chaves de domínio do sistema novo.

## Plano de expansão

### Etapa A — cadastros-base

Atividades e lotações estão concluídas. Em seguida, adicionar bancos, agências, tipos
de pagamento, fontes de recurso e documentos.

Critério de saída: contagens conciliadas e 100% dos registros com chave legada.

### Etapa B — pessoas completas

Complementar a listagem de Pessoas com as abas Cadastro, Endereço/Conta, Prestador,
Dependentes e Parceiro. Documentos bancários e dependentes terão tabelas próprias.

Critério de saída: prestadores ativos aptos a formar vínculos sem recadastro manual.

### Etapa C — contratos e vínculos

Termos, Metas e Vínculos estão implementados. O importador cria ou atualiza o Prestador
quando a Pessoa já estiver mapeada e rejeita o registro quando qualquer dependência ainda
não tiver sido importada.

Critério de saída: cada prestador de uma folha histórica aponta para termo, meta e
vínculo válidos.

### Etapa D — regras e movimentos

Importar rubricas, tabelas por vigência, lançamentos e produtividade. Regras fiscais
observadas no GIW permanecem separadas das regras normativas confirmadas.

Critério de saída: eventos históricos explicam proventos, descontos e bases.

### Etapa E — folha e guia

Importar cabeçalhos, itens e memórias de três competências; reconciliar totais por
pessoa e bloquear a duplicidade previdenciária já detectada no legado.

Critério de saída: resultado centavo a centavo ou divergência formalmente classificada.

### Etapa F — operação paralela

Processar três competências simultaneamente no GIW e no sistema novo, registrar
diferenças, aprovar o corte e manter plano de retorno.

## Limites atuais

- o coletor de Pessoas depende do layout Webrun observado; alterações no GIW podem
  exigir ajuste de seletor;
- a primeira versão de Pessoas traz os quatro campos da listagem (código, nome, CPF e CNPJ); as
  abas detalhadas entram na Etapa B;
- o coletor de Termos opera sobre o ano selecionado no GIW; anos históricos devem ser
  selecionados e coletados separadamente;
- nenhuma guia é transmitida e nenhum registro do GIW é alterado;
- o importador pressupõe que as migrações novas já foram aplicadas.
