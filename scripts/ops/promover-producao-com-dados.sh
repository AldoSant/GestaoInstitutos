#!/usr/bin/env sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
GIW_PRIVATE_DIR=${GIW_PRIVATE_DIR:-/home/codex-giw/gestao-institutos/.private/importacoes/giw}
BACKUP_DIR=${BACKUP_DIR:-/srv/backups/gestao-institutos}
REPORT_DIR=${REPORT_DIR:-"$PROJECT_DIR/.private/relatorios"}
EXPECTED_COMMIT=${EXPECTED_COMMIT:-}
COMPOSE_FILES="-f compose.yaml -f compose.vps.yaml"
COLLECTION_DIR=/importacao-giw/coleta-real/2026-07-29-real-bb629174
HISTORY_DIR=/importacao-giw/pdf-historico-reconciliado-v1

cd "$PROJECT_DIR"

for command in docker git curl; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Comando obrigatório ausente: $command" >&2
    exit 2
  }
done

test -f .env || {
  echo "O arquivo .env de produção não foi encontrado em $PROJECT_DIR." >&2
  exit 2
}
test -d "$GIW_PRIVATE_DIR/coleta-real/2026-07-29-real-bb629174" || {
  echo "Coleta real não encontrada em $GIW_PRIVATE_DIR." >&2
  exit 2
}
test -d "$GIW_PRIVATE_DIR/pdf-historico-reconciliado-v1" || {
  echo "Snapshots históricos não encontrados em $GIW_PRIVATE_DIR." >&2
  exit 2
}

CURRENT_COMMIT=$(git rev-parse HEAD)
if [ -n "$EXPECTED_COMMIT" ] && [ "$CURRENT_COMMIT" != "$EXPECTED_COMMIT" ]; then
  echo "Commit atual $CURRENT_COMMIT difere de EXPECTED_COMMIT=$EXPECTED_COMMIT." >&2
  exit 2
fi
APP_COMMIT_SHA=$(git rev-parse --short=12 HEAD)
export APP_COMMIT_SHA

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"
chmod 700 "$BACKUP_DIR" "$REPORT_DIR"

echo "1/8: construindo imagens do commit $APP_COMMIT_SHA."
docker compose $COMPOSE_FILES build migrate web worker

echo "2/8: criando e validando backup antes de alterar o banco."
BACKUP_DIR="$BACKUP_DIR" ./scripts/ops/backup-postgres.sh

echo "3/8: aplicando migrations e regras fiscais."
docker compose $COMPOSE_FILES run --rm migrate
docker compose $COMPOSE_FILES run --rm migrate npm run db:bootstrap:regras

if [ -z "${EMPRESA_ID:-}" ]; then
  EMPRESA_ID=$(
    docker compose $COMPOSE_FILES exec -T database \
      psql -U instituto -d instituto_folha -Atc \
      "select id from empresa where ativo = true order by criado_em"
  )
fi
case "$EMPRESA_ID" in
  *'
'*|"")
    echo "Informe EMPRESA_ID: a produção não possui exatamente uma empresa ativa." >&2
    exit 2
    ;;
esac
export EMPRESA_ID

importar_lote() {
  docker compose $COMPOSE_FILES run --rm \
    -v "$GIW_PRIVATE_DIR:/importacao-giw:ro" \
    migrate npm run giw:importar:lote -- \
    --arquivo "$COLLECTION_DIR/pessoas.json" \
    --arquivo "$COLLECTION_DIR/pessoas-historicas-v1.json" \
    --arquivo "$COLLECTION_DIR/atividades.json" \
    --arquivo "$COLLECTION_DIR/atividades-historicas-v2.json" \
    --arquivo "$COLLECTION_DIR/lotacoes.json" \
    --arquivo "$COLLECTION_DIR/termos-v6.json" \
    --arquivo "$COLLECTION_DIR/vinculos-v6.json" \
    --arquivo "$COLLECTION_DIR/eventos.json" \
    --diretorio "$HISTORY_DIR" \
    --empresa-id "$EMPRESA_ID" "$@"
}

echo "4/8: importando os 38 snapshots reais na produção."
importar_lote --aplicar --confirmed-complete

echo "5/8: comprovando idempotência após a aplicação."
importar_lote

REPORT_FILE="$REPORT_DIR/auditoria-producao-$APP_COMMIT_SHA.json"
echo "6/8: auditando chaves, referências e totais financeiros."
docker compose $COMPOSE_FILES run --rm \
  -v "$GIW_PRIVATE_DIR:/importacao-giw:ro" \
  -v "$REPORT_DIR:/relatorios" \
  migrate npm run giw:auditar:migracao -- \
  --arquivo "$COLLECTION_DIR/pessoas.json" \
  --arquivo "$COLLECTION_DIR/pessoas-historicas-v1.json" \
  --arquivo "$COLLECTION_DIR/atividades.json" \
  --arquivo "$COLLECTION_DIR/atividades-historicas-v2.json" \
  --arquivo "$COLLECTION_DIR/lotacoes.json" \
  --arquivo "$COLLECTION_DIR/termos-v6.json" \
  --arquivo "$COLLECTION_DIR/vinculos-v6.json" \
  --arquivo "$COLLECTION_DIR/eventos.json" \
  --diretorio "$HISTORY_DIR" \
  --empresa-id "$EMPRESA_ID" \
  --relatorio "/relatorios/$(basename "$REPORT_FILE")"
chmod 600 "$REPORT_FILE"

echo "7/8: publicando web e worker com a revisão auditada."
docker compose $COMPOSE_FILES up -d --no-build
docker compose $COMPOSE_FILES ps

echo "8/8: validando o serviço publicado."
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3001/gestao-institutos/api/health}
HEALTH=$(curl --fail --silent --show-error "$HEALTH_URL")
case "$HEALTH" in
  *'"status":"ok"'*'"database":"ok"'*'"revision":"'"$APP_COMMIT_SHA"'"'*)
    ;;
  *)
    echo "Health check não confirmou banco e revisão: $HEALTH" >&2
    exit 2
    ;;
esac

echo "$HEALTH"
echo "PROMOÇÃO APROVADA: dados reais online no commit $APP_COMMIT_SHA."
echo "Relatório: $REPORT_FILE"
