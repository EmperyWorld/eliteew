#!/usr/bin/env bash
# Конфиги WG: сервер на edge (статический IP), клиент на punisher (исходящий, без NAT дома).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
# shellcheck source=../_ssh_defaults.sh
source "$SCRIPT_DIR/../_ssh_defaults.sh"

ROOT="$(meet_edge_wg_repo_root "$SCRIPT_DIR")"
eliteew_yandex_source_env "$ROOT" 2>/dev/null || true

meet_edge_wg_ensure_keys "$SCRIPT_DIR"
KD="$(meet_edge_wg_keys_dir "$SCRIPT_DIR")"
DATA="${MEET_EDGE_WG_DATA:-$ROOT/docker/data/meet-edge-wg}"
PORT="${MEET_EDGE_WG_PORT:-51821}"
EDGE_IP="${YANDEX_VM_IP:-93.77.165.185}"
PUNISHER_IP="${PUNISHER_LAN_IP:-192.168.1.136}"
SUBNET_IP_SERVER="${MEET_EDGE_WG_SERVER_IP:-10.77.77.1}"
SUBNET_IP_CLIENT="${MEET_EDGE_WG_CLIENT_IP:-10.77.77.2}"

if [[ ! -f "${KD}/meet-edge-server.private" ]]; then
	S_PRIV="$(wg genkey)"
	echo "$S_PRIV" >"${KD}/meet-edge-server.private"
	echo "$S_PRIV" | wg pubkey >"${KD}/meet-edge-server.public"
	chmod 600 "${KD}/meet-edge-server.private" "${KD}/meet-edge-server.public"
fi

S_PRIV="$(meet_edge_wg_read_key "${KD}/meet-edge-server.private")"
S_PUB="$(meet_edge_wg_read_key "${KD}/meet-edge-server.public")"
C_PRIV="$(meet_edge_wg_read_key "${KD}/meet-edge.private")"
C_PUB="$(meet_edge_wg_read_key "${KD}/meet-edge.public")"

mkdir -p "$DATA"
EDGE_CONF="${DATA}/edge-wg-server.conf"
HOME_CONF="${DATA}/home-wg-client.conf"

cat >"$EDGE_CONF" <<EOF
[Interface]
Address = ${SUBNET_IP_SERVER}/24
ListenPort = ${PORT}
PrivateKey = ${S_PRIV}

[Peer]
PublicKey = ${C_PUB}
AllowedIPs = ${SUBNET_IP_CLIENT}/32
EOF

cat >"$HOME_CONF" <<EOF
[Interface]
Address = ${SUBNET_IP_CLIENT}/32
PrivateKey = ${C_PRIV}
MTU = 1280

[Peer]
PublicKey = ${S_PUB}
Endpoint = ${EDGE_IP}:${PORT}
AllowedIPs = ${SUBNET_IP_SERVER}/32
PersistentKeepalive = 25
EOF

chmod 600 "$EDGE_CONF" "$HOME_CONF"
echo "OK reversed configs:"
echo "  edge server: $EDGE_CONF  (Listen ${EDGE_IP}:${PORT})"
echo "  home client: $HOME_CONF  (исходящий, MikroTik не нужен)"
echo "MEET_EDGE_WG_RELAY_TARGET=${SUBNET_IP_CLIENT}:34000"
