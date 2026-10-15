#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# firewalld: запретить входящий HTTP/HTTPS на LAN IP punisher (обход edge+туннель для *.eliteew.ru).
# Invariants:
# - Только root; идемпотентные rich-rules; не трогает доступ к edge в интернете.
# Related:
# - validate-empery-tunnel-security.sh, EMPERY-EDGE-IP-OPERATIONS.md
# ---
set -euo pipefail

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "sudo required" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
LAN_IP="${EMPERY_LAN_IP:-192.168.1.136}"
ZONE="${FIREWALL_PUBLIC_ZONE:-FedoraServer}"

if ! command -v firewall-cmd >/dev/null 2>&1; then
  echo "firewalld not installed — skip" >&2
  exit 0
fi

# RFC1918 + VPN pools — источники, с которых нельзя принимать «псевдо-empery» на LAN IP
SOURCE_NETS=(
  "192.168.0.0/16"
  "10.0.0.0/8"
  "172.16.0.0/12"
)

add_reject() {
  local port="$1"
  local proto="$2"
  local src net rule
  for src in "${SOURCE_NETS[@]}"; do
    rule="rule family=\"ipv4\" source address=\"${src}\" destination address=\"${LAN_IP}/32\" port port=\"${port}\" protocol=\"${proto}\" reject"
    if firewall-cmd --permanent --zone="${ZONE}" --query-rich-rule="${rule}" >/dev/null 2>&1; then
      echo "exists: $rule"
    else
      firewall-cmd --permanent --zone="${ZONE}" --add-rich-rule="${rule}"
      echo "added: $rule"
    fi
  done
}

add_reject 443 tcp
add_reject 80 tcp

firewall-cmd --reload
echo "LAN bypass block active for ${LAN_IP}:80,443 from private sources (zone ${ZONE})"
