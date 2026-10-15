#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Render WireGuard server and Android peer configs for the mobile private tunnel pilot.
# Invariants:
# - Generated configs include private keys and must remain under ignored docker/data or keys paths.
# - Default peer routes only the tunnel edge IP; app/auth privacy is enforced by tunnel DNS overrides.
# Related:
# - docker/scripts/mobile-private-tunnel/deploy-edge.sh
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
PEER_NAME="$(mobile_private_tunnel_peer_slug "${1:-${MOBILE_PRIVATE_TUNNEL_PEER_NAME:-operator-android-1}}")"

EDGE_PUBLIC_IP="${YANDEX_VM_IP:-93.77.165.185}"
IFACE="${MOBILE_PRIVATE_TUNNEL_INTERFACE:-wg-mobile}"
PORT="${MOBILE_PRIVATE_TUNNEL_PORT:-51822}"
EDGE_WG_IP="${MOBILE_PRIVATE_TUNNEL_EDGE_IP:-10.88.88.1}"
EDGE_WG_CIDR="${MOBILE_PRIVATE_TUNNEL_EDGE_CIDR:-${EDGE_WG_IP}/24}"
PEER_IP="${MOBILE_PRIVATE_TUNNEL_PEER_IP:-10.88.88.101}"
DNS_IP="${MOBILE_PRIVATE_TUNNEL_DNS_IP:-$EDGE_WG_IP}"

SERVER_PRIVATE="$KEYS/${IFACE}-server.private"
SERVER_PUBLIC="$KEYS/${IFACE}-server.public"
PEER_PRIVATE="$KEYS/${PEER_NAME}.private"
PEER_PUBLIC="$KEYS/${PEER_NAME}.public"

mobile_private_tunnel_resolve_server_keypair "$SERVER_PRIVATE" "$SERVER_PUBLIC" "$IFACE server"
mobile_private_tunnel_ensure_keypair "$PEER_PRIVATE" "$PEER_PUBLIC" "$PEER_NAME peer"

SERVER_PRIV="$(mobile_private_tunnel_read_key "$SERVER_PRIVATE")"
SERVER_PUB="$(mobile_private_tunnel_read_key "$SERVER_PUBLIC")"
PEER_PRIV="$(mobile_private_tunnel_read_key "$PEER_PRIVATE")"
PEER_PUB="$(mobile_private_tunnel_read_key "$PEER_PUBLIC")"

mkdir -p "$DATA/peers"
chmod 700 "$DATA" "$DATA/peers"

EDGE_CONF="$DATA/edge-${IFACE}.conf"
PEER_CONF="$DATA/peers/${PEER_NAME}.conf"

cat >"$EDGE_CONF" <<EOF
[Interface]
Address = ${EDGE_WG_CIDR}
ListenPort = ${PORT}
PrivateKey = ${SERVER_PRIV}
SaveConfig = false

[Peer]
# ${PEER_NAME}
PublicKey = ${PEER_PUB}
AllowedIPs = ${PEER_IP}/32
EOF

cat >"$PEER_CONF" <<EOF
[Interface]
PrivateKey = ${PEER_PRIV}
Address = ${PEER_IP}/32
DNS = ${DNS_IP}

[Peer]
PublicKey = ${SERVER_PUB}
Endpoint = ${EDGE_PUBLIC_IP}:${PORT}
AllowedIPs = ${EDGE_WG_IP}/32
PersistentKeepalive = 25
EOF

chmod 600 "$EDGE_CONF" "$PEER_CONF"

echo "OK: rendered mobile private tunnel configs"
echo "  edge: $EDGE_CONF (${IFACE}, ${EDGE_WG_CIDR}, udp/${PORT})"
echo "  peer: $PEER_CONF (${PEER_NAME}, ${PEER_IP}/32)"
echo "  DNS override target: ${DNS_IP}"
