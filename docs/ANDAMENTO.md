# Andamento do MVP

## Decisão prioritária de 30/07/2026

Foi eliminada da linha oficial de desenvolvimento a proposta de excluir toda pessoa
jurídica da Folha por uma chave binária. O domínio agora separa pagamento ao prestador,
retenção tributária vinculada e guia/recolhimento. A migração `0034` introduz o
demonstrativo mensal auditável sem alterar o motor previdenciário PF.

O desenho, limites e aceite estão em
[Demonstrativo mensal de Camamu](DEMONSTRATIVO_MENSAL_CAMAMU.md), e a decisão está
registrada em
[ADR-0004](decisoes/ADR-0004-demonstrativo-pagamentos-retencoes-guias.md).

O fluxo `/demonstrativos` já materializa pagamentos PF de Folhas fechadas, preserva
descontos não tributários no snapshot, cria INSS/IRRF como retenções, vincula as guias
da competência e permite registrar PJ por documento em modal. A prova transacional
foi executada no PostgreSQL 16 descartável. A migração `0035` acrescenta conferência
imutável por revisão/hash; o fechamento recalcula pagamentos, retenções, obrigações e
documentos e recusa fonte alterada. O CSV operacional preserva as três naturezas.

## Visão geral

**Estimativa do MVP ampliado: 72% concluído. Prontidão operacional com dados reais:
aproximadamente 63%.**

O núcleo anterior — folha de prestadores e obrigação previdenciária — está em
94%. Em 28/07/2026 o alvo foi ampliado para incluir folha trabalhista, transmissão ao
eSocial e GFD oficial. Prestador `701` não pode ser convertido silenciosamente em
empregado com FGTS; por isso o escopo novo é medido separadamente e depende das
amostras reais do RH.

| Componente do escopo ampliado | Peso | Maturidade | Contribuição |
|---|---:|---:|---:|
| Núcleo de prestadores, INSS e migração | 65% | 94% | 61,1% |
| Folha trabalhista, eSocial e FGTS Digital | 25% | 34% | 8,5% |
| Operação real, homologação e corte | 10% | 24% | 2,4% |
| **MVP ampliado** | **100%** |  | **72,0%** |

A prontidão operacional é menor porque ainda exige carregar os snapshots reconciliados
em uma homologação PostgreSQL, classificar vínculos, executar as três competências no
motor novo, operar eSocial/FGTS Digital e obter aceite do RH. Código implementado sem
essa prova não é contado como operação concluída.

## Migração real confirmada em 29/07/2026

- remessa de 30 PDFs inventariada por SHA-256: 15 Folhas e 15 conjuntos de GPS;
- 15 Folhas e 169 GPS convertidas em snapshots privados e revalidadas individualmente;
- competências abril, maio e junho de 2026 fecham Folha × GPS centavo a centavo;
- 1.071 Pessoas completas coletadas do GIW, sem ID legado duplicado;
- 82 de 82 Pessoas das Folhas e 59 de 59 beneficiários de GPS reconciliados por
  CPF/CNPJ/NIT, sem depender de aproximação por nome;
- todas as 169 GPS associadas à respectiva Folha da mesma Pessoa e competência;
- 14 Atividades atuais, 20 Lotações, 10 Eventos atuais, 3 Termos, 16 Metas e 321
  Vínculos coletados; dois passes integrais reproduziram os mesmos 321 registros;
- 27 Atividades antigas e 1 Pessoa histórica, ainda referenciadas pelos Vínculos mas
  ausentes dos localizadores atuais, preservadas em snapshots suplementares;
- estrutura real de Eventos, Lançamentos, Produtividade, Folha e GPS mapeada novamente
  no GIW; formulários diretos e formulários com localizador são tratados separadamente;
- 30 snapshots reconciliados estão prontos para dry-run transacional assim que a
  homologação PostgreSQL descartável estiver disponível.

O percentual mede capacidade operacional validada, e não quantidade de telas ou linhas
de código. Uma etapa só avança quando existe persistência, validação, teste e caminho de
homologação. Interfaces demonstrativas contam apenas como descoberta de fluxo.

| Frente | Peso no MVP | Concluído | Situação |
|---|---:|---:|---|
| Plataforma, banco, deploy e CI | 15% | 14% | Pool, concorrência, auditoria, fila e worker operacional implementados; falta comprovar restauração periódica na VPS, ampliar monitoramento e identificar o usuário autenticado. |
| Descoberta, regras e modelo relacional | 10% | 8% | Fluxo principal e modelo identificados. Regime geral e imunidade beneficente agora possuem cenários distintos e versionados; contratos, CEBAS e amostras reais ainda precisam ampliar a evidência. |
| Migração e cadastros-base | 15% | 14,5% | Pessoas e cadastros-base reais foram coletados; 30 PDFs foram convertidos e 100% das Pessoas/beneficiários reconciliados. Falta o dry-run transacional e a carga em homologação. |
| Termos, metas e vínculos | 15% | 14,5% | Termos, Metas e 321 Vínculos de 2026 foram coletados em dois passes idênticos; Atividades e Pessoas históricas órfãs foram preservadas. Faltam os demais anos e a aplicação em homologação. |
| Folha auditável | 20% | 20% | Processamento, memória, hash canônico, revisão, medição, aprovação do RH, fechamento e reabertura estão operacionais. O rateio multi-lote homologado possui consumo produtivo delimitado por empresa e competência, revalidação de fontes e cobertura integral antes do fechamento; permanece desligado por padrão até a homologação real. |
| Obrigação previdenciária | 15% | 14% | Segurado e patronal são apurados conforme o enquadramento congelado. Apuração parcial é recusada; revisão e hash das fontes são revalidados. Totalizador, recibo e DARF possuem máquina de estados, CSV e dossiê imprimível com fechamento monetário; falta integração oficial e homologação real. |
| Homologação, paralelo e corte | 10% | 9% | Painel real, oito gates, comparação CSV, acervo histórico, casos multi-lote, simulações, relatórios, pagamentos e retificação formal estão operacionais. Faltam executar os meses reais, treinar e efetuar o corte. |
| **Total do núcleo anterior** | **100%** | **94%** | |

## Nova frente prioritária: FGTS Digital

| Etapa | Estado | Evidência |
|---|---|---|
| Regra de elegibilidade e cálculo individual | Implementada | Categorias `101`, `103` e `721`; `701` bloqueada; truncamento por trabalhador/tipo de valor testado. |
| Contrato de integração eSocial | Implementado | Interface de provedor, eventos mínimos e máquina de estados independentes de fornecedor. |
| Persistência e auditoria | Implementada | Migração `0029`: apuração, itens S-5003, eventos eSocial e GFD oficial. |
| Pesquisa de canal oficial e alternativas | Concluída para o desenho | Web Service oficial, `erpbrasil/esociallib`, TecnoSpeed e RESocial documentados para _spike_. |
| Contrato trabalhista e rubricas eSocial | Pendente | Exige amostra real do RH e separação de prestador. |
| Folha trabalhista | Pendente | Não deve reutilizar o motor de contribuinte individual. |
| Produção restrita do eSocial | Pendente | Exige certificado/procuração e escolha provisória de adaptador. |
| Emissão, importação e pagamento da GFD | Pendente | A GFD é emitida no FGTS Digital; falta operar e reconciliar uma competência real. |

## O que já pode ser usado

- aplicação, PostgreSQL, migrações e containers com CI;
- painel inicial operacional alimentado apenas pelo PostgreSQL, com próximo bloqueio,
  histórico de competências e acessos diretos ao fechamento;
- coleta e importação idempotente de Pessoas completas, Atividades, Lotações, Termos,
  Metas e Vínculos do GIW;
- contratos normalizados e importação idempotente de Folhas históricas completas e
  guias previdenciárias, mantendo o acervo separado da Folha oficial;
- conversão de CSVs fornecidos de Folhas e guias em snapshots privados, com modelos,
  agrupamento de rubricas, SHA-256 da fonte e recusa de totais divergentes;
- inventário auditável de remessas com quantidade esperada, formatos, tamanhos,
  SHA-256 e duplicidades, mantendo os detalhes exclusivamente em `.private`;
- preflight em lote de uma pasta de PDFs, com concorrência limitada, relatório privado
  de todas as pendências e bloqueio integral antes de gerar qualquer snapshot;
- derivação deduplicada de Pessoas a partir das Folhas fornecidas, sem marcar como
  completos os campos cadastrais que não existirem no relatório;
- derivação conservadora de Eventos a partir das rubricas históricas, bloqueando
  incidências ausentes ou conflitantes em vez de presumir tratamento tributário;
- importação idempotente de Eventos, Lançamentos recorrentes e Produtividade, com
  dependências resolvidas por chave GIW e dry-run persistido para auditoria;
- sonda somente leitura e retomável para mapear Eventos, Lançamentos,
  Produtividade, Folhas e GPS no Webrun;
- painel `/migracoes` com cobertura das chaves legadas, comparação por pessoa e
  competência e dossiê CSV;
- ficha de Pessoa com identificação civil/profissional, contatos, endereço, conta
  bancária e dependentes relevantes para IRRF e salário-família;
- cadastro persistente de Pessoas, Atividades, Lotações e Prestadores;
- cadastro persistente de Termos e Metas, com vigência, orçamento e dependências protegidas;
- cadastro persistente de Vínculos, ligando toda a cadeia e bloqueando vigências sobrepostas;
- medição mensal por percentual, quantidade × valor unitário ou valor explícito, com
  evidência, responsável, proteção após fechamento e bloqueio quando obrigatória;
- cadastro persistente de Eventos/Rubricas e lançamentos recorrentes, com incidências,
  vigência e proteção contra sobreposição;
- pool PostgreSQL único com limites configuráveis, fila de processamento idempotente,
  auditoria automática e imutabilidade de Folha fechada;
- worker isolado com reserva concorrente, retentativa e handler de validação fiscal;
- scripts operacionais de backup com checksum e restauração em banco temporário;
- regras iniciais de INSS e IRRF de 2026 com testes;
- parâmetros fiscais de 2026 persistidos por vigência, com hash verificado e tela
  conectada ao PostgreSQL;
- criação de Folha por Termo, Meta e competência, com enfileiramento idempotente;
- processamento transacional de retribuição e Eventos recorrentes pelo worker;
- memória individual em centavos, snapshots cadastrais e linhas de cálculo persistidas;
- cadastro mensal de remuneração, base e contribuição em outras fontes, com identificação
  do comprovante e uso no teto do INSS somente após conferência;
- pré-validação anterior à criação da Folha para categoria eSocial, NIT e comprovantes
  previdenciários pendentes;
- revisão, reprocessamento, hash SHA-256, fechamento imutável e reabertura justificada;
- decisão imutável do RH por revisão e hash, com checklist de cadastros, valores e
  rubricas; o fechamento é bloqueado sem aprovação válida;
- telas de listagem e conferência conectadas ao PostgreSQL, com memória JSON para
  auditoria técnica e relatório CSV determinístico para revisão operacional do RH;
- relatório A4 da Folha com resumo, uma página por prestador, rubricas, bases, hashes,
  rateio consolidado e blocos de assinatura;
- relação interna de pagamentos A4 e CSV com total em centavos, conta congelada no
  hash, pendências tipadas e liberação somente para Folha fechada sem dados incompletos;
- importação de referência do GIW/RH na Folha, com comparação de proventos, INSS,
  IRRF, descontos e líquido por matrícula, diferenças explícitas, idempotência e
  evidência imutável por revisão e hash;
- resumo fiscal de bases de INSS/IRRF e agregação de rubricas por natureza, incidência,
  ocorrência e valor;
- trava transacional que impede calcular a mesma pessoa em Folhas separadas da
  competência antes da implementação do agregado mensal e do rateio determinístico;
- diagnóstico por competência das pessoas multi-lote, com Termos, Metas, medições,
  Folhas, valores e outras fontes; cada conjunto pode ser congelado por hash e
  decidido pelo RH com responsável, justificativa, histórico e exportação;
- invalidação automática da decisão mensal quando valor, medição, Folha, Vínculo ou
  base comprovada em outra fonte muda; versões antigas permanecem consultáveis;
- motor mensal por Pessoa que soma bases, aplica teto, outras fontes e dependentes uma
  única vez e rateia INSS/IRRF por maior resto sem perder centavos;
- simulações fiscais persistentes com snapshots, hashes de fontes/regra/enquadramento/
  resultado, máquina de estados, decisões terminais imutáveis e exportação CSV;
- consumo produtivo do rateio multi-vínculo, desativado por padrão e delimitado por
  empresa e competência, que revalida simulação, fontes, regras, enquadramento e
  composição dos Vínculos antes de alterar somente as parcelas fiscais;
- fechamento que exige todas as Folhas da Pessoa e o mesmo ID/hash de simulação
  homologada registrado em cada memória;
- homologação da competência integrando medições, consolidação, Folhas, aprovação do
  RH, paralelo GIW, pagamentos, obrigação e documentos DCTFWeb/DARF em uma versão por hash;
- campanha móvel de três competências, aprovação final auditada, invalidação de versão
  obsoleta e dossiê CSV com uma linha por controle;
- apuração previdenciária persistente da parcela dos segurados a partir de Folhas
  fechadas, com vínculo ao item, hash de origem e bloqueio explícito de emissão;
- enquadramento previdenciário versionado da organização: regime geral (segurado 11%,
  patronal 20%) ou beneficente em gozo da imunidade (segurado 20%, patronal zero),
  exigindo CEBAS e evidência cobrindo toda a vigência;
- reconciliação de totalizador, recibo e DARF da DCTFWeb com valor, protocolo,
  localizador, hash SHA-256 e confirmação de conferência;
- apuração recusada enquanto houver Folha pendente e revalidação de revisão/hash,
  Folhas novas ou reabertas antes de aceitar qualquer documento verificado;
- espelho previdenciário CSV por item, com fonte, Termo, Meta, prestador, base,
  alíquota, valor, totais e evidências documentais;
- dossiê previdenciário imprimível que valida itens contra principal e acréscimos
  contra total, exigindo totalizador, recibo e DARF para qualquer estado emitido;
- cancelamento de Folha aberta/na fila com interrupção de tarefa pendente; reabertura
  invalida obrigações e documentos não emitidos, enquanto fontes já emitidas são
  protegidas;
- cancelamento terminal de obrigação ainda não emitida, mantendo itens e totais como
  evidência auditável;
- retificação de obrigação emitida com snapshot integral anterior, SHA-256, versão,
  responsável, protocolo, reapuração e conclusão somente após novo DARF conciliado;
- diagnóstico de duplicidade da obrigação previdenciária do legado;
- documentação de implantação, modelo relacional e evidências.

## Caminho crítico restante

1. Aplicar a migração `0034` em PostgreSQL descartável e comprovar as travas de soma,
   segregação e imutabilidade do demonstrativo.
2. Montar uma competência de Camamu com pagamentos PF, PJ, retenções e guias e obter
   a classificação das pendências com o RH/contabilidade.
3. Homologar as fórmulas de produtividade/proporcionalização com contratos e RH.
4. Executar as simulações mensais sobre três competências reais e homologar agregado,
   rateio, Folhas e obrigação por Pessoa.
5. Ativar o consumo produtivo apenas para a empresa e a competência aprovadas, ensaiar
   fechamento, reabertura e regressão e então avançar a competência inicial.
6. Disponibilizar a homologação PostgreSQL descartável, aplicar a migração `0030`,
   importar Pessoas/cadastros/instrumentos e os 30 snapshots reconciliados em dry-run,
   repetir com aplicação e comprovar idempotência.
7. Homologar o enquadramento real da entidade e reconciliar com eSocial/DCTFWeb reais.
8. Três competências reais em paralelo, com diferenças explicadas.
9. Backup/restauração, acesso, auditoria e corte controlado do GIW.

## Como o percentual será atualizado

O valor deve ser revisto ao concluir cada incremento. Código sem validação no banco ou
fluxo apenas visual não recebe o peso completo. Descobertas que revelem escopo obrigatório
adicional podem alterar os pesos, mantendo sempre o total em 100%.
