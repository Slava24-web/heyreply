#!/bin/sh
# Prints the newest dump (still age-encrypted, decrypt with the private key) to stdout (key and age go to stderr). Fails if it is older than MAX_AGE_HOURS (default 36).
set -eu

: "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_BUCKET:?}" "${BACKUP_S3_ACCESS_KEY_ID:?}" "${BACKUP_S3_SECRET_ACCESS_KEY:?}"
export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY" AWS_REGION=auto
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required

prefix="${BACKUP_S3_PREFIX:-heyreply}"
name=$(aws s3 ls "s3://$BACKUP_S3_BUCKET/$prefix/" --endpoint-url "$BACKUP_S3_ENDPOINT" | awk '{print $4}' | grep -E '\.dump(\.age)?$' | sort | tail -n 1)
[ -n "$name" ] || { echo "no dumps found in s3://$BACKUP_S3_BUCKET/$prefix/" >&2; exit 1; }

# heyreply-20261006T031500Z.dump → 2026-10-06 03:15:00
ts=$(echo "$name" | sed -E 's/.*-([0-9]{4})([0-9]{2})([0-9]{2})T([0-9]{2})([0-9]{2})([0-9]{2})Z\.dump(\.age)?/\1-\2-\3 \4:\5:\6/')
age_h=$(( ($(date -u +%s) - $(date -u -d "$ts" +%s)) / 3600 ))
echo "latest dump: $name (${age_h}h old)" >&2
[ "$age_h" -le "${MAX_AGE_HOURS:-36}" ] || { echo "latest dump is older than ${MAX_AGE_HOURS:-36}h — backups are not running" >&2; exit 1; }

aws s3 cp "s3://$BACKUP_S3_BUCKET/$prefix/$name" - --endpoint-url "$BACKUP_S3_ENDPOINT" --only-show-errors
