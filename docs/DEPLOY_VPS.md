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
- `ADMIN_LOGIN`: identificador do administrador temporário;
- `ADMIN_PASSWORD`: senha com ao menos 12 caracteres;
- `AUTH_SECRET`: pelo menos 32 bytes aleatórios;
- `APP_COMMIT_SHA`: revisão publicada, obtida por `git rev-parse --short=12 HEAD`;
- `EMPRESA_ATIVA_ID`: UUID da organização a operar, obrigatório quando o banco
  tiver mais de uma organização ativa;
- demais variáveis conforme o ambiente.

Mantenha `FOLHA_CONSOLIDADA_PRODUTIVA=false` até a homologação real do rateio
multi-vínculo. A configuração é compartilhada pelos serviços web e worker.

O `.env` nunca deve ser versionado.

## Subida

Na VPS que publica a aplicação em `/gestao-institutos`, use sempre os dois arquivos
Compose. O overlay mantém o PostgreSQL somente na rede Docker e publica a aplicação
apenas em `127.0.0.1:3001`, para consumo do proxy reverso:

```bash
export APP_COMMIT_SHA="$(git rev-parse --short=12 HEAD)"
docker compose -f compose.yaml -f compose.vps.yaml pull
docker compose -f compose.yaml -f compose.vps.yaml up -d --build
docker compose -f compose.yaml -f compose.vps.yaml ps
```

A porta do PostgreSQL está vinculada a `127.0.0.1` no Compose. Não publique a porta 5432 na internet.
O serviço `worker` não publica portas e usa no máximo duas conexões PostgreSQL. Para
validar o caminho fila → worker → regra fiscal depois da implantação:

```bash
docker compose run --rm worker npm run worker:validar-regra -- 2026-06
docker compose logs --since 5m worker
```

A tarefa deve terminar como `CONCLUIDA`. O worker também registra
`PROCESSAR_FOLHA`; esse handler valida empresa e revisão antes de materializar a memória
em uma única transação.

### Ativação controlada do rateio multi-vínculo

Depois da aprovação formal da competência e somente para a organização homologada:

```dotenv
FOLHA_CONSOLIDADA_PRODUTIVA=true
FOLHA_CONSOLIDADA_EMPRESA_ID=UUID-REAL-DA-EMPRESA
FOLHA_CONSOLIDADA_INICIO=AAAA-MM
```

Confirme o UUID no PostgreSQL, não o digite por aproximação:

```bash
docker compose exec database psql -U instituto -d instituto_folha \
  -c "select id, cnpj, razao_social from empresa where ativa order by razao_social;"
```

Antes de reiniciar, confirme na aplicação que todos os casos multi-vínculo da
competência estão resolvidos e que as simulações correspondentes estão homologadas.
Depois:

```bash
docker compose up -d --force-recreate web worker
docker compose logs --since 5m web worker
```

Faça a primeira Folha em uma competência de homologação. O servidor recusará fontes
obsoletas, Vínculos diferentes da simulação, proventos alterados e fechamento sem todas
as Folhas da Pessoa. Para interromper novas operações multi-vínculo, restaure
`FOLHA_CONSOLIDADA_PRODUTIVA=false` e recrie web e worker. Folhas fechadas não são
reescritas.

## Migrações

Antes do primeiro uso e de atualizações com mudança de schema, faça backup e aplique as migrações a partir de um checkout confiável:

Com Docker Compose, use o alvo de migração incluído no projeto:

```bash
docker compose build migrate
docker compose run --rm migrate
docker compose run --rm migrate npm run db:bootstrap:regras
```

Após aplicar as migrações `0015_payroll-processing`,
`0016_other-source-contributions`, `0017_social-security-assessment`,
`0018_social-security-profile`, `0019_dctfweb-reconciliation`,
`0020_payroll-hr-review`, `0021_monthly-measurements`,
`0022_payroll-reconciliation`, `0023_obligation-source-integrity`,
`0024_monthly-consolidation-cases` e `0025_monthly-homologation`, confirme no log
do worker que
`PROCESSAR_FOLHA` aparece entre os tipos registrados. Antes da primeira Folha real,
crie um lote de homologação, aguarde “Em conferência”, exporte a memória, registre uma
aprovação sintética do RH, importe o CSV de referência em **Homologação paralela** e
teste o fechamento. Se o Vínculo exigir medição, registre-a
em `/medicoes` antes de criar a Folha. As fórmulas de produtividade e
proporcionalização ainda exigem homologação contratual.

A migração `0023` preenche revisão e hash das Folhas já ligadas a obrigações. Ela
interrompe a atualização se encontrar uma fonte antiga sem hash, evitando publicar
uma integridade apenas aparente. Nesse caso, preserve o backup, identifique a Folha
afetada e reapure a competência em ambiente controlado antes de repetir a migração.

A migração `0024` cria os casos mensais e os espelhos imutáveis usados por
`/conferencia-entre-folhas`. Após aplicá-la, abra uma competência multi-lote, use **Congelar
diagnóstico atual**, registre um caso em análise e confirme que a exportação CSV contém
o hash e o estado. Alterar uma medição ou Folha e congelar novamente deve invalidar a
versão anterior.

A migração `0025` cria o dossiê de homologação e seus sete itens imutáveis. Depois de
aplicá-la, acesse `/fechamento-mensal`, escolha uma competência sintética, congele o
diagnóstico e exporte o CSV. Tentar aprovar com qualquer controle pendente deve ser
recusado pelo servidor. O teste de restauração agora exige ao menos 39 tabelas públicas.

Em uma instalação sem Docker, a alternativa é `npm ci` seguido de
`npm run db:migrate` com `DATABASE_URL` configurada.

Depois das migrações, conclua o onboarding em `/configuracao-inicial`. O bootstrap
abaixo é adequado somente quando o contador confirmou expressamente o regime geral:

```bash
npm run db:bootstrap:enquadramento -- \
  --regime EMPRESA_GERAL \
  --evidencia "Documento, data e responsável pela conferência"
```

Não use `BENEFICENTE_IMUNE` sem CEBAS válido cobrindo toda a vigência.

Em produção madura, a migração deve ser uma etapa única e controlada do pipeline, não executada simultaneamente por várias réplicas.

## Proxy e HTTPS

Na configuração padrão, encaminhe o domínio para `127.0.0.1:3000`. Com
`compose.vps.yaml`, encaminhe exclusivamente o caminho `/gestao-institutos` para
`127.0.0.1:3001`. Habilite HTTPS, redirecionamento de HTTP e limites de tamanho/tempo
adequados. Não exponha diretamente o contêiner de aplicação sem proxy e firewall.

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
export APP_COMMIT_SHA="$(git rev-parse --short=12 HEAD)"
docker compose -f compose.yaml -f compose.vps.yaml build migrate web worker
docker compose -f compose.yaml -f compose.vps.yaml run --rm migrate
docker compose -f compose.yaml -f compose.vps.yaml run --rm migrate npm run db:bootstrap:regras
docker compose -f compose.yaml -f compose.vps.yaml up -d --build
```

Para promover o commit aprovado junto com os 38 snapshots reais já armazenados na
conta isolada, o administrador pode executar a operação completa e bloqueante:

```bash
EXPECTED_COMMIT="$(git rev-parse HEAD)" \
  ./scripts/ops/promover-producao-com-dados.sh
```

O script exige o `.env` de produção, cria e valida um backup, aplica migrations e
regras, resolve a única empresa ativa, importa o lote real, comprova idempotência,
emite a auditoria privada, publica `web` e `worker` e confere a revisão no endpoint de
saúde. Se houver mais de uma empresa ativa, informe explicitamente `EMPRESA_ID`.
`GIW_PRIVATE_DIR`, `BACKUP_DIR`, `REPORT_DIR` e `HEALTH_URL` podem ser sobrescritos
sem alterar o código. Os snapshots continuam fora do Git e são montados somente para
leitura dentro do container de migração.

Valide `/api/health`, logs, login e uma consulta de leitura após a atualização. O
endpoint de saúde agora devolve HTTP 503 quando não consegue consultar o PostgreSQL;
uma resposta HTTP 200 confirma aplicação e banco acessíveis. Compare também o campo
`revision` da resposta com `git rev-parse --short=12 HEAD`; `unknown` significa que o
procedimento de publicação não registrou a revisão e deve ser corrigido.

## Antes de ampliar o acesso além da equipe interna

- implementar autenticação e autorização reais;
- configurar política de logs sem dados pessoais;
- revisar firewall, SSH, atualizações e usuários da VPS;
- configurar monitoramento e alertas;
- testar backup/restauração;
- formalizar encarregado, acessos e resposta a incidentes;
- concluir homologação contábil e fiscal.
