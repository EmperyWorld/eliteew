#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Align active mobile_trusted_devices.wg_server_public_key with config plane canon.
# Invariants:
# - Read-only on edge; updates DB metadata only (no rebind).
# - Never prints WireGuard private keys.
# Related:
# - documentation/product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

ROOT="$(mobile_private_tunnel_repo_root "$SCRIPT_DIR")"
mobile_private_tunnel_source_env "$ROOT"

STACK0_BACKEND_ENV="${MOBILE_PRIVATE_TUNNEL_STACK0_ENV_FILE:-$ROOT/docker/env_file/.env.stack0.backend}"
if [[ -f "$STACK0_BACKEND_ENV" ]]; then
	set -a
	# shellcheck source=/dev/null
	source "$STACK0_BACKEND_ENV"
	set +a
fi

DB_URL="${MOBILE_PRIVATE_TUNNEL_DATABASE_URL:-${DATABASE_URL:-}}"
PSQL_BIN="${MOBILE_PRIVATE_TUNNEL_PSQL:-psql}"
CANON_SERVER_PUB="${MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY:-}"

if [[ -z "$DB_URL" ]]; then
	echo "Set MOBILE_PRIVATE_TUNNEL_DATABASE_URL or DATABASE_URL." >&2
	exit 1
fi
if [[ -z "$CANON_SERVER_PUB" ]]; then
	echo "Set MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY in config plane." >&2
	exit 1
fi

updated="$(
	"$PSQL_BIN" "$DB_URL" -X -qAt -c "
UPDATE public.mobile_trusted_devices
SET wg_server_public_key = btrim('${CANON_SERVER_PUB}'),
    updated_at = now()
WHERE status = 'active'
  AND (wg_server_public_key IS DISTINCT FROM btrim('${CANON_SERVER_PUB}'))
RETURNING id::text;
"
)"

count="$(printf '%s\n' "$updated" | sed '/^$/d' | wc -l | tr -d ' ')"
echo "OK: synced wg_server_public_key for ${count} active device row(s)"
