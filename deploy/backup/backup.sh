#!/bin/sh
# pg_dump (custom format) → verify it is readable → upload. Retention is a bucket lifecycle rule (docs/DEPLOY.md).
set -eu

: "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_BUCKET:?}" "${BACKUP_S3_ACCESS_KEY_ID:?}" "${BACKUP_S3_SECRET_ACCESS_KEY:?}" "${POSTGRES_PASSWORD:?}"
export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY" AWS_REGION=auto
# Recent aws-cli adds CRC checksums that R2 and B2 reject
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
export PGPASSWORD="$POSTGRES_PASSWORD"

ping() { [ -n "${BACKUP_PING_URL:-}" ] && wget -qO /dev/null -T 10 "$BACKUP_PING_URL$1" || true; }

stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="/tmp/heyreply-$stamp.dump"
key="${BACKUP_S3_PREFIX:-heyreply}/heyreply-$stamp.dump"
trap 'rc=$?; rm -f "$file"; [ "$rc" -eq 0 ] || { echo "backup FAILED (exit $rc)"; ping /fail; }' EXIT

ping /start
pg_dump -h "${PGHOST:-postgres}" -U heyreply -d heyreply -Fc -f "$file"
pg_restore -l "$file" >/dev/null
aws s3 cp "$file" "s3://$BACKUP_S3_BUCKET/$key" --endpoint-url "$BACKUP_S3_ENDPOINT" --only-show-errors
echo "backup ok: $key ($(wc -c <"$file") bytes)"
ping ""
