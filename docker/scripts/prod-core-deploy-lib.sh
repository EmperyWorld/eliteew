#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared helpers for prod-core (.111) mobile/API deploy — safe env patch, baked stack0 recreate,
# and exclusive flock for stack0 baked release (no concurrent / orphan bake races).
# Invariants:
# - Never recreate stack0 without stack0_*.prod-baked.override.yml on prod-core.
# - Reject empty or truncated STACK0_*_BAKED_IMAGE values after patch.
# - stack0/stack4 force-recreate must retire existing named containers first
#   (podman-compose name-conflict can leave stale celery/tika on old tags).
# - Compose log with "name already in use" is fail-closed (even when exit code is 0).
# - At most one stack0 baked deploy on command-center (flock + meta pid); SIGINT/TERM
#   releases lock and signals the deploy process group.
# Related:
# - eliteew-stack0-baked-deploy.sh, eliteew-prod-core-runtime-deploy.sh
# - documentation/platform/docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md
# ---

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Source this file; do not execute directly." >&2
  exit 2
fi

_SCRIPT_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}")" && pwd)"
# shellcheck source=prod-core-env-lib.sh
source "${_SCRIPT_LIB_DIR}/prod-core-env-lib.sh"

prod_core_deploy_env_file() {
  local repo_root="$1"
  local basename="$2"
  prod_core_env_file_path "${repo_root}" "${basename}"
}

prod_core_deploy_repo_root() {
  if [[ -n "${PROD_CORE_DEPLOY_REPO_ROOT:-}" ]]; then
    printf '%s' "${PROD_CORE_DEPLOY_REPO_ROOT}"
    return 0
  fi
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}")" && pwd)"
  printf '%s' "$(cd "${script_dir}/../.." && pwd)"
}

prod_core_deploy_default_baked_tag() {
  printf 'prod-baked-%s' "$(date +%Y%m%d-%H%M)"
}

prod_core_deploy_validate_baked_tag() {
  local tag="$1"
  if [[ ! "${tag}" =~ ^prod-baked-[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]]; then
    echo "ERROR: invalid baked tag '${tag}' (expected prod-baked-…)" >&2
    return 1
  fi
}

# Exclusive stack0 baked deploy lock (command-center). Prevents two releases racing
# last-writer-wins on prod-core after an aborted Cursor shell leaves orphans.
PROD_CORE_BAKED_DEPLOY_LOCK_FD=9
PROD_CORE_BAKED_DEPLOY_LOCK_FILE=""
PROD_CORE_BAKED_DEPLOY_META_FILE=""
PROD_CORE_BAKED_DEPLOY_LOCK_HELD=0

prod_core_deploy_baked_lock_paths() {
  local repo_root
  repo_root="$(prod_core_deploy_repo_root)"
  mkdir -p "${repo_root}/docker/tmp"
  PROD_CORE_BAKED_DEPLOY_LOCK_FILE="${repo_root}/docker/tmp/stack0-baked-deploy.lock"
  PROD_CORE_BAKED_DEPLOY_META_FILE="${repo_root}/docker/tmp/stack0-baked-deploy.lock.meta"
}

prod_core_deploy_release_baked_deploy_lock() {
  if [[ "${PROD_CORE_BAKED_DEPLOY_LOCK_HELD}" -ne 1 ]]; then
    return 0
  fi
  rm -f "${PROD_CORE_BAKED_DEPLOY_META_FILE}" 2>/dev/null || true
  flock -u "${PROD_CORE_BAKED_DEPLOY_LOCK_FD}" 2>/dev/null || true
  eval "exec ${PROD_CORE_BAKED_DEPLOY_LOCK_FD}>&-" 2>/dev/null || true
  PROD_CORE_BAKED_DEPLOY_LOCK_HELD=0
}

prod_core_deploy_on_baked_deploy_signal() {
  echo "ERROR: [STACK0 BAKED LOCK] signal — aborting deploy (kill process group, release lock)" >&2
  trap - INT TERM HUP EXIT
  prod_core_deploy_release_baked_deploy_lock || true
  # Stop siblings started under this shell (podman build / export / ssh).
  kill 0 2>/dev/null || true
  exit 130
}

# Orphan build/export PIDs left after a Cursor abort (parent deploy gone, children live).
# Do NOT match eliteew-stack0-baked-deploy.sh here: flock serializes releases, and bash
# process-substitution forks inherit that script argv (false "other PID" on acquire).
# Match only argv entries whose basename is build/export (not shell -c mention strings).
prod_core_deploy_other_bake_export_pids() {
  local self_pid=$$
  local self_pgid
  local pid arg found pgid
  local -a out=()
  self_pgid="$(ps -o pgid= -p "${self_pid}" 2>/dev/null | tr -d ' ' || true)"
  # Prefer /proc scan over pgrep -f (avoids matching this function's own pattern text).
  for pid in /proc/[0-9]*; do
    pid="${pid#/proc/}"
    [[ "${pid}" == "${self_pid}" ]] && continue
    if [[ -n "${self_pgid}" ]]; then
      pgid="$(ps -o pgid= -p "${pid}" 2>/dev/null | tr -d ' ' || true)"
      [[ "${pgid}" == "${self_pgid}" ]] && continue
    fi
    found=0
    while IFS= read -r -d '' arg; do
      case "${arg##*/}" in
        build-stack0-prod-baked-images.sh | export-stack0-prod-baked-images.sh)
          found=1
          break
          ;;
      esac
    done <"/proc/${pid}/cmdline" 2>/dev/null || true
    if [[ "${found}" -eq 1 ]]; then
      out+=("${pid}")
    fi
  done
  if [[ "${#out[@]}" -gt 0 ]]; then
    printf '%s' "${out[*]}"
  fi
}

prod_core_deploy_acquire_baked_deploy_lock() {
  local tag="$1"
  local force_unlock="${2:-0}"
  local self_pid=$$
  local other_pids
  local holder_pid=""
  local waited=0

  prod_core_deploy_baked_lock_paths
  prod_core_deploy_validate_baked_tag "${tag}" || return 1

  other_pids="$(prod_core_deploy_other_bake_export_pids || true)"
  other_pids="${other_pids%% }"
  if [[ -n "${other_pids}" && "${force_unlock}" -ne 1 ]]; then
    echo "ERROR: [STACK0 BAKED LOCK] other bake/export PID(s) still running: ${other_pids}" >&2
    echo "  Wait for them to finish, or stop them, then retry." >&2
    echo "  Emergency: --force-unlock (kills meta PID if set, then steals flock)." >&2
    return 1
  fi

  # shellcheck disable=SC2094
  eval "exec ${PROD_CORE_BAKED_DEPLOY_LOCK_FD}>\"${PROD_CORE_BAKED_DEPLOY_LOCK_FILE}\""
  if ! flock -n "${PROD_CORE_BAKED_DEPLOY_LOCK_FD}"; then
    local holder_tag="" holder_started=""
    if [[ -f "${PROD_CORE_BAKED_DEPLOY_META_FILE}" ]]; then
      holder_pid="$(awk -F= '/^pid=/{print $2; exit}' "${PROD_CORE_BAKED_DEPLOY_META_FILE}" 2>/dev/null || true)"
      holder_tag="$(awk -F= '/^tag=/{print $2; exit}' "${PROD_CORE_BAKED_DEPLOY_META_FILE}" 2>/dev/null || true)"
      holder_started="$(awk -F= '/^started_at=/{print $2; exit}' "${PROD_CORE_BAKED_DEPLOY_META_FILE}" 2>/dev/null || true)"
      echo "ERROR: [STACK0 BAKED LOCK] held by pid=${holder_pid:-?} tag=${holder_tag:-?} started=${holder_started:-?}" >&2
      cat "${PROD_CORE_BAKED_DEPLOY_META_FILE}" >&2 || true
    else
      echo "ERROR: [STACK0 BAKED LOCK] ${PROD_CORE_BAKED_DEPLOY_LOCK_FILE} busy (no meta)" >&2
    fi
    if [[ "${force_unlock}" -eq 1 ]]; then
      if [[ -n "${holder_pid}" ]] && kill -0 "${holder_pid}" 2>/dev/null; then
        echo "WARN: [STACK0 BAKED LOCK] --force-unlock: TERM pid=${holder_pid}" >&2
        kill -TERM "${holder_pid}" 2>/dev/null || true
        while kill -0 "${holder_pid}" 2>/dev/null && [[ "${waited}" -lt 20 ]]; do
          sleep 1
          waited=$((waited + 1))
        done
        if kill -0 "${holder_pid}" 2>/dev/null; then
          echo "WARN: [STACK0 BAKED LOCK] --force-unlock: KILL pid=${holder_pid}" >&2
          kill -KILL "${holder_pid}" 2>/dev/null || true
          sleep 1
        fi
      fi
      flock -u "${PROD_CORE_BAKED_DEPLOY_LOCK_FD}" 2>/dev/null || true
      if ! flock -n "${PROD_CORE_BAKED_DEPLOY_LOCK_FD}"; then
        echo "ERROR: [STACK0 BAKED LOCK] still busy after --force-unlock" >&2
        eval "exec ${PROD_CORE_BAKED_DEPLOY_LOCK_FD}>&-" 2>/dev/null || true
        return 1
      fi
    else
      echo "  Retry after the other deploy ends, or use --force-unlock." >&2
      eval "exec ${PROD_CORE_BAKED_DEPLOY_LOCK_FD}>&-" 2>/dev/null || true
      return 1
    fi
  fi

  {
    echo "pid=${self_pid}"
    echo "pgid=$(ps -o pgid= -p "${self_pid}" | tr -d ' ')"
    echo "tag=${tag}"
    echo "started_at=$(date -Iseconds)"
    echo "host=$(hostname -f 2>/dev/null || hostname)"
    echo "argv0=${0##*/}"
  } >"${PROD_CORE_BAKED_DEPLOY_META_FILE}"
  PROD_CORE_BAKED_DEPLOY_LOCK_HELD=1
  trap 'prod_core_deploy_on_baked_deploy_signal' INT TERM HUP
  trap 'prod_core_deploy_release_baked_deploy_lock' EXIT
  echo "✅ [STACK0 BAKED LOCK] acquired tag=${tag} pid=${self_pid} file=${PROD_CORE_BAKED_DEPLOY_LOCK_FILE}"
}

prod_core_deploy_patch_baked_env() {
  local env_file="$1"
  local tag="$2"
  prod_core_deploy_validate_baked_tag "${tag}" || return 1

  local -a keys=(
    STACK0_PROD_BAKED_TAG
    STACK0_API_BAKED_IMAGE
    STACK0_QUEUE_WORKER_BAKED_IMAGE
    STACK0_CELERY_WORKER_BAKED_IMAGE
    STACK0_CELERY_BEAT_BAKED_IMAGE
    STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE
    STACK0_FRONTEND_BAKED_IMAGE
  )
  local -a vals=(
    "${tag}"
    "eliteew-api:${tag}"
    "eliteew-queue-worker:${tag}"
    "eliteew-celery-worker:${tag}"
    "eliteew-celery-beat:${tag}"
    "eliteew-site-studio-worker:${tag}"
    "eliteew-frontend:${tag}"
  )

  [[ -f "${env_file}" ]] || {
    echo "ERROR: env file missing: ${env_file}" >&2
    return 1
  }

  local i key val
  for i in "${!keys[@]}"; do
    key="${keys[$i]}"
    val="${vals[$i]}"
    if grep -q "^${key}=" "${env_file}"; then
      sed -i "s|^${key}=.*|${key}=${val}|" "${env_file}"
    else
      echo "${key}=${val}" >>"${env_file}"
    fi
  done

  prod_core_deploy_validate_baked_env "${env_file}" "${tag}" || return 1
  echo "✅ env patched (${tag})"
  grep -E '^STACK0_(PROD_BAKED_TAG|.*_BAKED_IMAGE)=' "${env_file}" | tail -8
}

prod_core_deploy_validate_baked_env() {
  local env_file="$1"
  local tag="$2"
  python3 - "${env_file}" "${tag}" <<'PY'
import re
import sys
from pathlib import Path

env_path = Path(sys.argv[1])
expected_tag = sys.argv[2]
text = env_path.read_text(encoding="utf-8")
values: dict[str, str] = {}
for raw in text.splitlines():
    if not raw or raw.lstrip().startswith("#"):
        continue
    if "=" not in raw:
        continue
    key, val = raw.split("=", 1)
    if key.startswith("STACK0_") and "BAKED" in key:
        values[key] = val.strip()

errors: list[str] = []
required = {
    "STACK0_PROD_BAKED_TAG": expected_tag,
    "STACK0_API_BAKED_IMAGE": f"eliteew-api:{expected_tag}",
    "STACK0_QUEUE_WORKER_BAKED_IMAGE": f"eliteew-queue-worker:{expected_tag}",
    "STACK0_CELERY_WORKER_BAKED_IMAGE": f"eliteew-celery-worker:{expected_tag}",
    "STACK0_CELERY_BEAT_BAKED_IMAGE": f"eliteew-celery-beat:{expected_tag}",
    "STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE": f"eliteew-site-studio-worker:{expected_tag}",
    "STACK0_FRONTEND_BAKED_IMAGE": f"eliteew-frontend:{expected_tag}",
}
for key, want in required.items():
    got = values.get(key, "")
    if not got or got.endswith(":") or got.endswith(": "):
        errors.append(f"{key} is empty or truncated ({got!r})")
    elif got != want:
        errors.append(f"{key}={got!r}, expected {want!r}")

if errors:
    for err in errors:
        print(f"ERROR: env validation: {err}", file=sys.stderr)
    raise SystemExit(1)
print(f"env validation OK ({expected_tag})")
PY
}

# Env keys required by stack0_* .dev-bind.override.yml (baked image refs for bind-mount line).
prod_core_deploy_stack0_baked_image_env_keys() {
  printf '%s\n' \
    STACK0_PROD_BAKED_TAG \
    STACK0_API_BAKED_IMAGE \
    STACK0_QUEUE_WORKER_BAKED_IMAGE \
    STACK0_CELERY_WORKER_BAKED_IMAGE \
    STACK0_CELERY_BEAT_BAKED_IMAGE \
    STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE \
    STACK0_FRONTEND_BAKED_IMAGE
}

prod_core_deploy_stack0_baked_image_env_container_map() {
  printf '%s\t%s\n' \
    STACK0_API_BAKED_IMAGE stack0-eliteew-api-prod-baked \
    STACK0_QUEUE_WORKER_BAKED_IMAGE stack0-eliteew-api-worker-prod-baked \
    STACK0_CELERY_WORKER_BAKED_IMAGE stack0-eliteew-celery-worker-prod-baked \
    STACK0_CELERY_BEAT_BAKED_IMAGE stack0-eliteew-celery-beat-prod-baked \
    STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE stack0-eliteew-site-studio-worker-prod-baked \
    STACK0_FRONTEND_BAKED_IMAGE stack0-eliteew-frontend-prod-baked
}

prod_core_deploy_env_key_nonempty() {
  local env_file="$1"
  local key="$2"
  local val
  val="$(grep -E "^${key}=" "${env_file}" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
  [[ -n "${val}" ]] && [[ "${val}" != "..." ]]
}

prod_core_deploy_env_set_key() {
  local env_file="$1"
  local key="$2"
  local value="$3"
  python3 - "${env_file}" "${key}" "${value}" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
out: list[str] = []
seen = False
for line in lines:
    if line.startswith(f"{key}="):
        if not seen:
            out.append(f"{key}={value}")
            seen = True
        continue
    out.append(line)
if not seen:
    out.append(f"{key}={value}")
path.write_text("\n".join(out) + "\n", encoding="utf-8")
PY
}

prod_core_deploy_infer_baked_image_from_container() {
  local container="$1"
  podman inspect "${container}" --format '{{.Config.Image}}' 2>/dev/null || true
}

prod_core_deploy_infer_baked_tag_from_image() {
  local image="$1"
  if [[ "${image}" =~ :prod-baked-([0-9]{8}-[0-9]{4})$ ]]; then
    echo "prod-baked-${BASH_REMATCH[1]}"
  fi
}

# Fill missing/truncated STACK0_*_BAKED_IMAGE keys from running prod-baked containers.
# Safe when only frontend-only eeprodbaked left a partial env (dev-bind compose needs all keys).
prod_core_deploy_ensure_stack0_baked_image_env() {
  local env_file="$1"
  [[ -f "${env_file}" ]] || {
    echo "ERROR: env file missing: ${env_file}" >&2
    return 1
  }

  local patched=0
  local line key container image tag env_val
  while IFS=$'\t' read -r key container; do
    [[ -n "${key}" ]] || continue
    image="$(prod_core_deploy_infer_baked_image_from_container "${container}")"
    if [[ -z "${image}" ]]; then
      if ! prod_core_deploy_env_key_nonempty "${env_file}" "${key}"; then
        echo "WARN: ${key} missing and container ${container} not running — skip infer" >&2
      fi
      continue
    fi
    env_val="$(grep -E "^${key}=" "${env_file}" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
    if [[ "${env_val}" == "${image}" ]]; then
      continue
    fi
    if [[ -n "${env_val}" && "${env_val}" != "..." ]]; then
      # Explicit env (e.g. eeprodbaked tag patch) wins over running container inference.
      continue
    fi
    prod_core_deploy_env_set_key "${env_file}" "${key}" "${image}"
    echo "INFO: patched ${key}=${image} (from ${container})"
    patched=$((patched + 1))
  done < <(prod_core_deploy_stack0_baked_image_env_container_map)

  if ! prod_core_deploy_env_key_nonempty "${env_file}" STACK0_PROD_BAKED_TAG; then
    image="$(prod_core_deploy_infer_baked_image_from_container stack0-eliteew-api-prod-baked)"
    tag="$(prod_core_deploy_infer_baked_tag_from_image "${image}")"
    if [[ -n "${tag}" ]]; then
      prod_core_deploy_env_set_key "${env_file}" STACK0_PROD_BAKED_TAG "${tag}"
      echo "INFO: patched STACK0_PROD_BAKED_TAG=${tag} (from stack0-eliteew-api-prod-baked)"
      patched=$((patched + 1))
    fi
  fi

  if (( patched == 0 )); then
    echo "INFO: STACK0_*_BAKED_IMAGE env already complete"
  else
    echo "INFO: STACK0 baked image env patched (${patched} key(s))"
  fi

  prod_core_deploy_validate_stack0_baked_image_env "${env_file}"
}

prod_core_deploy_validate_stack0_baked_image_env() {
  local env_file="$1"
  python3 - "${env_file}" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
if not path.exists():
    raise SystemExit(f"ERROR: env file missing: {path}")

required = [
    "STACK0_PROD_BAKED_TAG",
    "STACK0_API_BAKED_IMAGE",
    "STACK0_QUEUE_WORKER_BAKED_IMAGE",
    "STACK0_CELERY_WORKER_BAKED_IMAGE",
    "STACK0_CELERY_BEAT_BAKED_IMAGE",
    "STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE",
    "STACK0_FRONTEND_BAKED_IMAGE",
]
values = {}
for line in path.read_text(encoding="utf-8").splitlines():
    if not line or line.lstrip().startswith("#") or "=" not in line:
        continue
    key, _, val = line.partition("=")
    values[key] = val

missing = [k for k in required if not values.get(k) or values[k] == "..."]
if missing:
    raise SystemExit(
        "ERROR: incomplete STACK0 baked image env (missing or truncated): "
        + ", ".join(missing)
        + "\nFix: eeprodbaked (full or --backend-only/--frontend-only) or "
        "eeprodline up-dev-bind (auto-ensure from running containers)."
    )
print(f"STACK0 baked image env OK ({len(required)} keys)")
PY
}

prod_core_deploy_stop_legacy_stack0() {
  local -a legacy=(
    stack0-eliteew-api-prod
    stack0-eliteew-api-worker-prod
    stack0-eliteew-celery-worker-prod
    stack0-eliteew-celery-agentic-worker-prod
    stack0-eliteew-celery-companion-worker-prod
    stack0-eliteew-celery-beat-prod
    stack0-eliteew-site-studio-worker-prod
    stack0-eliteew-frontend-prod
  )
  local name
  for name in "${legacy[@]}"; do
    podman stop "${name}" 2>/dev/null || true
    podman rm -f "${name}" 2>/dev/null || true
  done
}

prod_core_deploy_patch_baked_env_backend_only() {
  local env_file="$1"
  local tag="$2"
  prod_core_deploy_validate_baked_tag "${tag}" || return 1
  [[ -f "${env_file}" ]] || {
    echo "ERROR: env file missing: ${env_file}" >&2
    return 1
  }

  local -a keys=(
    STACK0_PROD_BAKED_TAG
    STACK0_API_BAKED_IMAGE
    STACK0_QUEUE_WORKER_BAKED_IMAGE
    STACK0_CELERY_WORKER_BAKED_IMAGE
    STACK0_CELERY_BEAT_BAKED_IMAGE
    STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE
  )
  local -a vals=(
    "${tag}"
    "eliteew-api:${tag}"
    "eliteew-queue-worker:${tag}"
    "eliteew-celery-worker:${tag}"
    "eliteew-celery-beat:${tag}"
    "eliteew-site-studio-worker:${tag}"
  )
  local i key val
  for i in "${!keys[@]}"; do
    key="${keys[$i]}"
    val="${vals[$i]}"
    if grep -q "^${key}=" "${env_file}"; then
      sed -i "s|^${key}=.*|${key}=${val}|" "${env_file}"
    else
      echo "${key}=${val}" >>"${env_file}"
    fi
  done
  echo "✅ env patched backend-only (${tag})"
  grep -E '^STACK0_(PROD_BAKED_TAG|.*_BAKED_IMAGE)=' "${env_file}" | tail -8
}

prod_core_deploy_ensure_site_studio_podman_uid() {
  local env_file="$1"
  local uid="${SITE_STUDIO_PODMAN_UID:-$(id -u)}"
  [[ -f "${env_file}" ]] || {
    echo "ERROR: env file missing: ${env_file}" >&2
    return 1
  }
  if grep -q '^SITE_STUDIO_PODMAN_UID=' "${env_file}"; then
    return 0
  fi
  echo "SITE_STUDIO_PODMAN_UID=${uid}" >>"${env_file}"
  echo "✅ env patched SITE_STUDIO_PODMAN_UID=${uid}"
}

# podman-compose resolves per-service env_file paths from compose YAML; prod-core keeps secrets only
# in runtime tmpfs (Config Plane). Symlink legacy path expected by stack0_b.yml.
prod_core_deploy_ensure_legacy_env_file_symlink() {
  local repo_root="$1"
  prod_core_env_ensure_legacy_symlinks "${repo_root}"
}

prod_core_deploy_prepare_stack0_compose_env() {
  local repo_root="$1"
  local env_file
  env_file="$(prod_core_deploy_env_file "${repo_root}" .env.stack0.backend)"
  prod_core_deploy_ensure_site_studio_podman_uid "${env_file}"
  prod_core_deploy_ensure_legacy_env_file_symlink "${repo_root}"
}

prod_core_deploy_patch_baked_env_frontend_only() {
  local env_file="$1"
  local tag="$2"
  prod_core_deploy_validate_baked_tag "${tag}" || return 1
  [[ -f "${env_file}" ]] || {
    echo "ERROR: env file missing: ${env_file}" >&2
    return 1
  }
  local key="STACK0_FRONTEND_BAKED_IMAGE"
  local val="eliteew-frontend:${tag}"
  if grep -q "^${key}=" "${env_file}"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${env_file}"
  else
    echo "${key}=${val}" >>"${env_file}"
  fi
  echo "✅ env patched frontend-only (${val})"
  grep -E '^STACK0_FRONTEND_BAKED_IMAGE=' "${env_file}" || true
}

# Named stack0 baked containers that podman-compose --force-recreate may leave in place.
prod_core_deploy_stack0_baked_backend_container_names() {
  cat <<'EOF'
stack0-eliteew-api-prod-baked
stack0-eliteew-api-worker-prod-baked
stack0-eliteew-site-studio-worker-prod-baked
stack0-eliteew-celery-worker-prod-baked
stack0-eliteew-celery-agentic-worker-prod-baked
stack0-eliteew-celery-companion-worker-prod-baked
stack0-eliteew-celery-discussion-worker-prod-baked
stack0-eliteew-celery-beat-prod-baked
EOF
}

prod_core_deploy_retire_stack0_baked_backend_containers() {
  local name
  while IFS= read -r name; do
    [[ -n "${name}" ]] || continue
    prod_core_deploy_retire_named_container "${name}"
  done < <(prod_core_deploy_stack0_baked_backend_container_names)
}

prod_core_deploy_recreate_stack0_backend_baked() {
  local repo_root="$1"
  local env_file compose_log compose_rc
  env_file="$(prod_core_deploy_env_file "${repo_root}" .env.stack0.backend)"
  prod_core_deploy_prepare_stack0_compose_env "${repo_root}"
  cd "${repo_root}"
  prod_core_deploy_ensure_baked_image_short_tags "${env_file}" || return 1
  prod_core_deploy_stop_legacy_stack0
  prod_core_deploy_retire_stack0_baked_backend_containers
  compose_log="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '${compose_log}'" RETURN
  set +e
  podman compose \
    -f docker/stack/stack0_b.yml \
    -f docker/stack/stack0_b.prod-baked.override.yml \
    --env-file "${env_file}" \
    --profile punisher-local-workers \
    --profile site-studio-worker \
    up -d --force-recreate >"${compose_log}" 2>&1
  compose_rc=$?
  set -e
  cat "${compose_log}"
  prod_core_deploy_compose_log_fail_closed "${compose_log}" "stack0-backend" || return 1
  if [[ "${compose_rc}" -ne 0 ]]; then
    echo "ERROR: stack0 backend compose up failed (rc=${compose_rc})" >&2
    return "${compose_rc}"
  fi
  prod_core_deploy_assert_stack0_baked_backend_containers "${env_file}" || return 1
}

prod_core_deploy_recreate_stack0_frontend_baked() {
  local repo_root="$1"
  local env_file compose_log compose_rc
  env_file="$(prod_core_deploy_env_file "${repo_root}" .env.stack0.backend)"
  cd "${repo_root}"
  podman stop stack0-eliteew-frontend-prod 2>/dev/null || true
  podman rm -f stack0-eliteew-frontend-prod 2>/dev/null || true
  prod_core_deploy_retire_named_container stack0-eliteew-frontend-prod-baked
  compose_log="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '${compose_log}'" RETURN
  set +e
  podman compose \
    -f docker/stack/stack0_f.yml \
    -f docker/stack/stack0_f.prod-baked.override.yml \
    --env-file "${env_file}" \
    up -d --force-recreate >"${compose_log}" 2>&1
  compose_rc=$?
  set -e
  cat "${compose_log}"
  prod_core_deploy_compose_log_fail_closed "${compose_log}" "stack0-frontend" || return 1
  if [[ "${compose_rc}" -ne 0 ]]; then
    echo "ERROR: stack0 frontend compose up failed (rc=${compose_rc})" >&2
    return "${compose_rc}"
  fi
  ELITEEW_FRONTEND_HEALTH_STRICT=0 bash docker/scripts/fix-prod-core-baked-frontend-nginx.sh
}

prod_core_deploy_ensure_baked_image_short_tags() {
  # Podman load stores localhost/<name>:<tag>; compose env uses <name>:<tag>.
  # Without a dual-tag, short-name resolution prompts for a TTY and fails in SSH.
  local env_file="$1"
  local key raw short
  for key in \
    STACK0_API_BAKED_IMAGE \
    STACK0_QUEUE_WORKER_BAKED_IMAGE \
    STACK0_CELERY_WORKER_BAKED_IMAGE \
    STACK0_CELERY_BEAT_BAKED_IMAGE \
    STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE \
    STACK0_FRONTEND_BAKED_IMAGE; do
    raw="$(grep -E "^${key}=" "${env_file}" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
    [[ -n "${raw}" ]] || continue
    short="${raw#localhost/}"
    if podman image exists "localhost/${short}" 2>/dev/null; then
      podman tag "localhost/${short}" "${short}" 2>/dev/null || true
    fi
    if podman image exists "${short}" 2>/dev/null && ! podman image exists "localhost/${short}" 2>/dev/null; then
      podman tag "${short}" "localhost/${short}" 2>/dev/null || true
    fi
    if ! podman image exists "${short}" 2>/dev/null && ! podman image exists "localhost/${short}" 2>/dev/null; then
      echo "ERROR: baked image missing for ${key}=${raw} (need ${short} or localhost/${short})" >&2
      return 1
    fi
  done
  echo "✅ baked image short-tags OK"
}

prod_core_deploy_recreate_stack0_baked() {
  local repo_root="$1"
  local env_file
  env_file="$(prod_core_deploy_env_file "${repo_root}" .env.stack0.backend)"
  prod_core_deploy_prepare_stack0_compose_env "${repo_root}"
  cd "${repo_root}"

  prod_core_deploy_ensure_stack0_baked_image_env "${env_file}" || return 1
  prod_core_deploy_ensure_baked_image_short_tags "${env_file}" || return 1
  prod_core_deploy_stop_legacy_stack0

  prod_core_deploy_recreate_stack0_backend_baked "${repo_root}" || return 1
  prod_core_deploy_recreate_stack0_frontend_baked "${repo_root}" || return 1
}

prod_core_deploy_recreate_stack0_dev_bind() {
  local repo_root="$1"
  local env_file
  local mount_path="${ELITEEW_PROD_LINE_MOUNT:-/mnt/eliteew-prod-line-export}"
  env_file="$(prod_core_deploy_env_file "${repo_root}" .env.stack0.backend)"
  prod_core_deploy_prepare_stack0_compose_env "${repo_root}"
  cd "${repo_root}"

  if ! mountpoint -q "${mount_path}" 2>/dev/null; then
    echo "ERROR: dev-bind mount missing: ${mount_path}" >&2
    echo "       Mount NFS export from command-center first (eeprodline export-setup)." >&2
    return 1
  fi
  for req in api/main.py apps/README.md frontend-dist/index.html; do
    if [[ ! -e "${mount_path}/${req}" ]]; then
      echo "ERROR: export artifact missing: ${mount_path}/${req}" >&2
      echo "       Run eeprodline sync on command-center." >&2
      return 1
    fi
  done

  prod_core_deploy_ensure_stack0_baked_image_env "${env_file}" || return 1
  prod_core_deploy_ensure_baked_image_short_tags "${env_file}" || return 1

  prod_core_deploy_stop_legacy_stack0
  prod_core_deploy_retire_stack0_baked_backend_containers
  prod_core_deploy_retire_named_container stack0-eliteew-frontend-prod-baked

  export ELITEEW_PROD_LINE_MOUNT="${mount_path}"
  if grep -q "^ELITEEW_PROD_LINE_MOUNT=" "${env_file}"; then
    sed -i "s|^ELITEEW_PROD_LINE_MOUNT=.*|ELITEEW_PROD_LINE_MOUNT=${mount_path}|" "${env_file}"
  else
    echo "ELITEEW_PROD_LINE_MOUNT=${mount_path}" >>"${env_file}"
  fi
  local compose_log compose_rc
  compose_log="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '${compose_log}'" RETURN
  set +e
  podman compose \
    -f docker/stack/stack0_b.yml \
    -f docker/stack/stack0_b.dev-bind.override.yml \
    --env-file "${env_file}" \
    --profile punisher-local-workers \
    --profile site-studio-worker \
    up -d --force-recreate >"${compose_log}" 2>&1
  compose_rc=$?
  set -e
  cat "${compose_log}"
  prod_core_deploy_compose_log_fail_closed "${compose_log}" "stack0-dev-bind-backend" || return 1
  if [[ "${compose_rc}" -ne 0 ]]; then
    echo "ERROR: stack0 dev-bind backend compose up failed (rc=${compose_rc})" >&2
    return "${compose_rc}"
  fi

  compose_log="$(mktemp)"
  set +e
  podman compose \
    -f docker/stack/stack0_f.yml \
    -f docker/stack/stack0_f.dev-bind.override.yml \
    --env-file "${env_file}" \
    up -d --force-recreate >"${compose_log}" 2>&1
  compose_rc=$?
  set -e
  cat "${compose_log}"
  prod_core_deploy_compose_log_fail_closed "${compose_log}" "stack0-dev-bind-frontend" || return 1
  if [[ "${compose_rc}" -ne 0 ]]; then
    echo "ERROR: stack0 dev-bind frontend compose up failed (rc=${compose_rc})" >&2
    return "${compose_rc}"
  fi

  ELITEEW_FRONTEND_HEALTH_STRICT=0 bash docker/scripts/fix-prod-core-baked-frontend-nginx.sh
  prod_core_deploy_wait_api_baked || return 1
}

prod_core_deploy_wait_api_baked() {
  local attempt=1
  local max="${PROD_CORE_API_READY_ATTEMPTS:-90}"
  while (( attempt <= max )); do
    if podman exec stack0-eliteew-api-prod-baked curl -sf --connect-timeout 2 http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    attempt=$((attempt + 1))
  done
  echo "ERROR: stack0-eliteew-api-prod-baked health timeout" >&2
  return 1
}

# Read active_line from NFS mount state (dev-bind | baked). Default baked when missing.
prod_core_deploy_read_active_line() {
  local mount_path="${ELITEEW_PROD_LINE_MOUNT:-/mnt/eliteew-prod-line-export}"
  local state="${mount_path}/.prod-line-state.json"
  if [[ ! -f "${state}" ]]; then
    printf '%s\n' "baked"
    return 0
  fi
  python3 - "${state}" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
try:
    data = json.loads(path.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError):
    print("baked")
    raise SystemExit(0)
line = str(data.get("active_line") or "baked").strip()
print(line if line in {"baked", "dev-bind"} else "baked")
PY
}

# Boot / port-guard entry: honor active_line, always dual-tag short names before compose.
prod_core_deploy_recreate_stack0_for_active_line() {
  local repo_root="$1"
  local line
  line="$(prod_core_deploy_read_active_line)"
  echo "INFO: stack0 recreate for active_line=${line}"
  if [[ "${line}" == "dev-bind" ]]; then
    prod_core_deploy_recreate_stack0_dev_bind "${repo_root}"
  else
    prod_core_deploy_recreate_stack0_baked "${repo_root}"
  fi
}

prod_core_deploy_smoke_stack0() {
  # Layer C liveness — host ports; not podman compose healthcheck. Canon: STACK0-HEALTHCHECK-LAYERS.md
  local api_port="${STACK0_API_HOST_PORT:-29000}"
  local front_port="${STACK0_FRONTEND_HOST_PORT:-29001}"
  local ota_port="${MOBILE_RELEASE_HOST_PORT:-29180}"
  local failures=0

  curl -sf "http://127.0.0.1:${api_port}/api/health" >/dev/null || {
    echo "ERROR: API health :${api_port} failed" >&2
    failures=$((failures + 1))
  }
  curl -sf "http://127.0.0.1:${front_port}/" -o /dev/null || {
    echo "ERROR: frontend :${front_port} failed" >&2
    failures=$((failures + 1))
  }
  local nginx_deploy_id="" api_deploy_id=""
  nginx_deploy_id="$(curl -sf "http://127.0.0.1:${front_port}/app-build-version.txt" 2>/dev/null | tr -d '\n\r' || true)"
  if podman ps --format '{{.Names}}' | grep -qx 'stack0-eliteew-api-prod-baked'; then
    api_deploy_id="$(podman exec stack0-eliteew-api-prod-baked cat /app/frontend-dist/app-build-version.txt 2>/dev/null | tr -d '\n\r' || true)"
  fi
  if [[ -z "${nginx_deploy_id}" ]]; then
    echo "ERROR: nginx app-build-version.txt empty (:${front_port})" >&2
    failures=$((failures + 1))
  elif [[ -z "${api_deploy_id}" ]]; then
    echo "ERROR: API /app/frontend-dist/app-build-version.txt empty" >&2
    failures=$((failures + 1))
  elif [[ "${nginx_deploy_id}" != "${api_deploy_id}" ]]; then
    echo "ERROR: deploy id mismatch nginx=${nginx_deploy_id} api=${api_deploy_id}" >&2
    echo "       rebake BOTH frontend+api images from the same dist-build" >&2
    failures=$((failures + 1))
  else
    echo "✅ deploy id match: ${nginx_deploy_id}"
  fi
  local profile_code
  profile_code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${api_port}/api/v1/mobile-app/profile")"
  if [[ "${profile_code}" != "401" && "${profile_code}" != "403" ]]; then
    echo "ERROR: mobile profile route HTTP ${profile_code} (expected 401/403)" >&2
    failures=$((failures + 1))
  fi
  if curl -sf "http://127.0.0.1:${ota_port}/v1/manifest.json" >/dev/null; then
    python3 - "http://127.0.0.1:${ota_port}/v1/manifest.json" <<'PY'
import json
import sys
import urllib.request

url = sys.argv[1]
data = json.load(urllib.request.urlopen(url, timeout=5))
print(f"OTA {data.get('version_name')} ({data.get('version_code')})")
PY
  else
    echo "WARN: OTA manifest :${ota_port} not reachable (skip if --api-only)" >&2
  fi

  if podman ps --format '{{.Names}}' | grep -qx 'stack0-eliteew-api-prod-baked'; then
    echo "✅ stack0-eliteew-api-prod-baked running"
  else
    echo "ERROR: stack0-eliteew-api-prod-baked not running" >&2
    failures=$((failures + 1))
  fi

  return "${failures}"
}

prod_core_deploy_env_var_from_file() {
  local env_file="$1"
  local key="$2"
  local default="${3:-}"
  local val=""
  if [[ -f "${env_file}" ]]; then
    val="$(
      grep -E "^${key}=" "${env_file}" 2>/dev/null \
        | tail -n 1 \
        | cut -d= -f2- \
        | sed 's/^"\(.*\)"$/\1/' \
        | sed "s/^'\(.*\)'$/\1/"
    )"
  fi
  if [[ -n "${val}" ]]; then
    printf '%s' "${val}"
  else
    printf '%s' "${default}"
  fi
}

prod_core_deploy_resolve_sidecar_host() {
  local repo_root env_file url host
  repo_root="${PROD_CORE_DEPLOY_REPO_ROOT:-$(prod_core_deploy_repo_root)}"
  env_file="$(prod_core_deploy_env_file "${repo_root}" .env.stack0.backend)"
  url="$(prod_core_deploy_env_var_from_file "${env_file}" BROWSER_RENDER_SERVICE_URL "")"
  if [[ -n "${url}" ]]; then
    host="$(
      python3 - "${url}" <<'PY'
import sys
from urllib.parse import urlparse

print(urlparse(sys.argv[1]).hostname or "")
PY
    )"
    if [[ -n "${host}" ]]; then
      printf '%s' "${host}"
      return 0
    fi
  fi
  host="$(prod_core_deploy_env_var_from_file "${env_file}" BROWSER_RENDER_WORKER_HOST "stack0-eliteew-api-worker-prod")"
  printf '%s' "${host}"
}

prod_core_deploy_resolve_contract_container_names() {
  local repo_root env_file
  repo_root="${PROD_CORE_DEPLOY_REPO_ROOT:-$(prod_core_deploy_repo_root)}"
  env_file="$(prod_core_deploy_env_file "${repo_root}" .env.stack0.backend)"
  STACK0_CONTRACT_API_CONTAINER="${STACK0_CONTRACT_API_CONTAINER:-$(prod_core_deploy_env_var_from_file "${env_file}" STACK0_API_BAKED_CONTAINER_NAME "stack0-eliteew-api-prod-baked")}"
  STACK0_CONTRACT_WORKER_CONTAINER="${STACK0_CONTRACT_WORKER_CONTAINER:-$(prod_core_deploy_env_var_from_file "${env_file}" STACK0_QUEUE_WORKER_BAKED_CONTAINER_NAME "stack0-eliteew-api-worker-prod-baked")}"
  export STACK0_CONTRACT_API_CONTAINER STACK0_CONTRACT_WORKER_CONTAINER
}

# Contract-level post-deploy gate: API venv, worker presence, sidecar DNS + HTTP reachability.
# Called after prod_core_deploy_smoke_stack0 liveness checks on prod-baked backend/all deploys.
prod_core_deploy_smoke_stack0_contract() {
  local failures=0
  local api_c worker_c sidecar_host browser_port science_port

  prod_core_deploy_resolve_contract_container_names
  api_c="${STACK0_CONTRACT_API_CONTAINER}"
  worker_c="${STACK0_CONTRACT_WORKER_CONTAINER}"
  sidecar_host="${STACK0_CONTRACT_SIDECAR_HOST:-$(prod_core_deploy_resolve_sidecar_host)}"
  browser_port="${BROWSER_RENDER_SERVICE_PORT:-8095}"
  science_port="${SCIENCE_STACK_SERVICE_PORT:-8096}"

  echo "=== stack0 contract smoke (api=${api_c} worker=${worker_c} sidecar_host=${sidecar_host}) ==="

  if ! podman exec "${api_c}" python -c "import bcrypt; import importlib.util; assert importlib.util.find_spec('playwright') is None"; then
    echo "ERROR: contract check 1 failed — API venv must import bcrypt and exclude playwright" >&2
    failures=$((failures + 1))
  else
    echo "✅ contract check 1: API venv (bcrypt present, playwright absent)"
  fi

  if ! podman ps --format '{{.Names}}' | grep -qx "${worker_c}"; then
    echo "ERROR: contract check 2 failed — queue-worker container not running: ${worker_c}" >&2
    failures=$((failures + 1))
  else
    echo "✅ contract check 2: queue-worker ${worker_c} running"
  fi

  if ! podman exec "${api_c}" getent hosts "${sidecar_host}" >/dev/null 2>&1; then
    echo "ERROR: contract check 3 failed — API pod cannot resolve sidecar host: ${sidecar_host}" >&2
    failures=$((failures + 1))
  else
    echo "✅ contract check 3: DNS ${sidecar_host} resolves from API pod"
  fi

  if ! podman exec "${api_c}" curl -sf --connect-timeout 5 "http://${sidecar_host}:${browser_port}/health" >/dev/null; then
    echo "ERROR: contract check 4a failed — browser sidecar http://${sidecar_host}:${browser_port}/health" >&2
    failures=$((failures + 1))
  else
    echo "✅ contract check 4a: browser sidecar :${browser_port}/health reachable"
  fi

  if ! podman exec "${api_c}" curl -sf --connect-timeout 5 "http://${sidecar_host}:${science_port}/health" >/dev/null; then
    echo "ERROR: contract check 4b failed — science sidecar http://${sidecar_host}:${science_port}/health" >&2
    failures=$((failures + 1))
  else
    echo "✅ contract check 4b: science sidecar :${science_port}/health reachable"
  fi

  if [[ "${failures}" -gt 0 ]]; then
    echo "ERROR: stack0 contract smoke failed (${failures} check(s))" >&2
  else
    echo "✅ stack0 contract smoke passed"
  fi

  return "${failures}"
}

prod_core_deploy_user_path_origin() {
  printf '%s' "${STACK0_USER_PATH_PUBLIC_ORIGIN:-https://app.eliteew.ru}"
}

prod_core_deploy_user_path_curl() {
  local -a curl_args=(-sf --connect-timeout 15 --max-time 30)
  if [[ "${STACK0_USER_PATH_CURL_INSECURE:-1}" == "1" ]]; then
    curl_args+=(-k)
  fi
  curl "${curl_args[@]}" "$@"
}

# Check 1 — public edge /api/health (runs on command-center or any host with edge reachability).
prod_core_deploy_verify_public_api_liveness() {
  local origin url
  origin="$(prod_core_deploy_user_path_origin)"
  url="${origin%/}/api/health"
  echo ">>> user-path check 1: public API liveness ${url}"
  if ! prod_core_deploy_user_path_curl "${url}" >/dev/null; then
    echo "ERROR: user-path check 1 failed — ${url} not HTTP 200" >&2
    return 1
  fi
  echo "✅ user-path check 1: public /api/health OK"
  return 0
}

# Check 2 — Engine.IO v4 polling handshake must return a sid (public wss path via edge).
prod_core_deploy_verify_public_socketio_handshake() {
  local origin url body
  origin="$(prod_core_deploy_user_path_origin)"
  url="${origin%/}/socket.io/?EIO=4&transport=polling"
  echo ">>> user-path check 2: Socket.IO handshake ${url}"
  body="$(prod_core_deploy_user_path_curl "${url}" 2>/dev/null || true)"
  if [[ -z "${body}" ]]; then
    echo "ERROR: user-path check 2 failed — empty Socket.IO handshake response" >&2
    return 1
  fi
  if ! python3 - "${body}" <<'PY'
import json
import re
import sys

raw = sys.argv[1]
match = re.match(r"^(\d+)", raw)
payload = raw[match.end() :] if match else raw
try:
    data = json.loads(payload)
except json.JSONDecodeError:
    sys.exit(1)
sid = data.get("sid")
if not isinstance(sid, str) or len(sid) < 8:
    sys.exit(1)
print(sid)
PY
  then
    echo "ERROR: user-path check 2 failed — Socket.IO handshake missing valid sid" >&2
    echo "       body prefix: ${body:0:120}" >&2
    return 1
  fi
  echo "✅ user-path check 2: Socket.IO handshake sid OK"
  return 0
}

prod_core_deploy_resolve_user_path_container_names() {
  local repo_root env_file
  repo_root="${PROD_CORE_DEPLOY_REPO_ROOT:-$(prod_core_deploy_repo_root)}"
  env_file="$(prod_core_deploy_env_file "${repo_root}" .env.stack0.backend)"
  STACK0_USER_PATH_API_CONTAINER="${STACK0_USER_PATH_API_CONTAINER:-$(prod_core_deploy_env_var_from_file "${env_file}" STACK0_API_BAKED_CONTAINER_NAME "stack0-eliteew-api-prod-baked")}"
  STACK0_USER_PATH_FRONTEND_CONTAINER="${STACK0_USER_PATH_FRONTEND_CONTAINER:-$(prod_core_deploy_env_var_from_file "${env_file}" STACK0_FRONTEND_BAKED_CONTAINER_NAME "stack0-eliteew-frontend-prod-baked")}"
  STACK0_USER_PATH_API_HOST="${STACK0_USER_PATH_API_HOST:-eliteew-api-prod}"
  export STACK0_USER_PATH_API_CONTAINER STACK0_USER_PATH_FRONTEND_CONTAINER STACK0_USER_PATH_API_HOST
}

# Check 3 — frontend DNS for eliteew-api-prod must resolve only live API container IPs (prod-core only).
# Multi-network API may return >1 address; fail only on zero resolves or ghost IPs outside the container.
prod_core_deploy_verify_single_upstream() {
  local failures=0
  local api_c fe_c api_host resolved_ips api_ips ip_count rip ghost=0
  prod_core_deploy_resolve_user_path_container_names
  api_c="${STACK0_USER_PATH_API_CONTAINER}"
  fe_c="${STACK0_USER_PATH_FRONTEND_CONTAINER}"
  api_host="${STACK0_USER_PATH_API_HOST}"

  echo "=== user-path check 3: upstream DNS (${api_host} ⊆ live API container) ==="

  if ! podman container exists "${api_c}" 2>/dev/null; then
    echo "ERROR: user-path check 3 failed — API container not found: ${api_c}" >&2
    return 1
  fi
  if ! podman container exists "${fe_c}" 2>/dev/null; then
    echo "ERROR: user-path check 3 failed — frontend container not found: ${fe_c}" >&2
    return 1
  fi

  api_ips="$(podman inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "${api_c}" 2>/dev/null | tr ' ' '\n' | sed '/^$/d' | sort -u | tr '\n' ' ')"
  api_ips="${api_ips%" "}"
  if [[ -z "${api_ips}" ]]; then
    echo "ERROR: user-path check 3 failed — no IP on API container ${api_c}" >&2
    return 1
  fi

  resolved_ips="$(podman exec "${fe_c}" getent hosts "${api_host}" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ')"
  resolved_ips="${resolved_ips%" "}"
  ip_count="$(podman exec "${fe_c}" getent hosts "${api_host}" 2>/dev/null | awk '{print $1}' | sort -u | wc -l | tr -d ' ')"

  echo ">>> API container IPs: ${api_ips}"
  echo ">>> frontend getent ${api_host}: ${resolved_ips:-<none>} (count=${ip_count})"

  if [[ "${ip_count}" -eq 0 ]]; then
    echo "ERROR: user-path check 3 failed — ${api_host} did not resolve inside frontend container" >&2
    failures=$((failures + 1))
  else
    for rip in ${resolved_ips}; do
      matched=0
      for aip in ${api_ips}; do
        if [[ "${rip}" == "${aip}" ]]; then
          matched=1
          break
        fi
      done
      if [[ "${matched}" -eq 0 ]]; then
        echo "ERROR: user-path check 3 failed — ghost/stale DNS ${rip} not in active API IPs" >&2
        ghost=$((ghost + 1))
        failures=$((failures + 1))
      fi
    done
    if [[ "${ghost}" -eq 0 ]]; then
      if [[ "${ip_count}" -eq 1 ]]; then
        echo "✅ user-path check 3: single upstream ${resolved_ips} matches API container"
      else
        echo "✅ user-path check 3: ${ip_count} upstream IP(s) all match live API container (multi-network OK)"
      fi
    else
      echo "       hint: bash docker/scripts/fix-prod-core-baked-frontend-nginx.sh && podman restart ${fe_c}" >&2
    fi
  fi

  return "${failures}"
}

prod_core_deploy_verify_public_user_path() {
  local failures=0
  echo "=== stack0 public user-path checks (edge) ==="
  prod_core_deploy_verify_public_api_liveness || failures=$((failures + 1))
  prod_core_deploy_verify_public_socketio_handshake || failures=$((failures + 1))
  if [[ "${failures}" -gt 0 ]]; then
    echo "ERROR: public user-path verification failed (${failures} check(s))" >&2
  else
    echo "✅ public user-path verification passed"
  fi
  return "${failures}"
}

# Full user-path gate: public edge (command-center) + single upstream (prod-core).
prod_core_deploy_verify_external_user_path() {
  local failures=0
  echo "=== stack0 external user-path gate ==="
  prod_core_deploy_verify_public_user_path || failures=$((failures + 1))
  prod_core_deploy_verify_single_upstream || failures=$((failures + 1))
  if [[ "${failures}" -gt 0 ]]; then
    echo "ERROR: external user-path gate failed (${failures} stage(s))" >&2
  else
    echo "✅ external user-path gate passed"
  fi
  return "${failures}"
}

prod_core_deploy_recreate_ota_stack() {
  local repo_root="$1"
  cd "${repo_root}"
  podman compose -f docker/stack/stack-mobile-release.yml up -d --force-recreate
  if [[ -x docker/scripts/mobile-release-stack.sh ]]; then
    bash docker/scripts/mobile-release-stack.sh smoke
  else
    curl -sf http://127.0.0.1:29180/v1/manifest.json | python3 -m json.tool
  fi
}

prod_core_deploy_default_runtime_baked_tag() {
  printf 'prod-runtime-%s' "$(date +%Y%m%d-%H%M)"
}

prod_core_deploy_validate_runtime_baked_tag() {
  local tag="$1"
  if [[ ! "${tag}" =~ ^prod-runtime-[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]]; then
    echo "ERROR: invalid runtime tag '${tag}' (expected prod-runtime-…)" >&2
    return 1
  fi
}

prod_core_deploy_ensure_stack2_tool_router_env() {
  local env_file="$1"
  if ! grep -q '^LLAMA_TOOL_ROUTER_FILE=' "${env_file}" 2>/dev/null; then
    echo 'LLAMA_TOOL_ROUTER_FILE=gemma-4-26B.gguf' >>"${env_file}"
  fi
}

prod_core_deploy_patch_runtime_baked_env() {
  local tag="$1"
  local repo="${PROD_CORE_DEPLOY_REPO_ROOT:-$(prod_core_deploy_repo_root)}"
  local env2 env4
  env2="$(prod_core_deploy_env_file "${repo}" .env.stack2)"
  env4="$(prod_core_deploy_env_file "${repo}" .env.stack4)"
  prod_core_deploy_validate_runtime_baked_tag "${tag}" || return 1
  prod_core_deploy_patch_runtime_baked_env_stack2_only "${env2}" "${tag}"
  prod_core_deploy_patch_runtime_baked_env_stack4_only "${env4}" "${tag}"
}

prod_core_deploy_patch_runtime_baked_env_stack2_only() {
  local env_file="$1"
  local tag="$2"
  prod_core_deploy_validate_runtime_baked_tag "${tag}" || return 1
  [[ -f "${env_file}" ]] || {
    echo "ERROR: env file missing: ${env_file}" >&2
    return 1
  }
  prod_core_deploy_ensure_stack2_tool_router_env "${env_file}"
  local -a keys=(
    PROD_CORE_RUNTIME_BAKED_TAG
    STACK2_LLAMA_CHAT_BAKED_IMAGE
  )
  local -a vals=(
    "${tag}"
    "eliteew-llama-chat:${tag}"
  )
  local i key val
  for i in "${!keys[@]}"; do
    key="${keys[$i]}"
    val="${vals[$i]}"
    if grep -q "^${key}=" "${env_file}"; then
      sed -i "s|^${key}=.*|${key}=${val}|" "${env_file}"
    else
      echo "${key}=${val}" >>"${env_file}"
    fi
  done
  echo "✅ env patched stack2 runtime (${tag})"
}

prod_core_deploy_patch_runtime_baked_env_stack4_only() {
  local env_file="$1"
  local tag="$2"
  prod_core_deploy_validate_runtime_baked_tag "${tag}" || return 1
  [[ -f "${env_file}" ]] || {
    echo "ERROR: env file missing: ${env_file}" >&2
    return 1
  }
  local -a keys=(
    PROD_CORE_RUNTIME_BAKED_TAG
    STACK4_TIKA_BAKED_IMAGE
    STACK4_OCRMYPDF_BAKED_IMAGE
    STACK4_GOTENBERG_BAKED_IMAGE
    STACK4_TESSERACT_BAKED_IMAGE
    STACK4_PAPERLESS_BAKED_IMAGE
  )
  local -a vals=(
    "${tag}"
    "eliteew-stack4-tika:${tag}"
    "eliteew-stack4-ocrmypdf:${tag}"
    "eliteew-stack4-gotenberg:${tag}"
    "eliteew-stack4-tesseract:${tag}"
    "eliteew-stack4-paperless:${tag}"
  )
  local i key val
  for i in "${!keys[@]}"; do
    key="${keys[$i]}"
    val="${vals[$i]}"
    if grep -q "^${key}=" "${env_file}"; then
      sed -i "s|^${key}=.*|${key}=${val}|" "${env_file}"
    else
      echo "${key}=${val}" >>"${env_file}"
    fi
  done
  echo "✅ env patched stack4 runtime (${tag})"
}

prod_core_deploy_recreate_stack2_chat_baked() {
  local repo_root="$1"
  local env_file
  env_file="$(prod_core_deploy_env_file "${repo_root}" .env.stack2)"
  cd "${repo_root}"
  prod_core_deploy_ensure_stack2_tool_router_env "${env_file}"
  podman compose \
    -f docker/stack/stack2.yml \
    -f docker/stack/stack2.prod-core.override.yml \
    -f docker/stack/stack2.prod-core.baked.override.yml \
    --env-file "${env_file}" \
    up -d --force-recreate llama-chat
}

# Retire a named container so compose can recreate it (rename → stale, else remove).
prod_core_deploy_retire_named_container() {
  local name="$1"
  if ! podman container exists "${name}" 2>/dev/null; then
    return 0
  fi
  local stamp stale
  stamp="$(date +%Y%m%d-%H%M%S)"
  stale="${name}-stale-${stamp}"
  echo "INFO: retiring ${name} → ${stale} (compose recreate)"
  podman stop -t 20 "${name}" >/dev/null 2>&1 || true
  if podman container exists "${stale}" 2>/dev/null; then
    podman container rm -f "${name}" >/dev/null
    return 0
  fi
  if ! podman container rename "${name}" "${stale}" 2>/dev/null; then
    podman container rm -f "${name}" >/dev/null
  fi
}

prod_core_deploy_normalize_image_ref() {
  local image="$1"
  image="${image#localhost/}"
  image="${image#docker.io/library/}"
  image="${image#docker.io/}"
  printf '%s' "${image}"
}

prod_core_deploy_recreate_stack4_baked() {
  local repo_root="$1"
  local env_file name
  env_file="$(prod_core_deploy_env_file "${repo_root}" .env.stack4)"
  # podman-compose --force-recreate can fail with "name already in use" and leave the
  # old container running (seen on stack4-tika: no Healthcheck, wrong image tag).
  cd "${repo_root}" || return 1
  for name in stack4-tika stack4-ocrmypdf-api stack4-gotenberg stack4-tesseract stack4-paperless; do
    prod_core_deploy_retire_named_container "${name}"
  done
  local compose_log
  compose_log="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '${compose_log}'" RETURN
  set +e
  podman compose \
    -f docker/stack/stack4.yml \
    -f docker/stack/stack4.prod-baked.override.yml \
    --env-file "${env_file}" \
    up -d --force-recreate >"${compose_log}" 2>&1
  local compose_rc=$?
  set -e
  cat "${compose_log}"
  prod_core_deploy_compose_log_fail_closed "${compose_log}" "stack4" || return 1
  if [[ "${compose_rc}" -ne 0 ]]; then
    echo "ERROR: stack4 compose up failed (rc=${compose_rc})" >&2
    return "${compose_rc}"
  fi
  prod_core_deploy_assert_stack4_containers "${env_file}" || return 1
}

# Fail closed if compose log shows name collision (even when exit code is 0).
prod_core_deploy_compose_log_fail_closed() {
  local compose_log="$1"
  local label="${2:-compose}"
  # Podman variants: 'name already in use' | 'the container name "x" is already in use'
  if grep -qiE 'container name .+ is already in use|name is already in use|name already in use' "${compose_log}"; then
    echo "ERROR: ${label} compose reported name-already-in-use — refuse success (stale container risk)" >&2
    return 1
  fi
  return 0
}

prod_core_deploy_stack4_compose_log_fail_closed() {
  prod_core_deploy_compose_log_fail_closed "$1" "stack4"
}

# Fail if a stack0 baked backend container is missing or on the wrong image tag.
prod_core_deploy_assert_stack0_baked_backend_containers() {
  local env_file="$1"
  local -A expected=(
    [stack0-eliteew-api-prod-baked]=STACK0_API_BAKED_IMAGE
    [stack0-eliteew-api-worker-prod-baked]=STACK0_QUEUE_WORKER_BAKED_IMAGE
    [stack0-eliteew-celery-worker-prod-baked]=STACK0_CELERY_WORKER_BAKED_IMAGE
    [stack0-eliteew-celery-agentic-worker-prod-baked]=STACK0_CELERY_WORKER_BAKED_IMAGE
    [stack0-eliteew-celery-companion-worker-prod-baked]=STACK0_CELERY_WORKER_BAKED_IMAGE
    [stack0-eliteew-celery-discussion-worker-prod-baked]=STACK0_CELERY_WORKER_BAKED_IMAGE
    [stack0-eliteew-celery-beat-prod-baked]=STACK0_CELERY_BEAT_BAKED_IMAGE
  )
  local name key want have failures=0
  for name in "${!expected[@]}"; do
    key="${expected[${name}]}"
    want="$(grep -E "^${key}=" "${env_file}" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
    want="$(prod_core_deploy_normalize_image_ref "${want}")"
    if ! podman ps --format '{{.Names}}' | grep -qx "${name}"; then
      echo "ERROR: stack0 container not running: ${name}" >&2
      failures=$((failures + 1))
      continue
    fi
    have="$(podman inspect -f '{{.Config.Image}}' "${name}" 2>/dev/null || true)"
    have="$(prod_core_deploy_normalize_image_ref "${have}")"
    if [[ -n "${want}" && "${have}" != "${want}" ]]; then
      echo "ERROR: ${name} image mismatch want=${want} have=${have}" >&2
      failures=$((failures + 1))
    fi
  done
  if [[ "${failures}" -gt 0 ]]; then
    echo "ERROR: ${failures} stack0 baked backend container assertion(s) failed" >&2
    return 1
  fi
  echo "✅ stack0 baked backend containers match expected images"
  return 0
}

# Fail if a stack4 container is missing, on the wrong image, or has no Healthcheck.
prod_core_deploy_assert_stack4_containers() {
  local env_file="$1"
  local -A expected=(
    [stack4-tika]=STACK4_TIKA_BAKED_IMAGE
    [stack4-ocrmypdf-api]=STACK4_OCRMYPDF_BAKED_IMAGE
    [stack4-gotenberg]=STACK4_GOTENBERG_BAKED_IMAGE
    [stack4-tesseract]=STACK4_TESSERACT_BAKED_IMAGE
    [stack4-paperless]=STACK4_PAPERLESS_BAKED_IMAGE
  )
  local name key want have hc failures=0
  for name in "${!expected[@]}"; do
    key="${expected[${name}]}"
    want="$(grep -E "^${key}=" "${env_file}" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
    if ! podman ps --format '{{.Names}}' | grep -qx "${name}"; then
      echo "ERROR: ${name} not running after recreate" >&2
      failures=$((failures + 1))
      continue
    fi
    have="$(podman inspect "${name}" --format '{{.Config.Image}}' 2>/dev/null || true)"
    if [[ -n "${want}" ]]; then
      if [[ "$(prod_core_deploy_normalize_image_ref "${have}")" != "$(prod_core_deploy_normalize_image_ref "${want}")" ]]; then
        echo "ERROR: ${name} image drift: have=${have} want=${want}" >&2
        failures=$((failures + 1))
      fi
    fi
    hc="$(podman inspect "${name}" --format '{{if .Config.Healthcheck}}yes{{else}}no{{end}}' 2>/dev/null || echo no)"
    if [[ "${hc}" != "yes" ]]; then
      echo "ERROR: ${name} missing Healthcheck after recreate" >&2
      failures=$((failures + 1))
    fi
  done
  return "${failures}"
}

prod_core_deploy_smoke_stack2_chat() {
  local failures=0
  local repo="${PROD_CORE_DEPLOY_REPO_ROOT:-.}"
  local env_file
  env_file="$(prod_core_deploy_env_file "${repo}" .env.stack2)"
  local llama_port="8080"
  local llama_bind="127.0.0.1"
  if [[ -f "${env_file}" ]]; then
    llama_port="$(grep -E '^LLAMA_CHAT_HOST_PORT=' "${env_file}" | tail -1 | cut -d= -f2-)"
    llama_port="${llama_port:-8080}"
    llama_bind="$(grep -E '^LLAMA_CHAT_CLIENT_BIND=' "${env_file}" | tail -1 | cut -d= -f2-)"
    llama_bind="${llama_bind:-127.0.0.1}"
  fi
  local -a probe_hosts=()
  if [[ "${llama_bind}" == "0.0.0.0" ]]; then
    probe_hosts=("127.0.0.1")
  else
    probe_hosts=("${llama_bind}" "127.0.0.1")
  fi
  local host
  local llm_ok=0
  for host in "${probe_hosts[@]}"; do
    if curl -sf --connect-timeout 5 "http://${host}:${llama_port}/health" >/dev/null; then
      llm_ok=1
      break
    fi
  done
  if [[ "${llm_ok}" -ne 1 ]]; then
    echo "ERROR: llama-chat health failed on ${probe_hosts[*]}:${llama_port}" >&2
    failures=$((failures + 1))
  fi
  if podman ps --format '{{.Names}}' | grep -qx 'stack2-llama-chat'; then
    echo "✅ stack2-llama-chat running"
  else
    echo "ERROR: stack2-llama-chat not running" >&2
    failures=$((failures + 1))
  fi
  return "${failures}"
}

prod_core_deploy_smoke_stack4() {
  local failures=0
  local repo="${PROD_CORE_DEPLOY_REPO_ROOT:-.}"
  local env_file
  env_file="$(prod_core_deploy_env_file "${repo}" .env.stack4)"
  local tika_port="9998"
  if [[ -f "${env_file}" ]]; then
    tika_port="$(grep -E '^STACK4_TIKA_HOST_PORT=' "${env_file}" | tail -1 | cut -d= -f2-)"
    tika_port="${tika_port:-9998}"
  fi
  local attempt
  for attempt in 1 2 3 4 5; do
    if curl -sf -o /dev/null "http://127.0.0.1:${tika_port}/tika"; then
      break
    fi
    if [[ "${attempt}" -eq 5 ]]; then
      echo "ERROR: stack4 tika :${tika_port} failed" >&2
      failures=$((failures + 1))
    else
      sleep 5
    fi
  done
  for name in stack4-tika stack4-ocrmypdf-api stack4-gotenberg stack4-tesseract stack4-paperless; do
    if podman ps --format '{{.Names}}' | grep -qx "${name}"; then
      echo "✅ ${name} running"
    else
      echo "ERROR: ${name} not running" >&2
      failures=$((failures + 1))
    fi
  done
  if ! prod_core_deploy_assert_stack4_containers "${env_file}"; then
    failures=$((failures + 1))
  fi
  return "${failures}"
}

# Fill missing STACK2/STACK4 *_BAKED_IMAGE keys from existing containers (incl. exited).
# Used after env-pull/reboot when SOPS bundle omitted runtime deploy tags.
prod_core_deploy_ensure_stack24_runtime_baked_image_env() {
  local repo="${PROD_CORE_DEPLOY_REPO_ROOT:-$(prod_core_deploy_repo_root)}"
  local env2 env4 patched=0
  local key container image env_val target_env
  env2="$(prod_core_deploy_env_file "${repo}" .env.stack2)"
  env4="$(prod_core_deploy_env_file "${repo}" .env.stack4)"
  while IFS=$'\t' read -r key container; do
    [[ -n "${key}" ]] || continue
    image="$(prod_core_deploy_infer_baked_image_from_container "${container}")"
    [[ -n "${image}" ]] || continue
    target_env="${env4}"
    if [[ "${key}" == "STACK2_LLAMA_CHAT_BAKED_IMAGE" ]]; then
      target_env="${env2}"
    fi
    [[ -f "${target_env}" ]] || continue
    env_val="$(grep -E "^${key}=" "${target_env}" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
    if [[ -n "${env_val}" && "${env_val}" != "..." ]]; then
      continue
    fi
    prod_core_deploy_env_set_key "${target_env}" "${key}" "${image}"
    echo "INFO: patched ${key}=${image} (from ${container})"
    patched=$((patched + 1))
  done <<'MAP'
STACK2_LLAMA_CHAT_BAKED_IMAGE	stack2-llama-chat
STACK4_TIKA_BAKED_IMAGE	stack4-tika
STACK4_OCRMYPDF_BAKED_IMAGE	stack4-ocrmypdf-api
STACK4_GOTENBERG_BAKED_IMAGE	stack4-gotenberg
STACK4_TESSERACT_BAKED_IMAGE	stack4-tesseract
STACK4_PAPERLESS_BAKED_IMAGE	stack4-paperless
MAP
  if ((patched == 0)); then
    echo "INFO: STACK2/STACK4 runtime baked image env already complete"
  else
    echo "INFO: STACK2/STACK4 runtime baked image env patched (${patched} key(s))"
  fi
}
