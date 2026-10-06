#!/usr/bin/env bash
# Proves the latest off-site backup restores: downloads it, restores into a throwaway Postgres, prints row counts.
# Run on a machine with docker + the prod .env. Backups are age-encrypted, so also pass the PRIVATE key (absolute path;
# keep it off the server): AGE_IDENTITY_FILE=/abs/path/to/key.txt deploy/restore-test.sh
set -euo pipefail
cd "$(dirname "$0")/.."

compose=(docker compose -f docker-compose.prod.yml)
pg_image=postgres:16.15-alpine
name="heyreply-restore-test-$$"
work=$(mktemp -d)
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT

"${compose[@]}" run --rm --no-deps -T backup fetch-latest.sh > "$work/latest.bin"
if head -c 20 "$work/latest.bin" | grep -q '^age-encryption.org'; then
  : "${AGE_IDENTITY_FILE:?the latest backup is encrypted: set AGE_IDENTITY_FILE to the absolute path of your private age key}"
  "${compose[@]}" run --rm --no-deps -T -v "$AGE_IDENTITY_FILE:/identity:ro" backup age -d -i /identity < "$work/latest.bin" > "$work/latest.dump"
else
  mv "$work/latest.bin" "$work/latest.dump" # backup made before encryption was enabled
fi
[ -s "$work/latest.dump" ] || { echo "downloaded dump is empty" >&2; exit 1; }

docker run -d --name "$name" -e POSTGRES_PASSWORD=restore-test "$pg_image" >/dev/null
for _ in $(seq 1 30); do
  docker exec "$name" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$name" pg_isready -U postgres >/dev/null

docker exec "$name" createdb -U postgres heyreply
docker exec -i "$name" pg_restore -U postgres -d heyreply --no-owner --no-privileges --exit-on-error < "$work/latest.dump"

rows=$(docker exec "$name" psql -U postgres -d heyreply -At -F ' ' -c "
  SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
  FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1")
echo "$rows" | column -t
echo "$rows" | grep -q '^_prisma_migrations ' || { echo "restore looks wrong: _prisma_migrations missing" >&2; exit 1; }
echo "restore OK"
