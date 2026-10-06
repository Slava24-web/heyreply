#!/usr/bin/env bash
# Run on the server: deploy/deploy.sh sha-abc1234   (tag printed by the "images" GitHub Action)
# Rollback = run it again with the previous tag (the old one is printed below).
set -euo pipefail
cd "$(dirname "$0")/.."

tag="${1:?usage: deploy/deploy.sh <image tag, e.g. sha-abc1234>}"
compose=(docker compose -f docker-compose.prod.yml)

[ -f .env ] || { echo ".env is missing (see docs/DEPLOY.md)" >&2; exit 1; }
echo "current tag: $(grep '^IMAGE_TAG=' .env | cut -d= -f2- || true)"

git pull --ff-only

# Rewrite IMAGE_TAG, keeping the file at mode 600
tmp=$(mktemp .env.XXXXXX)
chmod 600 "$tmp"
{ grep -v '^IMAGE_TAG=' .env || true; echo "IMAGE_TAG=$tag"; } > "$tmp"
mv "$tmp" .env

"${compose[@]}" pull
"${compose[@]}" up -d --remove-orphans
docker image prune -f >/dev/null
"${compose[@]}" ps
