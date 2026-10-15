#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Install user systemd unit+timer so stack-kbsew is restarted after reboot when
# system podman-restart.service is unavailable (no sudo). Requires Linger=yes.
# Invariants:
# - User units only (systemctl --user); does not disable podman --restart policy.
# - Timer polls every 5 minutes as a safety net for silent exits.
# Related:
# - docker/scripts/kbsew-ensure-running.sh
# - documentation/product/KBSEW.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENSURE="${REPO_ROOT}/docker/scripts/kbsew-ensure-running.sh"
UNIT_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
SERVICE_NAME="eliteew-kbsew-ensure.service"
TIMER_NAME="eliteew-kbsew-ensure.timer"

if [[ ! -x "${ENSURE}" ]]; then
  chmod +x "${ENSURE}" || true
fi
if [[ ! -f "${ENSURE}" ]]; then
  echo "ERROR: missing ${ENSURE}" >&2
  exit 1
fi

linger="$(loginctl show-user "${USER}" -p Linger --value 2>/dev/null || echo no)"
if [[ "${linger}" != "yes" ]]; then
  echo "WARN: Linger is not yes for ${USER} — user units may not start at boot." >&2
  echo "      Operator: loginctl enable-linger ${USER}" >&2
fi

mkdir -p "${UNIT_DIR}"

cat >"${UNIT_DIR}/${SERVICE_NAME}" <<EOF
[Unit]
Description=EliteEW ensure stack-kbsew is running
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=${ENSURE}
WorkingDirectory=${REPO_ROOT}

[Install]
WantedBy=default.target
EOF

cat >"${UNIT_DIR}/${TIMER_NAME}" <<EOF
[Unit]
Description=EliteEW KBSEW liveness timer (every 5m)

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true
Unit=${SERVICE_NAME}

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "${SERVICE_NAME}"
systemctl --user enable --now "${TIMER_NAME}"
systemctl --user start "${SERVICE_NAME}" || true

echo "[ok] enabled ${SERVICE_NAME} + ${TIMER_NAME}"
systemctl --user --no-pager status "${TIMER_NAME}" | head -15 || true

if systemctl is-enabled podman-restart.service >/dev/null 2>&1; then
  echo "[info] system podman-restart.service is enabled (preferred host-wide recovery)"
else
  echo "[info] system podman-restart.service is NOT enabled (needs sudo)."
  echo "       Preferred: sudo systemctl enable --now podman-restart.service"
  echo "       User timer remains as fallback for stack-kbsew only."
fi
