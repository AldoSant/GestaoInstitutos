# Gestão Institutos

[![CI](https://github.com/AldoSant/GestaoInstitutos/actions/workflows/ci.yml/badge.svg)](https://github.com/AldoSant/GestaoInstitutos/actions/workflows/ci.yml)

Substituição incremental de um sistema legado de gestão de institutos, começando por **folha de prestadores** e **apuração previdenciária auditável**.

O projeto nasceu de engenharia reversa autorizada do comportamento do sistema atual. O objetivo não é copiar defeitos ou limitações técnicas: cada regra deve ser confirmada por dados, documento, norma e teste automatizado.

## Estado atual

Este primeiro incremento contém:

- painel das três competências analisadas;
- folhas, parâmetros e obrigações em dados demonstrativos;
- motor inicial de INSS e IRRF de 2026;
- parâmetros fiscais de 2026 conferidos em fontes oficiais e documentados;
- memória individual anonimizada;
- bloqueio da divergência previdenciária identificada no legado;
- modelo PostgreSQL com 50 tabelas, integridade relacional e trilha de importação;
- coletores e importadores idempotentes de Pessoas completas, Atividades, Lotações,
  Termos, Metas e Vínculos do GIW;
- contratos e importadores de Eventos, Lançamentos, Produtividade, Folhas históricas e
  guias, com dry-run auditável e dependências resolvidas por chave legada;
- conversores de CSVs fornecidos de Folhas e guias para snapshots históricos privados,
  com agrupamento por rubrica, validação de fechamento, SHA-256 da fonte e derivação
  deduplicada de Pessoas e Eventos para evitar recadastro manual;
- migração da ficha civil/profissional, contatos, endereço, conta bancária e dependentes
  da Pessoa, sem colocar snapshots reais no Git;
- cadastro persistente de Pessoas, Atividades e Lotações, com busca, edição e
  inativação sem exclusão física;
- cadastro persistente de Prestadores ligado obrigatoriamente a Pessoas;
- contribuições em outras fontes por competência, com comprovante verificável e
  abatimento controlado do teto previdenciário;
- apuração persistente e rastreável das retenções previdenciárias dos segurados a
  partir de Folhas fechadas, com emissão bloqueada até a conciliação completa;
- espelho CSV previdenciário com Folha, revisão, hash, base, alíquota, valor e
  documentos; apuração parcial e fontes alteradas são recusadas;
- relatório A4 da Folha com resumo, demonstrativo individual por prestador, rubricas,
  hashes, rateio homologado e assinaturas, pronto para impressão ou PDF;
- relação interna de pagamentos A4 e CSV, usando a conta congelada no hash da Folha e
  bloqueando a liberação enquanto a Folha estiver aberta ou houver dado bancário incompleto;
- dossiê previdenciário imprimível que reconcilia itens, principal, acréscimos e a
  cadeia totalizador–recibo–DARF sem se apresentar como guia oficial;
- enquadramento versionado da cota patronal e da alíquota do segurado, sem presumir
  imunidade pelo nome ou pela natureza sem fins lucrativos;
- conciliação documental de totalizador, recibo e DARF da DCTFWeb;
- cadastro persistente de Termos e Metas, com vigência, valores e proteção de
  dependências ativas;
- cadastro persistente de Vínculos, com contrato, vigência, retribuição, carga horária
  e incidências de INSS/IRRF;
- medições mensais por percentual, quantidade × valor unitário ou valor explícito,
  com evidência, conferência e bloqueio quando obrigatórias;
- homologação paralela por CSV contra GIW ou planilha do RH, com comparação por
  matrícula e cinco totais em centavos, hashes, idempotência e histórico imutável;
- bloqueio transacional da mesma pessoa em Folhas separadas da competência enquanto
  o rateio fiscal multi-lote não estiver homologado;
- diagnóstico mensal de pessoas multi-lote, com casos versionados por hash, fontes
  congeladas, decisão auditada do RH, invalidação automática e exportação CSV;
- simulação fiscal consolidada por Pessoa e competência, com INSS/IRRF agregados,
  rateio determinístico por maior resto, fontes imutáveis, quatro hashes, estados de
  homologação e espelho CSV; o consumo produtivo exige três configurações explícitas,
  uma simulação homologada ainda atual e a cobertura de todas as Folhas da Pessoa;
- painel inicial totalmente conectado ao PostgreSQL, sem números demonstrativos;
- homologação mensal com oito controles integrados, incluindo prontidão bancária, aprovação
  auditada, dossiê CSV e campanha de três competências para execução paralela;
- retificação formal de obrigação emitida, congelando o original completo por SHA-256
  antes de reabrir fontes, reapurar e registrar novos documentos;
- fundação do módulo FGTS com bloqueio explícito da categoria `701`, cálculo
  individual truncado para os cenários iniciais `101`, `103` e `721`, contrato de
  provedor eSocial substituível e tela de prontidão `/fgts`;
- decisão documentada de não fabricar uma guia paralela: a GFD pagável continua sendo
  emitida no FGTS Digital após as remunerações aceitas pelo eSocial;
- cancelamento auditado de Folhas e obrigações, com tarefas interrompidas, estados
  terminais e invalidação automática das evidências afetadas;
- cadastro persistente de Eventos/Rubricas e lançamentos recorrentes por Vínculo e
  competência, com validação de natureza, incidências, vigência e sobreposição;
- migrações Drizzle versionadas até `0029_fgts-digital-foundation`;
- autenticação de administrador único com credenciais exclusivas do ambiente,
  sessão assinada e proteção centralizada das rotas;
- Dockerfile e Compose para implantação própria;
- testes automatizados e pipeline de integração contínua.

Os módulos `/cadastros`, `/prestadores`, `/termos-e-metas`, `/vinculos`, `/medicoes`,
`/eventos`, `/folhas`, `/conferencia-entre-folhas`,
`/conferencia-entre-folhas/simulacoes`, `/fechamento-mensal`, `/migracoes`,
`/fgts`, `/obrigacoes` e `/parametros`
usam PostgreSQL. A autenticação não consulta nem armazena credenciais nesse banco;
ela usa o administrador único configurado no servidor. Nenhuma obrigação é
transmitida. Consulte o
[andamento ponderado do MVP](docs/ANDAMENTO.md).

O alvo trabalhista/FGTS foi separado do fluxo já maduro de prestadores e ainda exige
contratos de empregados, incidências de rubricas, transmissão e homologação real.
Consulte [a decisão do FGTS Digital](docs/FGTS_DIGITAL.md).

## Começando

Requisitos: Node.js 22+ e npm.

```bash
git clone https://github.com/AldoSant/GestaoInstitutos.git
cd GestaoInstitutos
npm install
npm run dev
```

Abra `http://localhost:3000`.

### Testes e build

```bash
npm run validate
npm audit
```

Sem `DATABASE_URL`, o teste de integração PostgreSQL é marcado como ignorado. No CI,
um PostgreSQL 16 real recebe todas as migrações e executa os testes de restrições.

### Banco e migrações

Copie `.env.example` para `.env`, ajuste a conexão e execute:

```bash
npm run db:generate
npm run db:migrate
```

Nunca envie o arquivo `.env` ao Git. Defina `ADMIN_LOGIN`, `ADMIN_PASSWORD` e um
`AUTH_SECRET` aleatório com pelo menos 32 bytes. Essas variáveis são obrigatórias
para autenticar e assinar a sessão; não reutilize senhas do banco.

### Docker

```bash
docker compose up --build
```

Antes de usar em servidor, defina valores fortes e exclusivos para
`POSTGRES_PASSWORD`, `ADMIN_PASSWORD` e `AUTH_SECRET`, além de `ADMIN_LOGIN`.

## Documentação

- [Índice da documentação](docs/README.md)
- [Arquitetura](docs/ARQUITETURA.md)
- [Modelo de dados](docs/MODELO_DE_DADOS.md)
- [Engenharia reversa e critérios de evidência](docs/ENGENHARIA_REVERSA.md)
- [Importação automatizada do GIW](docs/IMPORTACAO_GIW.md)
- [Migração histórica de Folhas e guias](docs/MIGRACAO_HISTORICA.md)
- [Regras fiscais confirmadas para 2026](docs/REGRAS_FISCAIS_2026.md)
- [Biblioteca contábil e fiscal](docs/BIBLIOTECA_CONTABIL_FISCAL.md)
- [Medições e homologação do RH](docs/MEDICOES_E_HOMOLOGACAO.md)
- [Homologação paralela da Folha](docs/HOMOLOGACAO_FOLHA.md)
- [Homologação mensal e execução paralela](docs/HOMOLOGACAO_MENSAL.md)
- [Consolidação mensal por pessoa](docs/CONSOLIDACAO_MENSAL.md)
- [Simulação fiscal consolidada](docs/SIMULACAO_FISCAL_CONSOLIDADA.md)
- [Obrigação previdenciária e conciliação](docs/OBRIGACAO_PREVIDENCIARIA.md)
- [Relatórios operacionais](docs/RELATORIOS_OPERACIONAIS.md)
- [Relação interna de pagamentos](docs/RELACAO_PAGAMENTOS.md)
- [Cancelamentos e retificações](docs/CANCELAMENTOS_E_RETIFICACOES.md)
- [Roadmap](docs/ROADMAP.md)
- [Andamento do MVP](docs/ANDAMENTO.md)
- [Implantação em VPS](docs/DEPLOY_VPS.md)
- [Como contribuir](CONTRIBUTING.md)
- [Política de segurança](SECURITY.md)

As referências completas da análise, UML e SQL proposto estão em [`docs/referencia`](docs/referencia/).

## Princípios do projeto

1. Folha fechada é imutável; correções são auditadas.
2. Toda regra fiscal tem versão, vigência e fonte.
3. Todo total precisa ser explicável até o evento de origem.
4. Conciliação mensal ocorre por pessoa, inclusive em múltiplos vínculos.
5. Divergência bloqueia emissão; não é arredondada ou ocultada.
6. Nenhum dado pessoal real entra em desenvolvimento sem anonimização.
7. Regras observadas no legado só viram requisitos depois de validadas.

## Stack

- Next.js 16 e React 19;
- TypeScript;
- PostgreSQL 16;
- Drizzle ORM/Kit;
- testes nativos do Node executados por TSX;
- Docker e Docker Compose.

## Licenciamento

Nenhuma licença aberta foi definida até o momento. Consulte o proprietário do repositório antes de reutilizar ou redistribuir o código fora deste projeto.
