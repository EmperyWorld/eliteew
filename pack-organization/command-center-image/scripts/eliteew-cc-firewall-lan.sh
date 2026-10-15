#!/usr/bin/env bash
# Command-center (.136): SSH + Cockpit 9090 LAN-only; drop zone-wide ssh/cockpit;
# bind Cockpit to LAN IP; LLMNR off (5355).
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERROR: sudo bash $0" >&2
  exit 1
fi

ZONE="${ELITEEW_HARDEN_ZONE:-FedoraServer}"
LAN_CIDR="${ELITEEW_HARDEN_LAN_CIDR:-192.168.1.0/24}"
CC_IP="${ELITEEW_CC_LAN_IP:-192.168.1.136}"
COCKPIT_EXTRA="${ELITEEW_HARDEN_COCKPIT_EXTRA:-}"

rich_rule_once() {
  local rule="$1"
  if firewall-cmd --permanent --zone="${ZONE}" --query-rich-rule="${rule}" >/dev/null 2>&1; then
    return 0
  fi
  firewall-cmd --permanent --zone="${ZONE}" --add-rich-rule="${rule}"
}

echo "=== firewalld: SSH + 9090 only from ${LAN_CIDR} ==="
command -v firewall-cmd >/dev/null 2>&1 || {
  echo "ERROR: firewalld not installed" >&2
  exit 1
}

firewall-cmd --set-default-zone="${ZONE}" 2>/dev/null || true
firewall-cmd --permanent --zone="${ZONE}" --remove-service=ssh 2>/dev/null || true
firewall-cmd --permanent --zone="${ZONE}" --remove-service=cockpit 2>/dev/null || true
firewall-cmd --permanent --zone="${ZONE}" --remove-port=9090/tcp 2>/dev/null || true

rich_rule_once "rule family=\"ipv4\" source address=\"${LAN_CIDR}\" service name=\"ssh\" accept"
rich_rule_once "rule family=\"ipv4\" source address=\"${LAN_CIDR}\" port port=\"9090\" protocol=\"tcp\" accept"
if [[ -n "${COCKPIT_EXTRA}" ]]; then
  rich_rule_once "rule family=\"ipv4\" source address=\"${COCKPIT_EXTRA}\" port port=\"9090\" protocol=\"tcp\" accept"
fi

firewall-cmd --reload
echo "Rich rules (ssh/9090):"
firewall-cmd --zone="${ZONE}" --list-rich-rules | rg 'ssh|9090' || true

echo "=== Cockpit bind ${CC_IP}:9090 ==="
mkdir -p /etc/systemd/system/cockpit.socket.d
cat >/etc/systemd/system/cockpit.socket.d/eliteew-lan-only.conf <<EOF
[Socket]
ListenStream=
ListenStream=${CC_IP}:9090
EOF
systemctl daemon-reload
systemctl enable cockpit.socket 2>/dev/null || true
systemctl restart cockpit.socket

echo "=== sshd ListenAddress ${CC_IP} ==="
mkdir -p /etc/ssh/sshd_config.d
cat >/etc/ssh/sshd_config.d/01-eliteew-cc-listen.conf <<EOF
# EliteEW CC — LAN bind (pairs with firewalld rich rules).
AddressFamily inet
ListenAddress ${CC_IP}
EOF
if sshd -t 2>/dev/null; then
  systemctl reload sshd || systemctl restart sshd
else
  echo "WARN: sshd -t failed — remove 01-eliteew-cc-listen.conf manually if locked out" >&2
fi

echo "=== LLMNR/mDNS off (5355) ==="
mkdir -p /etc/systemd/resolved.conf.d
cat >/etc/systemd/resolved.conf.d/99-eliteew-command-center.conf <<'EOF'
[Resolve]
LLMNR=no
MulticastDNS=no
EOF
systemctl restart systemd-resolved 2>/dev/null || true

echo "=== listeners (expect ${CC_IP}:9090, ${CC_IP}:22; no *:9090) ==="
ss -tulnp | rg ':(22|9090|5355)\s' || true
echo "DONE eliteew-cc-firewall-lan.sh"
