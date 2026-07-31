# Roadmap

## Prioridade operacional atual — conclusão funcional do MVP

1. Validar a migração `0034` e montar o demonstrativo real de Camamu, separando
   pagamentos PF/PJ, retenções e guias.
2. Validar Folha individual e consolidada em PostgreSQL e no fluxo do worker.
3. Fechar apuração e reconciliação da obrigação previdenciária.
4. Homologar produtividade, Eventos e enquadramento com RH/contabilidade.
5. Executar três competências em paralelo e ensaiar reabertura/retificação.
6. Comprovar backup/restauração e preparar o corte do legado.

A migração permanece disponível, mas não é o foco do caminho crítico desta etapa.

Autenticação completa e perfis continuam previstos, mas não bloqueiam estas entregas.
Até essa etapa, a aplicação deve permanecer em ambiente interno controlado. O roteiro
detalhado da migração está em [Importação do GIW](IMPORTACAO_GIW.md).

## Incremento 0 — concluído

- interface navegável;
- dados demonstrativos das três competências;
- motor inicial de INSS/IRRF;
- detecção da duplicidade previdenciária;
- PostgreSQL, migração, Docker, testes e CI.

## Incremento 1 — fundação persistente

- executar PostgreSQL e migrações;
- pipeline de importação com dry-run, trilha e repetição segura;
- coletores de cadastros do GIW;
- CRUD de pessoas, prestadores, termos, metas e vínculos.

Progresso: Pessoas, Atividades e Lotações já possuem coleta, importação e CRUD
persistente com busca, edição e inativação. Prestadores também possuem CRUD persistente,
vinculação obrigatória a uma Pessoa e parâmetros previdenciários. Atividades e Lotações
possuem tabelas relacionais próprias e chaves opcionais nos vínculos. O banco rejeita
documentos, vigências, totais e estados estruturalmente inconsistentes, e o CI aplica as
migrações em PostgreSQL 16, cria uma organização sintética e testa as páginas conectadas
ao banco. Termos, Metas e Vínculos possuem coleta/importação idempotente e CRUD
persistente. A importação cria o Prestador quando sua Pessoa já está mapeada, resolve
Termo, Meta, Atividade e Lotação por chave legada e rejeita dependências ausentes.
O coletor de Pessoas abre cada ficha do GIW e transporta identificação civil e
profissional, contatos, endereço, conta bancária e dependentes. Snapshots resumidos
anteriores continuam aceitos sem apagar detalhes já migrados.

Eventos/Rubricas, lançamentos recorrentes e medições mensais por Vínculo já possuem
persistência e validações no servidor e no banco. O próximo recorte é reconciliar a
coleta contratual real e homologar composição de Eventos e fórmulas de produtividade
sobre a cadeia já persistente.

O importador GIW agora cobre também os três movimentos: Eventos, Lançamentos e
Produtividade possuem contratos versionados, dry-run auditável, checksum e resolução
obrigatória das dependências. O painel de Migração apresenta cobertura por entidade e
as últimas execuções. Falta confirmar os seletores do legado e executar a carga real.

Critério de aceite: cadastros sobrevivem a reinicializações, dados do GIW são conciliados
sem duplicação e toda linha importada tem origem rastreável.

## Incremento 2 — folha auditável

- eventos/rubricas e lançamentos recorrentes — cadastro operacional concluído;
- regras e tabelas fiscais por vigência;
- consolidação mensal por pessoa;
- outras fontes pagadoras;
- processamento idempotente;
- memória de cálculo e snapshots;
- fechamento e reabertura auditados.

Progresso: o caso de uso transacional cria e processa a Folha por Termo, Meta e
competência. O worker materializa Vínculos, retribuição, Eventos recorrentes, retenções,
snapshots e memória individual, usando a regra fiscal publicada e conferida por hash.
Cada revisão possui hash reproduzível; o fechamento reconfere esse conteúdo e o banco
torna Folha, itens e linhas imutáveis. Reabertura exige motivo e deixa trilha. As páginas
de Folhas já consultam o PostgreSQL, exportam a memória em JSON e geram um CSV
determinístico de conferência para o RH, com hashes da Folha e da regra fiscal. A
decisão do RH é registrada de forma imutável, inclui checklist e vale apenas para o
hash analisado; sem aprovação vigente, o fechamento é bloqueado.

A conta bancária agora integra o snapshot e o hash de cada item. A relação A4 e seu
espelho CSV bloqueiam liberação se a Folha não estiver fechada ou se algum prestador
estiver sem agência, conta ou tipo válido. Transmissão e retorno bancários continuam
fora do MVP.

Outras fontes pagadoras e medições mensais possuem cadastro por competência, evidência
de conferência e snapshot. A criação da Folha executa pré-validação cadastral, fiscal e
de medições antes de enfileirar. Percentual, quantidade × valor unitário e valor
explícito são suportados sem pressupor fórmulas contratuais. Ainda falta homologação
centavo a centavo com as três competências reais antes de liberar o uso financeiro.

A revisão estrutural identificou que o rateio entre Folhas diferentes da mesma pessoa
e competência exige uma ativação controlada. Sem ela, a criação e o worker bloqueiam
esse cenário sob trava transacional. O desenho e os
critérios estão em [Consolidação mensal por pessoa](CONSOLIDACAO_MENSAL.md). A tela da
Folha agora também apresenta bases totais de INSS/IRRF e resumo de rubricas. O
diagnóstico `/conferencia-entre-folhas` antecipa pessoas multi-lote, medições e Folhas existentes.
O operador congela as fontes em casos versionados por SHA-256; o RH registra andamento,
decisão, justificativa e responsável. Mudança nas fontes invalida automaticamente a
decisão anterior, preservando-a para auditoria. O CSV inclui o estado da homologação.
O motor agregado agora existe em modo controlado: calcula INSS/IRRF uma única vez por
Pessoa, rateia por maior resto, versiona entradas e resultado e possui fluxo próprio de
homologação em `/conferencia-entre-folhas/simulacoes`. O consumo pela Folha está implementado,
desligado por padrão e limitado por empresa e competência inicial. Ele exige a
simulação homologada ainda atual, registra seu ID/hash em cada item e bloqueia o
fechamento sem todas as Folhas da Pessoa.

Folha na fila ou aberta pode ser cancelada com motivo e preservação da memória.
Reabrir uma Folha invalida automaticamente obrigação e documentos ainda não emitidos;
fontes de obrigação emitida são bloqueadas até existir fluxo formal de retificação.

Critério de aceite: as três competências anonimizadas fecham centavo a centavo ou possuem diferença formalmente explicada.

## Incremento 3 — obrigações

- itens tipados de segurado, patronal, RAT, terceiros e acréscimos;
- reconciliação folha–obrigação;
- exportação para eSocial/EFD-Reinf, quando aplicável;
- recibos DCTFWeb e DARF;
- GPS somente em hipótese validada.

Progresso: `SEGURADO` e `PATRONAL` são recompostos de forma idempotente a partir de
itens de Folhas fechadas, preservando Folha, revisão, hash, base, alíquota, valor,
prestador, outras fontes e enquadramento. Regime geral e imunidade beneficente não
compartilham alíquotas: a segunda exige CEBAS válido e evidência. Totalizador, recibo
e DARF da DCTFWeb podem ser registrados com hash; a máquina de estados só considera
emitida a obrigação com totalizador idêntico, recibo verificado e DARF do mesmo valor.
A apuração parcial agora é recusada. A relação com cada Folha congela revisão e hash;
documentos verificados só são aceitos se nenhuma fonte mudou ou foi acrescentada.
Reapurar invalida conferências anteriores. O espelho CSV detalha cada item e as
evidências para conferência contábil. O dossiê A4 recompõe itens, principal, juros,
multa e total, lista as fontes congeladas e só aceita estado emitido com a cadeia
documental completa. Ainda faltam integração/exportação oficial e homologação com
documentos reais.

Obrigações ainda não emitidas podem ser canceladas de modo terminal e auditado,
invalidando documentos verificados sem apagar a composição histórica.

Critério de aceite: nenhuma obrigação é emitida com item sem origem ou com diferença não aprovada.

## Incremento prioritário — folha trabalhista e FGTS Digital

- separar contrato de trabalho de Vínculo de prestador;
- cadastrar estabelecimentos, lotações tributárias, cargos e rubricas eSocial;
- processar folha trabalhista para categorias inicialmente homologadas;
- formar e validar S-1200 pelos XSD oficiais;
- transmitir por adaptador substituível e consultar protocolo/recibo;
- conciliar S-5003 por trabalhador e S-5013 por competência;
- registrar a GFD oficial, Pix, pagamento e retificações;
- incluir FGTS na homologação mensal.

Fundação concluída: categorias `101`, `103` e `721` possuem regra inicial explícita,
a categoria `701` é bloqueada, o cálculo é truncado por trabalhador/tipo de valor e a
integração possui contrato independente do fornecedor. A decisão técnica e a pesquisa
estão em [FGTS Digital](FGTS_DIGITAL.md).

Não há API pública oficial confirmada para gerar a GFD. O primeiro MVP automatiza a
cadeia do eSocial e trata a emissão no portal/importação da GFD como etapa assistida.
Web Service oficial, `erpbrasil/esociallib`, TecnoSpeed e RESocial serão comparados em
produção restrita antes da escolha.

Critério de aceite: a soma interna fecha com S-5003/S-5013 e com a GFD oficial, sem
habilitar FGTS para categoria sem direito validado.

## Incremento 4 — homologação e corte

- importação histórica controlada;
- três competências em execução paralela;
- testes de segurança, backup e restauração;
- treinamento e documentação operacional;
- plano de reversão.

Progresso: a tela da Folha já importa uma referência CSV do GIW ou do RH, associa
linhas por matrícula e compara proventos, INSS, IRRF, descontos e líquido em centavos.
Cada execução preserva hashes do arquivo e da revisão, responsável, totais e diferenças
em registros imutáveis. Repetir o mesmo arquivo é idempotente. O contrato e o roteiro
estão em [Homologação paralela da Folha](HOMOLOGACAO_FOLHA.md).

`/fechamento-mensal` agora consolida oito gates por competência: medições, casos
multi-vínculo, Folhas fechadas, conferência do RH, comparação GIW, pagamentos,
obrigação e documentos DCTFWeb/DARF. Cada fotografia possui hash, versão, itens imutáveis, decisão
auditada e dossiê CSV. A campanha móvel apresenta três competências e só as considera
concluídas quando a versão vigente estiver aprovada. O procedimento está em
[Homologação mensal](HOMOLOGACAO_MENSAL.md). Ainda faltam executar os meses reais,
explicar diferenças, treinar operadores e ensaiar corte e reversão.

O acervo histórico agora possui modelo próprio para Folhas, itens, rubricas e guias,
validação de fechamento, checksum e importação idempotente. `/migracoes` compara o GIW
com a operação nova por competência e pessoa e exporta um dossiê CSV. O desenho está em
[Migração histórica](MIGRACAO_HISTORICA.md). O adaptador visual permanece condicionado
à reconexão do endereço do GIW; a sonda retomável já está pronta para confirmar os
seletores sem alterar o legado. Como contingência, exportações CSV de Folhas e guias
podem ser convertidas em snapshots históricos rastreáveis, com agrupamento por
Folha/pessoa/rubrica, SHA-256 e validação integral dos fechamentos.

## Incremento 5 — acesso e endurecimento

- autenticação real;
- perfis Administrador, Operador e Consulta;
- isolamento por organização;
- auditoria de login e alterações;
- revisão de exposição antes de ampliar o público do sistema.

## Expansões posteriores

- empenho e execução orçamentária;
- transmissão, retorno e conciliação de arquivos bancários;
- prestação de contas;
- documentos e contratos;
- painéis gerenciais.

## Priorização

Não iniciar um módulo posterior se ele exigir alterar silenciosamente o núcleo de cálculo. Novas capacidades devem consumir a folha fechada por contratos estáveis.
