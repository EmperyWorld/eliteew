#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Deploy the isolated mobile WireGuard endpoint and split DNS on the Yandex edge VM.
# Invariants:
# - Deploys only wg-mobile/dnsmasq pilot state; it must not modify reverse SSH or Meet media WG.
# - Generated private keys are copied by file transfer and never printed in command arguments.
# Related:
# - docker/scripts/mobile-private-tunnel/render-configs.sh
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

VM_IP="${YANDEX_VM_IP:-93.77.165.185}"
ADMIN_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
IFACE="${MOBILE_PRIVATE_TUNNEL_INTERFACE:-wg-mobile}"
PORT="${MOBILE_PRIVATE_TUNNEL_PORT:-51822}"
EDGE_WG_IP="${MOBILE_PRIVATE_TUNNEL_EDGE_IP:-10.88.88.1}"
DNS_UPSTREAMS="${MOBILE_PRIVATE_TUNNEL_DNS_UPSTREAMS:-1.1.1.1,8.8.8.8}"
DATA="$(mobile_private_tunnel_data_dir "$ROOT")"
RENDER_SOURCE="${MOBILE_PRIVATE_TUNNEL_RENDER_SOURCE:-pilot}"
DEFAULT_HOSTNAMES="app.eliteew.ru,auth.eliteew.ru,meet.eliteew.ru"

ensure_required_mobile_hostnames() {
	local raw="${1//[[:space:]]/}"
	local normalized=",${raw},"
	local required
	for required in app.eliteew.ru auth.eliteew.ru meet.eliteew.ru; do
		if [[ "$normalized" != *",$required,"* ]]; then
			raw="${raw%,}"
			if [[ -n "$raw" ]]; then
				raw="${raw},${required}"
			else
				raw="${required}"
			fi
			normalized=",${raw},"
		fi
	done
	printf '%s' "$raw"
}

HOSTNAMES="$(ensure_required_mobile_hostnames "${MOBILE_PRIVATE_TUNNEL_HOSTNAMES:-$DEFAULT_HOSTNAMES}")"

PEERS_ONLY=0
PEER_NAME_ARG=""
for arg in "$@"; do
	case "$arg" in
	--peers-only) PEERS_ONLY=1 ;;
	*) [[ -z "$PEER_NAME_ARG" ]] && PEER_NAME_ARG="$arg" ;;
	esac
done

if [[ "$RENDER_SOURCE" == "db" ]]; then
	bash "$SCRIPT_DIR/render-db-peers.sh"
else
	bash "$SCRIPT_DIR/render-configs.sh" "${PEER_NAME_ARG:-${MOBILE_PRIVATE_TUNNEL_PEER_NAME:-operator-android-1}}"
fi
EDGE_CONF="$DATA/edge-${IFACE}.conf"
[[ -f "$EDGE_CONF" ]] || {
	echo "Нет edge config: $EDGE_CONF" >&2
	exit 1
}

ADMIN_KEY="$(eliteew_resolve_admin_private "$ROOT" "$ADMIN_USER")" || {
	echo "Не найден SSH admin key для edge VM." >&2
	exit 1
}

if [[ "$PEERS_ONLY" -eq 1 ]]; then
	echo "=== peers-only: update ${IFACE} [Peer] sections on ${ADMIN_USER}@${VM_IP} (Interface untouched) ==="
	REMOTE_TMP="/tmp/eliteew-${IFACE}-peers-only.$$.conf"
	scp -q -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i "$ADMIN_KEY" "$EDGE_CONF" "${ADMIN_USER}@${VM_IP}:${REMOTE_TMP}"
	ssh -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i "$ADMIN_KEY" -l "$ADMIN_USER" "$VM_IP" \
		bash -s -- "$IFACE" "$REMOTE_TMP" <<'REMOTE'
set -euo pipefail
IFACE="$1"
REMOTE_TMP="$2"
CONF="/etc/wireguard/${IFACE}.conf"
if ! sudo test -f "$CONF"; then
	echo "missing_wg_conf:$CONF" >&2
	exit 2
fi
TMP="$(mktemp)"
trap 'rm -f "$TMP" "$REMOTE_TMP"' EXIT
sudo awk 'BEGIN{p=1} /^\[Peer\]/{p=0} p {print}' "$CONF" >"$TMP"
if ! grep -q '^SaveConfig' "$TMP"; then
	printf '\nSaveConfig = false\n' >>"$TMP"
fi
sudo awk 'BEGIN{p=0} /^\[Peer\]/{p=1} p {print}' "$REMOTE_TMP" >>"$TMP"
sudo install -m 600 "$TMP" "$CONF"
while IFS= read -r line; do
	[[ -n "$line" ]] || continue
	sudo bash -c "$line"
done < <(
	awk '
		/^\[Peer\]/ { peer = 1; next }
		peer && /^PublicKey = / { pk = $3; next }
		peer && /^AllowedIPs = / { ip = $3; gsub(/\/32$/, "", ip); if (pk != "" && ip != "") print "wg set '"$IFACE"' peer " pk " allowed-ips " ip "/32 persistent-keepalive 25"; pk=""; ip=""; peer=0 }
	' "$REMOTE_TMP"
)
if command -v wg-quick >/dev/null 2>&1; then
	sudo wg syncconf "$IFACE" <(sudo wg-quick strip "$IFACE") 2>/dev/null || true
fi
sudo wg show "$IFACE"
REMOTE
	echo "OK: peers-only deploy completed for ${IFACE}."
	exit 0
fi

REMOTE_TMP="/tmp/eliteew-${IFACE}.$$.conf"
echo "=== 1) Upload ${IFACE} config to ${ADMIN_USER}@${VM_IP} ==="
scp -q -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i "$ADMIN_KEY" "$EDGE_CONF" "${ADMIN_USER}@${VM_IP}:${REMOTE_TMP}"

echo "=== 2) Install WireGuard + split DNS on edge ==="
ssh -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i "$ADMIN_KEY" -l "$ADMIN_USER" "$VM_IP" \
	bash -s -- "$IFACE" "$EDGE_WG_IP" "$PORT" "$HOSTNAMES" "$DNS_UPSTREAMS" "$REMOTE_TMP" <<'REMOTE'
set -euo pipefail

IFACE="$1"
EDGE_WG_IP="$2"
PORT="$3"
HOSTNAMES="$4"
DNS_UPSTREAMS="$5"
REMOTE_TMP="$6"
WG_CONF="/etc/wireguard/${IFACE}.conf"
DNSMASQ_CONF="/etc/dnsmasq.d/eliteew-mobile-private-tunnel.conf"

install_packages() {
	if command -v wg >/dev/null 2>&1 && command -v dnsmasq >/dev/null 2>&1 && command -v curl >/dev/null 2>&1; then
		return 0
	fi
	if command -v apt-get >/dev/null 2>&1; then
		sudo apt-get update -qq
		sudo DEBIAN_FRONTEND=noninteractive apt-get install -y wireguard-tools dnsmasq curl
	elif command -v dnf >/dev/null 2>&1; then
		sudo dnf install -y wireguard-tools dnsmasq curl
	else
		echo "Не найден apt-get/dnf. Установи wireguard-tools, dnsmasq и curl вручную." >&2
		exit 1
	fi
}

install_packages
sudo mkdir -p /etc/wireguard /etc/dnsmasq.d
sudo install -m 600 -o root -g root "$REMOTE_TMP" "$WG_CONF"
rm -f "$REMOTE_TMP"

sudo wg-quick down "$IFACE" >/dev/null 2>&1 || true
sudo wg-quick up "$IFACE"
sudo systemctl enable "wg-quick@${IFACE}.service" >/dev/null 2>&1 || true

{
	echo "# EliteEW mobile private tunnel split DNS"
	echo "interface=${IFACE}"
	echo "listen-address=${EDGE_WG_IP}"
	echo "bind-dynamic"
	echo "no-resolv"
	for upstream in ${DNS_UPSTREAMS//,/ }; do
		echo "server=${upstream}"
	done
	for hostname in ${HOSTNAMES//,/ }; do
		echo "address=/${hostname}/${EDGE_WG_IP}"
	done
} | sudo tee "$DNSMASQ_CONF" >/dev/null

sudo systemctl enable dnsmasq >/dev/null 2>&1 || true
sudo systemctl restart dnsmasq

if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active firewalld >/dev/null 2>&1; then
	sudo firewall-cmd --add-port="${PORT}/udp" >/dev/null || true
	sudo firewall-cmd --permanent --add-port="${PORT}/udp" >/dev/null || true
fi
if command -v ufw >/dev/null 2>&1 && sudo ufw status 2>/dev/null | grep -qi '^Status: active'; then
	sudo ufw allow "${PORT}/udp" >/dev/null || true
fi

echo "--- wg show ${IFACE} ---"
sudo wg show "$IFACE"
echo "--- dnsmasq listen ---"
ss -lun | grep -E "(${EDGE_WG_IP}:53|:53 )" || true
REMOTE

echo "=== 3) Edge-local HTTPS smoke via WG IP/SNI ==="
ssh -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i "$ADMIN_KEY" -l "$ADMIN_USER" "$VM_IP" \
	bash -s -- "$EDGE_WG_IP" "$HOSTNAMES" <<'REMOTE'
set -euo pipefail
EDGE_WG_IP="$1"
HOSTNAMES="$2"

if grep -qw app.eliteew.ru <<<"$HOSTNAMES"; then
	curl -fsS --resolve "app.eliteew.ru:443:${EDGE_WG_IP}" "https://app.eliteew.ru/api/health" >/dev/null
	echo "PASS: app.eliteew.ru API health resolves to ${EDGE_WG_IP}"
fi
if grep -qw auth.eliteew.ru <<<"$HOSTNAMES"; then
	curl -fsS --resolve "auth.eliteew.ru:443:${EDGE_WG_IP}" "https://auth.eliteew.ru/realms/empery/.well-known/openid-configuration" >/dev/null
	echo "PASS: auth.eliteew.ru discovery resolves to ${EDGE_WG_IP}"
fi
if grep -qw meet.eliteew.ru <<<"$HOSTNAMES"; then
	# Meet root may return 403 without a room/JWT; connectivity itself is the check.
	curl -sS --resolve "meet.eliteew.ru:443:${EDGE_WG_IP}" "https://meet.eliteew.ru/" >/dev/null
	echo "PASS: meet.eliteew.ru reachability resolves to ${EDGE_WG_IP}"
fi
REMOTE

echo "OK: mobile private tunnel edge pilot deployed on ${IFACE} udp/${PORT}."
echo "NOTE: Yandex Security Group must allow inbound UDP ${PORT} to the edge VM for external Android peers."
