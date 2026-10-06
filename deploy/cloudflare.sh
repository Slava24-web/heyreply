#!/usr/bin/env bash
# Puts the stack behind Cloudflare's proxy (DDoS absorption) without losing real client IPs in the rate limits.
#   deploy/cloudflare.sh on      trust Cloudflare's X-Forwarded-For (Caddy) and count its hop (API)
#   deploy/cloudflare.sh lock    additionally drop every request that did not come through Cloudflare
#   deploy/cloudflare.sh unlock  allow direct access again (e.g. if certificate issuance fails)
#   deploy/cloudflare.sh off     back to the direct setup
# `on` and `lock` fetch Cloudflare's current ranges, so run them again from time to time to refresh.
# Afterwards apply with: docker compose -f docker-compose.prod.yml up -d
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo ".env is missing (see docs/DEPLOY.md)" >&2; exit 1; }

unset_env() {
  local tmp; tmp=$(mktemp .env.XXXXXX); chmod 600 "$tmp"
  { grep -v "^$1=" .env || true; } > "$tmp"; mv "$tmp" .env
}
set_env() {
  unset_env "$1"
  local tmp; tmp=$(mktemp .env.XXXXXX); chmod 600 "$tmp"
  { cat .env; printf '%s="%s"\n' "$1" "$2"; } > "$tmp"; mv "$tmp" .env
}
ranges() {
  local out
  out=$({ curl -fsS --max-time 15 https://www.cloudflare.com/ips-v4; echo; curl -fsS --max-time 15 https://www.cloudflare.com/ips-v6; } | grep -E '^[0-9a-fA-F:.]+/[0-9]+$' | tr '\n' ' ' | sed 's/ $//')
  # A truncated download must never turn into a lock-out
  [ "$(wc -w <<<"$out")" -ge 10 ] || { echo "could not fetch Cloudflare's IP ranges" >&2; exit 1; }
  echo "$out"
}

case "${1:-}" in
  on)
    set_env TRUSTED_PROXIES "$(ranges)"
    set_env TRUST_PROXY_HOPS 2
    echo "Cloudflare trusted. Apply: docker compose -f docker-compose.prod.yml up -d"
    echo "Then log in and check Settings → sessions: it must show YOUR address, not a Cloudflare one. Only then run: $0 lock" ;;
  lock)
    grep -q '^TRUSTED_PROXIES=' .env || { echo "run '$0 on' first" >&2; exit 1; }
    set_env ORIGIN_ALLOW "$(ranges)"
    echo "Origin locked. Apply: docker compose -f docker-compose.prod.yml up -d edge" ;;
  unlock)
    unset_env ORIGIN_ALLOW
    echo "Origin unlocked. Apply: docker compose -f docker-compose.prod.yml up -d edge" ;;
  off)
    unset_env ORIGIN_ALLOW; unset_env TRUSTED_PROXIES; unset_env TRUST_PROXY_HOPS
    echo "Direct setup restored. Apply: docker compose -f docker-compose.prod.yml up -d" ;;
  *) echo "usage: $0 on|lock|unlock|off" >&2; exit 1 ;;
esac
