# Andamento do MVP

## Visão geral

**Estimativa atual: 78% concluído.**

O percentual mede capacidade operacional validada, e não quantidade de telas ou linhas
de código. Uma etapa só avança quando existe persistência, validação, teste e caminho de
homologação. Interfaces demonstrativas contam apenas como descoberta de fluxo.

| Frente | Peso no MVP | Concluído | Situação |
|---|---:|---:|---|
| Plataforma, banco, deploy e CI | 15% | 14% | Pool, concorrência, auditoria, fila e worker operacional implementados; falta comprovar restauração periódica na VPS, ampliar monitoramento e identificar o usuário autenticado. |
| Descoberta, regras e modelo relacional | 10% | 8% | Fluxo principal e modelo identificados. Regime geral e imunidade beneficente agora possuem cenários distintos e versionados; contratos, CEBAS e amostras reais ainda precisam ampliar a evidência. |
| Migração e cadastros-base | 15% | 12% | Pessoas completas, Atividades, Lotações e Prestadores persistentes; a coleta de Pessoa inclui dados civis, contatos, endereço, conta e dependentes. |
| Termos, metas e vínculos | 15% | 14% | Coleta/importação e CRUD da cadeia implementados; falta executar e reconciliar os dados reais de todos os anos. |
| Folha auditável | 20% | 18% | Processamento, memória, hash, revisão, medição mensal, aprovação formal do RH, fechamento e reabertura auditada estão operacionais. Produtividade e proporcionalização aceitam fórmulas explícitas e evidência; falta homologação real. |
| Obrigação previdenciária | 15% | 12% | Segurado e patronal são apurados conforme o enquadramento congelado. Totalizador, recibo e DARF da DCTFWeb possuem evidência, hash e máquina de estados; divergência bloqueia e somente a sequência conciliada chega a emitida. |
| Homologação, paralelo e corte | 10% | 0% | Depende dos módulos anteriores e de três competências reais conciliadas. |
| **Total** | **100%** | **78%** | |

## O que já pode ser usado

- aplicação, PostgreSQL, migrações e containers com CI;
- coleta e importação idempotente de Pessoas completas, Atividades, Lotações, Termos,
  Metas e Vínculos do GIW;
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
- apuração previdenciária persistente da parcela dos segurados a partir de Folhas
  fechadas, com vínculo ao item, hash de origem e bloqueio explícito de emissão;
- enquadramento previdenciário versionado da organização: regime geral (segurado 11%,
  patronal 20%) ou beneficente em gozo da imunidade (segurado 20%, patronal zero),
  exigindo CEBAS e evidência cobrindo toda a vigência;
- reconciliação de totalizador, recibo e DARF da DCTFWeb com valor, protocolo,
  localizador, hash SHA-256 e confirmação de conferência;
- diagnóstico de duplicidade da obrigação previdenciária do legado;
- documentação de implantação, modelo relacional e evidências.

## Caminho crítico restante

1. Executar a coleta real da cadeia contratual e reconciliar contagens por Termo e Meta.
2. Homologar as fórmulas de produtividade/proporcionalização com contratos e RH.
3. Homologar processamento, conferência e fechamento com três competências reais.
4. Homologar o enquadramento real da entidade e reconciliar com eSocial/DCTFWeb reais.
5. Três competências reais em paralelo, com diferenças explicadas.
6. Backup/restauração, acesso, auditoria e corte controlado do GIW.

## Como o percentual será atualizado

O valor deve ser revisto ao concluir cada incremento. Código sem validação no banco ou
fluxo apenas visual não recebe o peso completo. Descobertas que revelem escopo obrigatório
adicional podem alterar os pesos, mantendo sempre o total em 100%.
