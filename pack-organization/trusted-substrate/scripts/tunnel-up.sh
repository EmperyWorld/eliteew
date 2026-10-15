#!/usr/bin/env bash
# Purpose: Bring up WireGuard portal iface when peer conf exists (root); honest status.
# Related: docs/NETWORK-HANDOFF.md · eliteew-ts-tunnel.service
# Does not block forever — app may start offline after timeout.
set -euo pipefail

CONF="${WG_PORTAL_CONF:-/etc/wireguard/wg-portal.conf}"
IFACE="${WG_PORTAL_IFACE:-wg-portal}"
WAIT_SEC="${ELITEEW_TS_TUNNEL_WAIT_SEC:-20}"
STATUS_HELPER="${STATUS_HELPER:-/usr/local/sbin/eliteew-ts-handoff-status}"

log() { printf 'eliteew-ts-tunnel-up: %s\n' "$*" >&2; }

[[ "$(id -u)" -eq 0 ]] || { log "must run as root"; exit 1; }

if [[ ! -f "${CONF}" ]]; then
  log "peer missing (${CONF}) — skip tunnel"
  exit 0
fi

systemctl enable "wg-quick@${IFACE}.service" >/dev/null 2>&1 || true
if ! systemctl start "wg-quick@${IFACE}.service"; then
  log "wg-quick@${IFACE} start failed — continue (app may run offline)"
fi

deadline=$((SECONDS + WAIT_SEC))
while (( SECONDS < deadline )); do
  if [[ -x "${STATUS_HELPER}" ]]; then
    "${STATUS_HELPER}" >/dev/null 2>&1 || true
  fi
  if [[ -f /run/eliteew-ts/network-status ]] && grep -qx 'connected=1' /run/eliteew-ts/network-status; then
    log "tunnel_up within ${WAIT_SEC}s"
    exit 0
  fi
  sleep 1
done

log "tunnel not up within ${WAIT_SEC}s — starting shell offline (honest)"
if [[ -x "${STATUS_HELPER}" ]]; then
  "${STATUS_HELPER}" >/dev/null 2>&1 || true
fi
exit 0
