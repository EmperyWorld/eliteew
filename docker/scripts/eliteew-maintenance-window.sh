#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared user-visible maintenance window helpers (static JSON + Redis via deploy ctl).
# Invariants:
# - Single window id per deploy run; phases warning → active → recovering → completed.
# - notice_before = user warning lead time (publish early; overlap bake/export) — NOT an idle pad after export.
# - Before recreate: sleep only until advertised starts_at (0 if bake overran the window).
# - Redis SoT written without admin OAuth; never overwrites foreign (admin) windows.
# Related:
# - docker/scripts/eliteew-deploy.sh
# - docker/scripts/eliteew-stack0-baked-deploy.sh
# - shared/api/scripts/maintenance_deploy_ctl.py
# - documentation/platform/USER-SAFE-RESTARTS-AND-MAINTENANCE.md
# ---

if [[ -n "${ELITEEW_MAINTENANCE_LIB_LOADED:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi
ELITEEW_MAINTENANCE_LIB_LOADED=1

# shellcheck source=eliteew-ops-lib.sh
if [[ -z "${DEWA_OPS_REPO_ROOT:-}" ]]; then
  _eliteew_maint_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=eliteew-ops-lib.sh
  source "${_eliteew_maint_lib_dir}/eliteew-ops-lib.sh"
fi

ELITEEW_MAINTENANCE_FRONTEND_DIR="${ELITEEW_MAINTENANCE_FRONTEND_DIR:-${DEWA_OPS_FRONTEND_DIR}}"
ELITEEW_MAINTENANCE_STATE_FILE="${ELITEEW_MAINTENANCE_STATE_FILE:-${ELITEEW_MAINTENANCE_FRONTEND_DIR}/dist-build/maintenance-state.json}"
# Code/DB fallbacks: 10m notice, 2m expected downtime (honest absolute ends_at = starts + downtime).
ELITEEW_MAINTENANCE_NOTICE_SECONDS="${ELITEEW_MAINTENANCE_NOTICE_SECONDS:-600}"
ELITEEW_MAINTENANCE_DURATION_SECONDS="${ELITEEW_MAINTENANCE_DURATION_SECONDS:-120}"
ELITEEW_MAINTENANCE_TITLE="${ELITEEW_MAINTENANCE_TITLE:-EliteEW обновляет среду}"
ELITEEW_MAINTENANCE_MESSAGE="${ELITEEW_MAINTENANCE_MESSAGE:-}"
ELITEEW_MAINTENANCE_USER_IMPACT="${ELITEEW_MAINTENANCE_USER_IMPACT:-}"
ELITEEW_MAINTENANCE_WINDOW_ID="${ELITEEW_MAINTENANCE_WINDOW_ID:-deploy-$(date -u +%Y%m%dT%H%M%SZ)}"
ELITEEW_MAINTENANCE_SOURCE="${ELITEEW_MAINTENANCE_SOURCE:-stack0-baked-deploy}"
ELITEEW_MAINTENANCE_ENABLED="${ELITEEW_MAINTENANCE_ENABLED:-0}"
ELITEEW_MAINTENANCE_PROD_CORE_SSH="${ELITEEW_MAINTENANCE_PROD_CORE_SSH:-${DEWA_OPS_PROD_CORE_SSH:-prod-core}}"
ELITEEW_MAINTENANCE_FRONTEND_CONTAINER="${ELITEEW_MAINTENANCE_FRONTEND_CONTAINER:-stack0-eliteew-frontend-prod-baked}"
ELITEEW_MAINTENANCE_API_CONTAINER="${ELITEEW_MAINTENANCE_API_CONTAINER:-stack0-eliteew-api-prod-baked}"
ELITEEW_MAINTENANCE_CTL_PATH="${ELITEEW_MAINTENANCE_CTL_PATH:-/app/api/scripts/maintenance_deploy_ctl.py}"

eliteew_maintenance_iso_after_seconds() {
  local seconds="${1:-0}"
  python3 - "$seconds" <<'PY'
from __future__ import annotations

import sys
from datetime import UTC, datetime, timedelta

seconds = int(sys.argv[1])
print((datetime.now(UTC) + timedelta(seconds=seconds)).isoformat().replace("+00:00", "Z"))
PY
}

# Load notice/downtime/title/rendered copy from live API (Postgres defaults). CLI overrides win.
eliteew_maintenance_load_defaults_from_db() {
  local json=""
  local host_ctl="${DEWA_OPS_REPO_ROOT}/shared/api/scripts/maintenance_deploy_ctl.py"
  local host_defaults="${DEWA_OPS_REPO_ROOT}/shared/api/services/maintenance_deploy_defaults.py"
  local host_svc="${DEWA_OPS_REPO_ROOT}/shared/api/services/maintenance_service.py"
  local host_schema="${DEWA_OPS_REPO_ROOT}/shared/api/schemas/maintenance.py"
  local remote_ctl_tmp="/tmp/eliteew-maintenance-deploy-ctl-$$.py"
  local remote_defaults_tmp="/tmp/eliteew-maintenance-deploy-defaults-$$.py"
  local remote_svc_tmp="/tmp/eliteew-maintenance-service-$$.py"
  local remote_schema_tmp="/tmp/eliteew-maintenance-schema-$$.py"

  [[ -f "${host_ctl}" ]] && scp -q "${host_ctl}" "${ELITEEW_MAINTENANCE_PROD_CORE_SSH}:${remote_ctl_tmp}" || remote_ctl_tmp=""
  [[ -f "${host_defaults}" ]] && scp -q "${host_defaults}" "${ELITEEW_MAINTENANCE_PROD_CORE_SSH}:${remote_defaults_tmp}" || remote_defaults_tmp=""
  [[ -f "${host_svc}" ]] && scp -q "${host_svc}" "${ELITEEW_MAINTENANCE_PROD_CORE_SSH}:${remote_svc_tmp}" || remote_svc_tmp=""
  [[ -f "${host_schema}" ]] && scp -q "${host_schema}" "${ELITEEW_MAINTENANCE_PROD_CORE_SSH}:${remote_schema_tmp}" || remote_schema_tmp=""

  json="$(
    ssh "${ELITEEW_MAINTENANCE_PROD_CORE_SSH}" bash -s \
      "${ELITEEW_MAINTENANCE_API_CONTAINER}" \
      "${ELITEEW_MAINTENANCE_CTL_PATH}" \
      "${remote_ctl_tmp}" \
      "${remote_defaults_tmp}" \
      "${remote_svc_tmp}" \
      "${remote_schema_tmp}" <<'REMOTE' 2>/dev/null || true
set -euo pipefail
api_container="$1"
ctl_path="$2"
host_injected_ctl="$3"
host_injected_defaults="$4"
host_injected_svc="$5"
host_injected_schema="$6"
RT="${ELITEEW_CONTAINER_RUNTIME:-podman}"
command -v "${RT}" >/dev/null 2>&1 || RT=docker
cleanup_tmp() {
  [[ -n "${host_injected_ctl}" ]] && rm -f "${host_injected_ctl}"
  [[ -n "${host_injected_defaults}" ]] && rm -f "${host_injected_defaults}"
  [[ -n "${host_injected_svc}" ]] && rm -f "${host_injected_svc}"
  [[ -n "${host_injected_schema}" ]] && rm -f "${host_injected_schema}"
}
if ! "${RT}" ps --format '{{.Names}}' | grep -qx "${api_container}"; then
  cleanup_tmp
  exit 0
fi
if [[ -n "${host_injected_schema}" && -f "${host_injected_schema}" ]]; then
  "${RT}" exec "${api_container}" mkdir -p /app/api/schemas
  "${RT}" cp "${host_injected_schema}" "${api_container}:/app/api/schemas/maintenance.py"
fi
if [[ -n "${host_injected_defaults}" && -f "${host_injected_defaults}" ]]; then
  "${RT}" exec "${api_container}" mkdir -p /app/api/services
  "${RT}" cp "${host_injected_defaults}" "${api_container}:/app/api/services/maintenance_deploy_defaults.py"
fi
if [[ -n "${host_injected_svc}" && -f "${host_injected_svc}" ]]; then
  "${RT}" cp "${host_injected_svc}" "${api_container}:/app/api/services/maintenance_service.py"
fi
if ! "${RT}" exec "${api_container}" test -f "${ctl_path}"; then
  if [[ -n "${host_injected_ctl}" && -f "${host_injected_ctl}" ]]; then
    "${RT}" exec "${api_container}" mkdir -p "$(dirname "${ctl_path}")"
    "${RT}" cp "${host_injected_ctl}" "${api_container}:${ctl_path}"
  else
    cleanup_tmp
    exit 0
  fi
elif [[ -n "${host_injected_ctl}" && -f "${host_injected_ctl}" ]]; then
  "${RT}" cp "${host_injected_ctl}" "${api_container}:${ctl_path}"
fi
cleanup_tmp
"${RT}" exec "${api_container}" python "${ctl_path}" print-defaults
REMOTE
  )" || json=""

  if [[ -z "${json}" ]]; then
    echo "WARN: maintenance print-defaults unavailable — using local fallbacks notice=${ELITEEW_MAINTENANCE_NOTICE_SECONDS}s downtime=${ELITEEW_MAINTENANCE_DURATION_SECONDS}s" >&2
    return 0
  fi

  local parsed
  parsed="$(NOTICE_OVERRIDE="${ELITEEW_MAINTENANCE_NOTICE_CLI:-}" \
    DURATION_OVERRIDE="${ELITEEW_MAINTENANCE_DURATION_CLI:-}" \
    TITLE_OVERRIDE="${ELITEEW_MAINTENANCE_TITLE_CLI:-}" \
    MESSAGE_OVERRIDE="${ELITEEW_MAINTENANCE_MESSAGE_CLI:-}" \
    python3 -c '
import json, os, sys
raw = sys.stdin.read().strip()
if not raw:
  raise SystemExit(1)
data = json.loads(raw)
notice = os.environ.get("NOTICE_OVERRIDE") or str(data.get("notice_before_seconds", 600))
duration = os.environ.get("DURATION_OVERRIDE") or str(data.get("expected_downtime_seconds", 120))
title = os.environ.get("TITLE_OVERRIDE") or str(data.get("title") or "")
message = os.environ.get("MESSAGE_OVERRIDE") or str(data.get("message") or "")
impact = str(data.get("user_impact") or "")
print(notice)
print(duration)
print(title)
print(message)
print(impact)
' <<<"${json}" 2>/dev/null)" || parsed=""

  if [[ -z "${parsed}" ]]; then
    echo "WARN: maintenance defaults JSON parse failed — keeping current env" >&2
    return 0
  fi

  local notice duration title message impact
  notice="$(sed -n '1p' <<<"${parsed}")"
  duration="$(sed -n '2p' <<<"${parsed}")"
  title="$(sed -n '3p' <<<"${parsed}")"
  message="$(sed -n '4p' <<<"${parsed}")"
  impact="$(sed -n '5p' <<<"${parsed}")"

  ELITEEW_MAINTENANCE_NOTICE_SECONDS="${notice}"
  ELITEEW_MAINTENANCE_DURATION_SECONDS="${duration}"
  [[ -n "${title}" ]] && ELITEEW_MAINTENANCE_TITLE="${title}"
  [[ -n "${message}" ]] && ELITEEW_MAINTENANCE_MESSAGE="${message}"
  [[ -n "${impact}" ]] && ELITEEW_MAINTENANCE_USER_IMPACT="${impact}"
  export ELITEEW_MAINTENANCE_NOTICE_SECONDS ELITEEW_MAINTENANCE_DURATION_SECONDS
  export ELITEEW_MAINTENANCE_TITLE ELITEEW_MAINTENANCE_MESSAGE ELITEEW_MAINTENANCE_USER_IMPACT
  echo "Maintenance defaults from DB/API: notice=${ELITEEW_MAINTENANCE_NOTICE_SECONDS}s downtime=${ELITEEW_MAINTENANCE_DURATION_SECONDS}s"
}

eliteew_maintenance_write_state() {
  local phase="$1"
  local active="$2"
  local notice="$3"
  local duration="$4"
  local now_iso
  local starts_iso
  local ends_iso
  local ends_from_now
  now_iso="$(eliteew_maintenance_iso_after_seconds 0)"
  starts_iso="$(eliteew_maintenance_iso_after_seconds "$notice")"
  # Honest window: expected_ends_at = starts_at + downtime (= now + notice + downtime).
  ends_from_now=$((notice + duration))
  ends_iso="$(eliteew_maintenance_iso_after_seconds "$ends_from_now")"
  local message="${ELITEEW_MAINTENANCE_MESSAGE}"
  local impact="${ELITEEW_MAINTENANCE_USER_IMPACT}"
  if [[ -z "${message}" ]]; then
    message="Безраздельный мир временно на технической паузе. Данные, окна и раскладка сохранены."
  fi
  if [[ -z "${impact}" ]]; then
    impact="Оставьте вкладку открытой: Безраздельный мир восстановится автоматически, данные и раскладка сохранены."
  fi
  mkdir -p "$(dirname "${ELITEEW_MAINTENANCE_STATE_FILE}")"
  python3 - "${ELITEEW_MAINTENANCE_STATE_FILE}" "$phase" "$active" "$notice" "$duration" "$now_iso" "$starts_iso" "$ends_iso" "$ELITEEW_MAINTENANCE_TITLE" "$message" "$impact" "$ELITEEW_MAINTENANCE_WINDOW_ID" "$ELITEEW_MAINTENANCE_SOURCE" <<'PY'
from __future__ import annotations

import json
import sys

(
    path,
    phase,
    active_raw,
    notice,
    duration,
    now_iso,
    starts_iso,
    ends_iso,
    title,
    message,
    impact,
    window_id,
    source,
) = sys.argv[1:14]
active = active_raw == "1"
payload = {
    "active": active,
    "window": {
        "id": window_id,
        "kind": "stack0_restart",
        "phase": phase,
        "active": active,
        "starts_at": starts_iso,
        "expected_ends_at": ends_iso,
        "notice_before_seconds": int(notice),
        "retry_after_seconds": max(30, int(duration)),
        "title": title,
        "message": message,
        "affected_services": ["Безраздельный мир", "Связь", "Уведомления"],
        "user_impact": impact,
        "suppress_error_toasts": True,
        "block_new_long_jobs": True,
        "allow_operator_bypass": False,
        "updated_at": now_iso,
        "source": source,
    }
    if active or phase in {"completed", "cancelled"}
    else None,
}
with open(path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY
  echo "Maintenance state: phase=${phase} active=${active} file=${ELITEEW_MAINTENANCE_STATE_FILE} starts=${starts_iso} ends=${ends_iso}"
}

eliteew_maintenance_push_to_prod_core() {
  if [[ "${ELITEEW_MAINTENANCE_ENABLED}" != "1" ]]; then
    return 0
  fi
  if [[ ! -f "${ELITEEW_MAINTENANCE_STATE_FILE}" ]]; then
    echo "WARN: maintenance state file missing: ${ELITEEW_MAINTENANCE_STATE_FILE}" >&2
    return 0
  fi
  if dewa_ops_is_dry_run 2>/dev/null; then
    dewa_ops_log_dry_run "maintenance push → ${ELITEEW_MAINTENANCE_PROD_CORE_SSH}"
    return 0
  fi
  local remote_tmp="/tmp/eliteew-maintenance-state-$$.json"
  scp -q "${ELITEEW_MAINTENANCE_STATE_FILE}" "${ELITEEW_MAINTENANCE_PROD_CORE_SSH}:${remote_tmp}"
  ssh "${ELITEEW_MAINTENANCE_PROD_CORE_SSH}" bash -s \
    "${remote_tmp}" \
    "${ELITEEW_MAINTENANCE_FRONTEND_CONTAINER}" \
    "${ELITEEW_MAINTENANCE_API_CONTAINER}" <<'REMOTE'
set -euo pipefail
remote_tmp="$1"
frontend_container="$2"
api_container="$3"
RT="${ELITEEW_CONTAINER_RUNTIME:-podman}"
if ! command -v "${RT}" >/dev/null 2>&1; then
  RT=docker
fi
copy_if_running() {
  local container="$1"
  local target_path="$2"
  if "${RT}" container exists "${container}" 2>/dev/null; then
    if "${RT}" ps --format '{{.Names}}' | grep -qx "${container}"; then
      "${RT}" cp "${remote_tmp}" "${container}:${target_path}"
      echo ">>> maintenance pushed to ${container}:${target_path}"
    fi
  fi
}
copy_if_running "${frontend_container}" "/usr/share/nginx/html/maintenance-state.json"
copy_if_running "${api_container}" "/app/frontend-dist/maintenance-state.json"
rm -f "${remote_tmp}"
REMOTE
}

# Sync Redis (+ Socket emit) via live API container ctl — no admin HTTP.
eliteew_maintenance_sync_redis_ctl() {
  local action="$1"
  if [[ "${ELITEEW_MAINTENANCE_ENABLED}" != "1" ]]; then
    return 0
  fi
  if dewa_ops_is_dry_run 2>/dev/null; then
    dewa_ops_log_dry_run "maintenance redis ctl action=${action} id=${ELITEEW_MAINTENANCE_WINDOW_ID}"
    return 0
  fi
  local ctl_args=()
  case "${action}" in
    warning)
      ctl_args=(
        --source "${ELITEEW_MAINTENANCE_SOURCE}"
        upsert-warning
        --window-id "${ELITEEW_MAINTENANCE_WINDOW_ID}"
        --notice-seconds "${ELITEEW_MAINTENANCE_NOTICE_SECONDS}"
        --duration-seconds "${ELITEEW_MAINTENANCE_DURATION_SECONDS}"
        --title "${ELITEEW_MAINTENANCE_TITLE}"
      )
      if [[ -n "${ELITEEW_MAINTENANCE_MESSAGE}" ]]; then
        ctl_args+=(--message "${ELITEEW_MAINTENANCE_MESSAGE}")
      fi
      ;;
    active | recovering)
      ctl_args=(
        --source "${ELITEEW_MAINTENANCE_SOURCE}"
        set-phase
        --window-id "${ELITEEW_MAINTENANCE_WINDOW_ID}"
        --phase "${action}"
      )
      ;;
    completed)
      ctl_args=(
        --source "${ELITEEW_MAINTENANCE_SOURCE}"
        set-phase
        --window-id "${ELITEEW_MAINTENANCE_WINDOW_ID}"
        --phase completed
      )
      ;;
    clear)
      ctl_args=(
        --source "${ELITEEW_MAINTENANCE_SOURCE}"
        clear-if-owned
        --window-id "${ELITEEW_MAINTENANCE_WINDOW_ID}"
      )
      ;;
    *)
      echo "WARN: unknown maintenance redis action=${action}" >&2
      return 0
      ;;
  esac

  local host_ctl="${DEWA_OPS_REPO_ROOT}/shared/api/scripts/maintenance_deploy_ctl.py"
  local host_svc="${DEWA_OPS_REPO_ROOT}/shared/api/services/maintenance_service.py"
  local host_defaults="${DEWA_OPS_REPO_ROOT}/shared/api/services/maintenance_deploy_defaults.py"
  local host_schema="${DEWA_OPS_REPO_ROOT}/shared/api/schemas/maintenance.py"
  local remote_ctl_tmp="/tmp/eliteew-maintenance-deploy-ctl-$$.py"
  local remote_svc_tmp="/tmp/eliteew-maintenance-service-$$.py"
  local remote_defaults_tmp="/tmp/eliteew-maintenance-deploy-defaults-$$.py"
  local remote_schema_tmp="/tmp/eliteew-maintenance-schema-$$.py"
  if [[ -f "${host_ctl}" ]]; then
    scp -q "${host_ctl}" "${ELITEEW_MAINTENANCE_PROD_CORE_SSH}:${remote_ctl_tmp}" || remote_ctl_tmp=""
  else
    remote_ctl_tmp=""
  fi
  if [[ -f "${host_svc}" ]]; then
    scp -q "${host_svc}" "${ELITEEW_MAINTENANCE_PROD_CORE_SSH}:${remote_svc_tmp}" || remote_svc_tmp=""
  else
    remote_svc_tmp=""
  fi
  if [[ -f "${host_defaults}" ]]; then
    scp -q "${host_defaults}" "${ELITEEW_MAINTENANCE_PROD_CORE_SSH}:${remote_defaults_tmp}" || remote_defaults_tmp=""
  else
    remote_defaults_tmp=""
  fi
  if [[ -f "${host_schema}" ]]; then
    scp -q "${host_schema}" "${ELITEEW_MAINTENANCE_PROD_CORE_SSH}:${remote_schema_tmp}" || remote_schema_tmp=""
  else
    remote_schema_tmp=""
  fi

  # argv via JSON — avoids bash/ssh mangling of RU copy with parentheses (e.g. "(~2 мин)").
  local host_args_json remote_args_json
  host_args_json="$(mktemp "${TMPDIR:-/tmp}/eliteew-maint-ctl-args.XXXXXX.json")"
  remote_args_json="/tmp/eliteew-maintenance-ctl-args-$$.json"
  python3 - "${host_args_json}" "${ctl_args[@]}" <<'PY'
from __future__ import annotations

import json
import sys

path = sys.argv[1]
with open(path, "w", encoding="utf-8") as f:
    json.dump(sys.argv[2:], f, ensure_ascii=False)
    f.write("\n")
PY
  if ! scp -q "${host_args_json}" "${ELITEEW_MAINTENANCE_PROD_CORE_SSH}:${remote_args_json}"; then
    rm -f "${host_args_json}"
    echo "WARN: maintenance Redis ctl failed action=${action} (could not scp ctl args JSON)" >&2
    return 0
  fi
  rm -f "${host_args_json}"

  if ! ssh "${ELITEEW_MAINTENANCE_PROD_CORE_SSH}" bash -s \
    "${ELITEEW_MAINTENANCE_API_CONTAINER}" \
    "${ELITEEW_MAINTENANCE_CTL_PATH}" \
    "${remote_ctl_tmp}" \
    "${remote_svc_tmp}" \
    "${remote_defaults_tmp}" \
    "${remote_schema_tmp}" \
    "${remote_args_json}" <<'REMOTE'
set -euo pipefail
api_container="$1"
ctl_path="$2"
host_injected_ctl="$3"
host_injected_svc="$4"
host_injected_defaults="$5"
host_injected_schema="$6"
args_json="$7"
RT="${ELITEEW_CONTAINER_RUNTIME:-podman}"
if ! command -v "${RT}" >/dev/null 2>&1; then
  RT=docker
fi
cleanup_tmp() {
  [[ -n "${host_injected_ctl}" ]] && rm -f "${host_injected_ctl}"
  [[ -n "${host_injected_svc}" ]] && rm -f "${host_injected_svc}"
  [[ -n "${host_injected_defaults}" ]] && rm -f "${host_injected_defaults}"
  [[ -n "${host_injected_schema}" ]] && rm -f "${host_injected_schema}"
  [[ -n "${args_json}" ]] && rm -f "${args_json}"
}
if ! "${RT}" ps --format '{{.Names}}' | grep -qx "${api_container}"; then
  echo "WARN: API container ${api_container} not running — skip Redis maintenance ctl" >&2
  cleanup_tmp
  exit 0
fi
# Side-car python process imports from container FS — inject updated modules for first release.
if [[ -n "${host_injected_schema}" && -f "${host_injected_schema}" ]]; then
  "${RT}" exec "${api_container}" mkdir -p /app/api/schemas
  "${RT}" cp "${host_injected_schema}" "${api_container}:/app/api/schemas/maintenance.py"
  echo ">>> injected schemas/maintenance.py into ${api_container} for ctl process"
fi
if [[ -n "${host_injected_defaults}" && -f "${host_injected_defaults}" ]]; then
  "${RT}" exec "${api_container}" mkdir -p /app/api/services
  "${RT}" cp "${host_injected_defaults}" "${api_container}:/app/api/services/maintenance_deploy_defaults.py"
  echo ">>> injected maintenance_deploy_defaults.py into ${api_container} for ctl process"
fi
if [[ -n "${host_injected_svc}" && -f "${host_injected_svc}" ]]; then
  "${RT}" cp "${host_injected_svc}" "${api_container}:/app/api/services/maintenance_service.py"
  echo ">>> injected maintenance_service.py into ${api_container} for ctl process"
fi
if ! "${RT}" exec "${api_container}" test -f "${ctl_path}"; then
  if [[ -n "${host_injected_ctl}" && -f "${host_injected_ctl}" ]]; then
    "${RT}" exec "${api_container}" mkdir -p "$(dirname "${ctl_path}")"
    "${RT}" cp "${host_injected_ctl}" "${api_container}:${ctl_path}"
    echo ">>> injected ${ctl_path} into ${api_container} for this run"
  else
    echo "WARN: maintenance_deploy_ctl.py missing in ${api_container} — Redis sync skipped" >&2
    cleanup_tmp
    exit 0
  fi
elif [[ -n "${host_injected_ctl}" && -f "${host_injected_ctl}" ]]; then
  # Refresh ctl even if a stale copy exists from a prior inject.
  "${RT}" cp "${host_injected_ctl}" "${api_container}:${ctl_path}"
fi
args_in_ctr="/tmp/eliteew-maintenance-ctl-args-in-ctr.json"
"${RT}" cp "${args_json}" "${api_container}:${args_in_ctr}"
cleanup_tmp
"${RT}" exec "${api_container}" python - "${ctl_path}" "${args_in_ctr}" <<'PY'
from __future__ import annotations

import json
import subprocess
import sys

ctl_path, args_path = sys.argv[1], sys.argv[2]
with open(args_path, encoding="utf-8") as f:
    args = json.load(f)
try:
    subprocess.check_call(["python", ctl_path, *args])
finally:
    try:
        import os

        os.remove(args_path)
    except OSError:
        pass
PY
REMOTE
  then
    echo "WARN: maintenance Redis ctl failed action=${action} (static JSON still applied)" >&2
  fi
}

# Publish warning at release start so bake/export overlap the user lead time.
eliteew_maintenance_publish_warning_if_enabled() {
  if [[ "${ELITEEW_MAINTENANCE_ENABLED}" != "1" ]]; then
    return 0
  fi
  eliteew_maintenance_load_defaults_from_db || true
  eliteew_maintenance_write_state "warning" "1" "${ELITEEW_MAINTENANCE_NOTICE_SECONDS}" "${ELITEEW_MAINTENANCE_DURATION_SECONDS}"
  eliteew_maintenance_push_to_prod_core
  eliteew_maintenance_sync_redis_ctl "warning"
  echo "=== Maintenance warning published (starts_at from notice=${ELITEEW_MAINTENANCE_NOTICE_SECONDS}s; bake/export continue) ==="
}

# Sleep only until advertised starts_at — never pad a full notice after export is already done.
eliteew_maintenance_wait_until_starts_if_enabled() {
  if [[ "${ELITEEW_MAINTENANCE_ENABLED}" != "1" ]]; then
    return 0
  fi
  if dewa_ops_is_dry_run 2>/dev/null; then
    dewa_ops_log_dry_run "maintenance wait until starts_at"
    return 0
  fi
  if [[ ! -f "${ELITEEW_MAINTENANCE_STATE_FILE}" ]]; then
    echo "WARN: maintenance state missing — no wait before recreate" >&2
    return 0
  fi
  local remaining
  remaining="$(
    python3 - "${ELITEEW_MAINTENANCE_STATE_FILE}" <<'PY'
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
window = data.get("window") or {}
starts = window.get("starts_at")
if not starts:
    print(0)
    raise SystemExit(0)
raw = str(starts).strip().replace("Z", "+00:00")
dt = datetime.fromisoformat(raw)
if dt.tzinfo is None:
    dt = dt.replace(tzinfo=timezone.utc)
sec = int((dt - datetime.now(timezone.utc)).total_seconds())
print(max(0, sec))
PY
  )"
  if ((remaining > 0)); then
    echo "=== Maintenance notice: ${remaining}s left until advertised starts_at (work overlapped warning) ==="
    sleep "${remaining}"
  else
    echo "=== Maintenance notice: starts_at already reached — recreate now (no idle pad) ==="
  fi
}

# Backward-compatible: publish + wait-until-starts (prefer split call sites in bake deploy).
eliteew_maintenance_notice_if_enabled() {
  eliteew_maintenance_publish_warning_if_enabled
  eliteew_maintenance_wait_until_starts_if_enabled
}

eliteew_maintenance_phase_if_enabled() {
  if [[ "${ELITEEW_MAINTENANCE_ENABLED}" != "1" ]]; then
    return 0
  fi
  eliteew_maintenance_write_state "$1" "1" "0" "${ELITEEW_MAINTENANCE_DURATION_SECONDS}"
  eliteew_maintenance_push_to_prod_core
  eliteew_maintenance_sync_redis_ctl "$1"
}

eliteew_maintenance_complete_if_enabled() {
  if [[ "${ELITEEW_MAINTENANCE_ENABLED}" != "1" ]]; then
    return 0
  fi
  eliteew_maintenance_write_state "completed" "0" "0" "60"
  eliteew_maintenance_push_to_prod_core
  # Prefer clear-if-owned after API is back (completed phase clears Redis when ctl available).
  eliteew_maintenance_sync_redis_ctl "completed"
  eliteew_maintenance_sync_redis_ctl "clear"
}
