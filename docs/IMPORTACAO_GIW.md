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

## Receber e inventariar uma remessa

Antes de converter qualquer dado, inventarie a pasta recebida. O comando percorre
subpastas sem seguir links simbólicos, classifica os formatos, calcula SHA-256,
identifica duplicidades e confere a quantidade declarada:

```bash
npm run giw:inventariar:insumos -- \
  --diretorio .private/insumos-consulta \
  --esperados 30 \
  --confirmed-complete \
  --saida .private/importacoes/giw/manifestos/remessa-30-arquivos.json
```

O terminal mostra apenas contagens agregadas. Nomes, caminhos, hashes e metadados
individuais ficam no manifesto, cuja saída é aceita somente dentro de `.private`. O
inventário não interpreta nem importa dados; ele estabelece a cadeia de custódia da
remessa e separa arquivos processáveis de documentos que ainda exigem classificação
manual.

Quando o GIW estiver indisponível, Folhas e guias recebidas em CSV podem seguir o mesmo
pipeline de validação e importação. O conversor registra o nome e o SHA-256 do arquivo
recebido no snapshot, agrupa várias rubricas da mesma pessoa sem duplicar os totais e
recusa qualquer fechamento inconsistente.

## Sequência obrigatória

1. Atualizar o código e executar `npm install`.
2. Aplicar as migrações com `npm run db:migrate`.
3. Cadastrar ou atualizar a empresa-base.
4. Instalar o Chromium do coletor com `npx playwright install chromium`.
5. Coletar Pessoas, Atividades, Lotações, Eventos, Termos, Metas e Vínculos do GIW.
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
- `GIW_BROWSER_EXECUTABLE`: usa um Chrome/Edge já instalado quando o Chromium do
  Playwright não estiver disponível no host.

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

Os caminhos podem ser alterados com `GIW_OUTPUT_TERMOS`, `GIW_OUTPUT_VINCULOS` e
`GIW_OUTPUT_ATIVIDADES_REFERENCIADAS`. A terceira saída preserva também as Atividades
antigas/inativas ainda usadas pelos Vínculos, mesmo quando elas já não aparecem no
cadastro atual do GIW. Elas são marcadas como inativas e sem valor/carga presumidos.
Informe `GIW_ATIVIDADES_BASE` com o snapshot do cadastro atual para que a saída
suplementar contenha somente chaves realmente ausentes, sem rebaixar uma Atividade
atual durante a importação.

Da mesma forma, `GIW_PESSOAS_BASE` e `GIW_OUTPUT_PESSOAS_REFERENCIADAS` preservam
Pessoas históricas que já foram excluídas do localizador atual, mas continuam ligadas
a Vínculos. Essas fichas contêm somente o ID e o nome ainda exibidos pelo GIW e usam
`dadosCompletos: false`; nenhuma informação ausente é presumida.

## Coletar Eventos

O coletor de Eventos percorre todas as páginas de Cadastro > Tabelas > Eventos e abre
cada ficha em consulta para preservar natureza, modo de cálculo, incidências e estado:

```bash
npm run giw:coletar:eventos
```

Use `GIW_OUTPUT_EVENTOS` para definir a saída privada. Nenhuma incidência é inferida
pela descrição da rubrica; INSS e IRRF são lidos diretamente das caixas de seleção do
GIW.

## Validar e importar

Validação estrutural, sem consultar o banco, funciona para qualquer uma das entidades
suportadas:

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

Para processar toda a cadeia na ordem relacional, repita `--arquivo` para os
cadastros e use `--diretorio` para a pasta dos 30 snapshots reconciliados:

```bash
DATABASE_URL='postgresql://...' npm run giw:importar:lote -- \
  --arquivo .private/importacoes/giw/pessoas.json \
  --arquivo .private/importacoes/giw/atividades.json \
  --arquivo .private/importacoes/giw/atividades-referenciadas.json \
  --arquivo .private/importacoes/giw/lotacoes.json \
  --arquivo .private/importacoes/giw/termos.json \
  --arquivo .private/importacoes/giw/vinculos.json \
  --diretorio .private/importacoes/giw/pdf-historico-reconciliado-v1 \
  --empresa-id UUID-DA-EMPRESA
```

O lote valida tudo antes de consultar o banco, confere a integridade das referências e
ordena Pessoas, Atividades, Lotações, Termos, Vínculos, movimentos, Folhas e GPS.
Snapshots repetidos, chaves duplicadas, dependências ausentes ou arquivos inválidos
bloqueiam o lote inteiro. Depois do dry-run, repita com
`--aplicar --confirmed-complete`; execute mais um dry-run ao final para comprovar que
todos os registros ficam em `ignorar`.

Finalize sempre com a auditoria de pós-migração, usando exatamente o mesmo conjunto de
arquivos. Ela é somente leitura e reprova a carga se encontrar migration SQL ausente,
chave ou destino faltando, checksum divergente, snapshot histórico alterado, execução
com erro, segunda execução não idempotente, referência órfã ou total financeiro
divergente. Competências e chaves anteriores que não pertencem ao lote são preservadas
como avisos, sem serem confundidas com perda de dados:

```bash
DATABASE_URL='postgresql://...' npm run giw:auditar:migracao -- \
  --arquivo .private/importacoes/giw/pessoas.json \
  --arquivo .private/importacoes/giw/atividades.json \
  --arquivo .private/importacoes/giw/atividades-referenciadas.json \
  --arquivo .private/importacoes/giw/lotacoes.json \
  --arquivo .private/importacoes/giw/termos.json \
  --arquivo .private/importacoes/giw/vinculos.json \
  --diretorio .private/importacoes/giw/pdf-historico-reconciliado-v1 \
  --empresa-id UUID-DA-EMPRESA \
  --relatorio .private/importacoes/giw/relatorios/auditoria-banco.json
```

O relatório só recebe `status: "APROVADA"` quando existem, para cada snapshot, uma
execução `APLICAR` concluída e um `DRY_RUN` posterior com 100% dos registros ignorados.
O arquivo contém apenas identificadores técnicos, contagens, totais e pendências; não
replica os dados pessoais dos snapshots.

O identificador de Evento dentro de uma rubrica histórica é evidência textual e não
uma chave estrangeira: Eventos já inativos podem não aparecer mais no localizador do
GIW, e sua incidência não é reconstruída por suposição. Lançamentos operacionais, por
outro lado, exigem Evento coletado e são bloqueados quando a dependência não existe.

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

## Converter PDFs históricos de Folha e GPS

O conversor de PDF requer `pdftotext` (pacote `poppler-utils`). A imagem Docker
`migrate` já contém essa ferramenta. No host, instale o mesmo pacote antes de executar
o comando diretamente com Node. Em ambientes sem Poppler, pode ser usado o fallback
Python com `pdfplumber`, informando o executável em `PDF_PYTHON`; o fallback somente é
acionado quando `pdftotext` não existe:

```bash
PDF_PYTHON=/caminho/python npm run giw:converter:historico-pdf -- \
  --diretorio .private/insumos-consulta
```

Comece sempre em dry-run. O comando extrai o texto, identifica tipo e competência,
calcula o SHA-256 e executa a conversão completa sem gravar snapshot. Para uma remessa
inteira, prefira `--diretorio`; o relatório detalhado é privado e o terminal exibe
somente totais:

```bash
npm run giw:converter:historico-pdf -- \
  --diretorio .private/insumos-consulta \
  --esperados 30 \
  --recebidos 30 \
  --relatorio .private/importacoes/giw/relatorios/preflight-pdfs.json
```

Também é possível repetir `--arquivo` para selecionar documentos avulsos. Qualquer
campo incompleto, tipo desconhecido ou total divergente reprova a remessa inteira, mas
o relatório preserva todas as pendências encontradas. Depois de conferir o preflight,
grave os snapshots somente em `.private`, declarando a quantidade esperada e
confirmando que a remessa está completa:

```bash
npm run giw:converter:historico-pdf -- \
  --diretorio .private/insumos-consulta \
  --aplicar \
  --esperados 30 \
  --recebidos 30 \
  --confirmed-complete \
  --pasta-saida .private/importacoes/giw/pdf-historico-v2 \
  --relatorio .private/importacoes/giw/relatorios/aplicacao-pdfs.json
```

`--aplicar` cria snapshots privados; ele ainda não altera o PostgreSQL. Importe cada
snapshot primeiro em dry-run com `giw:importar` e só então repita com `--aplicar`.
Os nomes dos snapshots são derivados do SHA-256, evitando colisão entre meses ou
arquivos homônimos. `--pasta-saida` permite criar uma nova versão imutável do lote sem
sobrescrever snapshots anteriores. Arquivos PDF, texto extraído, relatórios, snapshots e dados pessoais
nunca devem entrar no Git. O lote aceita no máximo 200 PDFs, 50 MB por arquivo e
500 MB no total; a extração usa concorrência limitada para não saturar a VPS.

### Reconciliar PDFs com as Pessoas reais do GIW

Antes de importar os snapshots produzidos dos PDFs, vincule CPF, CNPJ, NIT e nome ao
`legacyId` efetivamente coletado no cadastro de Pessoas. O comando prioriza documentos
fortes (CPF/CNPJ na Folha e NIT na GPS), usa nome normalizado somente como alternativa
exata e reprova ambiguidades. Também associa cada GPS à Folha da mesma Pessoa e
competência:

```bash
npm run giw:reconciliar:historico -- \
  --pessoas .private/importacoes/giw/pessoas.json \
  --diretorio-snapshots .private/importacoes/giw/pdf-historico-v2 \
  --relatorio .private/importacoes/giw/relatorios/reconciliacao-v1.json
```

O primeiro comando é somente diagnóstico. Se o relatório estiver `PRONTA`, grave uma
nova versão imutável dos snapshots:

```bash
npm run giw:reconciliar:historico -- \
  --pessoas .private/importacoes/giw/pessoas.json \
  --diretorio-snapshots .private/importacoes/giw/pdf-historico-v2 \
  --relatorio .private/importacoes/giw/relatorios/reconciliacao-aplicada-v1.json \
  --aplicar \
  --confirmed-complete \
  --pasta-saida .private/importacoes/giw/pdf-historico-reconciliado-v1
```

O comando revalida todos os snapshots resultantes e não grava se existir Pessoa ou GPS
sem vínculo. A saída deve permanecer sob `.private` e nunca sobrescreve uma versão
anterior.

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
| 5 | Eventos/rubricas | 8716 | parâmetros | coletor, contrato, validação e importador prontos |
| 6 | Tabela de IRRF | 8733 | regras por vigência | mapeado |
| 7 | Limites de INSS | 464569398 | regras por vigência | mapeado |
| 8 | Termos e Metas | 464569250 | empresa | coletor e importador prontos |
| 9 | Vínculos | 464569258 | pessoa, termo, meta, atividade e lotação | coletor e importador prontos |
| 10 | Lançamentos de eventos | 464569425 | vínculo e evento | estrutura real reconfirmada; contrato, validação e importador prontos |
| 11 | Produtividade | 464569461 | vínculo e competência | estrutura real reconfirmada; contrato, validação e importador prontos |
| 12 | Folhas | 464569390 | todos os anteriores | formulário de emissão reconfirmado; PDFs convertidos, persistência e importador prontos |
| 13 | Emissão de GPS | 464569421 | folha fechada | formulário direto reconfirmado; PDFs convertidos, persistência e importador prontos |

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

Os seletores e a estrutura foram reconfirmados no GIW disponível. Lançamentos e
Produtividade são formulários diretos condicionados por Parceiro/Termo/Meta e ainda
precisam de um coletor normalizado que percorra essas combinações. Regras fiscais
observadas no legado permanecem separadas das regras normativas confirmadas.

Critério de saída: eventos históricos explicam proventos, descontos e bases.

### Etapa E — folha e guia — núcleo implementado

As tabelas `legado_folha`, `legado_folha_item`, `legado_folha_item_rubrica` e
`legado_guia_inss` preservam o acervo sem misturá-lo com a folha oficial. O importador
é idempotente, substitui os filhos de uma versão alterada dentro da mesma transação e
registra checksum e trilha de execução. A tela `/migracoes` reconcilia por competência,
pessoa, lote e guia.

As três competências reais foram convertidas e reconciliadas. Falta aplicar os
snapshots no PostgreSQL de homologação e executar as competências no motor novo para
classificar divergências operacionais.

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
- o inventário reconhece PDFs, CSVs e JSONs, mas planilhas e documentos de escritório
  precisam de adaptador específico antes da importação;
- o importador pressupõe que as migrações novas já foram aplicadas.
