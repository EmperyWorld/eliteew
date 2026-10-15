#!/usr/bin/env bash
# Split tunnel for command-center: RFC1918 + LAN CIDR stay on physical NIC; rest via AWG.
# Patches /etc/amnezia/amneziawg/<iface>.conf (keeps keys/obfuscation lines intact).
# Run: sudo IFACE=awg0 LAN_DEV=enp5s0 bash awg-split-tunnel-local-lan.sh
set -euo pipefail

IFACE="${IFACE:-awg0}"
LAN_DEV="${LAN_DEV:-enp5s0}"
LAN_CIDR="${LAN_CIDR:-192.168.1.0/24}"
CONF="/etc/amnezia/amneziawg/${IFACE}.conf"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi
[[ -f "${CONF}" ]] || { echo "Missing ${CONF}" >&2; exit 1; }

BACKUP="${CONF}.bak.$(date -u +%Y%m%dT%H%M%SZ)"
cp -a "${CONF}" "${BACKUP}"
echo "Backup: ${BACKUP}"

# IPv4 default via VPN (two /1 routes — same coverage as 0.0.0.0/0, no ::/0).
# Kernel still prefers connected /24 on ${LAN_DEV} for ${LAN_CIDR}; PostUp adds explicit RFC1918 on-LAN.
SPLIT_ALLOWED='0.0.0.0/1, 128.0.0.0/1'

POST_UP="PostUp = ip route replace ${LAN_CIDR} dev ${LAN_DEV} scope link; ip route replace 10.0.0.0/8 dev ${LAN_DEV} metric 5; ip route replace 172.16.0.0/12 dev ${LAN_DEV} metric 5; ip route replace 192.168.0.0/16 dev ${LAN_DEV} metric 5"
PRE_DOWN="PreDown = ip route del ${LAN_CIDR} dev ${LAN_DEV} 2>/dev/null || true; ip route del 10.0.0.0/8 dev ${LAN_DEV} 2>/dev/null || true; ip route del 172.16.0.0/12 dev ${LAN_DEV} 2>/dev/null || true; ip route del 192.168.0.0/16 dev ${LAN_DEV} 2>/dev/null || true"

tmp="$(mktemp)"
awk -v allowed="${SPLIT_ALLOWED}" '
  BEGIN { in_peer=0; done_allowed=0 }
  /^\[Peer\]/ { in_peer=1 }
  /^AllowedIPs\s*=/ && in_peer {
    print "AllowedIPs = " allowed
    done_allowed=1
    next
  }
  /^PostUp\s*=|^PreDown\s*=|^Table\s*=/ { next }
  { print }
  END {
    if (!done_allowed) {
      print "[Peer] section or AllowedIPs not found — fix manually" > "/dev/stderr"
      exit 1
    }
  }
' "${CONF}" >"${tmp}"

# Strip old PostUp/PreDown from [Interface] handled above; append fresh Interface hooks before [Peer]
iface_tmp="$(mktemp)"
awk -v post="${POST_UP}" -v pre="${PRE_DOWN}" '
  /^\[Peer\]/ && !added {
    print post
    print pre
    added=1
  }
  { print }
' "${tmp}" >"${iface_tmp}"

mv "${iface_tmp}" "${CONF}"
chmod 600 "${CONF}"

echo "Patched ${CONF}:"
grep -E '^(AllowedIPs|PostUp|PreDown)\s*=' "${CONF}" || true

if awg show "${IFACE}" >/dev/null 2>&1; then
  echo "Restarting ${IFACE}..."
  awg-quick down "${IFACE}" || true
  awg-quick up "${IFACE}"
fi

echo ""
echo "Verify (expect enp5s0 for .111, awg0 for 1.1.1.1):"
echo "  ip route get 192.168.1.111"
echo "  ip route get 1.1.1.1"
echo "  curl -4 --max-time 5 -fsS https://ifconfig.me; echo"
