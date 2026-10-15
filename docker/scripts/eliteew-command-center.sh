#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Operator entrypoint for living `.136` command-center units (ComfyUI) + migration smokes.
# Invariants:
# - Destructive local service actions are explicit subcommands; status/smoke are read-only.
# - Retired DEWA/EWPower/EWC/EWGen/EWCO/logwatch contours are not managed here (→ trash/).
# - Remote topology checks delegate to eliteew-migration-command-center.sh.
# Related:
# - docker/scripts/eliteew-migration-command-center.sh
# - documentation/platform/PROD-CORE-FINAL-CUTOVER-RUNBOOK.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

CORE_UNITS=(
  "eliteew-comfyui.service"
)

OPTIONAL_UNITS=()

usage() {
  cat <<'USAGE'
Usage:
  eliteew-command-center.sh status
  eliteew-command-center.sh smoke
  eliteew-command-center.sh start|stop|restart
  eliteew-command-center.sh baseline|acceptance|workload-smoke|reboot-gate

Core units (start|stop|restart):
  eliteew-comfyui.service

Retired operator contours (DEWA/EWPower/EWC/EWGen/EWCO/logwatch) → trash/; not managed here.

Smoke checks: ComfyUI :31003, auth perimeter, prod-core ping.
USAGE
}

unit_action() {
  local action="$1"
  systemctl --user "${action}" "${CORE_UNITS[@]}"
}

optional_unit_status() {
  local unit
  for unit in "${OPTIONAL_UNITS[@]}"; do
    if systemctl --user list-unit-files "${unit}" --no-legend 2>/dev/null | grep -q "${unit}"; then
      systemctl --user --no-pager --full status "${unit}" || true
    else
      echo "${unit}: not installed (skip)"
    fi
  done
}

status() {
  echo ">>> command-center core units"
  systemctl --user --no-pager --full status "${CORE_UNITS[@]}" || true
  echo ">>> command-center optional units"
  optional_unit_status
  echo ">>> command-center listeners"
  ss -ltnp '( sport = :31003 )' || true
}

smoke() {
  echo ">>> command-center local smoke (living units only)"
  curl -sf http://127.0.0.1:31003/ >/dev/null && echo "comfy_ok" || echo "comfy_FAIL"
  systemctl --user is-active "${CORE_UNITS[@]}" || true
  echo ">>> public perimeter (informational; 502 here means prod-core tunnel/edge is down)"
  curl -sk -o /dev/null -w "auth_eliteew_ru_http=%{http_code}\n" https://auth.eliteew.ru/realms/empery || echo "auth_eliteew_ru_http=FAIL"
  curl -sk -o /dev/null -w "app_eliteew_ru_http=%{http_code}\n" https://app.eliteew.ru/ || echo "app_eliteew_ru_http=FAIL"
  ping -c 1 -W 2 192.168.1.111 >/dev/null 2>&1 && echo "prod_core_ping_ok" || echo "prod_core_ping_FAIL"
}
main() {
  local command="${1:-}"
  shift || true
  case "${command}" in
    status)
      status
      ;;
    smoke)
      smoke
      ;;
    start | stop | restart)
      unit_action "${command}"
      smoke
      ;;
    baseline | acceptance | workload-smoke | reboot-gate)
      bash "${REPO_ROOT}/docker/scripts/eliteew-migration-command-center.sh" "${command}" "$@"
      ;;
    -h | --help | help | "")
      usage
      ;;
    *)
      echo "Unknown command: ${command}" >&2
      usage
      exit 64
      ;;
  esac
}

main "$@"
