#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Drop known hostile IPs on prod-core firewalld (FedoraServer).
# Invariants:
# - Idempotent rich-rule insert; requires root.
# - Does not touch edge fail2ban (separate perimeter).
# Related:
# - documentation/platform/PROD-CORE-HOST-HARDEN.md
# - docker/scripts/prod-core/harden-prod-core-host.sh
# ---
set -euo pipefail

ZONE="${ELITEEW_FIREWALL_ZONE:-FedoraServer}"
# Manual hostile drops (internet scanners / unwanted probes to prod-core).
# NOTE: 38.145.32.21 PTR=proxy10.fedoraproject.org (Red Hat) — confirm before long-term keep.
IPS=(
  "34.160.111.45"
  "34.160.111.145"
  "85.236.55.6"
  "18.157.159.91"
  "38.145.32.21"
)

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERROR: run as root (sudo $0)" >&2
  exit 1
fi

if ! command -v firewall-cmd >/dev/null 2>&1; then
  echo "ERROR: firewall-cmd not found" >&2
  exit 1
fi

echo "=== ban hostile IPs on zone=${ZONE} ==="
for ip in "${IPS[@]}"; do
  rule="rule family=\"ipv4\" source address=\"${ip}/32\" drop"
  if firewall-cmd --permanent --zone="${ZONE}" --query-rich-rule="${rule}" >/dev/null 2>&1; then
    echo "already permanent: ${ip}"
  else
    firewall-cmd --permanent --zone="${ZONE}" --add-rich-rule="${rule}"
    echo "added permanent: ${ip}"
  fi
  # runtime too (survive until reload if permanent already applied)
  if firewall-cmd --zone="${ZONE}" --query-rich-rule="${rule}" >/dev/null 2>&1; then
    echo "already runtime: ${ip}"
  else
    firewall-cmd --zone="${ZONE}" --add-rich-rule="${rule}" || true
  fi
done

firewall-cmd --reload
echo "=== verify ==="
missing=0
for ip in "${IPS[@]}"; do
  if ! firewall-cmd --list-rich-rules | grep -Fq "${ip}/32"; then
    echo "MISSING after reload: ${ip}" >&2
    missing=1
  fi
done
if [[ "${missing}" -ne 0 ]]; then
  echo "ERROR: one or more rules not visible after reload" >&2
  exit 1
fi
firewall-cmd --list-rich-rules | grep -E '34\.160\.111\.(45|145)|85\.236\.55\.6|18\.157\.159\.91|38\.145\.32\.21' || true
echo "OK: hostile IPs dropped on ${ZONE}"
