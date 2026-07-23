#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Uso: $0 caminho/backup.dump" >&2
  exit 2
fi

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
ARCHIVE=$1
VERIFY_DATABASE=instituto_folha_restore_verify

if [ ! -f "$ARCHIVE" ]; then
  echo "Backup não encontrado: $ARCHIVE" >&2
  exit 2
fi

ARCHIVE_DIR=$(CDPATH= cd -- "$(dirname -- "$ARCHIVE")" && pwd)
ARCHIVE="$ARCHIVE_DIR/$(basename -- "$ARCHIVE")"
cd "$PROJECT_DIR"

cleanup() {
  docker compose exec -T database \
    dropdb --username instituto --if-exists "$VERIFY_DATABASE" >/dev/null 2>&1 || true
}
trap cleanup EXIT HUP INT TERM

cleanup
docker compose exec -T database \
  createdb --username instituto "$VERIFY_DATABASE"
docker compose exec -T database \
  pg_restore --list < "$ARCHIVE" >/dev/null
docker compose exec -T database \
  pg_restore \
    --username instituto \
    --dbname "$VERIFY_DATABASE" \
    --exit-on-error \
    --no-owner \
    --no-acl < "$ARCHIVE"

TABLE_COUNT=$(
  docker compose exec -T database \
    psql \
      --username instituto \
      --dbname "$VERIFY_DATABASE" \
      --tuples-only \
      --no-align \
      --command \
      "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"
)

case "$TABLE_COUNT" in
  ""|*[!0-9]*)
    echo "A restauração não produziu uma contagem válida de tabelas." >&2
    exit 1
    ;;
esac

if [ "$TABLE_COUNT" -lt 26 ]; then
  echo "Restauração incompleta: apenas $TABLE_COUNT tabelas públicas." >&2
  exit 1
fi

echo "Restauração validada em banco temporário: $TABLE_COUNT tabelas públicas."
