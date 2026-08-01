# Plano de substituição do GIW — MVP operacional

**Data-base:** 01/08/2026  
**Prioridade:** P0 — substituição do fluxo atualmente comprovado  
**Estado:** plano executivo aprovado para implementação; homologação fiscal e operacional ainda pendente

## 1. Resultado que este plano deve entregar

Colocar em produção um fluxo completo, rastreável e utilizável pelo RH para:

1. manter os cadastros necessários à operação;
2. preparar a competência por contrato, termo/meta e frente de trabalho;
3. registrar medições e eventos de prestadores PF e PJ;
4. calcular, revisar, fechar e retificar a folha/relatório mensal;
5. produzir relações de pagamento e demonstrativos individuais;
6. apurar as retenções previdenciárias e fiscais aplicáveis;
7. gerar ou registrar o documento de recolhimento juridicamente aplicável;
8. montar o dossiê mensal de prestação de contas;
9. provar o resultado contra abril, maio e junho de 2026 antes do corte definitivo.

O produto só substitui o GIW quando uma competência puder ser executada de ponta a ponta pela interface, sem terminal, edição direta no banco ou cálculo paralelo em planilha.

## 2. Escopo congelado do MVP

### Incluído

- Pessoas, prestadores PF/PJ, dados fiscais, previdenciários e bancários.
- Situação ativa/inativa e vigência histórica, sem exclusão destrutiva de legado.
- Contratos, termos, metas, unidades e frentes de trabalho.
- Vínculos de prestação, funções, valores e períodos de vigência.
- Medições/produção e eventos manuais controlados.
- Folha/relatório por competência e frente.
- Proventos, descontos, retenções e valor líquido.
- Tratamento distinto de:
  - pagamento devido ao prestador;
  - retenção tributária associada ao pagamento;
  - obrigação/guia de recolhimento.
- Relações bancárias, demonstrativos PF/PJ e documentos de conferência.
- GPS histórica como evidência imutável.
- Geração ou registro do instrumento atual de recolhimento conforme enquadramento fiscal efetivo e aprovado.
- Fechamento, cancelamento, reabertura controlada, retificação e trilha de auditoria.
- Importação/reconciliação dos dados históricos disponíveis.
- Dossiê de prestação de contas com índice, hashes e documentos associados.

### Fora do caminho crítico

- Folha de empregados CLT.
- FGTS Digital/GFD.
- Rescisões, férias e 13º de empregados.
- Integração bancária automática.
- Transmissão governamental automática por certificado digital.
- Módulos amplos de contabilidade, patrimônio, compras ou licitações.
- Multiempresa genérico além do necessário ao contrato atual.

Esses itens não devem ocupar desenvolvimento P0. A arquitetura deve permitir sua inclusão futura sem misturá-los ao domínio atual.

## 3. Base factual de homologação

Os documentos recebidos formam o conjunto de referência (“golden master”):

- 3 competências: abril, maio e junho de 2026;
- 5 frentes por competência: CAPS, E-Multi, Hospital, Melhor em Casa e PSF;
- 15 folhas/relatórios;
- 169 documentos GPS convertidos e reconciliados;
- 82 pessoas encontradas nas folhas;
- 59 beneficiários de GPS reconciliados por CPF/CNPJ/NIT;
- conciliação centavo a centavo entre as 15 folhas e os 169 documentos de referência;
- exemplo aprofundado de maio: 37 prestadores, R$ 221.523,22 de proventos, R$ 8.963,24 de descontos, R$ 212.559,98 líquidos, R$ 8.173,29 de INSS e R$ 789,95 de IRRF.

Esses números não são parâmetros legais nem valores fixos do produto. São oráculos de regressão: qualquer divergência na reprodução histórica deve ser zero ou formalmente explicada, classificada e aprovada.

## 4. Decisão fiscal obrigatória, sem paralisar a engenharia

Os PDFs históricos apresentam GPS com código 1007, NIT/PIS/PASEP, linha digitável e segunda via. Isso prova o que o GIW produziu, mas não prova, sozinho, que o mesmo instrumento continua sendo o recolhimento correto para toda competência futura.

A Receita Federal identifica o código 1007 como contribuição mensal de contribuinte individual. Para pessoas jurídicas obrigadas à DCTFWeb, a orientação oficial é recolher por DARF emitido pela DCTFWeb, e a própria Receita alerta que GPS paga quando o DARF era devido exige ajuste. Portanto, o sistema não pode ocultar essa decisão nem inventar uma guia pagável.

### Perfil fiscal versionado

Antes de liberar “emitir para pagamento”, cada entidade/contrato deve possuir um perfil fiscal com vigência:

- categoria de cada prestador e natureza do pagamento;
- responsável pelo recolhimento;
- regime tributário e previdenciário da entidade;
- condição CEBAS, se aplicável, com documento e validade;
- obrigação ou dispensa de eSocial/EFD-Reinf/DCTFWeb;
- código de receita e instrumento de arrecadação aplicável;
- base, alíquota, limites e regras de retenção;
- responsável contábil que homologou a configuração;
- documento de fundamentação, data e versão.

### Regra de segurança operacional

- **Histórico:** GPS recebida permanece preservada e reproduzível como evidência.
- **Simulação/conferência:** o sistema pode calcular e comparar o resultado com o GIW.
- **Pagamento:** só é liberado como `APTO_PARA_PAGAMENTO` quando o perfil fiscal vigente autorizar o tipo do documento e todas as validações passarem.
- **Exceção GPS:** exige fundamentação registrada, responsável e vigência; não será inferida apenas do comportamento legado.
- **DCTFWeb/DARF:** no primeiro corte, o MVP pode registrar totalizador, recibo e DARF oficiais emitidos fora do sistema, conciliando-os com a folha. A transmissão automática fica para uma etapa posterior.

Referências oficiais:

- [Receita Federal — códigos de contribuição previdenciária](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/pagamentos-e-parcelamentos/codigos-de-receita/codigos-de-receita-de-contribuicao-previdenciaria)
- [Receita Federal/eSocial — substituição da GPS pelo DARF da DCTFWeb](https://www.gov.br/esocial/pt-br/noticias/receita-altera-regras-relativas-a-entrega-da-dctfweb/)
- [Receita Federal — Perguntas e respostas DCTFWeb](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/DCTFWeb/arquivos/perguntas-e-respostas-dctfweb-fevereiro-2025-19-02-1.pdf)
- [Receita Federal — contribuições previdenciárias da pessoa física](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/contribuicoes-previdenciarias-pf)
- [eSocial — Manual Web Geral](https://www.gov.br/esocial/pt-br/empresas/manual-web-geral)
- [IN RFB nº 2.110/2022](https://normas.receita.fazenda.gov.br/sijut2consulta/consulta/link.action?idAto=126687&visao=original)

## 5. Arquitetura mínima de produção

### Camadas

1. **Interface web:** jornada por competência, responsiva, acessível e sem formulários extensos permanentemente expostos.
2. **Aplicação/backend:** casos de uso transacionais; nenhuma regra fiscal crítica apenas no navegador.
3. **Motor de cálculo:** funções determinísticas, versionadas e testadas; valores monetários em decimal, nunca ponto flutuante.
4. **PostgreSQL:** fonte transacional única, com chaves, constraints, índices, vigências e migrations reproduzíveis.
5. **Worker/fila:** geração de PDFs, importações e tarefas pesadas idempotentes.
6. **Armazenamento privado de documentos:** PDF original, PDF gerado, comprovante e hash; acesso controlado.
7. **Auditoria:** autor, data, origem, estado anterior/posterior e motivo para toda ação sensível.
8. **Observabilidade:** health check, logs estruturados, erros rastreáveis e métricas dos jobs.

### Fluxo transacional

```mermaid
flowchart LR
    A["Cadastros e perfil fiscal"] --> B["Contrato, termo/meta e vigência"]
    B --> C["Medições e eventos"]
    C --> D["Prévia da competência"]
    D --> E["Validações bloqueantes"]
    E --> F["Cálculo versionado"]
    F --> G["Conferência RH/contábil"]
    G --> H["Fechamento imutável"]
    H --> I["Relações de pagamento"]
    H --> J["Retenções e obrigações"]
    I --> K["Dossiê de prestação de contas"]
    J --> K
    K --> L["Retificação versionada, se necessária"]
```

### Estados obrigatórios

- Competência: `RASCUNHO -> CALCULADA -> EM_CONFERENCIA -> APROVADA -> FECHADA`.
- Documento: `RASCUNHO -> VALIDADO -> APTO_PARA_PAGAMENTO -> PAGO -> CONCILIADO`.
- Retificação nunca altera silenciosamente um fechamento; cria nova revisão relacionada à anterior.
- Processamentos repetidos devem ser idempotentes: a mesma entrada e versão de regra produzem o mesmo resultado, sem duplicar folha ou guia.

## 6. Frentes de implementação e critérios de aceite

### Fase 0 — saneamento de escopo e governança

**Objetivo:** retirar FGTS/CLT do fluxo ativo e impedir novas interpretações contraditórias.

Entregas:

- este plano como fonte única do MVP;
- navegação, textos e backlog sem FGTS no caminho principal;
- matriz de responsabilidade RH/financeiro/contabilidade/administração;
- registro de decisões fiscais com responsável e evidência;
- inventário de pendências classificado em P0, P1 e futuro.

Aceite:

- nenhuma tela sugere que o produto emite FGTS para a operação atual;
- todos concordam com o significado de folha, retenção e guia;
- mudanças de escopo exigem decisão registrada.

### Fase 1 — cadastro operacional completo

**Objetivo:** garantir que a folha não dependa de dado oculto ou edição no banco.

Entregas:

- pessoa e prestador editáveis em todos os campos necessários;
- PF/PJ e dados do documento com validação;
- NIT/PIS/PASEP, categoria e enquadramento sem valores fictícios;
- conta bancária, favorecido e chave de pagamento com histórico;
- vínculo de prestação, função, unidade, frente, termo/meta e vigência;
- ativo/inativo com motivo e data;
- criação/edição em modal ou página dedicada, com listas e filtros separados;
- validação responsiva em desktop, tablet e celular.

Aceite:

- uma ficha marcada incompleta aponta cada campo e abre diretamente o local de correção;
- “prestador ativo” e “vínculo ativo” são ações acessíveis e compreensíveis;
- todos os dados usados no cálculo têm origem e vigência visíveis.

### Fase 2 — preparação e cálculo da folha

**Objetivo:** executar uma competência real integralmente pela interface.

Entregas:

- seleção válida de contrato, termo/meta, frente e competência;
- elegibilidade por vínculo e vigência;
- importação/reaproveitamento controlado da competência anterior;
- medição, provento, desconto, ajuste e justificativa;
- separação explícita entre prestador PF, pagamento PJ e retenção;
- cálculo determinístico de bruto, retenções, descontos e líquido;
- prévia, validações, erros acionáveis, recálculo e aprovação;
- fechamento com snapshot de regras, entradas e resultados;
- reabertura/retificação com permissão, motivo e auditoria.

Aceite:

- nenhuma PJ legítima é excluída apenas por ser PJ;
- nenhum tributo aparece como beneficiário de pagamento;
- somatórios de cabeçalho, itens e relatórios fecham no centavo;
- não há duplicidade ao processar novamente a mesma competência.

### Fase 3 — documentos da folha e pagamentos

**Objetivo:** substituir os relatórios utilizados no trabalho e na prestação de contas.

Entregas:

- folha analítica e sintética por frente;
- demonstrativo individual;
- demonstrativo específico para pagamentos PJ;
- relatório de retenções;
- relação bancária/pagamento com total e quantidade;
- exportação PDF e planilha quando aplicável;
- cabeçalho institucional, competência, versão, data, responsável e hash;
- impressão A4 legível e responsiva na visualização web.

Aceite:

- totais iguais entre tela, folha, demonstrativos e relação de pagamento;
- nenhum relatório mistura valor devido ao prestador com valor a recolher;
- o RH encontra e baixa qualquer documento em até três ações a partir da competência.

### Fase 4 — retenções e documentos de recolhimento

**Objetivo:** reproduzir o resultado comprovado do GIW e operar com o instrumento juridicamente correto.

Entregas:

- itens de retenção derivados exclusivamente de folha fechada;
- conciliação pessoa a pessoa por CPF/CNPJ/NIT;
- gerador de representação GPS somente quando o perfil autorizar;
- código, competência, identificador, base, valor, vencimento e segunda via;
- linha digitável apenas com algoritmo homologado e teste contra referências; nunca texto inventado;
- fluxo alternativo DCTFWeb: totalizador, recibo, DARF, vencimento, pagamento e conciliação;
- estado visual inequívoco: histórico, simulação, conferência ou apto para pagamento;
- lote por competência/frente e índice dos documentos;
- bloqueios para falta de NIT, categoria, perfil fiscal, duplicidade, divergência ou valor inválido.

Aceite:

- 169/169 referências históricas associadas à folha e conciliadas;
- diferença histórica agregada e individual igual a zero, salvo exceção documentada;
- nenhum documento de simulação pode ser confundido com guia apta para pagamento;
- o documento atual só é liberado conforme perfil fiscal vigente e homologado.

### Fase 5 — dossiê e auditoria

**Objetivo:** sustentar prestação de contas e investigação posterior.

Entregas:

- pacote mensal com folha, demonstrativos, relação de pagamento, retenções, documentos de recolhimento e comprovantes;
- índice com quantidade, valor, hash e relação com a competência;
- trilha de criação, revisão, aprovação, fechamento, pagamento e retificação;
- autoria individual mínima antes do corte, mesmo que a autenticação avançada fique para depois;
- relatório de inconsistências e justificativas;
- retenção documental e política de backup.

Aceite:

- qualquer valor do dossiê retorna à pessoa, evento, regra, folha e documento de origem;
- alterações posteriores não sobrescrevem o material originalmente aprovado;
- o pacote é verificável sem acesso ao banco.

### Fase 6 — homologação dos três meses

**Objetivo:** provar o motor e os documentos contra dados reais conhecidos.

Matriz mínima:

| Controle | Meta de aceite |
|---|---:|
| Folhas reconciliadas | 15/15 |
| Documentos GPS históricos associados | 169/169 |
| Pessoas das folhas identificadas | 82/82 |
| Beneficiários reconciliados | 59/59 |
| Diferença total por folha | R$ 0,00 ou exceção formal |
| Diferença por pessoa/documento | R$ 0,00 ou exceção formal |
| Órfãos de pessoa/vínculo/folha | 0 |
| Duplicidades ativas | 0 |
| Erros bloqueantes ignorados | 0 |

Os 101 avisos de importação já conhecidos não podem ser escondidos. Cada um deve ser classificado como:

- resolvido automaticamente com evidência;
- resolvido manualmente com autor e motivo;
- limitação legítima do documento de origem;
- bloqueante para produção.

Somente a última classe impede o corte; nenhuma classe pode ficar sem contagem e rastreabilidade.

### Fase 7 — qualidade de produto e operação

**Objetivo:** garantir que a implementação seja um produto utilizável, não apenas código existente.

Entregas:

- varredura de todas as rotas, links e botões;
- jornada principal com mensagens, vazios, erros e confirmações coerentes;
- formulários em modal/página dedicada e listas com filtros reais;
- tabelas responsivas sem sobreposição;
- navegação e nomes de rota harmonizados;
- foco, teclado, contraste e rótulos acessíveis;
- ajuda contextual curta nas decisões fiscais;
- operações críticas com confirmação e resultado explícito.

Aceite:

- suíte E2E percorre cadastro -> competência -> cálculo -> fechamento -> pagamento -> obrigação -> dossiê;
- todos os elementos interativos visíveis têm ação válida;
- testes em larguras móvel, tablet e desktop não apresentam sobreposição ou perda de ação;
- uma pessoa do RH treinada executa o roteiro sem apoio técnico.

### Fase 8 — confiabilidade, implantação e corte

**Objetivo:** colocar a solução em produção com retorno seguro caso algo falhe.

Entregas:

- migrations aplicadas primeiro em banco descartável/homologação;
- backup integral anterior ao deploy;
- restauração do backup testada, não apenas presumida;
- smoke test pós-deploy;
- jobs idempotentes, tentativas controladas e fila observável;
- health check, logs e alerta para falha de cálculo/documento;
- runbook de deploy, rollback e suporte;
- execução paralela de uma competência antes do desligamento operacional do GIW.

Aceite:

- deploy e rollback ensaiados;
- backup restaurado em ambiente separado e validado;
- nenhuma migration destrutiva sem plano de reversão;
- competência piloto assinada por RH e responsável contábil;
- GIW mantido somente para consulta durante a janela acordada.

## 7. Estratégia de testes obrigatória

### Código

- Unitários para fórmulas, arredondamento, limites, vigências e estados.
- Testes de propriedade para invariantes monetários e idempotência.
- Integração com PostgreSQL real para constraints, transações e migrations.
- Contratos de entrada/saída dos casos de uso.
- E2E no navegador para a jornada crítica e todas as ações de cadastro.

### Dados e documentos

- Golden tests com abril, maio e junho de 2026.
- Reconciliação por pessoa, frente, competência, rubrica e documento.
- Extração automática do PDF gerado para conferir texto e valores.
- Comparação visual amostral de A4, quebras, repetição de cabeçalho e segunda via.
- Hash dos arquivos de entrada e saída.

### Operação

- Perfil sem dado obrigatório deve bloquear com correção acionável.
- Usuário não pode fechar folha divergente sem exceção formal.
- Falha no PDF não pode deixar documento parcialmente “emitido”.
- Reprocessamento não pode duplicar pessoas, itens ou obrigações.
- Conflito de edição deve ser detectado.
- Restauração, rollback e reexecução da fila devem ser ensaiados.

## 8. Portões de liberação

### Portão A — cálculo confiável

- 15 folhas históricas reproduzidas.
- zero divergência monetária inexplicada.
- cadastros e vínculos corrigíveis pela interface.

### Portão B — documento juridicamente definido

- perfil fiscal homologado e vigente.
- tipo de recolhimento aprovado para a entidade/competência.
- bloqueios e classificação visual testados.

### Portão C — operação utilizável

- jornada E2E verde.
- RH conclui roteiro de homologação.
- relatórios e dossiê aprovados.

### Portão D — produção recuperável

- backup restaurado com sucesso.
- deploy/rollback ensaiados.
- smoke test e monitoramento ativos.

Não existe “produção plena” antes dos quatro portões. O software pode ser disponibilizado para homologação antes, mas deve mostrar claramente essa condição.

## 9. Ordem de execução a partir de agora

1. Retirar FGTS da navegação e do backlog P0; manter apenas nota arquitetural futura.
2. Transformar este documento e o andamento em fonte única, eliminando percentuais e objetivos conflitantes.
3. Implementar o perfil fiscal versionado e o portão `APTO_PARA_PAGAMENTO`.
4. Fechar a jornada de cadastro, termo/meta e vínculo que hoje impede o uso da folha.
5. Executar uma folha completa por interface e corrigir toda divergência de domínio/UX.
6. Concluir o módulo de retenções e documentos: GPS autorizada ou registro/conciliação DCTFWeb/DARF.
7. Incorporar abril, maio e junho como fixtures privadas de homologação e testes de regressão.
8. Corrigir os 101 avisos com classificação e relatório rastreável.
9. Gerar os documentos e o dossiê mensal.
10. Rodar varredura de páginas, botões, rotas, responsividade e acessibilidade.
11. Homologar com RH e responsável contábil em uma competência piloto.
12. Ensaiar backup/restauração, publicar, fazer smoke test e operar em paralelo.

## 10. Reestimativa honesta

Com o escopo corrigido:

- **implementação funcional existente:** aproximadamente 72%;
- **prontidão comprovada para substituir o GIW em produção:** aproximadamente 55%;
- **conclusão do MVP:** 100% somente após os portões A–D.

A diferença não é “mais módulos”. É o trabalho mais valioso: fechar documento de recolhimento correto, corrigir a jornada real, transformar dados históricos em testes automáticos, reconciliar os avisos e provar recuperação/uso operacional.

### Janela de execução estimada

Mantendo foco exclusivo e acesso rápido ao RH/contabilidade:

- beta operacional das fases 0–4: **7 a 10 dias úteis de trabalho focado**;
- candidato a produção com reconciliação, UX, dossiê e infraestrutura: **15 a 20 dias úteis**;
- corte: **primeira competência após homologação dos quatro portões**.

Essa janela é previsão de engenharia, não promessa jurídica. A definição fiscal do instrumento de arrecadação e a homologação humana não podem ser substituídas por código, mas a implementação deve avançar em paralelo sem esperar o último dia.

## 11. Definição final de pronto

O GIW poderá ser substituído quando, para uma competência real:

- os cadastros estiverem completos e editáveis;
- termo/meta e vínculos puderem ser selecionados sem contorno técnico;
- a folha calcular e fechar com totais corretos;
- PF e PJ receberem tratamento coerente com a natureza do pagamento;
- retenções e documento de recolhimento estiverem conciliados e juridicamente aprovados;
- folha, relações, demonstrativos e dossiê forem emitidos;
- toda ação crítica tiver autoria e rastreabilidade;
- os três meses de referência estiverem reconciliados;
- RH e contabilidade assinarem o roteiro de aceite;
- backup, restauração, deploy e rollback tiverem sido testados.

Até lá, cada entrega deve reduzir diretamente um desses bloqueios. Trabalho que não aproxima um portão de aceite deve sair do P0.
