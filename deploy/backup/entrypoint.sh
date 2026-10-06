#!/bin/sh
# No arguments: run crond with the backup job. With arguments: run that command (used by deploy/restore-test.sh).
set -eu
if [ "$#" -gt 0 ]; then exec "$@"; fi

: "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_BUCKET:?}" "${BACKUP_S3_ACCESS_KEY_ID:?}" "${BACKUP_S3_SECRET_ACCESS_KEY:?}" "${POSTGRES_PASSWORD:?}"

# Output goes to PID 1's stdout so it shows up in `docker compose logs backup`
echo "${BACKUP_CRON:-15 3 * * *} /usr/local/bin/backup.sh >/proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "backup schedule (UTC): ${BACKUP_CRON:-15 3 * * *}"
exec crond -f -l 8
