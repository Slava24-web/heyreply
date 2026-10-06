# Daily pg_dump, encrypted with age to a public key → S3-compatible storage (Cloudflare R2 / Backblaze B2). Same major version as the database.
FROM postgres:16.15-alpine
RUN apk add --no-cache aws-cli age
COPY backup.sh fetch-latest.sh entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/fetch-latest.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]
