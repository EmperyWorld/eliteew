#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Install the bounded prod-core/WireGuard clock fallback on the public edge VM.
# Invariants:
# - Uses the canonical edge admin key resolver; never copies credentials.
# - Native synchronized NTP retains precedence.
# - Service gets only CAP_SYS_TIME and network access to prod-core WG.
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"
# shellcheck source=../_ssh_defaults.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_ssh_defaults.sh"

ROOT="$(wg_backhaul_repo_root "$SCRIPT_DIR")"
eliteew_yandex_source_env "$ROOT" 2>/dev/null || true

VM_IP="${YANDEX_VM_IP:-93.77.165.185}"
ADMIN_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
ADMIN_KEY="$(eliteew_resolve_admin_private "$ROOT" "$ADMIN_USER")"
RUNTIME_SRC="$SCRIPT_DIR/edge-time-sync-from-prod.sh"
RUNTIME_DST="/usr/local/libexec/eliteew-edge-time-sync-from-prod"
SERVICE_NAME="eliteew-edge-time-sync.service"
TIMER_NAME="eliteew-edge-time-sync.timer"

[[ -r "$ADMIN_KEY" ]] || {
	echo "edge admin key missing" >&2
	exit 1
}
[[ -f "$RUNTIME_SRC" ]] || {
	echo "runtime source missing: $RUNTIME_SRC" >&2
	exit 1
}

bash "$RUNTIME_SRC" --selftest

ssh_opts=(
	-o BatchMode=yes
	-o ConnectTimeout=15
	-o IdentitiesOnly=yes
	-o StrictHostKeyChecking=accept-new
	-i "$ADMIN_KEY"
)

ADMIN_HOST="$VM_IP"
if ! ssh "${ssh_opts[@]}" -l "$ADMIN_USER" "$VM_IP" true 2>/dev/null; then
	ADMIN_HOST="${WG_BACKHAUL_EDGE_ADMIN_HOST:-10.77.77.1}"
	echo "public SSH fail; using WG admin ${ADMIN_HOST}"
fi

echo "=== install edge time-sync runtime via ${ADMIN_HOST} ==="
ssh "${ssh_opts[@]}" -l "$ADMIN_USER" "$ADMIN_HOST" \
	"sudo install -d -o root -g root -m 0755 /usr/local/libexec; sudo tee '$RUNTIME_DST' >/dev/null; sudo chmod 0755 '$RUNTIME_DST'" \
	<"$RUNTIME_SRC"

# Client-side expansion intentionally renders fixed unit paths into the payload.
# shellcheck disable=SC2087
ssh "${ssh_opts[@]}" -l "$ADMIN_USER" "$ADMIN_HOST" \
	"sudo tee '/etc/systemd/system/${SERVICE_NAME}' >/dev/null" <<EOF
[Unit]
Description=EliteEW edge clock fallback from prod-core over WireGuard
Documentation=file:///usr/local/libexec/eliteew-edge-time-sync-from-prod
After=network-online.target wg-quick@wg-meet-edge.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=${RUNTIME_DST} --apply
User=root
Group=root
NoNewPrivileges=true
CapabilityBoundingSet=CAP_SYS_TIME
AmbientCapabilities=CAP_SYS_TIME
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectClock=false
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_UNIX AF_INET
RestrictSUIDSGID=true
LockPersonality=true
MemoryDenyWriteExecute=true
IPAddressDeny=any
IPAddressAllow=10.77.77.2/32
EOF

# Client-side expansion intentionally renders the fixed service name.
# shellcheck disable=SC2087
ssh "${ssh_opts[@]}" -l "$ADMIN_USER" "$ADMIN_HOST" \
	"sudo tee '/etc/systemd/system/${TIMER_NAME}' >/dev/null" <<EOF
[Unit]
Description=Run EliteEW edge clock fallback

[Timer]
OnBootSec=20s
OnUnitActiveSec=60s
RandomizedDelaySec=5s
AccuracySec=1s
Persistent=true
Unit=${SERVICE_NAME}

[Install]
WantedBy=timers.target
EOF

echo "=== activate and verify edge time-sync ==="
ssh "${ssh_opts[@]}" -l "$ADMIN_USER" "$ADMIN_HOST" \
	"sudo systemctl daemon-reload; sudo systemctl enable --now '${TIMER_NAME}'; sudo systemctl start '${SERVICE_NAME}'; sudo systemctl is-active '${TIMER_NAME}'; sudo '${RUNTIME_DST}' --check; printf 'edge_epoch='; date +%s; printf 'ntp_synchronized='; timedatectl show -p NTPSynchronized --value"

echo "edge_time_sync_install_ok host=${ADMIN_HOST}"
