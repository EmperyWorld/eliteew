#!/usr/bin/env bash
# Purpose: Apply WireGuard peer conf AFTER install (never from ISO).
# Related: docs/NETWORK-HANDOFF.md · portal-private-tunnel README
set -euo pipefail

die() { printf 'handoff-apply-peer: %s\n' "$*" >&2; exit 1; }

SRC="${1:-}"
DEST="${WG_PORTAL_CONF:-/etc/wireguard/wg-portal.conf}"
IFACE="${WG_PORTAL_IFACE:-wg-portal}"

[[ -n "${SRC}" ]] || die "usage: handoff-apply-peer.sh /secure/path/to/wg-portal.conf"

# Refuse install-media / payload bake paths before privilege checks
case "${SRC}" in
  */eliteew-ts-payload/*|*/iso*)
    die "refusing path that looks like install media/payload: ${SRC}"
    ;;
esac
if [[ "${SRC}" == /run/install/* || "${SRC}" == /mnt/install/* ]]; then
  die "refusing install-media path: ${SRC}"
fi

[[ "$(id -u)" -eq 0 ]] || die "run as root"
[[ -f "${SRC}" ]] || die "peer conf missing: ${SRC}"

install -d -m 0700 /etc/wireguard
install -m 0600 "${SRC}" "${DEST}"

systemctl enable "wg-quick@${IFACE}.service"
systemctl restart "wg-quick@${IFACE}.service"

# Unified product path: tunnel unit + kiosk (app under cage) in one apply.
systemctl enable eliteew-ts-tunnel.service >/dev/null 2>&1 || true
systemctl start eliteew-ts-tunnel.service >/dev/null 2>&1 || true
systemctl restart eliteew-ts-kiosk.service >/dev/null 2>&1 || true

echo "handoff-apply-peer: installed ${DEST} and restarted wg-quick@${IFACE}"
echo "handoff-apply-peer: tunnel + kiosk restarted (app + channel together)"
echo "handoff-apply-peer: next → eliteew-ts-handoff-status  (or eliteew-ts-smoke)"
