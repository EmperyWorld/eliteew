#!/usr/bin/env bash
#
# RU: firewalld на хосте — разрешить HTTP/HTTPS/DNS с LAN (и опционально пула OpenVPN AS).
# EN: host firewalld — allow HTTP/HTTPS/DNS from LAN (optional OpenVPN AS pool). WireGuard-in-docker removed.
#
# Env: docker/env_file/.env.stack12 (FIREWALL_* и опционально ACME_* для других скриптов).
# Переменные WireGuard (FIREWALL_WIREGUARD_*) больше не используются.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
STACK12_ENV_FILE="${STACK12_ENV_FILE:-${REPO_ROOT}/docker/env_file/.env.stack12}"

if [[ ! -f "${STACK12_ENV_FILE}" ]]; then
    echo "Missing env file: ${STACK12_ENV_FILE}" >&2
    exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
    echo "Run this script with sudo or as root." >&2
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "${STACK12_ENV_FILE}"
set +a

require_var() {
    local name="${1:?name is required}"
    if [[ -z "${!name:-}" ]]; then
        echo "Missing required env: ${name}" >&2
        exit 1
    fi
}

ensure_rich_rule() {
    local zone="${1:?zone is required}"
    local rule="${2:?rule is required}"
    if ! firewall-cmd --permanent --zone="${zone}" --query-rich-rule="${rule}" >/dev/null; then
        firewall-cmd --permanent --zone="${zone}" --add-rich-rule="${rule}" >/dev/null
    fi
}

require_var FIREWALL_PUBLIC_ZONE
require_var FIREWALL_LAN_SUBNET

firewall-cmd --permanent --zone="${FIREWALL_PUBLIC_ZONE}" --remove-service=http >/dev/null 2>&1 || true
firewall-cmd --permanent --zone="${FIREWALL_PUBLIC_ZONE}" --remove-service=https >/dev/null 2>&1 || true

source_addresses=("${FIREWALL_LAN_SUBNET}")

# OpenVPN Access Server clients (VPN pool on VPS, e.g. 172.27.224.0/20) reach this host via gateway user.
# Without this, firewalld blocks HTTPS/DNS from remote OVPN peers to nginx/CoreDNS on the LAN IP.
if [[ -n "${FIREWALL_OPENVPN_AS_SUBNET:-}" ]]; then
	source_addresses+=("${FIREWALL_OPENVPN_AS_SUBNET}")
fi

for subnet in "${source_addresses[@]}"; do
    ensure_rich_rule "${FIREWALL_PUBLIC_ZONE}" "rule family=\"ipv4\" source address=\"${subnet}\" service name=\"http\" accept"
    ensure_rich_rule "${FIREWALL_PUBLIC_ZONE}" "rule family=\"ipv4\" source address=\"${subnet}\" service name=\"https\" accept"
    ensure_rich_rule "${FIREWALL_PUBLIC_ZONE}" "rule family=\"ipv4\" source address=\"${subnet}\" port port=\"53\" protocol=\"tcp\" accept"
    ensure_rich_rule "${FIREWALL_PUBLIC_ZONE}" "rule family=\"ipv4\" source address=\"${subnet}\" port port=\"53\" protocol=\"udp\" accept"
done

# OpenVPN AS: трафик от удалённых клиентов приходит на tun0, а не на eno1. Rich-rules в зоне
# public применяются к интерфейсам этой зоны; tun0 часто в другой зоне или без зоны — SYN доходит,
# SYN-ACK не проходит. Прямые правила INPUT на tun+ + привязка tun0 к public закрывают это.
if [[ -n "${FIREWALL_OPENVPN_AS_SUBNET:-}" ]]; then
	OVPN_SUB="${FIREWALL_OPENVPN_AS_SUBNET}"
	if ip link show tun0 >/dev/null 2>&1; then
		firewall-cmd --permanent --zone="${FIREWALL_PUBLIC_ZONE}" --add-interface=tun0 >/dev/null 2>&1 || true
	fi
	# Не зависят от зоны; iptables: -i tun+ (tun0, tun1, …). Идемпотентность: не дублировать.
	direct_add_once() {
		local rule="$1"
		if firewall-cmd --permanent --direct --get-all-rules 2>/dev/null | tr -s ' ' | grep -Fq -- "${rule}"; then
			return 0
		fi
		firewall-cmd --permanent --direct --add-rule ${rule} >/dev/null
	}
	direct_add_once "ipv4 filter INPUT 0 -i tun+ -s ${OVPN_SUB} -p tcp -m tcp --dport 443 -j ACCEPT"
	direct_add_once "ipv4 filter INPUT 0 -i tun+ -s ${OVPN_SUB} -p tcp -m tcp --dport 80 -j ACCEPT"
	direct_add_once "ipv4 filter INPUT 0 -i tun+ -s ${OVPN_SUB} -p udp -m udp --dport 53 -j ACCEPT"
	direct_add_once "ipv4 filter INPUT 0 -i tun+ -s ${OVPN_SUB} -p tcp -m tcp --dport 53 -j ACCEPT"
fi

firewall-cmd --reload >/dev/null

echo "firewalld updated for LAN-only (and optional OpenVPN AS) HTTPS and internal DNS access."
