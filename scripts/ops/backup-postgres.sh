#!/usr/bin/env sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
BACKUP_DIR=${BACKUP_DIR:-"$PROJECT_DIR/.private/backups"}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
STAMP=$(date -u +"%Y%m%dT%H%M%SZ")
FINAL_FILE="$BACKUP_DIR/instituto_folha_$STAMP.dump"
TEMP_FILE="$FINAL_FILE.tmp"

case "$RETENTION_DAYS" in
  *[!0-9]*|"")
    echo "BACKUP_RETENTION_DAYS deve ser um inteiro positivo." >&2
    exit 2
    ;;
esac

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
cd "$PROJECT_DIR"

cleanup() {
  rm -f -- "$TEMP_FILE"
}
trap cleanup EXIT HUP INT TERM

docker compose exec -T database \
  pg_dump \
    --username instituto \
    --dbname instituto_folha \
    --format custom \
    --compress 9 \
    --no-owner \
    --no-acl > "$TEMP_FILE"

test -s "$TEMP_FILE"
docker compose exec -T database pg_restore --list < "$TEMP_FILE" >/dev/null
chmod 600 "$TEMP_FILE"
mv "$TEMP_FILE" "$FINAL_FILE"
sha256sum "$FINAL_FILE" > "$FINAL_FILE.sha256"
chmod 600 "$FINAL_FILE.sha256"

find "$BACKUP_DIR" -type f \
  \( -name 'instituto_folha_*.dump' -o -name 'instituto_folha_*.dump.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete

echo "$FINAL_FILE"
echo "Backup criado e estrutura validada. Copie-o para um destino externo criptografado."
