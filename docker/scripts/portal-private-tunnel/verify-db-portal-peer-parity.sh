#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Compare DB-active desktop portal peers vs edge wg-portal (additive parity).
# Invariants:
# - Does NOT require full iface == DB (portalctl peers may coexist).
# - Expects psql access to ai_services + SSH to edge (same as mobile parity style).
# Related: documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

IFACE="${PORTAL_PRIVATE_TUNNEL_INTERFACE:-wg-portal}"
portal_private_tunnel_assert_isolation_ids "${IFACE}" 51823 10.88.89.1

PSQL_CMD="${DESKTOP_CLIENT_PORTAL_PSQL:-}"
EDGE_SSH="${DESKTOP_CLIENT_PORTAL_EDGE_SSH:-}"

if [[ -z "${PSQL_CMD}" || -z "${EDGE_SSH}" ]]; then
	cat >&2 <<EOF
FAIL: set DESKTOP_CLIENT_PORTAL_PSQL (psql wrapper) and DESKTOP_CLIENT_PORTAL_EDGE_SSH (ssh target).
Example:
  export DESKTOP_CLIENT_PORTAL_PSQL="\$PWD/docker/scripts/mobile-private-tunnel/psql-via-prod-core.sh"
  export DESKTOP_CLIENT_PORTAL_EDGE_SSH="eliteew-edge@93.77.165.185"
EOF
	exit 2
fi

DB_KEYS="$($PSQL_CMD -Atc "SELECT wg_public_key FROM desktop_client_portal_peers WHERE status='active' ORDER BY 1")"
EDGE_KEYS="$(ssh -o BatchMode=yes "${EDGE_SSH}" "sudo wg show ${IFACE} peers" | sort -u)"

MISSING=0
while IFS= read -r key; do
	[[ -z "${key}" ]] && continue
	if ! grep -Fxq "${key}" <<<"${EDGE_KEYS}"; then
		echo "MISSING_ON_EDGE: ${key:0:20}…"
		MISSING=$((MISSING + 1))
	fi
done <<<"${DB_KEYS}"

if [[ "${MISSING}" -gt 0 ]]; then
	echo "FAIL: ${MISSING} DB-active peer(s) missing on ${IFACE}"
	exit 1
fi
echo "OK: all DB-active portal peers present on ${IFACE} (foreign peers ignored)"
