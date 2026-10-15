#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Restore wg-mobile [Interface] private key on the edge VM from config plane / keys dir.
# Invariants:
# - Never prints WireGuard private keys; reads from env or ignored keys paths only.
# - Fails closed when MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY does not match derived public key.
# Related:
# - docker/scripts/mobile-private-tunnel/lib.sh
# - documentation/product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md
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

# Optional stack0 backend env (config plane staging on command-center).
STACK0_BACKEND_ENV="${MOBILE_PRIVATE_TUNNEL_STACK0_ENV_FILE:-$ROOT/docker/env_file/.env.stack0.backend}"
if [[ -f "$STACK0_BACKEND_ENV" ]]; then
	set -a
	# shellcheck source=/dev/null
	source "$STACK0_BACKEND_ENV"
	set +a
fi

VM_IP="${YANDEX_VM_IP:-93.77.165.185}"
ADMIN_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
IFACE="${MOBILE_PRIVATE_TUNNEL_INTERFACE:-wg-mobile}"
KEYS="$(mobile_private_tunnel_keys_dir "$ROOT")"
SERVER_PRIVATE="$KEYS/${IFACE}-server.private"
SERVER_PUBLIC="$KEYS/${IFACE}-server.public"
EXPECTED_PUB="${MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY:-}"

mobile_private_tunnel_resolve_server_keypair "$SERVER_PRIVATE" "$SERVER_PUBLIC" "$IFACE server"
SERVER_PUB="$(mobile_private_tunnel_read_key "$SERVER_PUBLIC")"

if [[ -n "$EXPECTED_PUB" && "$SERVER_PUB" != "$EXPECTED_PUB" ]]; then
	echo "FAIL: derived server public key does not match MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY." >&2
	exit 1
fi

ADMIN_KEY="$(eliteew_resolve_admin_private "$ROOT" "$ADMIN_USER")" || {
	echo "FAIL: SSH admin key not found for edge VM." >&2
	exit 1
}

REMOTE_PRIV="/tmp/eliteew-${IFACE}-server-private.$$.key"
trap 'ssh -o BatchMode=yes -o ConnectTimeout=10 -o IdentitiesOnly=yes -i "$ADMIN_KEY" -l "$ADMIN_USER" "$VM_IP" "rm -f \"$REMOTE_PRIV\"" 2>/dev/null || true' EXIT

scp -q -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i "$ADMIN_KEY" "$SERVER_PRIVATE" "${ADMIN_USER}@${VM_IP}:${REMOTE_PRIV}"

echo "=== Restore ${IFACE} interface private key on ${ADMIN_USER}@${VM_IP} ==="
ssh -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i "$ADMIN_KEY" -l "$ADMIN_USER" "$VM_IP" \
	bash -s -- "$IFACE" "$REMOTE_PRIV" "$SERVER_PUB" <<'REMOTE'
set -euo pipefail
IFACE="$1"
REMOTE_PRIV="$2"
EXPECTED_PUB="$3"
CONF="/etc/wireguard/${IFACE}.conf"

if ! sudo test -f "$CONF"; then
	echo "missing_wg_conf:$CONF" >&2
	exit 2
fi

CURRENT_PUB="$(sudo wg show "$IFACE" public-key 2>/dev/null || true)"
if [[ -n "$CURRENT_PUB" && "$CURRENT_PUB" == "$EXPECTED_PUB" ]]; then
	echo "OK: edge ${IFACE} already uses canonical server public key"
	exit 0
fi

sudo wg set "$IFACE" private-key "$REMOTE_PRIV"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
sudo awk -v priv="$(sudo tr -d '\n' <"$REMOTE_PRIV")" '
	BEGIN { replaced = 0 }
	/^PrivateKey = / {
		print "PrivateKey = " priv
		replaced = 1
		next
	}
	{ print }
' "$CONF" >"$TMP"
if [[ "$(sudo awk '/^PrivateKey = / { print; exit }' "$CONF")" == "" ]]; then
	echo "FAIL: ${CONF} has no PrivateKey line to update" >&2
	exit 3
fi
sudo install -m 600 "$TMP" "$CONF"
ACTUAL_PUB="$(sudo wg show "$IFACE" public-key)"
if [[ "$ACTUAL_PUB" != "$EXPECTED_PUB" ]]; then
	echo "FAIL: wg set completed but public key mismatch (got=${ACTUAL_PUB})" >&2
	exit 4
fi
echo "OK: restored ${IFACE} interface public key=${ACTUAL_PUB}"
REMOTE

echo "OK: edge ${IFACE} interface key restored."
