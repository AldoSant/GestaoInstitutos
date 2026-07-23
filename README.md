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
- modelo PostgreSQL inicial com 19 tabelas, incluindo trilha de importação;
- coletores e importadores idempotentes de Pessoas, Atividades e Lotações do GIW;
- cadastro persistente de Pessoas, Atividades e Lotações, com busca, edição e
  inativação sem exclusão física;
- cadastro persistente de Prestadores ligado obrigatoriamente a Pessoas;
- primeira migração Drizzle;
- Dockerfile e Compose para implantação própria;
- testes automatizados e pipeline de integração contínua.

Os módulos `/cadastros` e `/prestadores` já gravam no PostgreSQL. As demais telas de
escrita e o login ainda são demonstrativos. Nenhuma obrigação é transmitida. Consulte
o [andamento ponderado do MVP](docs/ANDAMENTO.md).

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

Nunca envie o arquivo `.env` ao Git.

### Docker

```bash
docker compose up --build
```

Antes de usar em servidor, defina valores fortes para `POSTGRES_PASSWORD` e `AUTH_SECRET`.

## Documentação

- [Índice da documentação](docs/README.md)
- [Arquitetura](docs/ARQUITETURA.md)
- [Modelo de dados](docs/MODELO_DE_DADOS.md)
- [Engenharia reversa e critérios de evidência](docs/ENGENHARIA_REVERSA.md)
- [Importação automatizada do GIW](docs/IMPORTACAO_GIW.md)
- [Regras fiscais confirmadas para 2026](docs/REGRAS_FISCAIS_2026.md)
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
