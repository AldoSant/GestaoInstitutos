# Plano de recuperação do produto

## Objetivo

Transformar o Gestão Institutos de uma interface técnica sobre o banco de dados em
um produto operacional que permita ao RH:

1. manter os cadastros reais;
2. preparar uma competência;
3. calcular e conferir a folha;
4. corrigir pendências;
5. fechar a competência;
6. apurar obrigações;
7. emitir ou registrar os documentos oficiais aplicáveis;
8. consultar histórico e evidências sem depender da equipe técnica.

O MVP só será considerado concluído quando uma pessoa do RH conseguir executar
essa jornada usando exclusivamente a interface.

## Princípios do produto

- A competência é o contexto principal da operação.
- A interface apresenta tarefas e decisões, não tabelas, hashes ou infraestrutura.
- Todo bloqueio informa o problema, o registro afetado e a ação para corrigi-lo.
- Histórico importado é somente leitura e não compete com a operação corrente.
- Auditoria continua existindo, mas fica em detalhes ou na área administrativa.
- Recursos indisponíveis são identificados com clareza e não aparentam funcionar.
- Listas reais têm busca, filtros, ordenação, paginação e contagem total.
- A identidade do usuário autenticado é usada nas decisões e registros.
- Uma entrega só termina depois de teste automatizado e validação da jornada.

## Usuários prioritários

### Operador de RH

Mantém cadastros, registra movimentos, calcula, confere e corrige a folha.

### Responsável pelo fechamento

Analisa totais, aprova a competência, libera pagamentos e acompanha obrigações.

### Administrador

Mantém parâmetros fiscais, acompanha integrações, migrações e auditoria.

No primeiro ciclo, uma mesma conta pode acumular os três papéis. A interface,
porém, preserva essa separação para não misturar tarefas.

## Arquitetura de informação alvo

### Início

- competência em foco;
- situação do fechamento;
- totais principais;
- pendências que exigem ação;
- próxima tarefa recomendada;
- atalhos para folha e obrigações.

### Pessoas e vínculos

- pessoas e documentos;
- contatos e endereço;
- dados bancários e previdenciários;
- prestadores e vínculos;
- termos, metas, atividades e lotações;
- eventos e medições mensais.

### Folha mensal

- competências;
- preparação;
- cálculo;
- pendências;
- conferência;
- fechamento;
- pagamentos;
- demonstrativos e relatórios.

### Obrigações

- apuração previdenciária;
- documentos DCTFWeb/DARF;
- FGTS e eSocial quando aplicáveis;
- vencimentos;
- conciliação;
- pagamento e histórico.

### Administração

- parâmetros fiscais;
- fechamento e auditoria;
- importação GIW;
- integrações;
- registros técnicos.

## Estados da competência

1. **Não iniciada** — ainda não existe folha.
2. **Em preparação** — cadastros ou movimentos possuem pendências.
3. **Pronta para calcular** — entradas obrigatórias estão completas.
4. **Processando** — cálculo em execução.
5. **Com divergências** — cálculo concluído com bloqueios.
6. **Pronta para conferência** — totais e pessoas estão disponíveis.
7. **Conferida** — RH aprovou a versão calculada.
8. **Fechada** — folha congelada para obrigações e pagamentos.
9. **Com obrigações pendentes** — falta conciliar documento oficial.
10. **Concluída** — pagamentos e obrigações estão registrados.

Cada estado possui uma única ação primária.

## Fases de execução

### Fase 1 — Fundação da experiência

Objetivo: retirar o aspecto de protótipo e organizar o produto pela rotina do RH.

Entregas:

- nova navegação hierárquica;
- remoção de “protótipo”, “ambiente local” e “dados demonstrativos”;
- organização e operador reais no cabeçalho;
- remoção de controles decorativos;
- textos orientados à operação;
- ajuda operacional;
- recursos incompletos apresentados honestamente.

Critérios de aceite:

- nenhum texto de desenvolvimento aparece na navegação normal;
- todo controle visível possui ação;
- o usuário identifica onde iniciar a folha em até dois cliques;
- migração e auditoria não aparecem como tarefas principais.

### Fase 2 — Contexto de competência

Objetivo: tornar mês/ano o eixo de toda a operação.

Entregas:

- seletor real de competência;
- competência preservada durante a navegação;
- estados padronizados;
- resumo de prontidão;
- próxima ação recomendada;
- datas e vencimentos derivados da competência.

Critérios de aceite:

- trocar a competência atualiza folha, obrigações e pendências;
- nenhuma data é fixa no código da interface;
- o sistema diferencia competência corrente, histórica e fechada.

### Fase 3 — Cadastros operacionais

Objetivo: permitir manter integralmente os dados reais.

Entregas:

- ficha única de pessoa;
- abas de identificação, contato, endereço, banco, previdência e vínculos;
- inclusão e edição de dependentes;
- paginação e contagem real;
- filtros ativo/inativo, tipo e pendência;
- visualização “somente ativos” por padrão;
- ações em lote para ativar ou inativar;
- indicação dos campos obrigatórios para cálculo;
- histórico do GIW somente em detalhes administrativos.

Critérios de aceite:

- todos os registros importados podem ser encontrados;
- nenhum limite silencioso de 200/300/500 registros;
- o RH corrige dados bancários, endereço, contato e previdência;
- a ficha mostra por que uma pessoa não está apta para a folha.

### Fase 4 — Jornada guiada da folha

Objetivo: transformar o cálculo existente em uma operação compreensível.

Etapas:

1. preparar;
2. calcular;
3. revisar pendências;
4. conferir pessoas e rubricas;
5. aprovar;
6. fechar;
7. gerar pagamentos e relatórios.

Entregas:

- assistente de criação da competência;
- verificação prévia dos cadastros;
- atualização automática do processamento;
- lista de pendências com links de correção;
- visão por pessoa e por rubrica;
- memória de cálculo em linguagem simples;
- comparação com competência anterior;
- confirmação contextual para cancelar, reabrir e fechar;
- histórico técnico recolhido em seção avançada.

Critérios de aceite:

- uma folha real é criada, calculada, corrigida e fechada pela interface;
- nenhuma etapa exige atualizar manualmente a página;
- falhas preservam os dados digitados;
- totais da interface conciliam com o relatório final.

### Fase 5 — Obrigações previdenciárias

Objetivo: ligar a competência fechada aos documentos oficiais.

Entregas:

- apuração derivada da folha fechada;
- composição de segurado e patronal;
- pendências por pessoa;
- registro ou importação de DCTFWeb e DARF;
- conciliação dos valores;
- vencimento, pagamento e comprovante;
- retificação vinculada à competência original.

Critérios de aceite:

- documento interno nunca é identificado como guia oficial;
- diferenças entre folha e documento oficial ficam visíveis;
- a competência só é concluída após decisão explícita sobre divergências.

### Fase 6 — eSocial e FGTS

Objetivo: suportar somente vínculos elegíveis e a cadeia oficial.

Entregas:

- classificação validada de categoria eSocial;
- geração e validação dos eventos necessários;
- provedor de transmissão substituível;
- ambiente de produção restrita;
- recibos, rejeições e reenvio;
- conciliação de S-5003 e S-5013;
- registro ou importação da GFD;
- pagamento e comprovante.

Critérios de aceite:

- autônomos e categorias não elegíveis não geram FGTS;
- a GFD é identificada como documento externo oficial;
- nenhum botão “Emitir guia” existe antes da integração real;
- o fluxo é homologado primeiro em produção restrita.

### Fase 7 — Administração e legado

Objetivo: retirar ruído técnico da rotina diária sem perder rastreabilidade.

Entregas:

- área administrativa separada;
- importação e reconciliação GIW;
- parâmetros e vigências;
- auditoria, hashes e snapshots;
- relatórios de integridade;
- histórico importado somente leitura.

Critérios de aceite:

- operadores não precisam compreender conceitos de migração;
- dados históricos nunca são misturados silenciosamente com folha nova;
- artefatos técnicos continuam acessíveis ao administrador.

### Fase 8 — Qualidade e homologação

Objetivo: impedir que uma publicação tecnicamente válida seja um produto quebrado.

Entregas:

- testes E2E no navegador;
- testes de acessibilidade;
- testes de paginação e grandes volumes;
- teste de restauração do banco;
- roteiro de homologação com o RH;
- registro de aceite por competência;
- checklist de publicação e rollback.

Jornadas E2E obrigatórias:

1. entrar e localizar pessoa;
2. corrigir cadastro completo;
3. criar competência;
4. calcular folha;
5. resolver pendência;
6. conferir e fechar;
7. emitir relatório e relação de pagamentos;
8. apurar obrigação;
9. registrar documento oficial;
10. reabrir e retificar com justificativa.

## Critérios de conclusão do MVP

O MVP estará concluído somente quando:

- dados ativos puderem ser mantidos integralmente;
- uma competência real completar a jornada sem banco ou terminal;
- folha e memória individual forem compreensíveis pelo RH;
- pagamentos forem exportados e conferidos;
- obrigação previdenciária for conciliada;
- FGTS for marcado como não aplicável ou processado pela cadeia oficial;
- histórico importado estiver separado;
- as dez jornadas E2E passarem;
- a gerente do RH executar o roteiro e registrar o aceite.

## Ordem imediata

1. shell, navegação e linguagem;
2. competência global;
3. paginação e filtro de ativos;
4. ficha completa de pessoa;
5. prontidão e fluxo da folha;
6. atualização automática do processamento;
7. obrigações por competência;
8. isolamento do legado;
9. testes E2E;
10. homologação com RH.

Novos módulos não entram antes da conclusão dos itens 1 a 6.

## Estado da execução

| Item | Situação | Evidência |
|---|---|---|
| 1. Shell, navegação e linguagem | Concluído | Navegação orientada à rotina, identidade real da sessão e textos operacionais. |
| 2. Competência global | Concluído | Seletor persistente compartilhado por folha, obrigações, medições e consolidação. |
| 3. Paginação e filtro de ativos | Concluído | Pessoas ativas por padrão, busca, situação, contagem e paginação real. |
| 4. Ficha completa de pessoa | Concluído | Identificação, contato, endereço, conta, previdência e dependentes editáveis. |
| 5. Prontidão e fluxo da folha | Concluído | Diagnóstico anterior ao cálculo e jornada guiada até pagamentos. |
| 6. Atualização automática | Concluído | Acompanhamento de tarefa, falha compreensível e retentativa segura. |
| 7. Obrigações por competência | Concluído para o núcleo previdenciário | Cadeia de folha fechada, apuração, totalizador, recibo e DARF. |
| 8. Isolamento do legado | Concluído na navegação | Importação e parâmetros foram removidos da rotina principal e concentrados em Administração. |
| 9. Testes E2E | Em andamento | Jornada não destrutiva criada e exigida no CI; falta executar também contra o commit implantado na VPS. |
| 10. Homologação com RH | Pendente | Depende do deploy e da execução assistida em competência controlada. |
