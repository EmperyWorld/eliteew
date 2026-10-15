#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Render the mobile WireGuard edge config from active trusted-device registry rows.
# Invariants:
# - Reads only phone public keys and assigned IPs from Postgres; phone private keys are never generated or stored here.
# - Generated edge config includes the server private key and must remain under ignored docker/data paths.
# Related:
# - shared/api/migrations/20260617_mobile_trusted_devices.sql
# - documentation/product/mobile/MOBILE-TRUSTED-DEVICE-BINDING.md
# - documentation/platform/docker-re_doc/MOBILE-PRIVATE-TUNNEL-EDGE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
# shellcheck source=../yandex-tunnel/_ssh_defaults.sh
source "$SCRIPT_DIR/../yandex-tunnel/_ssh_defaults.sh"

ROOT="$(mobile_private_tunnel_repo_root "$SCRIPT_DIR")"
eliteew_yandex_source_env "$ROOT" 2>/dev/null || true
mobile_private_tunnel_source_env "$ROOT"

DATA="$(mobile_private_tunnel_data_dir "$ROOT")"
KEYS="$(mobile_private_tunnel_keys_dir "$ROOT")"

IFACE="${MOBILE_PRIVATE_TUNNEL_INTERFACE:-wg-mobile}"
PORT="${MOBILE_PRIVATE_TUNNEL_PORT:-51822}"
EDGE_WG_IP="${MOBILE_PRIVATE_TUNNEL_EDGE_IP:-10.88.88.1}"
EDGE_WG_CIDR="${MOBILE_PRIVATE_TUNNEL_EDGE_CIDR:-${EDGE_WG_IP}/24}"
DB_URL="${MOBILE_PRIVATE_TUNNEL_DATABASE_URL:-${DATABASE_URL:-}}"
PSQL_BIN="${MOBILE_PRIVATE_TUNNEL_PSQL:-psql}"

if [[ -z "$DB_URL" ]]; then
	echo "Set MOBILE_PRIVATE_TUNNEL_DATABASE_URL or DATABASE_URL for trusted-device peer rendering." >&2
	exit 1
fi
if ! command -v "$PSQL_BIN" >/dev/null 2>&1; then
	echo "Missing psql binary: $PSQL_BIN" >&2
	exit 1
fi

SERVER_PRIVATE="$KEYS/${IFACE}-server.private"
SERVER_PUBLIC="$KEYS/${IFACE}-server.public"
mobile_private_tunnel_resolve_server_keypair "$SERVER_PRIVATE" "$SERVER_PUBLIC" "$IFACE server"

SERVER_PRIV="$(mobile_private_tunnel_read_key "$SERVER_PRIVATE")"
SERVER_PUB="$(mobile_private_tunnel_read_key "$SERVER_PUBLIC")"

mkdir -p "$DATA"
chmod 700 "$DATA"

EDGE_CONF="$DATA/edge-${IFACE}.conf"
PEERS_TSV="$(mktemp)"
trap 'rm -f "$PEERS_TSV"' EXIT

"$PSQL_BIN" "$DB_URL" -X -qAt -F $'\t' -c "
SELECT
    id::text,
    regexp_replace(stable_device_id, '[^[:alnum:]_.-]+', '-', 'g') AS stable_device_id,
    wg_public_key,
    host(wg_assigned_ip) AS assigned_ip
FROM public.mobile_trusted_devices
WHERE status = 'active'
  AND wg_public_key IS NOT NULL
  AND wg_assigned_ip IS NOT NULL
ORDER BY created_at ASC;
" >"$PEERS_TSV"

{
	echo "[Interface]"
	echo "Address = ${EDGE_WG_CIDR}"
	echo "ListenPort = ${PORT}"
	echo "PrivateKey = ${SERVER_PRIV}"
	echo "SaveConfig = false"
	echo
	while IFS=$'\t' read -r device_id stable_device_id wg_public_key assigned_ip; do
		[[ -n "${device_id:-}" && -n "${wg_public_key:-}" && -n "${assigned_ip:-}" ]] || continue
		echo "[Peer]"
		echo "# trusted-device ${stable_device_id:-unknown} ${device_id}"
		echo "PublicKey = ${wg_public_key}"
		echo "AllowedIPs = ${assigned_ip}/32"
		echo
	done <"$PEERS_TSV"
} >"$EDGE_CONF"

chmod 600 "$EDGE_CONF"

peer_count="$(wc -l <"$PEERS_TSV" | tr -d ' ')"
echo "OK: rendered ${IFACE} edge config from trusted-device registry"
echo "  edge: $EDGE_CONF (${IFACE}, ${EDGE_WG_CIDR}, udp/${PORT})"
echo "  peers: ${peer_count}"
echo "  server public key: ${SERVER_PUB}"
echo "  API env: MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY=${SERVER_PUB}"
