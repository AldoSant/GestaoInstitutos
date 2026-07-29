# Importação do GIW

Este documento é o roteiro operacional para copiar cadastros e movimentos do GIW sem
digitação manual. A migração é incremental: cada entidade passa por coleta, validação,
simulação, aplicação e conferência antes de liberar a próxima.

## Situação atual

Os fluxos implementados coletam e importam **Pessoas completas**, **Atividades**, **Lotações**,
**Termos**, **Metas** e **Vínculos**. O importador também aceita snapshots normalizados de
**Eventos/Rubricas**, **Lançamentos de Eventos** e **Produtividade/Medições**, além de
**Folhas históricas completas** — cabeçalho, pessoas e rubricas — e **Guias
previdenciárias históricas**. O mapeador retomável dos formulários de lançamentos,
Folhas e GPS coleta evidências estruturais para manter os adaptadores sincronizados com
o layout Webrun.

Dados reais nunca são versionados. O coletor grava em `.private/importacoes/giw`, pasta
ignorada pelo Git. Usuário e senha são lidos exclusivamente de variáveis de ambiente.

Quando o GIW estiver indisponível, Folhas e guias recebidas em CSV podem seguir o mesmo
pipeline de validação e importação. O conversor registra o nome e o SHA-256 do arquivo
recebido no snapshot, agrupa várias rubricas da mesma pessoa sem duplicar os totais e
recusa qualquer fechamento inconsistente.

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
12. Abrir `/migracoes`, selecionar a competência e exportar o dossiê CSV.

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
- `GIW_RESUME=true`: carrega o arquivo indicado em `GIW_OUTPUT`, avança até a página
  calculada e continua sem reler as fichas já presentes;
- `GIW_HEADLESS=false`: mostra o navegador para diagnóstico local.

O coletor entra no GIW, abre Cadastro > Pessoa > Localizar, percorre todas as páginas
de 100 registros e abre cada ficha em modo de consulta. O snapshot inclui identificação
civil e profissional, papéis, contatos, endereço, conta bancária e dependentes com
baixas de salário-família e IRRF. Nenhuma tela de inclusão, edição ou exclusão é acionada.
Durante a coleta, um checkpoint é gravado a cada 25 fichas e ao final de cada página.
Uma interrupção pode ser retomada com o mesmo `GIW_OUTPUT` e `GIW_RESUME=true`.

Snapshots completos usam `dadosCompletos: true`. O importador sincroniza os detalhes e
inativa dependentes que deixaram de existir no GIW somente quando esse marcador está
presente. Assim, reprocessar um snapshot antigo resumido nunca apaga uma ficha detalhada.

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

Os contratos completos dos dois snapshots históricos estão em:

- `docs/exemplos/giw-eventos.json`;
- `docs/exemplos/giw-lancamentos-eventos.json`;
- `docs/exemplos/giw-produtividade.json`;
- `docs/exemplos/giw-folhas-historicas.json`;
- `docs/exemplos/giw-guias-inss-historicas.json`.

Os exemplos são fictícios e podem ser usados para testar apenas a validação estrutural.

## Converter arquivos CSV recebidos do RH ou do GIW

Os modelos versionados, sem dados reais, estão em:

- `docs/modelos/folhas-historicas.csv`;
- `docs/modelos/guias-inss-historicas.csv`.

Na planilha de Folhas, cada linha representa uma rubrica. Os dados e totais do item
devem ser repetidos nas linhas das demais rubricas da mesma pessoa. O conversor agrupa
por `folha_legacy_id` e `item_legacy_id`, exige que os valores repetidos sejam idênticos
e calcula o cabeçalho da Folha pela soma dos itens. Se o arquivo não trouxer
`pessoa_legacy_id`, a chave é derivada do CPF e, na ausência dele, da matrícula.

Conversão:

```bash
npm run giw:converter:historico -- \
  --tipo folhas \
  --arquivo /caminho/folhas.csv \
  --extraido-em 2026-07-28T15:00:00-03:00

npm run giw:converter:historico -- \
  --tipo guias \
  --arquivo /caminho/guias.csv \
  --extraido-em 2026-07-28T15:00:00-03:00

npm run giw:converter:historico -- \
  --tipo pessoas \
  --arquivo /caminho/folhas.csv \
  --extraido-em 2026-07-28T15:00:00-03:00

npm run giw:converter:historico -- \
  --tipo eventos \
  --arquivo /caminho/folhas.csv \
  --extraido-em 2026-07-28T15:00:00-03:00
```

Por padrão, os snapshots são gravados em `.private/importacoes/giw`. A saída usa
criação exclusiva e não sobrescreve um arquivo anterior. Depois da conversão, execute
`giw:importar` primeiro sem `--aplicar`, confira o relatório e só então aplique.

O modo `pessoas` deriva do mesmo CSV um cadastro operacional deduplicado por chave
legada, CPF ou matrícula. Nome ou CPF divergente entre meses bloqueia o resultado. As
fichas são marcadas com `dadosCompletos: false`: elas já evitam redigitação do
prestador, mas uma coleta posterior do GIW ainda poderá complementar endereço, conta,
dados profissionais e dependentes sem perder informação.

O modo `eventos` consolida as rubricas históricas pelo identificador do Evento e recusa
descrição, natureza ou incidência divergente entre meses. INSS e IRRF precisam estar
explicitamente preenchidos: o conversor não presume incidência tributária. O tipo de
cálculo derivado é `VALOR`, pois uma ocorrência histórica isolada não comprova que a
regra contratual original era percentual.

O CSV aceita `;` ou `,`, aspas, valores brasileiros (`1.234,56`) e cabeçalhos com ou
sem acentos. O limite é de 50 MB e 100.000 linhas. Arquivo vazio, coluna obrigatória
ausente, CPF inválido, rubrica duplicada, item divergente ou total sem fechamento
interrompe a conversão inteira.

## Mapear movimentos históricos sem alterar o GIW

Quando o endereço do legado estiver respondendo, execute:

```bash
GIW_USUARIO='seu-usuario' \
GIW_SENHA='sua-senha' \
npm run giw:mapear:historico
```

O comando abre exclusivamente consultas de **Eventos/Rubricas**, **Lançamentos de
eventos**, **Produtividade**, **Folhas** e **Emissão de GPS**. Para cada formulário,
preserva em `.private`:

- abas, rótulos, IDs e nomes dos campos;
- cabeçalhos e linhas de todas as páginas do localizador;
- amostras estruturais de até cinco fichas;
- checkpoint após cada página.

Para retomar uma interrupção, informe o mesmo arquivo e habilite a retomada:

```bash
GIW_OUTPUT_HISTORICO='.private/importacoes/giw/mapeamento-historico.json' \
GIW_RESUME=true \
npm run giw:mapear:historico
```

`GIW_MAP_MAX_PAGES` limita páginas e `GIW_MAP_MAX_DETAILS` limita fichas abertas por
formulário. O resultado é evidência de engenharia reversa; dados reais continuam fora
do Git.

## Como a repetição segura funciona

- `importacao_execucao` registra arquivo, checksum, modo, totais e resultado;
- `importacao_registro` registra a decisão tomada para cada linha;
- `legado_chave` relaciona `GIW + entidade + código legado` ao UUID local;
- o checksum normalizado identifica registros que não mudaram;
- CPF/CNPJ ajuda a reaproveitar uma pessoa já cadastrada antes da primeira importação;
- reexecutar o mesmo snapshot não cria uma segunda pessoa.
- dry-runs revertem todas as mutações, mas preservam uma execução auditável separada
  com arquivo, checksum, decisão prevista por registro e erros;
- Lançamentos exigem que Vínculo e Evento já tenham chave GIW; Produtividade exige o
  Vínculo;
- atualizar Produtividade usada por Folha fechada continua bloqueado pelo banco.

Em dry-run, todas as alterações são executadas dentro de uma transação e revertidas no
final. Assim a simulação usa as mesmas consultas e validações da aplicação real.

## Mapeamento confirmado no GIW

| Ordem | Entidade | Formulário GIW | Dependência local | Estado |
|---:|---|---:|---|---|
| 1 | Parâmetros | 464569255 | empresa e regras | mapeado |
| 2 | Pessoas | 464569402 | empresa | coletor e importador prontos |
| 3 | Atividades | 464569252 | empresa | coletor e importador prontos |
| 4 | Lotações | 464569449 | empresa | coletor e importador prontos |
| 5 | Eventos/rubricas | 8716 | parâmetros | contrato, validação e importador prontos |
| 6 | Tabela de IRRF | 8733 | regras por vigência | mapeado |
| 7 | Limites de INSS | 464569398 | regras por vigência | mapeado |
| 8 | Termos e Metas | 464569250 | empresa | coletor e importador prontos |
| 9 | Vínculos | 464569258 | pessoa, termo, meta, atividade e lotação | coletor e importador prontos |
| 10 | Lançamentos de eventos | 464569425 | vínculo e evento | contrato, validação e importador prontos |
| 11 | Produtividade | 464569461 | vínculo e competência | contrato, validação e importador prontos |
| 12 | Folhas | 464569390 | todos os anteriores | contrato, persistência e importador prontos; adaptador visual pendente de reconexão |
| 13 | Emissão de GPS | 464569421 | folha fechada | contrato, persistência e importador prontos; adaptador visual pendente de reconexão |

As listagens Webrun usam `basic_query.jsp`, paginação própria e grids com campos
identificados. IDs de formulário são tratados como adaptadores do legado, nunca como
chaves de domínio do sistema novo.

## Plano de expansão

### Etapa A — cadastros-base

Atividades e lotações estão concluídas. Em seguida, adicionar bancos, agências, tipos
de pagamento, fontes de recurso e documentos.

Critério de saída: contagens conciliadas e 100% dos registros com chave legada.

### Etapa B — pessoas completas — implementada

O coletor visita as abas Cadastro, Endereço/Conta e Dependentes. Dados bancários,
endereço e dependentes possuem tabelas próprias; dados civis, profissionais, contatos e
papéis ficam na Pessoa. A aba Prestador continua complementada pelos Vínculos coletados.

Critério de saída: prestadores ativos aptos a formar vínculos sem recadastro manual.

### Etapa C — contratos e vínculos

Termos, Metas e Vínculos estão implementados. O importador cria ou atualiza o Prestador
quando a Pessoa já estiver mapeada e rejeita o registro quando qualquer dependência ainda
não tiver sido importada.

Critério de saída: cada prestador de uma folha histórica aponta para termo, meta e
vínculo válidos.

### Etapa D — regras e movimentos — núcleo implementado

Eventos, Lançamentos e Produtividade possuem contratos, validação e importação
idempotente. Eventos preservam natureza, cálculo e incidências. Lançamentos resolvem
Vínculo e Evento exclusivamente por chave legada. Produtividade materializa a medição
mensal com memória de percentual, quantidade ou valor, evidência e conferente.

Falta confirmar os seletores no GIW disponível e coletar os registros reais. Regras
fiscais observadas no legado permanecem separadas das regras normativas confirmadas.

Critério de saída: eventos históricos explicam proventos, descontos e bases.

### Etapa E — folha e guia — núcleo implementado

As tabelas `legado_folha`, `legado_folha_item`, `legado_folha_item_rubrica` e
`legado_guia_inss` preservam o acervo sem misturá-lo com a folha oficial. O importador
é idempotente, substitui os filhos de uma versão alterada dentro da mesma transação e
registra checksum e trilha de execução. A tela `/migracoes` reconcilia por competência,
pessoa, lote e guia.

Falta executar o adaptador visual contra o GIW disponível e importar três competências
reais para classificar divergências.

Critério de saída: resultado centavo a centavo ou divergência formalmente classificada.

### Etapa F — operação paralela

Processar três competências simultaneamente no GIW e no sistema novo, registrar
diferenças, aprovar o corte e manter plano de retorno.

## Limites atuais

- o coletor de Pessoas depende do layout Webrun observado; alterações no GIW podem
  exigir ajuste de seletor;
- a coleta detalhada é mais lenta porque abre cada Pessoa individualmente; o snapshot
  deve ser conferido antes da aplicação e nunca enviado ao Git;
- o coletor de Termos opera sobre o ano selecionado no GIW; anos históricos devem ser
  selecionados e coletados separadamente;
- nenhuma guia é transmitida e nenhum registro do GIW é alterado;
- a sonda histórica captura a estrutura e amostras privadas, mas depende do GIW
  acessível para confirmar os seletores do adaptador normalizado;
- o conversor CSV permite avançar com Folhas e guias fornecidas, mas não substitui os
  cadastros completos de Pessoas, Termos, Metas, Vínculos, Eventos e Produtividade;
- o importador pressupõe que as migrações novas já foram aplicadas.
