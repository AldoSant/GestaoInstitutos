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
O serviço `worker` não publica portas e usa no máximo duas conexões PostgreSQL. Para
validar o caminho fila → worker → regra fiscal depois da implantação:

```bash
docker compose run --rm worker npm run worker:validar-regra -- 2026-06
docker compose logs --since 5m worker
```

A tarefa deve terminar como `CONCLUIDA`. O único handler habilitado neste estágio valida
a regra fiscal da competência; o processamento integral da Folha será adicionado como
um tipo separado depois da materialização transacional.

## Migrações

Antes do primeiro uso e de atualizações com mudança de schema, faça backup e aplique as migrações a partir de um checkout confiável:

Com Docker Compose, use o alvo de migração incluído no projeto:

```bash
docker compose build migrate
docker compose run --rm migrate
docker compose run --rm migrate npm run db:bootstrap:regras
```

Em uma instalação sem Docker, a alternativa é `npm ci` seguido de
`npm run db:migrate` com `DATABASE_URL` configurada.

Em produção madura, a migração deve ser uma etapa única e controlada do pipeline, não executada simultaneamente por várias réplicas.

## Proxy e HTTPS

Encaminhe o domínio para `127.0.0.1:3000`. Habilite HTTPS, redirecionamento de HTTP e limites de tamanho/tempo adequados. Não exponha diretamente o contêiner de aplicação sem proxy e firewall.

## Backup mínimo

- `pg_dump` diário criptografado;
- retenção em destino diferente da VPS;
- teste periódico de restauração;
- backup antes de cada migração;
- documentação de RPO/RTO.

O repositório inclui uma rotina operacional que cria o dump em formato PostgreSQL
custom, valida o catálogo do arquivo, calcula SHA-256 e aplica retenção local:

```bash
BACKUP_DIR=/srv/backups/gestao-institutos \
BACKUP_RETENTION_DAYS=30 \
./scripts/ops/backup-postgres.sh
```

O diretório local não é proteção contra perda da VPS. Após a criação, envie o arquivo
e seu `.sha256` para armazenamento externo criptografado e monitore o sucesso da cópia.
Não considere o backup operacional até testar uma restauração:

```bash
./scripts/ops/verificar-restauracao-postgres.sh \
  /srv/backups/gestao-institutos/instituto_folha_AAAAMMDDTHHMMSSZ.dump
```

O verificador usa exclusivamente o banco temporário
`instituto_folha_restore_verify`, confere a quantidade mínima de tabelas e o remove
ao terminar. Agende o backup diário e uma restauração de teste periódica pelo
gerenciador de tarefas da VPS.

## Atualização

```bash
git pull --ff-only
docker compose build migrate web
docker compose run --rm migrate
docker compose run --rm migrate npm run db:bootstrap:regras
docker compose up -d --build
```

Valide `/api/health`, logs, login e uma consulta de leitura após a atualização. O
endpoint de saúde agora devolve HTTP 503 quando não consegue consultar o PostgreSQL;
uma resposta HTTP 200 confirma aplicação e banco acessíveis.

## Antes de ampliar o acesso além da equipe interna

- implementar autenticação e autorização reais;
- configurar política de logs sem dados pessoais;
- revisar firewall, SSH, atualizações e usuários da VPS;
- configurar monitoramento e alertas;
- testar backup/restauração;
- formalizar encarregado, acessos e resposta a incidentes;
- concluir homologação contábil e fiscal.
