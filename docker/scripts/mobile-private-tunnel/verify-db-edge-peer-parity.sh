#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: FAIL when active trusted-device DB peers are missing or mismatched on edge wg-mobile.
# Invariants:
# - Read-only on edge and DB; does not deploy or mutate peers.
# - Stale edge-only peers WARN; missing DB peers on edge FAIL.
# Related:
# - docker/scripts/mobile-private-tunnel/deploy-edge.sh
# - documentation/product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
# shellcheck source=peer-parity-lib.sh
source "$SCRIPT_DIR/peer-parity-lib.sh"
# shellcheck source=../yandex-tunnel/_ssh_defaults.sh
source "$SCRIPT_DIR/../yandex-tunnel/_ssh_defaults.sh"

ROOT="$(mobile_private_tunnel_repo_root "$SCRIPT_DIR")"
eliteew_yandex_source_env "$ROOT" 2>/dev/null || true
mobile_private_tunnel_source_env "$ROOT"

VM_IP="${YANDEX_VM_IP:-93.77.165.185}"
ADMIN_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
IFACE="${MOBILE_PRIVATE_TUNNEL_INTERFACE:-wg-mobile}"
DB_URL="${MOBILE_PRIVATE_TUNNEL_DATABASE_URL:-${DATABASE_URL:-}}"
PSQL_BIN="${MOBILE_PRIVATE_TUNNEL_PSQL:-psql}"

PASS=0
WARN=0
FAIL=0

ok() { echo "PASS: $*"; PASS=$((PASS + 1)); }
warn() { echo "WARN: $*"; WARN=$((WARN + 1)); }
bad() { echo "FAIL: $*"; FAIL=$((FAIL + 1)); }

if [[ -z "$DB_URL" ]]; then
	echo "Set MOBILE_PRIVATE_TUNNEL_DATABASE_URL or DATABASE_URL." >&2
	exit 1
fi
if ! command -v "$PSQL_BIN" >/dev/null 2>&1 && [[ "$PSQL_BIN" != */* ]]; then
	echo "Missing psql binary: $PSQL_BIN (use docker/scripts/mobile-private-tunnel/psql-via-prod-core.sh)" >&2
	exit 1
fi

ADMIN_KEY="$(eliteew_resolve_admin_private "$ROOT" "$ADMIN_USER")" || {
	echo "FAIL: SSH admin key not found for edge VM." >&2
	exit 1
}

DB_TSV="$(mktemp)"
EDGE_TSV="$(mktemp)"
HANDSHAKE_TSV="$(mktemp)"
trap 'rm -f "$DB_TSV" "$EDGE_TSV" "$HANDSHAKE_TSV"' EXIT

echo "verify-db-edge-peer-parity db=trusted_devices edge=${ADMIN_USER}@${VM_IP} iface=${IFACE}"

"$PSQL_BIN" "$DB_URL" -X -qAt -F $'\t' -c "
SELECT id::text, stable_device_id, wg_public_key, host(wg_assigned_ip)
FROM public.mobile_trusted_devices
WHERE status = 'active'
  AND wg_public_key IS NOT NULL
  AND wg_assigned_ip IS NOT NULL
ORDER BY created_at ASC;
" >"$DB_TSV.raw"

: >"$DB_TSV"
while IFS=$'\t' read -r id stable pubkey ip; do
	mobile_private_tunnel_normalize_db_peer_line "$id" "$stable" "$pubkey" "$ip" >>"$DB_TSV"
done <"$DB_TSV.raw"

db_count="$(wc -l <"$DB_TSV" | tr -d ' ')"
if [[ "$db_count" -eq 0 ]]; then
	warn "no active trusted-device peers in database"
else
	ok "database active peer count=${db_count}"
fi

wg_output="$(
	ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
		-i "$ADMIN_KEY" -l "$ADMIN_USER" "$VM_IP" \
		"sudo wg show ${IFACE} 2>/dev/null || true"
)"

printf '%s\n' "$wg_output" | mobile_private_tunnel_parse_wg_show_peers >"$EDGE_TSV"
edge_count="$(wc -l <"$EDGE_TSV" | tr -d ' ')"
ok "edge configured peer count=${edge_count}"

compare_rc=0
mobile_private_tunnel_compare_peer_sets "$DB_TSV" "$EDGE_TSV" || compare_rc=$?

case "$compare_rc" in
	0) ok "database peers match edge wg-mobile configuration" ;;
	1) bad "active database peer(s) missing or mismatched on edge — run render-db-peers.sh && deploy-edge.sh --peers-only" ;;
	2) warn "edge has stale peer(s) not present as active in database — redeploy recommended" ;;
	*) bad "peer parity compare failed unexpectedly (rc=${compare_rc})" ;;
esac

CANON_SERVER_PUB="${MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY:-}"
if [[ -n "$CANON_SERVER_PUB" ]]; then
	edge_server_pub="$(printf '%s\n' "$wg_output" | mobile_private_tunnel_parse_wg_show_server_public_key)"
	if [[ -z "$edge_server_pub" ]]; then
		bad "edge ${IFACE} server public key not readable from wg show"
	elif [[ "$edge_server_pub" != "$CANON_SERVER_PUB" ]]; then
		bad "edge server public key mismatch (edge=${edge_server_pub}, canon=${CANON_SERVER_PUB}) — run restore-edge-wg-mobile-interface.sh or align config plane"
	else
		ok "edge server public key matches MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY"
	fi
else
	warn "MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY unset — server public key parity skipped"
fi

if [[ -n "$CANON_SERVER_PUB" && "$db_count" -gt 0 ]]; then
	db_stale_server_pub="$(
		"$PSQL_BIN" "$DB_URL" -X -qAt -c "
SELECT count(*)::text
FROM public.mobile_trusted_devices
WHERE status = 'active'
  AND wg_server_public_key IS NOT NULL
  AND btrim(wg_server_public_key) <> btrim('${CANON_SERVER_PUB}');
"
	)"
	if [[ "${db_stale_server_pub:-0}" -gt 0 ]]; then
		bad "database has ${db_stale_server_pub} active device(s) with stale wg_server_public_key — run sync-db-wg-server-public-key.sh"
	else
		ok "database wg_server_public_key matches canonical server public key"
	fi
fi

if [[ "$db_count" -gt 0 ]]; then
	printf '%s\n' "$wg_output" | mobile_private_tunnel_parse_wg_show_peer_handshakes >"$HANDSHAKE_TSV"
	handshake_missing=0
	while IFS=$'\t' read -r pubkey _ip; do
		[[ -n "${pubkey:-}" ]] || continue
		hs_ok="$(grep -F "${pubkey}"$'\t' "$HANDSHAKE_TSV" 2>/dev/null | cut -f2 | head -1 || true)"
		if [[ "${hs_ok:-0}" != "1" ]]; then
			bad "edge peer ${pubkey} has no recent handshake — phone cannot reach wg-mobile yet"
			handshake_missing=$((handshake_missing + 1))
		fi
	done <"$DB_TSV"
	if [[ "$handshake_missing" -eq 0 ]]; then
		ok "all active database peers have edge handshake evidence"
	fi
fi

echo "Summary: PASS=${PASS} WARN=${WARN} FAIL=${FAIL}"
if [[ "$FAIL" -gt 0 ]]; then
	exit 1
fi
