#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Install command-center WireGuard peer 10.77.77.3 (wg-backhaul-cc) toward edge
# for power/dewa primary backhaul. Does not touch mobile wg-mobile.
# Invariants:
# - Keys live under docker/scripts/yandex-tunnel/keys/meet-edge-wg/
# - Edge peer must be added via deploy-edge-backhaul.sh / sync-edge-cc-peer.sh
# Related:
# - docker/scripts/yandex-tunnel/wg-backhaul/README.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
# shellcheck source=../_ssh_defaults.sh
source "$SCRIPT_DIR/../_ssh_defaults.sh"

ROOT="$(wg_backhaul_repo_root "$SCRIPT_DIR")"
KD="$(wg_backhaul_keys_dir "$SCRIPT_DIR")"
PRIV="${KD}/cc-backhaul.private"
PUB="${KD}/cc-backhaul.public"
EDGE_PUB="${KD}/meet-edge-server.public"
IFACE="${WG_BACKHAUL_CC_IFACE:-wg-backhaul-cc}"
CC_IP="${WG_BACKHAUL_CC_IP:-10.77.77.3}"
EDGE_IP="${MEET_EDGE_WG_SERVER_IP:-10.77.77.1}"
EDGE_ENDPOINT="${YANDEX_VM_IP:-93.77.165.185}:51821"
SYSTEM_CONF="/etc/wireguard/${IFACE}.conf"

eliteew_yandex_source_env "$ROOT" 2>/dev/null || true
EDGE_ENDPOINT="${YANDEX_VM_IP:-93.77.165.185}:51821"

[[ -f "$PRIV" && -f "$PUB" && -f "$EDGE_PUB" ]] || {
	echo "Missing keys in ${KD} (cc-backhaul.* / meet-edge-server.public)" >&2
	exit 1
}

if [[ "${EUID}" -eq 0 ]]; then
	SUDO=()
else
	SUDO=(sudo)
	sudo -v
fi

if ! command -v wg >/dev/null 2>&1; then
	if command -v dnf >/dev/null 2>&1; then
		"${SUDO[@]}" dnf install -y wireguard-tools
	else
		echo "install wireguard-tools" >&2
		exit 1
	fi
fi

priv_b64="$(wg_backhaul_read_key "$PRIV")"
edge_pub_b64="$(wg_backhaul_read_key "$EDGE_PUB")"

"${SUDO[@]}" python3 - "$SYSTEM_CONF" "$priv_b64" "$CC_IP" "$edge_pub_b64" "$EDGE_ENDPOINT" "$EDGE_IP" <<'PY'
import pathlib, sys
path, priv, addr, edge_pub, endpoint, edge_ip = sys.argv[1:7]
body = f"""[Interface]
PrivateKey = {priv}
Address = {addr}/32

[Peer]
PublicKey = {edge_pub}
Endpoint = {endpoint}
AllowedIPs = {edge_ip}/32
PersistentKeepalive = 25
"""
pathlib.Path(path).write_text(body)
print(f"wrote {path}")
PY
"${SUDO[@]}" chmod 600 "$SYSTEM_CONF"
"${SUDO[@]}" systemctl enable --now "wg-quick@${IFACE}"
"${SUDO[@]}" wg show "$IFACE" || true
ping -c 2 -W 2 "$EDGE_IP" || true
echo "OK: ${IFACE} ${CC_IP} → ${EDGE_ENDPOINT}"
echo "NOTE: ensure edge has peer AllowedIPs=${CC_IP}/32 for $(wg_backhaul_read_key "$PUB")"
