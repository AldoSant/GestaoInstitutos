# Andamento do MVP

## Visão geral

**Estimativa do núcleo anterior, folha de prestadores + obrigação previdenciária:
93% concluído.**

> Em 28/07/2026 o alvo do MVP foi ampliado para incluir folha trabalhista,
> transmissão ao eSocial e GFD oficial. Os 93% não representam esse novo alvo. O
> percentual total será recalibrado depois de classificar uma Folha/GFD real, pois
> prestador `701` não pode ser convertido silenciosamente em empregado com FGTS.
> A fundação técnica do novo módulo já está implementada e testada.

O percentual mede capacidade operacional validada, e não quantidade de telas ou linhas
de código. Uma etapa só avança quando existe persistência, validação, teste e caminho de
homologação. Interfaces demonstrativas contam apenas como descoberta de fluxo.

| Frente | Peso no MVP | Concluído | Situação |
|---|---:|---:|---|
| Plataforma, banco, deploy e CI | 15% | 14% | Pool, concorrência, auditoria, fila e worker operacional implementados; falta comprovar restauração periódica na VPS, ampliar monitoramento e identificar o usuário autenticado. |
| Descoberta, regras e modelo relacional | 10% | 8% | Fluxo principal e modelo identificados. Regime geral e imunidade beneficente agora possuem cenários distintos e versionados; contratos, CEBAS e amostras reais ainda precisam ampliar a evidência. |
| Migração e cadastros-base | 15% | 14% | Pessoas, cadastros, contratos, Eventos, Lançamentos, Produtividade e o acervo histórico de Folhas/guias possuem contratos e importação idempotente; falta executar os adaptadores contra o GIW novamente disponível. |
| Termos, metas e vínculos | 15% | 14% | Coleta/importação e CRUD da cadeia implementados; falta executar e reconciliar os dados reais de todos os anos. |
| Folha auditável | 20% | 20% | Processamento, memória, hash canônico, revisão, medição, aprovação do RH, fechamento e reabertura estão operacionais. O rateio multi-lote homologado possui consumo produtivo delimitado por empresa e competência, revalidação de fontes e cobertura integral antes do fechamento; permanece desligado por padrão até a homologação real. |
| Obrigação previdenciária | 15% | 14% | Segurado e patronal são apurados conforme o enquadramento congelado. Apuração parcial é recusada; revisão e hash das fontes são revalidados. Totalizador, recibo e DARF possuem máquina de estados, CSV e dossiê imprimível com fechamento monetário; falta integração oficial e homologação real. |
| Homologação, paralelo e corte | 10% | 9% | Painel real, oito gates, comparação CSV, acervo histórico, casos multi-lote, simulações, relatórios, pagamentos e retificação formal estão operacionais. Faltam executar os meses reais, treinar e efetuar o corte. |
| **Total** | **100%** | **93%** | |

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

1. Homologar as fórmulas de produtividade/proporcionalização com contratos e RH.
2. Executar as simulações mensais sobre três competências reais e homologar agregado,
   rateio, Folhas e obrigação por Pessoa.
3. Ativar o consumo produtivo apenas para a empresa e a competência aprovadas, ensaiar
   fechamento, reabertura e regressão e então avançar a competência inicial.
4. Revalidar os seletores históricos quando o GIW voltar, coletar Folhas/guias e
   concluir a campanha de três competências reais no painel e nos dossiês já implementados.
   Se o portal continuar fora do ar, usar os conversores CSV já disponíveis para Folhas
   e guias e obter os demais cadastros por exportação assistida.
5. Homologar o enquadramento real da entidade e reconciliar com eSocial/DCTFWeb reais.
6. Três competências reais em paralelo, com diferenças explicadas.
7. Backup/restauração, acesso, auditoria e corte controlado do GIW.

## Como o percentual será atualizado

O valor deve ser revisto ao concluir cada incremento. Código sem validação no banco ou
fluxo apenas visual não recebe o peso completo. Descobertas que revelem escopo obrigatório
adicional podem alterar os pesos, mantendo sempre o total em 100%.
