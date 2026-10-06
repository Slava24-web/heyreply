#!/bin/sh
# pg_dump (custom format) → verify it is readable → encrypt to the age public key → upload. The private key is never on this server. Retention is a bucket lifecycle rule (docs/DEPLOY.md).
set -eu

: "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_BUCKET:?}" "${BACKUP_S3_ACCESS_KEY_ID:?}" "${BACKUP_S3_SECRET_ACCESS_KEY:?}" "${POSTGRES_PASSWORD:?}" "${BACKUP_AGE_RECIPIENT:?}"
case "$BACKUP_AGE_RECIPIENT" in age1*) ;; *) echo "BACKUP_AGE_RECIPIENT must be a public age key (age1…), not a private one" >&2; exit 1 ;; esac
export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY" AWS_REGION=auto
# Recent aws-cli adds CRC checksums that R2 and B2 reject
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
export PGPASSWORD="$POSTGRES_PASSWORD"

ping() { [ -n "${BACKUP_PING_URL:-}" ] && wget -qO /dev/null -T 10 "$BACKUP_PING_URL$1" || true; }

stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="/tmp/heyreply-$stamp.dump"
key="${BACKUP_S3_PREFIX:-heyreply}/heyreply-$stamp.dump.age"
trap 'rc=$?; rm -f "$file" "$file.age"; [ "$rc" -eq 0 ] || { echo "backup FAILED (exit $rc)"; ping /fail; }' EXIT

ping /start
pg_dump -h "${PGHOST:-postgres}" -U heyreply -d heyreply -Fc -f "$file"
pg_restore -l "$file" >/dev/null
# Plaintext never leaves this container: only the encrypted copy is uploaded
age -r "$BACKUP_AGE_RECIPIENT" -o "$file.age" "$file"
rm -f "$file"
aws s3 cp "$file.age" "s3://$BACKUP_S3_BUCKET/$key" --endpoint-url "$BACKUP_S3_ENDPOINT" --only-show-errors
echo "backup ok: $key ($(wc -c <"$file.age") bytes, encrypted)"
ping ""
