#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# DEWA ops: prod-core Podman egress status / set mode / apply / verify via SSH.
# Related: docker/scripts/prod-core/apply-podman-egress-lock.sh
# ---
set -euo pipefail

# shellcheck source=eliteew-ops-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/eliteew-ops-lib.sh"

ACTION="${1:-status}"
ARG2="${2:-}"
ARG3="${3:-}"

usage() {
  cat <<EOF
Usage: $(basename "$0") status|apply|verify|set <container> <lock|allowlist|wan_open>|install

  status   JSON status of all policy containers (+ unmanaged running)
  apply    re-apply nft from policy
  verify   smoke probes
  set      change mode and apply (admin)
  install  copy scripts + user timers on prod-core
EOF
}

if dewa_ops_is_dry_run; then
  dewa_ops_log_dry_run "podman-egress ${ACTION} ${ARG2} ${ARG3} via ${DEWA_OPS_PROD_CORE_SSH}"
  exit 0
fi

case "$ACTION" in
  status)
    ssh -o BatchMode=yes -o ConnectTimeout=15 "${DEWA_OPS_PROD_CORE_SSH}" \
      'bash /home/owned/bin/eliteew-podman-egress-lock.sh --status-json'
    ;;
  apply)
    ssh -o BatchMode=yes -o ConnectTimeout=30 "${DEWA_OPS_PROD_CORE_SSH}" \
      'bash /home/owned/bin/eliteew-podman-egress-lock.sh --apply'
    ;;
  verify)
    ssh -o BatchMode=yes -o ConnectTimeout=60 "${DEWA_OPS_PROD_CORE_SSH}" \
      'bash /home/owned/bin/eliteew-podman-egress-lock.sh --verify'
    ;;
  set)
    [[ -n "$ARG2" && -n "$ARG3" ]] || { usage >&2; exit 2; }
    ssh -o BatchMode=yes -o ConnectTimeout=60 "${DEWA_OPS_PROD_CORE_SSH}" \
      "bash /home/owned/bin/eliteew-podman-egress-lock.sh --set-mode $(printf '%q' "$ARG2") $(printf '%q' "$ARG3")"
    ;;
  install)
    scp -o BatchMode=yes \
      "${DEWA_OPS_REPO_ROOT}/docker/scripts/prod-core/apply-podman-egress-lock.sh" \
      "${DEWA_OPS_REPO_ROOT}/docker/scripts/prod-core/podman-egress-lib.sh" \
      "${DEWA_OPS_REPO_ROOT}/docker/scripts/prod-core/podman-egress-monitor.sh" \
      "${DEWA_OPS_REPO_ROOT}/docker/host_conf/podman-egress/policy.default.json" \
      "${DEWA_OPS_PROD_CORE_SSH}:/tmp/"
    ssh -o BatchMode=yes "${DEWA_OPS_PROD_CORE_SSH}" bash -s <<'REMOTE'
set -euo pipefail
mkdir -p "$HOME/bin" "$HOME/.config/eliteew" "$HOME/.local/state/eliteew" "$HOME/.config/systemd/user"
cp -f /tmp/apply-podman-egress-lock.sh "$HOME/bin/eliteew-podman-egress-lock.sh"
cp -f /tmp/podman-egress-lib.sh "$HOME/bin/podman-egress-lib.sh"
cp -f /tmp/podman-egress-monitor.sh "$HOME/bin/podman-egress-monitor.sh"
chmod +x "$HOME/bin/eliteew-podman-egress-lock.sh" "$HOME/bin/podman-egress-monitor.sh"
if [[ ! -f "$HOME/.config/eliteew/podman-egress-policy.json" ]]; then
  cp /tmp/policy.default.json "$HOME/.config/eliteew/podman-egress-policy.json"
fi
bash "$HOME/bin/eliteew-podman-egress-lock.sh" --install-user
unit_dir="$HOME/.config/systemd/user"
cat >"$unit_dir/eliteew-podman-egress-monitor.service" <<EOF
[Unit]
Description=EliteEW Podman egress status snapshot
After=default.target

[Service]
Type=oneshot
ExecStart=$HOME/bin/podman-egress-monitor.sh
EOF
cat >"$unit_dir/eliteew-podman-egress-monitor.timer" <<EOF
[Unit]
Description=Podman egress status every minute

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
AccuracySec=15s
Persistent=true

[Install]
WantedBy=timers.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now eliteew-podman-egress-monitor.timer
bash "$HOME/bin/eliteew-podman-egress-lock.sh" --write-status
echo "OK: egress lock+monitor installed on $(hostname -s)"
REMOTE
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
