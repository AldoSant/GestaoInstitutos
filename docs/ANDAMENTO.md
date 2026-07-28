# Andamento do MVP

## Visão geral

**Estimativa atual: 88% concluído.**

O percentual mede capacidade operacional validada, e não quantidade de telas ou linhas
de código. Uma etapa só avança quando existe persistência, validação, teste e caminho de
homologação. Interfaces demonstrativas contam apenas como descoberta de fluxo.

| Frente | Peso no MVP | Concluído | Situação |
|---|---:|---:|---|
| Plataforma, banco, deploy e CI | 15% | 14% | Pool, concorrência, auditoria, fila e worker operacional implementados; falta comprovar restauração periódica na VPS, ampliar monitoramento e identificar o usuário autenticado. |
| Descoberta, regras e modelo relacional | 10% | 8% | Fluxo principal e modelo identificados. Regime geral e imunidade beneficente agora possuem cenários distintos e versionados; contratos, CEBAS e amostras reais ainda precisam ampliar a evidência. |
| Migração e cadastros-base | 15% | 13% | Pessoas completas, Atividades, Lotações, Prestadores e o acervo histórico de Folhas/guias possuem contratos e importação idempotente; falta executar os adaptadores contra o GIW novamente disponível. |
| Termos, metas e vínculos | 15% | 14% | Coleta/importação e CRUD da cadeia implementados; falta executar e reconciliar os dados reais de todos os anos. |
| Folha auditável | 20% | 19% | Processamento, memória, hash, revisão, medição mensal, aprovação formal do RH, fechamento, reabertura, bases fiscais e resumo de rubricas estão operacionais. O agregado multi-lote e o rateio exato já operam em simulação versionada; a Folha permanece bloqueada até a homologação real. |
| Obrigação previdenciária | 15% | 13% | Segurado e patronal são apurados conforme o enquadramento congelado. Apuração parcial é recusada; revisão e hash das fontes são congelados e revalidados antes dos documentos. Totalizador, recibo e DARF possuem máquina de estados e espelho CSV; faltam integração oficial e homologação real. |
| Homologação, paralelo e corte | 10% | 7% | Comparação CSV, acervo histórico isolado, conciliação por pessoa/competência, casos multi-lote, simulações fiscais e dossiês estão operacionais. Faltam executar os meses reais, treinar, ensaiar retificação e efetuar o corte. |
| **Total** | **100%** | **88%** | |

## O que já pode ser usado

- aplicação, PostgreSQL, migrações e containers com CI;
- coleta e importação idempotente de Pessoas completas, Atividades, Lotações, Termos,
  Metas e Vínculos do GIW;
- contratos normalizados e importação idempotente de Folhas históricas completas e
  guias previdenciárias, mantendo o acervo separado da Folha oficial;
- sonda somente leitura e retomável para mapear Lançamentos, Folhas e GPS no Webrun;
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
- bloqueio explícito que impede até a simulação homologada de alimentar a Folha antes
  da campanha real e de uma ativação técnica separada;
- homologação da competência integrando medições, consolidação, Folhas, aprovação do
  RH, paralelo GIW, obrigação e documentos DCTFWeb/DARF em uma versão por hash;
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
- cancelamento de Folha aberta/na fila com interrupção de tarefa pendente; reabertura
  invalida obrigações e documentos não emitidos, enquanto fontes já emitidas são
  protegidas;
- cancelamento terminal de obrigação ainda não emitida, mantendo itens e totais como
  evidência auditável;
- diagnóstico de duplicidade da obrigação previdenciária do legado;
- documentação de implantação, modelo relacional e evidências.

## Caminho crítico restante

1. Executar a coleta real da cadeia contratual e reconciliar contagens por Termo e Meta.
2. Homologar as fórmulas de produtividade/proporcionalização com contratos e RH.
3. Executar as simulações mensais já implementadas sobre três competências reais,
   homologar o agregado e o rateio por Pessoa e só então projetar a ativação na Folha.
4. Revalidar os seletores históricos quando o GIW voltar, coletar Folhas/guias e
   concluir a campanha de três competências reais no painel e nos dossiês já implementados.
5. Homologar o enquadramento real da entidade e reconciliar com eSocial/DCTFWeb reais.
6. Três competências reais em paralelo, com diferenças explicadas.
7. Backup/restauração, acesso, auditoria e corte controlado do GIW.

## Como o percentual será atualizado

O valor deve ser revisto ao concluir cada incremento. Código sem validação no banco ou
fluxo apenas visual não recebe o peso completo. Descobertas que revelem escopo obrigatório
adicional podem alterar os pesos, mantendo sempre o total em 100%.
