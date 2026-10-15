#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# firewalld on command-center: allow NFS (rpcbind/mountd/nfs) from prod-core .111 only.
# Invariants:
# - Run on .136 with sudo; idempotent rich-rules per source IP.
# Related:
# - docker/scripts/prod-line-lib.sh
# - documentation/platform/PROD-CORE-DEV-BIND-LINE.md
# ---
set -euo pipefail

PROD_CORE_IP="${PROD_CORE_IP:-192.168.1.111}"
ZONE="${FIREWALLD_ZONE:-}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run with sudo on command-center (.136)." >&2
  exit 1
fi

if ! command -v firewall-cmd >/dev/null 2>&1; then
  echo "firewall-cmd not found — open TCP 111,2049,20048 from ${PROD_CORE_IP} manually." >&2
  exit 1
fi

if [[ -z "${ZONE}" ]]; then
  ZONE="$(firewall-cmd --get-active-zones 2>/dev/null | awk 'NR==1{print $1; exit}')"
fi
if [[ -z "${ZONE}" ]]; then
  ZONE="FedoraServer"
fi

PORTS_TCP=(111 2049 20048)

echo "=== prod-line firewalld (.136) ==="
echo "Zone   : ${ZONE}"
echo "Source : ${PROD_CORE_IP}/32"
echo "Ports  : ${PORTS_TCP[*]} (tcp)"

for port in "${PORTS_TCP[@]}"; do
  rule="rule family=ipv4 source address=${PROD_CORE_IP}/32 port port=${port} protocol=tcp accept"
  if firewall-cmd --permanent --zone="${ZONE}" --add-rich-rule="${rule}" 2>/dev/null; then
    echo "OK rich-rule tcp/${port}"
  else
    echo "SKIP or exists: tcp/${port}"
  fi
done

firewall-cmd --reload
echo "Done. Verify from prod-core:"
echo "  showmount -e 192.168.1.136"
echo "  sudo mount -t nfs 192.168.1.136:/srv/eliteew/prod-line-export /mnt/eliteew-prod-line-export -o ro,nfsvers=4.2"
