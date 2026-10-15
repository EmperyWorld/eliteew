#!/usr/bin/env bash
# Read-only AWG health on command-center — asymmetry, userspace vs kernel, mode state.
set -euo pipefail

IFACE="${AWG_IFACE:-awg0}"
STATE="/var/lib/eliteew-cc-network-mode"

log() { printf '%s\n' "$*"; }

if ! ip link show "${IFACE}" &>/dev/null; then
  log "awg: ${IFACE} DOWN (OK for CC idle — prefer mode 1 or 4 when needed)"
  log "mode=$(cat "${STATE}" 2>/dev/null || echo unknown)"
  exit 0
fi

log "=== AWG diagnose ${IFACE} ==="
log "mode=$(cat "${STATE}" 2>/dev/null || echo unknown)"
log "link: $(ip -br link show "${IFACE}" 2>/dev/null || true)"

if lsmod | rg -q amneziawg; then
  log "driver: kernel module amneziawg"
else
  log "driver: userspace amneziawg-go (high CPU / GiB sent on half-dead peer is common)"
  pgrep -a amneziawg-go || true
fi

if command -v awg >/dev/null; then
  awg show "${IFACE}" 2>/dev/null || true
fi

rx_b=0
tx_b=0
while IFS= read -r line; do
  case "${line}" in
    *received,*sent*)
      rx_b=$(echo "${line}" | sed -n 's/.*received, \([0-9.]* [KMG]*i*B\) sent.*/\1/p' | head -1)
      ;;
  esac
done < <(awg show "${IFACE}" 2>/dev/null | rg "transfer:" || true)

# Parse transfer line simply
trans=$(awg show "${IFACE}" 2>/dev/null | rg "transfer:" | tail -1 || true)
log "transfer: ${trans:-n/a}"

if awg show "${IFACE}" 2>/dev/null | rg -q "transfer:.*received,.*sent"; then
  rx_raw=$(awg show "${IFACE}" | rg "transfer:" | sed 's/.*received, //;s/ sent.*//')
  tx_raw=$(awg show "${IFACE}" | rg "transfer:" | sed 's/.*received, [^,]* sent, //;s/ sent//')
  # awg format: "X received, Y sent" on one line
  line=$(awg show "${IFACE}" | rg "^\s+transfer:" | tail -1)
  if [[ -n "${line}" ]]; then
    rx_part=$(echo "${line}" | awk '{print $2, $3}')
    tx_part=$(echo "${line}" | awk '{print $5, $6}')
    log "parsed: rx=${rx_part} tx=${tx_part}"
    if echo "${line}" | rg -q "B received.*GiB sent|KiB received.*MiB sent|92 B received"; then
      log ""
      log "VERDICT: asymmetric — allowlist may be OK (handshake), but data channel is not healthy."
      log "  1) sudo awg-quick down ${IFACE}  (stop UDP flood immediately)"
      log "  2) On VPS: awg show — peer must list THIS public key; transfer should grow both ways"
      log "  3) CC: install kernel module (amneziawg-dkms) if Secure Boot allows — not amneziawg-go"
      log "  4) Use mode 4 on .136, not full tunnel mode 2, for daily work"
    fi
  fi
fi

log ""
log "routes (v4):"
ip -4 route | head -12
