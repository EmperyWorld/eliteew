#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Install portal-only self-heal oneshot+timer on edge via SSH from command-center.
# Invariants:
# - Deploys only edge-heal-wg-portal.sh + portal-wg-heal.{service,timer}.
# - Abort if payload mentions wg-mobile / Meet / 0.0.0.0 bind patterns.
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

portal_private_tunnel_assert_isolation_ids "$IFACE" "$PORT" "$EDGE_WG_IP"

ADMIN_KEY="$(eliteew_resolve_admin_private "$ROOT" "$ADMIN_USER")" || {
	echo "FAIL: SSH admin key not found" >&2
	exit 1
}

for f in edge-heal-wg-portal.sh systemd/portal-wg-heal.service systemd/portal-wg-heal.timer; do
	[[ -f "$SCRIPT_DIR/$f" ]] || {
		echo "FAIL: missing $f" >&2
		exit 1
	}
done

# Payload must hardcode portal units; foreign iface names only allowed as rejection needles elsewhere.
if ! grep -Eq 'wg-quick@wg-portal\.service' "$SCRIPT_DIR/edge-heal-wg-portal.sh"; then
	echo "FAIL: heal script must target wg-quick@wg-portal.service" >&2
	exit 1
fi
if grep -Eq 'systemctl (restart|start|stop|enable).*(wg-mobile|wg-meet)' \
	"$SCRIPT_DIR/edge-heal-wg-portal.sh" \
	"$SCRIPT_DIR/systemd/portal-wg-heal.service"; then
	echo "FAIL: heal payload must not mutate mobile/Meet units" >&2
	exit 1
fi

SSH=(
	ssh -o BatchMode=yes -o ConnectTimeout=12 -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes
	-i "$ADMIN_KEY" -l "$ADMIN_USER" "$VM_IP"
)

echo "install-edge-heal → ${ADMIN_USER}@${VM_IP}"

tar -C "$SCRIPT_DIR" -czf - \
	edge-heal-wg-portal.sh \
	systemd/portal-wg-heal.service \
	systemd/portal-wg-heal.timer |
	"${SSH[@]}" 'cat > /tmp/eliteew-portal-heal.tgz'

"${SSH[@]}" bash -s <<'REMOTE'
set -euo pipefail
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR" /tmp/eliteew-portal-heal.tgz' EXIT
tar -C "$WORKDIR" -xzf /tmp/eliteew-portal-heal.tgz

if grep -Eq 'systemctl (restart|start|stop|enable).*(wg-mobile|wg-meet)' \
	"$WORKDIR/edge-heal-wg-portal.sh" "$WORKDIR/systemd/portal-wg-heal.service"; then
	echo "FAIL: staged heal would mutate mobile/Meet" >&2
	exit 1
fi

sudo mkdir -p /usr/local/lib/eliteew-portal
sudo install -m 755 "$WORKDIR/edge-heal-wg-portal.sh" /usr/local/lib/eliteew-portal/edge-heal-wg-portal.sh
sudo install -m 644 "$WORKDIR/systemd/portal-wg-heal.service" /etc/systemd/system/portal-wg-heal.service
sudo install -m 644 "$WORKDIR/systemd/portal-wg-heal.timer" /etc/systemd/system/portal-wg-heal.timer
sudo systemctl daemon-reload
sudo systemctl enable --now portal-wg-heal.timer
sudo systemctl start portal-wg-heal.service
systemctl is-active portal-wg-heal.timer
systemctl --no-pager --full status portal-wg-heal.service | head -15 || true
REMOTE

portal_private_tunnel_audit "$ROOT" "heal_install" "host=${VM_IP}"
echo "OK: portal-wg-heal.timer enabled on edge"
