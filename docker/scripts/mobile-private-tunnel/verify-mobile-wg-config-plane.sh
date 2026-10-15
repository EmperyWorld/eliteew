#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Verify mobile WG config plane role classification and pubkey/private-key pairing.
# Invariants:
# - Never prints secret values; key names and derived public key only.
# Related:
# - docker/scripts/stack0-env-materialize-roles.sh
# - documentation/product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ENV_DIR="${ELITEEW_STACK0_ENV_DIR:-$ROOT/docker/env_file}"
SSOT="${ENV_DIR}/.env.stack0.backend"

PASS=0
FAIL=0
ok() { echo "PASS: $*"; PASS=$((PASS + 1)); }
bad() { echo "FAIL: $*"; FAIL=$((FAIL + 1)); }

if [[ ! -f "$SSOT" ]]; then
	echo "FAIL: missing SSOT ${SSOT}" >&2
	exit 1
fi

bash "$ROOT/docker/scripts/stack0-env-materialize-roles.sh" --check >/dev/null

set -a
# shellcheck source=/dev/null
source "$SSOT"
set +a

CANON_PUB="${MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY:-}"
ENV_PRIV="${MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY:-}"

if [[ -z "$CANON_PUB" ]]; then
	bad "MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY missing in ${SSOT}"
else
	ok "MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY present in SSOT"
fi

if [[ -z "$ENV_PRIV" ]]; then
	bad "MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY missing in ${SSOT} (jobs slice / Celery interface restore)"
else
	ok "MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY present in SSOT"
fi

if [[ -n "$ENV_PRIV" && -n "$CANON_PUB" ]]; then
	derived_pub="$(printf '%s' "$ENV_PRIV" | wg pubkey 2>/dev/null || true)"
	if [[ -z "$derived_pub" ]]; then
		bad "MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY is not a valid WireGuard private key"
	elif [[ "$derived_pub" != "$CANON_PUB" ]]; then
		bad "private key does not derive MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY (derived=${derived_pub})"
	else
		ok "server private key derives canonical public key"
	fi
fi

API_ENV="${ENV_DIR}/.env.stack0.api"
JOBS_ENV="${ENV_DIR}/.env.stack0.jobs"
SHARED_ENV="${ENV_DIR}/.env.stack0.shared"
bash "$ROOT/docker/scripts/stack0-env-materialize-roles.sh" >/dev/null 2>&1 || true

if [[ -f "$SHARED_ENV" ]] && grep -q '^MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY=' "$SHARED_ENV"; then
	ok "MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY materialized to stack0 shared slice (API+Celery)"
else
	bad "MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY missing from .env.stack0.shared — run stack0-env-materialize-roles.sh"
fi

if [[ -f "$API_ENV" ]] && grep -q '^MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY=' "$API_ENV"; then
	bad "MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY must live in shared (not api-only) so Celery can verify expected_pub"
fi

if [[ -f "$SHARED_ENV" ]] && grep -q '^MOBILE_PRIVATE_TUNNEL_EDGE_SYNC_ENABLED=' "$SHARED_ENV"; then
	ok "MOBILE_PRIVATE_TUNNEL_EDGE_SYNC_ENABLED materialized to shared (API bind enqueue)"
else
	bad "MOBILE_PRIVATE_TUNNEL_EDGE_SYNC_ENABLED missing from .env.stack0.shared — API cannot schedule edge sync"
fi

if [[ -f "$SHARED_ENV" ]] && grep -q '^MOBILE_PRIVATE_TUNNEL_EDGE_SSH_HOST=' "$SHARED_ENV"; then
	ok "MOBILE_PRIVATE_TUNNEL_EDGE_SSH_HOST materialized to shared"
else
	bad "MOBILE_PRIVATE_TUNNEL_EDGE_SSH_HOST missing from .env.stack0.shared"
fi

if [[ -f "$JOBS_ENV" ]] && grep -q '^MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY=' "$JOBS_ENV"; then
	ok "MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY materialized to stack0 jobs slice"
else
	bad "MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY missing from .env.stack0.jobs — run stack0-env-materialize-roles.sh"
fi

if [[ -f "$JOBS_ENV" ]] && grep -q '^MOBILE_PRIVATE_TUNNEL_EDGE_SSH_PRIVATE_KEY=' "$JOBS_ENV"; then
	ok "MOBILE_PRIVATE_TUNNEL_EDGE_SSH_PRIVATE_KEY materialized to jobs slice"
else
	bad "MOBILE_PRIVATE_TUNNEL_EDGE_SSH_PRIVATE_KEY missing from .env.stack0.jobs"
fi

if [[ -f "$API_ENV" ]] && grep -q '^MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY=' "$API_ENV"; then
	bad "MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY must not appear in stack0 api slice"
fi

if [[ -f "$SHARED_ENV" ]] && grep -q '^MOBILE_PRIVATE_TUNNEL_EDGE_SSH_PRIVATE_KEY=' "$SHARED_ENV"; then
	bad "MOBILE_PRIVATE_TUNNEL_EDGE_SSH_PRIVATE_KEY must stay jobs-only (not shared)"
fi

if [[ -f "$API_ENV" ]] && grep -q '^MOBILE_PRIVATE_TUNNEL_EDGE_SSH_PRIVATE_KEY=' "$API_ENV"; then
	bad "MOBILE_PRIVATE_TUNNEL_EDGE_SSH_PRIVATE_KEY must stay jobs-only (not api)"
fi

echo "Summary: PASS=${PASS} FAIL=${FAIL}"
if [[ "$FAIL" -gt 0 ]]; then
	exit 1
fi
