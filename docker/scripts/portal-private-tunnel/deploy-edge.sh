#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Deploy wg-portal + isolated dnsmasq-portal on the Yandex edge VM.
# Invariants:
# - Must not modify wg-mobile, Meet WG, reverse SSH, or mobile dnsmasq drop-in.
# - DNS: dedicated systemd unit dnsmasq-portal listening only on 10.88.89.1:53.
# - nginx stays 0.0.0.0:443 (wildcard); no vhost rewrite required.
# Related:
# - docker/scripts/portal-private-tunnel/render-configs.sh
# - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
# shellcheck source=../yandex-tunnel/_ssh_defaults.sh
source "$SCRIPT_DIR/../yandex-tunnel/_ssh_defaults.sh"

ROOT="$(portal_private_tunnel_repo_root "$SCRIPT_DIR")"
eliteew_yandex_source_env "$ROOT" 2>/dev/null || true
portal_private_tunnel_source_env "$ROOT"

VM_IP="${YANDEX_VM_IP:-93.77.165.185}"
ADMIN_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
IFACE="${PORTAL_PRIVATE_TUNNEL_INTERFACE:-wg-portal}"
PORT="${PORTAL_PRIVATE_TUNNEL_PORT:-51823}"
EDGE_WG_IP="${PORTAL_PRIVATE_TUNNEL_EDGE_IP:-10.88.89.1}"
DNS_UPSTREAMS="${PORTAL_PRIVATE_TUNNEL_DNS_UPSTREAMS:-1.1.1.1,8.8.8.8}"
DATA="$(portal_private_tunnel_data_dir "$ROOT")"
DEFAULT_HOSTNAMES="app.eliteew.ru,auth.eliteew.ru"

ensure_required_portal_hostnames() {
	local raw="${1//[[:space:]]/}"
	local normalized=",${raw},"
	local required
	for required in app.eliteew.ru auth.eliteew.ru; do
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

HOSTNAMES="$(ensure_required_portal_hostnames "${PORTAL_PRIVATE_TUNNEL_HOSTNAMES:-$DEFAULT_HOSTNAMES}")"

if [[ "$IFACE" != "wg-portal" ]]; then
	echo "FAIL: deploy refuses non-portal interface '${IFACE}' (hard isolation)." >&2
	exit 1
fi
if [[ "$PORT" != "51823" ]]; then
	echo "FAIL: deploy refuses port '${PORT}' (locked UDP 51823)." >&2
	exit 1
fi

# Manifest is SoT; optional slug ensures that peer exists before multi-peer render.
if [[ -n "${1:-}" ]]; then
	bash "$SCRIPT_DIR/render-configs.sh" "$1"
else
	bash "$SCRIPT_DIR/render-configs.sh"
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

REMOTE_TMP="/tmp/eliteew-${IFACE}.$$.conf"
echo "=== 1) Upload ${IFACE} config to ${ADMIN_USER}@${VM_IP} ==="
scp -q -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i "$ADMIN_KEY" "$EDGE_CONF" "${ADMIN_USER}@${VM_IP}:${REMOTE_TMP}"

echo "=== 2) Install wg-portal + isolated dnsmasq-portal (do not touch mobile) ==="
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
DNS_CONF="/etc/dnsmasq-portal.conf"
DNS_UNIT="/etc/systemd/system/dnsmasq-portal.service"
MOBILE_DNS_DROPIN="/etc/dnsmasq.d/eliteew-mobile-private-tunnel.conf"

# Refuse clobbering mobile DNS drop-in
if [[ -f "$MOBILE_DNS_DROPIN" ]]; then
	if grep -q "10.88.89" "$MOBILE_DNS_DROPIN" 2>/dev/null; then
		echo "FAIL: mobile dnsmasq drop-in unexpectedly references portal subnet." >&2
		exit 1
	fi
fi

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
sudo mkdir -p /etc/wireguard
sudo install -m 600 -o root -g root "$REMOTE_TMP" "$WG_CONF"
rm -f "$REMOTE_TMP"

# Bring iface down first so systemd wg-quick@ can own it (manual wg-quick up breaks the unit).
sudo systemctl stop "wg-quick@${IFACE}.service" >/dev/null 2>&1 || true
sudo wg-quick down "$IFACE" >/dev/null 2>&1 || true
sudo systemctl enable "wg-quick@${IFACE}.service" >/dev/null 2>&1 || true
sudo systemctl restart "wg-quick@${IFACE}.service"

{
	echo "# EliteEW portal private tunnel — isolated dnsmasq (do not merge into mobile drop-in)"
	echo "listen-address=${EDGE_WG_IP}"
	echo "bind-interfaces"
	echo "no-resolv"
	echo "no-hosts"
	echo "port=53"
	for upstream in ${DNS_UPSTREAMS//,/ }; do
		echo "server=${upstream}"
	done
	for hostname in ${HOSTNAMES//,/ }; do
		echo "address=/${hostname}/${EDGE_WG_IP}"
	done
} | sudo tee "$DNS_CONF" >/dev/null
sudo chmod 644 "$DNS_CONF"

{
	echo "[Unit]"
	echo "Description=EliteEW Portal Private Tunnel dnsmasq (10.88.89.1 only)"
	echo "After=network-online.target wg-quick@${IFACE}.service"
	echo "Wants=network-online.target wg-quick@${IFACE}.service"
	echo ""
	echo "[Service]"
	echo "Type=simple"
	echo "ExecStartPre=/bin/sleep 1"
	echo "ExecStart=/usr/sbin/dnsmasq --keep-in-foreground --conf-file=${DNS_CONF} --pid-file=/run/dnsmasq-portal.pid"
	echo "ExecReload=/bin/kill -HUP \$MAINPID"
	echo "Restart=on-failure"
	echo "RestartSec=2"
	echo ""
	echo "[Install]"
	echo "WantedBy=multi-user.target"
} | sudo tee "$DNS_UNIT" >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable dnsmasq-portal.service >/dev/null 2>&1 || true
sudo systemctl restart dnsmasq-portal.service
sudo systemctl --no-pager --full status dnsmasq-portal.service | head -20 || true
sudo systemctl --no-pager --full status "wg-quick@${IFACE}.service" | head -15 || true

# Host firewall only — Yandex SG is separate (open-yandex-sg-udp.sh)
if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active firewalld >/dev/null 2>&1; then
	sudo firewall-cmd --add-port="${PORT}/udp" >/dev/null || true
	sudo firewall-cmd --permanent --add-port="${PORT}/udp" >/dev/null || true
fi
if command -v ufw >/dev/null 2>&1 && sudo ufw status 2>/dev/null | grep -qi '^Status: active'; then
	sudo ufw allow "${PORT}/udp" >/dev/null || true
fi

echo "--- wg show ${IFACE} ---"
sudo wg show "$IFACE"
echo "--- dnsmasq-portal listen ---"
ss -lun | grep -E "${EDGE_WG_IP}:53" || true
echo "--- mobile dnsmasq drop-in untouched ---"
if [[ -f "$MOBILE_DNS_DROPIN" ]]; then
	grep -E '^(listen-address|address=)' "$MOBILE_DNS_DROPIN" || true
fi
echo "--- system dnsmasq (mobile) still active? ---"
systemctl is-active dnsmasq 2>/dev/null || true
REMOTE

echo "=== 3) Edge-local HTTPS smoke via portal WG IP/SNI ==="
ssh -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i "$ADMIN_KEY" -l "$ADMIN_USER" "$VM_IP" \
	bash -s -- "$EDGE_WG_IP" "$HOSTNAMES" <<'REMOTE'
set -euo pipefail
EDGE_WG_IP="$1"
HOSTNAMES="$2"

if grep -qw app.eliteew.ru <<<"$HOSTNAMES"; then
	curl -fsS --resolve "app.eliteew.ru:443:${EDGE_WG_IP}" "https://app.eliteew.ru/api/health" >/dev/null
	echo "PASS: app.eliteew.ru API health via ${EDGE_WG_IP}"
fi
if grep -qw auth.eliteew.ru <<<"$HOSTNAMES"; then
	curl -fsS --resolve "auth.eliteew.ru:443:${EDGE_WG_IP}" "https://auth.eliteew.ru/realms/empery/.well-known/openid-configuration" >/dev/null
	echo "PASS: auth.eliteew.ru discovery via ${EDGE_WG_IP}"
fi
REMOTE

echo "OK: portal private tunnel deployed on ${IFACE} udp/${PORT}."
echo "NOTE: open Yandex Security Group inbound UDP ${PORT} (bash docker/scripts/portal-private-tunnel/open-yandex-sg-udp.sh)."
