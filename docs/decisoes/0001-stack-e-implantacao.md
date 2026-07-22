# ADR 0001 — Stack e implantação própria

- Status: aceita para o MVP
- Data: 2026-07-21

## Contexto

O sistema precisa rodar localmente, ser compartilhado no GitHub e posteriormente implantado em VPS, preservando dados relacionais, memória financeira e possibilidade de evolução modular.

## Decisão

Usar:

- Next.js e TypeScript para interface e camada servidor;
- PostgreSQL como fonte de verdade;
- Drizzle para schema e migrações;
- Docker/Compose como empacotamento inicial;
- regras de cálculo em módulos determinísticos independentes da interface.

## Consequências positivas

- execução local e em VPS com o mesmo pacote;
- banco relacional adequado à cadeia da folha;
- migrações revisáveis;
- facilidade para testes e contribuição;
- possibilidade de separar serviços no futuro sem antecipar complexidade.

## Consequências e cuidados

- autenticação própria exige implementação e manutenção seguras;
- PostgreSQL precisa de backup, monitoramento e migrações controladas;
- integração governamental deve ser desacoplada e idempotente;
- uma única aplicação modular é preferida agora; microsserviços ficam adiados até existir necessidade comprovada.
