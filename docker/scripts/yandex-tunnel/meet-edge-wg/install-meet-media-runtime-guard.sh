#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://eliteew.ru · Author: po&T <keysray70@gmail.com>
# ---
# Purpose: Install and enable a systemd timer that guards Meet media runtime invariants.
# Invariants:
# - System scope (root) can auto-fix firewalld; user scope can still fix JVB mapping + legacy container.
# - Timer is persistent and starts after boot in system scope, or with user linger in user scope.
# Related:
# - meet-media-runtime-guard.sh
# - documentation/platform/docker-re_doc/MEET-MEDIA-UDP-NATIVE-PATH.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

ROOT="$(meet_edge_wg_repo_root "$SCRIPT_DIR")"
GUARD_SCRIPT="$SCRIPT_DIR/meet-media-runtime-guard.sh"
SERVICE_NAME="eliteew-meet-media-guard.service"
TIMER_NAME="eliteew-meet-media-guard.timer"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
INSTALL_SCOPE="${1:-auto}" # auto|system|user

usage() {
	cat <<'EOF'
Usage:
  install-meet-media-runtime-guard.sh [auto|system|user]

Scopes:
  auto   - system if root/non-interactive sudo is available, else user.
  system - install into /etc/systemd/system (requires root or non-interactive sudo).
  user   - install into ~/.config/systemd/user (no sudo).
EOF
}

if [[ ! -f "$GUARD_SCRIPT" ]]; then
	echo "Guard script not found: $GUARD_SCRIPT" >&2
	exit 1
fi

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
		echo "Нет root/non-interactive sudo для system scope. Запусти от root или выбери user scope." >&2
		exit 1
	fi
fi

SERVICE_PATH=""
TIMER_PATH=""
ALLOW_FIREWALL_FIX="0"
if [[ "$INSTALL_SCOPE" == "system" ]]; then
	SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}"
	TIMER_PATH="/etc/systemd/system/${TIMER_NAME}"
	ALLOW_FIREWALL_FIX="1"
else
	USER_SYSTEMD_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
	SERVICE_PATH="${USER_SYSTEMD_DIR}/${SERVICE_NAME}"
	TIMER_PATH="${USER_SYSTEMD_DIR}/${TIMER_NAME}"
	ALLOW_FIREWALL_FIX="0"
	mkdir -p "$USER_SYSTEMD_DIR"
fi

tmp_service="$(mktemp)"
tmp_timer="$(mktemp)"
trap 'rm -f "$tmp_service" "$tmp_timer"' EXIT

cat >"$tmp_service" <<EOF
[Unit]
Description=EliteEW Meet media runtime drift guard
After=network-online.target docker.service podman.service
Wants=network-online.target

[Service]
Type=oneshot
Environment=ELITEEW_CONTAINER_RUNTIME=${CONTAINER_RUNTIME}
Environment=MEET_MEDIA_GUARD_ALLOW_FIREWALL_FIX=${ALLOW_FIREWALL_FIX}
WorkingDirectory=${ROOT}
ExecStart=/bin/bash ${GUARD_SCRIPT}

[Install]
WantedBy=multi-user.target
EOF

cat >"$tmp_timer" <<'EOF'
[Unit]
Description=Periodic EliteEW Meet media runtime drift guard

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
AccuracySec=30s
Persistent=true
Unit=eliteew-meet-media-guard.service

[Install]
WantedBy=timers.target
EOF

chmod +x "$GUARD_SCRIPT"

if [[ "$INSTALL_SCOPE" == "system" ]]; then
	"${SUDO[@]}" install -m 0644 "$tmp_service" "$SERVICE_PATH"
	"${SUDO[@]}" install -m 0644 "$tmp_timer" "$TIMER_PATH"

	"${SUDO[@]}" systemctl daemon-reload
	"${SUDO[@]}" systemctl enable --now "$TIMER_NAME"
	"${SUDO[@]}" systemctl start "$SERVICE_NAME"

	"${SUDO[@]}" systemctl --no-pager --full status "$SERVICE_NAME" || true
	"${SUDO[@]}" systemctl --no-pager --full status "$TIMER_NAME" || true
else
	install -m 0644 "$tmp_service" "$SERVICE_PATH"
	install -m 0644 "$tmp_timer" "$TIMER_PATH"

	systemctl --user daemon-reload
	systemctl --user enable --now "$TIMER_NAME"
	systemctl --user start "$SERVICE_NAME"

	systemctl --user --no-pager --full status "$SERVICE_NAME" || true
	systemctl --user --no-pager --full status "$TIMER_NAME" || true
fi

echo ""
echo "Готово:"
echo "- Scope: ${INSTALL_SCOPE}"
echo "- Таймер: ${TIMER_NAME}"
echo "- Сервис: ${SERVICE_NAME}"
echo "- Лог guard: ${ROOT}/docker/data/meet-edge-wg/runtime-guard.log"
if [[ "$INSTALL_SCOPE" == "user" ]]; then
	echo "- Для автозапуска без логина: sudo loginctl enable-linger ${USER}"
fi
