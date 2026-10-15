#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Install systemd timer for yandex-tunnel-runtime-guard.sh (auto clear zombie -R + recreate tunnel).
# Invariants:
# - Prefer system scope when root/non-interactive sudo is available; else user scope.
# Related:
# - yandex-tunnel-runtime-guard.sh
# - meet-edge-wg/install-meet-media-runtime-guard.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
GUARD_SCRIPT="$SCRIPT_DIR/yandex-tunnel-runtime-guard.sh"
SERVICE_NAME="eliteew-yandex-tunnel-guard.service"
TIMER_NAME="eliteew-yandex-tunnel-guard.timer"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
INSTALL_SCOPE="${1:-auto}"

usage() {
	cat <<'EOF'
Usage:
  install-yandex-tunnel-runtime-guard.sh [auto|system|user]

Scopes:
  auto   - system if root/non-interactive sudo is available, else user.
  system - /etc/systemd/system (root or sudo -n).
  user   - ~/.config/systemd/user
EOF
}

if [[ ! -f "$GUARD_SCRIPT" ]]; then
	echo "Guard script not found: $GUARD_SCRIPT" >&2
	exit 1
fi
chmod +x "$GUARD_SCRIPT"

if [[ "$INSTALL_SCOPE" == "-h" || "$INSTALL_SCOPE" == "--help" ]]; then
	usage
	exit 0
fi
if [[ "$INSTALL_SCOPE" != "auto" && "$INSTALL_SCOPE" != "system" && "$INSTALL_SCOPE" != "user" ]]; then
	echo "Invalid scope: $INSTALL_SCOPE" >&2
	usage
	exit 1
fi

can_sudo_non_interactive=0
if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
	can_sudo_non_interactive=1
fi

if [[ "$INSTALL_SCOPE" == "auto" ]]; then
	if [[ "${EUID}" -eq 0 || "$can_sudo_non_interactive" -eq 1 ]]; then
		INSTALL_SCOPE="system"
	else
		INSTALL_SCOPE="user"
	fi
fi

SUDO=()
if [[ "$INSTALL_SCOPE" == "system" ]]; then
	if [[ "${EUID}" -eq 0 ]]; then
		SUDO=()
	elif [[ "$can_sudo_non_interactive" -eq 1 ]]; then
		SUDO=(sudo -n)
	else
		echo "Нет root/non-interactive sudo для system scope. Запусти от root или выбери user." >&2
		exit 1
	fi
fi

if [[ "$INSTALL_SCOPE" == "system" ]]; then
	SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}"
	TIMER_PATH="/etc/systemd/system/${TIMER_NAME}"
else
	USER_SYSTEMD_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
	SERVICE_PATH="${USER_SYSTEMD_DIR}/${SERVICE_NAME}"
	TIMER_PATH="${USER_SYSTEMD_DIR}/${TIMER_NAME}"
	mkdir -p "$USER_SYSTEMD_DIR"
fi

tmp_service="$(mktemp)"
tmp_timer="$(mktemp)"
trap 'rm -f "$tmp_service" "$tmp_timer"' EXIT

cat >"$tmp_service" <<EOF
[Unit]
Description=EliteEW Yandex reverse-SSH tunnel runtime guard
After=network-online.target podman.service docker.service
Wants=network-online.target

[Service]
Type=oneshot
Environment=ELITEEW_CONTAINER_RUNTIME=${CONTAINER_RUNTIME}
Environment=YANDEX_TUNNEL_GUARD_ALLOW_EDGE_SSH=1
Environment=YANDEX_TUNNEL_GUARD_ALLOW_RELAY_RESTART=1
WorkingDirectory=${REPO_ROOT}
ExecStart=/bin/bash ${GUARD_SCRIPT}

[Install]
WantedBy=multi-user.target
EOF

cat >"$tmp_timer" <<'EOF'
[Unit]
Description=Periodic EliteEW Yandex tunnel runtime guard

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
AccuracySec=30s
Persistent=true
Unit=eliteew-yandex-tunnel-guard.service

[Install]
WantedBy=timers.target
EOF

if [[ "$INSTALL_SCOPE" == "system" ]]; then
	"${SUDO[@]}" cp "$tmp_service" "$SERVICE_PATH"
	"${SUDO[@]}" cp "$tmp_timer" "$TIMER_PATH"
	"${SUDO[@]}" systemctl daemon-reload
	"${SUDO[@]}" systemctl enable --now "$TIMER_NAME"
	"${SUDO[@]}" systemctl start "$SERVICE_NAME" || true
	echo "Installed system timer: $TIMER_NAME"
	"${SUDO[@]}" systemctl list-timers --all | grep -F "$TIMER_NAME" || true
else
	cp "$tmp_service" "$SERVICE_PATH"
	cp "$tmp_timer" "$TIMER_PATH"
	systemctl --user daemon-reload
	systemctl --user enable --now "$TIMER_NAME"
	systemctl --user start "$SERVICE_NAME" || true
	# linger so user timers survive logout on prod-core
	if command -v loginctl >/dev/null 2>&1; then
		loginctl enable-linger "$USER" 2>/dev/null || true
	fi
	echo "Installed user timer: $TIMER_NAME"
	systemctl --user list-timers --all | grep -F "$TIMER_NAME" || true
fi

echo "Guard log: ${REPO_ROOT}/docker/data/stack-yandex-tunnel/runtime-guard.log"
echo "Manual run: bash ${GUARD_SCRIPT}"
