#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Install loopback portal WireGuard exporter on edge via SSH from command-center.
# Invariants:
# - Bind 127.0.0.1:9586 only; interface wg-portal only.
# - Never installs/touches wg-mobile / Meet / mobile dnsmasq.
# Related:
# - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
# shellcheck source=../yandex-tunnel/_ssh_defaults.sh
source "$SCRIPT_DIR/../yandex-tunnel/_ssh_defaults.sh"

ROOT="$(portal_private_tunnel_repo_root "$SCRIPT_DIR")"
eliteew_yandex_source_env "$ROOT" 2>/dev/null || true
portal_private_tunnel_source_env "$ROOT"

VM_IP="${YANDEX_VM_IP:-93.77.165.185}"
ADMIN_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
IFACE="${PORTAL_PRIVATE_TUNNEL_INTERFACE:-wg-portal}"
PORT="${PORTAL_PRIVATE_TUNNEL_PORT:-51823}"
EDGE_WG_IP="${PORTAL_PRIVATE_TUNNEL_EDGE_IP:-10.88.89.1}"
EXPORTER_PORT="${PORTAL_PRIVATE_TUNNEL_EXPORTER_PORT:-9586}"
EXPORTER_LISTEN="${PORTAL_PRIVATE_TUNNEL_EXPORTER_LISTEN:-127.0.0.1}"

portal_private_tunnel_assert_isolation_ids "$IFACE" "$PORT" "$EDGE_WG_IP"

if [[ "$EXPORTER_LISTEN" != "127.0.0.1" && "$EXPORTER_LISTEN" != "::1" ]]; then
	echo "FAIL: exporter listen must be loopback (got ${EXPORTER_LISTEN})" >&2
	exit 1
fi
if [[ "$IFACE" != "wg-portal" ]]; then
	echo "FAIL: exporter interface must be wg-portal" >&2
	exit 1
fi

ADMIN_KEY="$(eliteew_resolve_admin_private "$ROOT" "$ADMIN_USER")" || {
	echo "FAIL: SSH admin key not found" >&2
	exit 1
}

PY_SRC="$SCRIPT_DIR/portal_wg_exporter.py"
UNIT_SRC="$SCRIPT_DIR/systemd/portal-wg-exporter.service"
[[ -f "$PY_SRC" && -f "$UNIT_SRC" ]] || {
	echo "FAIL: missing exporter sources" >&2
	exit 1
}

if ! grep -Eq '127\.0\.0\.1' "$UNIT_SRC"; then
	echo "FAIL: unit template missing 127.0.0.1 bind" >&2
	exit 1
fi
if ! grep -Eq -- '--interface wg-portal' "$UNIT_SRC"; then
	echo "FAIL: unit template must hardcode --interface wg-portal" >&2
	exit 1
fi
if grep -Eqi 'wg-mobile|wg-meet|0\.0\.0\.0' "$UNIT_SRC"; then
	echo "FAIL: unit template references forbidden bind/iface" >&2
	exit 1
fi

SSH=(
	ssh -o BatchMode=yes -o ConnectTimeout=12 -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes
	-i "$ADMIN_KEY" -l "$ADMIN_USER" "$VM_IP"
)

echo "install-edge-exporter → ${ADMIN_USER}@${VM_IP} listen=${EXPORTER_LISTEN}:${EXPORTER_PORT} iface=${IFACE}"

# Stage payload on edge /tmp then install with sudo.
tar -C "$SCRIPT_DIR" -czf - portal_wg_exporter.py systemd/portal-wg-exporter.service |
	"${SSH[@]}" 'cat > /tmp/eliteew-portal-exporter.tgz'

"${SSH[@]}" bash -s -- "$EXPORTER_LISTEN" "$EXPORTER_PORT" "$IFACE" <<'REMOTE'
set -euo pipefail
LISTEN="$1"
PORT="$2"
IFACE="$3"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR" /tmp/eliteew-portal-exporter.tgz' EXIT
tar -C "$WORKDIR" -xzf /tmp/eliteew-portal-exporter.tgz

PY_SRC="$WORKDIR/portal_wg_exporter.py"
UNIT_SRC="$WORKDIR/systemd/portal-wg-exporter.service"
REMOTE_PY="/usr/local/lib/eliteew-portal/portal_wg_exporter.py"
REMOTE_UNIT="/etc/systemd/system/portal-wg-exporter.service"

sed -e "s|--listen 127.0.0.1|--listen ${LISTEN}|g" \
	-e "s|--port 9586|--port ${PORT}|g" \
	-e "s|--interface wg-portal|--interface ${IFACE}|g" \
	"$UNIT_SRC" >"$WORKDIR/unit.rendered"

grep -Eq "127\\.0\\.0\\.1|::1" "$WORKDIR/unit.rendered" || {
	echo "FAIL: rendered unit not loopback" >&2
	exit 1
}
grep -Eq -- "--interface ${IFACE}" "$WORKDIR/unit.rendered" || {
	echo "FAIL: rendered unit iface mismatch" >&2
	exit 1
}
if grep -Eqi '0\.0\.0\.0|wg-mobile|wg-meet' "$WORKDIR/unit.rendered"; then
	echo "FAIL: forbidden pattern in unit" >&2
	exit 1
fi

sudo mkdir -p /usr/local/lib/eliteew-portal
sudo install -m 755 "$PY_SRC" "$REMOTE_PY"
sudo install -m 644 "$WORKDIR/unit.rendered" "$REMOTE_UNIT"
sudo systemctl daemon-reload
sudo systemctl enable portal-wg-exporter.service >/dev/null 2>&1 || true
sudo systemctl restart portal-wg-exporter.service
sleep 1
systemctl is-active portal-wg-exporter.service
curl -fsS "http://${LISTEN}:${PORT}/metrics" | head -25
REMOTE

portal_private_tunnel_audit "$ROOT" "exporter_install" "host=${VM_IP} listen=${EXPORTER_LISTEN}:${EXPORTER_PORT}"
echo "OK: portal-wg-exporter active on edge loopback"
