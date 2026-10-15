#!/usr/bin/env bash
# Purpose: Report honest network channel state (offline / degraded / tunnel_up).
# Related: policy/network_handoff.py · docs/NETWORK-HANDOFF.md
set -euo pipefail

ROOT_HINT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd || true)"
CONF="${WG_PORTAL_CONF:-/etc/wireguard/wg-portal.conf}"
IFACE="${WG_PORTAL_IFACE:-wg-portal}"
STATUS_DIR="${ELITEEW_TS_STATUS_DIR:-/run/eliteew-ts}"
STATUS_FILE="${STATUS_DIR}/network-status"

peer=0
iface=0
handshake=0

[[ -f "${CONF}" ]] && peer=1

if ip -br link show "${IFACE}" >/dev/null 2>&1; then
  # UP or UNKNOWN both count as present; check operstate
  state="$(ip -br link show "${IFACE}" 2>/dev/null | awk '{print $2}' || true)"
  if [[ "${state}" == "UP" || "${state}" == "UNKNOWN" ]]; then
    iface=1
  fi
fi

if command -v wg >/dev/null 2>&1 && [[ "${iface}" -eq 1 ]]; then
  # Any non-zero latest handshake → ok for pilot honesty
  if wg show "${IFACE}" latest-handshakes 2>/dev/null | awk 'NF>=2 && $2+0 > 0 {found=1} END{exit !found}'; then
    handshake=1
  fi
fi

# Prefer in-tree policy when available (build host / staged); else inline map
STATE=""
if [[ -n "${ROOT_HINT}" && -f "${ROOT_HINT}/policy/network_handoff.py" ]]; then
  PYTHON_BIN="${PYTHON_BIN:-python3}"
  if [[ -x "${ROOT_HINT}/../../.venv/bin/python" ]]; then
    PYTHON_BIN="${ROOT_HINT}/../../.venv/bin/python"
  fi
  STATE="$(
    PYTHONPATH="${ROOT_HINT}" "${PYTHON_BIN}" - <<PY
from policy.network_handoff import evaluate_network_channel
print(evaluate_network_channel(
    peer_conf_present=bool(${peer}),
    interface_up=bool(${iface}),
    handshake_ok=bool(${handshake}),
).value)
PY
  )"
else
  if [[ "${peer}" -eq 0 ]]; then
    STATE=peer_missing
  elif [[ "${iface}" -eq 0 || "${handshake}" -eq 0 ]]; then
    STATE=degraded
  else
    STATE=tunnel_up
  fi
fi

mkdir -p "${STATUS_DIR}"
{
  echo "state=${STATE}"
  echo "peer_conf_present=${peer}"
  echo "interface_up=${iface}"
  echo "handshake_ok=${handshake}"
  echo "iface=${IFACE}"
  echo "conf=${CONF}"
  echo "updated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "connected=$([ "${STATE}" = tunnel_up ] && echo 1 || echo 0)"
} >"${STATUS_FILE}"

echo "handoff-status: state=${STATE} (connected=$([ "${STATE}" = tunnel_up ] && echo yes || echo no))"
cat "${STATUS_FILE}"
