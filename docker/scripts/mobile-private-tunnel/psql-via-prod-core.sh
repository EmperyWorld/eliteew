#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Run psql against prod-core stack1 Postgres from command-center without a local psql client.
# Invariants:
# - Read-only by default; callers pass explicit SQL. No secrets in argv beyond what psql already receives.
# - Targets stack1 Postgres on prod-core via SSH + podman exec only.
# Related:
# - docker/scripts/mobile-private-tunnel/render-db-peers.sh
# - documentation/product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md
# ---
set -euo pipefail

if [[ "${1:-}" == postgresql://* ]]; then
	shift
fi

HOST="${MOBILE_PRIVATE_TUNNEL_PROD_CORE_HOST:-192.168.1.111}"
PGUSER="${MOBILE_PRIVATE_TUNNEL_PGUSER:-ai_user}"
PGDATABASE="${MOBILE_PRIVATE_TUNNEL_PGDATABASE:-ai_services}"

exec ssh -o BatchMode=yes -o ConnectTimeout=15 "$HOST" \
	"podman exec -i stack1-postgres psql -U ${PGUSER} -d ${PGDATABASE} -v ON_ERROR_STOP=1 $(printf '%q ' "$@")"
