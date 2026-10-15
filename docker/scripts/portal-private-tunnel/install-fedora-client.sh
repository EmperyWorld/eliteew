#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Install / enable Portal Private Tunnel WireGuard client on Fedora (desktop peer).
# Invariants:
# - Installs /etc/wireguard/wg-portal.conf only; enables systemd wg-quick@wg-portal (autostart).
# - Refuses full-tunnel AllowedIPs=0.0.0.0/0; requires MTU=1380 and DNS/AllowedIPs=10.88.89.1.
# - Does not touch mobile/Meet tunnels or edge deploy scripts.
# Related:
# - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
# ---
set -euo pipefail

IFACE="wg-portal"
WG_CONF="/etc/wireguard/${IFACE}.conf"
UNIT="wg-quick@${IFACE}.service"
EDGE_IP="10.88.89.1"
REQUIRED_MTU="1380"

usage() {
	cat <<EOF
Usage:
  sudo bash $0 install <peer.conf>   Install conf, enable autostart, bring tunnel up
  sudo bash $0 up                    Start tunnel (after install)
  sudo bash $0 down                  Stop tunnel
  sudo bash $0 status                Show wg + systemd status + smoke hints
  sudo bash $0 uninstall             Disable autostart, stop, remove ${WG_CONF}

Example:
  sudo bash $0 install ./fedora-operator-1.conf
EOF
}

die() {
	echo "FAIL: $*" >&2
	exit 1
}

need_root() {
	[[ "$(id -u)" -eq 0 ]] || die "run as root (sudo)"
}

assert_peer_conf() {
	local conf="$1"
	[[ -f "$conf" ]] || die "peer conf not found: $conf"
	grep -Eq 'AllowedIPs[[:space:]]*=[[:space:]]*0\.0\.0\.0/0' "$conf" &&
		die "full-tunnel AllowedIPs=0.0.0.0/0 is forbidden (split tunnel only)"
	grep -Eq "AllowedIPs[[:space:]]*=[[:space:]]*${EDGE_IP}/32" "$conf" ||
		die "peer conf must set AllowedIPs = ${EDGE_IP}/32"
	grep -Eq "MTU[[:space:]]*=[[:space:]]*${REQUIRED_MTU}" "$conf" ||
		die "peer conf must set MTU = ${REQUIRED_MTU}"
	grep -Eq "DNS[[:space:]]*=[[:space:]]*${EDGE_IP}" "$conf" ||
		die "peer conf must set DNS = ${EDGE_IP}"
	grep -Eq 'Endpoint[[:space:]]*=[[:space:]]*.+:51823' "$conf" ||
		die "peer conf Endpoint must use UDP 51823"
}

ensure_packages() {
	if command -v wg >/dev/null 2>&1 && command -v wg-quick >/dev/null 2>&1; then
		return 0
	fi
	if command -v dnf >/dev/null 2>&1; then
		dnf install -y wireguard-tools
	elif command -v apt-get >/dev/null 2>&1; then
		apt-get update -qq
		DEBIAN_FRONTEND=noninteractive apt-get install -y wireguard-tools
	else
		die "install wireguard-tools manually (wg / wg-quick missing)"
	fi
}

cmd_install() {
	local src="${1:-}"
	[[ -n "$src" ]] || die "missing peer.conf path"
	need_root
	assert_peer_conf "$src"
	ensure_packages
	mkdir -p /etc/wireguard
	install -m 600 -o root -g root "$src" "$WG_CONF"
	systemctl enable "$UNIT"
	systemctl restart "$UNIT"
	echo "OK: installed ${WG_CONF}"
	echo "OK: enabled autostart ${UNIT}"
	cmd_status
}

cmd_up() {
	need_root
	[[ -f "$WG_CONF" ]] || die "missing ${WG_CONF} — run: $0 install <peer.conf>"
	systemctl start "$UNIT"
	echo "OK: ${UNIT} started"
	cmd_status
}

cmd_down() {
	need_root
	systemctl stop "$UNIT" || true
	echo "OK: ${UNIT} stopped"
}

cmd_uninstall() {
	need_root
	systemctl disable --now "$UNIT" 2>/dev/null || true
	wg-quick down "$IFACE" 2>/dev/null || true
	rm -f "$WG_CONF"
	echo "OK: removed ${WG_CONF} and disabled ${UNIT}"
}

cmd_status() {
	echo "=== systemd ${UNIT} ==="
	systemctl is-enabled "$UNIT" 2>/dev/null || echo "not-enabled"
	systemctl is-active "$UNIT" 2>/dev/null || echo "inactive"
	echo "=== wg show ${IFACE} ==="
	wg show "$IFACE" 2>/dev/null || echo "(interface down)"
	if ip -4 addr show "$IFACE" >/dev/null 2>&1; then
		echo "=== smoke ==="
		if ping -c 1 -W 2 "$EDGE_IP" >/dev/null 2>&1; then
			echo "PASS: ping ${EDGE_IP}"
		else
			echo "WARN: ping ${EDGE_IP} failed (handshake/SG/DNS?)"
		fi
		if command -v resolvectl >/dev/null 2>&1; then
			resolvectl query app.eliteew.ru 2>/dev/null | head -5 || true
		fi
		if curl -fsS --max-time 8 "https://app.eliteew.ru/api/health" >/dev/null 2>&1; then
			echo "PASS: https://app.eliteew.ru/api/health"
		else
			echo "WARN: app health curl failed"
		fi
		echo "route 1.1.1.1:"
		ip route get 1.1.1.1 2>/dev/null || true
	fi
}

main() {
	local cmd="${1:-}"
	shift || true
	case "$cmd" in
	install) cmd_install "${1:-}" ;;
	up) cmd_up ;;
	down) cmd_down ;;
	status) cmd_status ;;
	uninstall) cmd_uninstall ;;
	-h | --help | help | "") usage ;;
	*)
		usage
		die "unknown command: $cmd"
		;;
	esac
}

main "$@"
