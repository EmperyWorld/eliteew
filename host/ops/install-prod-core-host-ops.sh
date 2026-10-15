#!/usr/bin/env bash
# ---
# EliteEW host ops · install nvidia-gpu-fanctl on prod-core (.111)
# Purpose: push multi-GPU-safe fanctl from repo SoT and restart the service.
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OPS="${ROOT}/host/ops"
TARGET="${ELITEEW_PROD_CORE_SSH:-192.168.1.111}"
REMOTE_NEW="${REMOTE_FANCTL_STAGING:-/home/owned/nvidia-gpu-fanctl.sh.new}"

scp -o BatchMode=yes "${OPS}/nvidia-gpu-fanctl.sh" "${TARGET}:${REMOTE_NEW}"

# Prefer a TTY so remote sudo can prompt; fall back to BatchMode for NOPASSWD setups.
ssh_opts=(-o ConnectTimeout=15)
if [[ -t 0 ]]; then
	ssh_opts+=(-t)
else
	ssh_opts+=(-o BatchMode=yes)
fi

# shellcheck disable=SC2029 # intentional: remote path is a controlled local variable
ssh "${ssh_opts[@]}" "${TARGET}" "bash -s -- $(printf '%q' "${REMOTE_NEW}")" <<'REMOTE'
set -euo pipefail
NEW="${1:?missing staged fanctl path}"
test -f "${NEW}"
bash -n "${NEW}"
sudo install -m 0755 "${NEW}" /usr/local/sbin/nvidia-gpu-fanctl.sh
sudo install -m 0755 "${NEW}" /usr/local/bin/nvidia-gpu-fanctl.sh
sudo systemctl restart nvidia-gpu-fanctl.service
n="$(nvidia-smi --query-gpu=index --format=csv,noheader,nounits | rg -c '^[0-9]+$' || echo 1)"
args=()
for ((i = 0; i < n; i++)); do
	args+=(-a "[gpu:${i}]/GPUFanControlState=0")
done
sudo env DISPLAY=:0 XAUTHORITY=/var/lib/fanboost/xauth nvidia-settings "${args[@]}" >/dev/null
sleep 1
nvidia-smi --query-gpu=index,name,fan.speed,temperature.gpu,utilization.gpu --format=csv
systemctl is-active nvidia-gpu-fanctl.service
REMOTE

echo "OK: prod-core fanctl installed from ${OPS}/nvidia-gpu-fanctl.sh"
