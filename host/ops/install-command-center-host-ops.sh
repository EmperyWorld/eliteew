#!/usr/bin/env bash
# ---
# EliteEW command-center host ops · install helper
# Purpose: sync host/ops scripts + systemd units to /usr/local/sbin and systemd.
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OPS="${ROOT}/host/ops"

if [[ "$(id -u)" -ne 0 ]]; then
	echo "Run as root: sudo bash ${OPS}/install-command-center-host-ops.sh" >&2
	exit 1
fi

install -m 0755 "${OPS}/ensure-fanboost-xauth.sh" /usr/local/sbin/ensure-fanboost-xauth.sh
install -m 0755 "${OPS}/nvidia-gpu-fanctl.sh" /usr/local/sbin/nvidia-gpu-fanctl.sh
install -m 0755 "${OPS}/nvidia-gpu-fanctl.sh" /usr/local/bin/nvidia-gpu-fanctl.sh
install -m 0755 "${OPS}/log-boot-reset-reason.sh" /usr/local/sbin/log-boot-reset-reason.sh

install -D -m 0644 "${OPS}/systemd/nvidia-gpu-fanctl.service" /etc/systemd/system/nvidia-gpu-fanctl.service
install -D -m 0644 "${OPS}/systemd/eliteew-boot-reset-reason.service" /etc/systemd/system/eliteew-boot-reset-reason.service
install -D -m 0644 "${OPS}/systemd/fanboost-x11.service.d/ensure-xauth.conf" \
	/etc/systemd/system/fanboost-x11.service.d/ensure-xauth.conf

mkdir -p /var/log/eliteew-host /var/lib/eliteew/host
chmod 755 /var/log/eliteew-host /var/lib/eliteew/host

/usr/local/sbin/ensure-fanboost-xauth.sh || true

systemctl daemon-reload
systemctl enable eliteew-boot-reset-reason.service
systemctl try-restart fanboost-x11.service
systemctl try-restart nvidia-gpu-fanctl.service
systemctl start eliteew-boot-reset-reason.service

echo "OK: command-center host ops installed"
echo "  log: /var/log/eliteew-host/boot-reset-reason.log"
systemctl --no-pager --full status nvidia-gpu-fanctl.service eliteew-boot-reset-reason.service | sed -n '1,12p'
