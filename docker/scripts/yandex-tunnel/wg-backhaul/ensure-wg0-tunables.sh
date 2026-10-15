#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Raise Meet WG reliability: MTU 1280 + PersistentKeepalive=25 on prod-core wg0.
# Prefer live `wg set` + patch conf. Run as owned (not sudo) so SSH uses owned keys.
# Related:
# - documentation/platform/docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md
# ---
set -euo pipefail

PROD_CORE_HOST="${PROD_CORE_HOST:-192.168.1.111}"
PROD_CORE_USER="${PROD_CORE_USER:-owned}"
WG_IFACE="${WG_IFACE:-wg0}"
TARGET_MTU="${TARGET_MTU:-1280}"
TARGET_KEEPALIVE="${TARGET_KEEPALIVE:-25}"
LOCAL=0

usage() {
  cat <<EOF
Usage: $0 [--local] [--help]

  Default: SSH as ${PROD_CORE_USER}@${PROD_CORE_HOST} and apply tunables there.
  --local  Apply on this host (run on prod-core, or when wg0 already has 10.77.77.2).

IMPORTANT: do NOT wrap with sudo on command-center.
  Wrong:  sudo bash $0
  Right:  bash $0
Remote sudo password (if needed) is prompted over SSH (-tt).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local) LOCAL=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# Prefer owned SSH known_hosts/keys — root sudo on CC breaks host-key verify.
if [[ "${EUID}" -eq 0 && "${LOCAL}" -eq 0 ]]; then
  if ip -4 -o addr show "${WG_IFACE}" 2>/dev/null | grep -q 'inet 10\.77\.77\.2/'; then
    LOCAL=1
  else
    cat >&2 <<EOF
ERROR: do not run this with sudo on command-center (root SSH → Host key verification failed).

  bash docker/scripts/yandex-tunnel/wg-backhaul/ensure-wg0-tunables.sh

On prod-core itself:
  bash docker/scripts/yandex-tunnel/wg-backhaul/ensure-wg0-tunables.sh --local
EOF
    exit 2
  fi
fi

if [[ "${LOCAL}" -eq 0 ]]; then
  if ip -4 -o addr show "${WG_IFACE}" 2>/dev/null | grep -q 'inet 10\.77\.77\.2/'; then
    LOCAL=1
  fi
fi

apply_local() {
  local conf="/etc/wireguard/${WG_IFACE}.conf"
  echo "=== ensure WG tunables on this host (MTU=${TARGET_MTU}, Keepalive=${TARGET_KEEPALIVE}) ==="
  if ! command -v wg >/dev/null 2>&1; then
    echo "ERROR: wg not installed" >&2
    return 1
  fi
  # Cache credentials once (needs a real TTY). Avoids false "missing conf" when sudo fails.
  if ! sudo -n true 2>/dev/null; then
    echo "sudo required for wg/ip on ${WG_IFACE} (password prompt next)…"
    if ! sudo -v; then
      echo "ERROR: sudo authentication failed" >&2
      return 1
    fi
  fi
  if ! sudo test -f "${conf}"; then
    echo "ERROR: missing ${conf}" >&2
    return 1
  fi
  sudo ip link set mtu "${TARGET_MTU}" dev "${WG_IFACE}" || true
  local pubkey
  pubkey="$(sudo wg show "${WG_IFACE}" peers | head -1 || true)"
  if [[ -n "${pubkey}" ]]; then
    sudo wg set "${WG_IFACE}" peer "${pubkey}" persistent-keepalive "${TARGET_KEEPALIVE}"
  else
    echo "WARN: no peers on ${WG_IFACE}" >&2
  fi
  if ! sudo grep -qE '^[[:space:]]*MTU[[:space:]]*=' "${conf}"; then
    sudo sed -i "/^\[Interface\]/a MTU = ${TARGET_MTU}" "${conf}"
  else
    sudo sed -i -E "s/^[[:space:]]*MTU[[:space:]]*=.*/MTU = ${TARGET_MTU}/" "${conf}"
  fi
  if ! sudo grep -qE '^[[:space:]]*PersistentKeepalive[[:space:]]*=' "${conf}"; then
    sudo sed -i "/^\[Peer\]/a PersistentKeepalive = ${TARGET_KEEPALIVE}" "${conf}"
  else
    sudo sed -i -E "s/^[[:space:]]*PersistentKeepalive[[:space:]]*=.*/PersistentKeepalive = ${TARGET_KEEPALIVE}/" "${conf}"
  fi
  echo "--- live ---"
  sudo wg show "${WG_IFACE}"
  echo "--- conf snippets ---"
  sudo grep -E '^(MTU|PersistentKeepalive)[[:space:]]*=' "${conf}" || true
  echo "OK: tunables applied on $(hostname -s)"
}

if [[ "${LOCAL}" -eq 1 ]]; then
  apply_local
  exit 0
fi

# Do NOT feed the script on ssh stdin (<"$0"): that steals the TTY and breaks sudo -v.
# Ship the script as base64 in the remote argv; keep local stdin as the terminal (-tt).
if [[ ! -t 0 && ! -t 1 ]]; then
  cat >&2 <<EOF
ERROR: no TTY — cannot prompt for remote sudo.

From an interactive terminal on command-center (as owned, WITHOUT sudo):

  bash docker/scripts/yandex-tunnel/wg-backhaul/ensure-wg0-tunables.sh

Or login to prod-core and run:

  ssh -t ${PROD_CORE_USER}@${PROD_CORE_HOST}
  # then paste/run apply with sudo, or copy this script and:
  bash ensure-wg0-tunables.sh --local
EOF
  exit 2
fi

echo "=== ensure WG tunables on ${PROD_CORE_HOST} via SSH as ${PROD_CORE_USER} (MTU=${TARGET_MTU}, Keepalive=${TARGET_KEEPALIVE}) ==="
_script_b64="$(base64 -w0 "$0")"
# shellcheck disable=SC2029
ssh -tt \
  -o BatchMode=yes \
  -o ConnectTimeout=12 \
  -o StrictHostKeyChecking=accept-new \
  "${PROD_CORE_USER}@${PROD_CORE_HOST}" \
  "echo '${_script_b64}' | base64 -d | PROD_CORE_HOST='${PROD_CORE_HOST}' PROD_CORE_USER='${PROD_CORE_USER}' WG_IFACE='${WG_IFACE}' TARGET_MTU='${TARGET_MTU}' TARGET_KEEPALIVE='${TARGET_KEEPALIVE}' bash -s -- --local"
