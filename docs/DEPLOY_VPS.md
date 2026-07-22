# Implantação em VPS

Este é um roteiro inicial para homologação. Produção exige revisão de segurança, backup, monitoramento e capacidade.

## Requisitos

- VPS Linux atualizada;
- Docker Engine com plugin Compose;
- domínio apontado para a VPS;
- proxy reverso com HTTPS, como Caddy ou Nginx;
- política de backup externo para PostgreSQL.

## Preparação

```bash
git clone https://github.com/AldoSant/GestaoInstitutos.git
cd GestaoInstitutos
cp .env.example .env
```

Defina no `.env`:

- `POSTGRES_PASSWORD`: senha exclusiva e forte;
- `AUTH_SECRET`: pelo menos 32 bytes aleatórios;
- demais variáveis conforme o ambiente.

O `.env` nunca deve ser versionado.

## Subida

```bash
docker compose pull
docker compose up -d --build
docker compose ps
```

A porta do PostgreSQL está vinculada a `127.0.0.1` no Compose. Não publique a porta 5432 na internet.

## Migrações

Antes do primeiro uso e de atualizações com mudança de schema, faça backup e aplique as migrações a partir de um checkout confiável:

```bash
npm ci
npm run db:migrate
```

Em produção madura, a migração deve ser uma etapa única e controlada do pipeline, não executada simultaneamente por várias réplicas.

## Proxy e HTTPS

Encaminhe o domínio para `127.0.0.1:3000`. Habilite HTTPS, redirecionamento de HTTP e limites de tamanho/tempo adequados. Não exponha diretamente o contêiner de aplicação sem proxy e firewall.

## Backup mínimo

- `pg_dump` diário criptografado;
- retenção em destino diferente da VPS;
- teste periódico de restauração;
- backup antes de cada migração;
- documentação de RPO/RTO.

## Atualização

```bash
git pull --ff-only
npm ci
npm test
npm run build
docker compose up -d --build
```

Valide `/api/health`, logs, login e uma consulta de leitura após a atualização.

## Antes de dados reais

- implementar autenticação e autorização reais;
- configurar política de logs sem dados pessoais;
- revisar firewall, SSH, atualizações e usuários da VPS;
- configurar monitoramento e alertas;
- testar backup/restauração;
- formalizar encarregado, acessos e resposta a incidentes;
- concluir homologação contábil e fiscal.
