#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared env runtime paths for prod-core Config Plane (tmpfs vs legacy disk).
# Also preserves deploy-patched baked image keys across env-push overwrite.
# Invariants:
# - STACK0/2/4 *_BAKED_IMAGE / PROD_CORE_RUNTIME_BAKED_TAG may live only on runtime
#   tmpfs (patched by eeprodbaked/eeprodruntime) and must survive SOPS bundle push.
# Related:
# - documentation/platform/PROD-CORE-CONFIG-PLANE.md
# - documentation/platform/docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md
# ---

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Source this file; do not execute directly." >&2
  exit 2
fi

PROD_CORE_ENV_BUNDLE_FILES=(
  .env.stack0.backend
  .env.stack1
  .env.stack2
  .env.stack4
  .env.stack6
  .env.stack-ewa
  .env.stack11
  .env.stack12
  .env.yandex-tunnel
)

# Generated on install from .env.stack0.backend (not in SOPS bundle).
PROD_CORE_ENV_STACK0_ROLE_FILES=(
  .env.stack0.shared
  .env.stack0.api
  .env.stack0.jobs
)

prod_core_env_runtime_dir() {
  if [[ -n "${ELITEEW_ENV_RUNTIME_DIR:-}" ]]; then
    printf '%s' "${ELITEEW_ENV_RUNTIME_DIR}"
    return 0
  fi
  printf '%s' "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/eliteew/env-runtime"
}

prod_core_env_legacy_dir() {
  local repo_root="$1"
  printf '%s/docker/env_file' "${repo_root}"
}

prod_core_env_resolve_dir() {
  local repo_root="$1"
  local runtime legacy
  runtime="$(prod_core_env_runtime_dir)"
  legacy="$(prod_core_env_legacy_dir "${repo_root}")"
  if [[ -f "${runtime}/.env.stack0.backend" ]]; then
    printf '%s' "${runtime}"
    return 0
  fi
  if [[ -f "${legacy}/.env.stack0.backend" ]]; then
    echo "WARN: using legacy disk env_file; prefer runtime tmpfs (Config Plane)" >&2
    printf '%s' "${legacy}"
    return 0
  fi
  printf '%s' "${runtime}"
}

prod_core_env_file_path() {
  local repo_root="$1"
  local basename="$2"
  local dir
  dir="$(prod_core_env_resolve_dir "${repo_root}")"
  printf '%s/%s' "${dir}" "${basename}"
}

prod_core_env_storage_mode() {
  local repo_root="$1"
  local runtime legacy
  runtime="$(prod_core_env_runtime_dir)"
  legacy="$(prod_core_env_legacy_dir "${repo_root}")"
  if [[ -f "${runtime}/.env.stack0.backend" ]]; then
    echo "runtime_tmpfs"
  elif [[ -f "${legacy}/.env.stack0.backend" ]]; then
    echo "legacy_disk"
  else
    echo "missing"
  fi
}

# podman-compose resolves per-service env_file paths relative to compose YAML (../env_file/…).
# Config Plane keeps secrets in runtime tmpfs only — symlink legacy paths for all bundle files.
prod_core_env_ensure_legacy_symlinks() {
  local repo_root="$1"
  local runtime legacy name legacy_path target
  runtime="$(prod_core_env_runtime_dir)"
  legacy="$(prod_core_env_legacy_dir "${repo_root}")"
  mkdir -p "${legacy}"
  for name in "${PROD_CORE_ENV_BUNDLE_FILES[@]}" "${PROD_CORE_ENV_STACK0_ROLE_FILES[@]}"; do
    target="${runtime}/${name}"
    legacy_path="${legacy}/${name}"
    [[ -f "${target}" ]] || continue
    if [[ -L "${legacy_path}" ]]; then
      local current
      current="$(readlink -f "${legacy_path}" 2>/dev/null || readlink "${legacy_path}")"
      if [[ "${current}" == "${target}" ]]; then
        continue
      fi
      rm -f "${legacy_path}"
    elif [[ -e "${legacy_path}" ]]; then
      echo "ERROR: ${legacy_path} exists and is not a symlink to runtime env" >&2
      return 1
    fi
    ln -sf "${target}" "${legacy_path}"
  done
  echo "✅ legacy env symlinks → ${runtime}"
}

# Keys patched by baked/runtime deploy onto tmpfs; often absent from SOPS bundle.
PROD_CORE_ENV_RUNTIME_DEPLOY_KEY_REGEX='^(STACK0_(PROD_BAKED_TAG|.*_BAKED_IMAGE)|STACK2_LLAMA_CHAT_BAKED_IMAGE|STACK4_.*_BAKED_IMAGE|STACK6_KEYCLOAK_IMAGE|PROD_CORE_RUNTIME_BAKED_TAG)='

prod_core_env_runtime_deploy_key_files() {
  printf '%s\n' .env.stack0.backend .env.stack2 .env.stack4 .env.stack6
}

# Snapshot deploy-only keys from current runtime dir into snap_dir (*.preserve).
prod_core_env_snapshot_runtime_deploy_keys() {
  local runtime_dir="$1"
  local snap_dir="$2"
  local f
  mkdir -p "${snap_dir}"
  while IFS= read -r f; do
    [[ -f "${runtime_dir}/${f}" ]] || continue
    grep -E "${PROD_CORE_ENV_RUNTIME_DEPLOY_KEY_REGEX}" "${runtime_dir}/${f}" \
      >"${snap_dir}/${f}.preserve" 2>/dev/null || true
  done < <(prod_core_env_runtime_deploy_key_files)
}

# Restore missing/truncated deploy-only keys after bundle overwrite.
prod_core_env_restore_runtime_deploy_keys() {
  local runtime_dir="$1"
  local snap_dir="$2"
  local f snap line key val cur restored=0
  while IFS= read -r f; do
    snap="${snap_dir}/${f}.preserve"
    [[ -f "${snap}" && -s "${snap}" && -f "${runtime_dir}/${f}" ]] || continue
    while IFS= read -r line || [[ -n "${line}" ]]; do
      [[ -n "${line}" ]] || continue
      key="${line%%=*}"
      val="${line#*=}"
      [[ -n "${key}" ]] || continue
      cur="$(grep -E "^${key}=" "${runtime_dir}/${f}" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
      if [[ -z "${cur}" || "${cur}" == "..." ]]; then
        if grep -qE "^${key}=" "${runtime_dir}/${f}" 2>/dev/null; then
          sed -i "s|^${key}=.*|${key}=${val}|" "${runtime_dir}/${f}"
        else
          printf '%s=%s\n' "${key}" "${val}" >>"${runtime_dir}/${f}"
        fi
        restored=$((restored + 1))
      fi
    done <"${snap}"
  done < <(prod_core_env_runtime_deploy_key_files)
  if ((restored > 0)); then
    echo "INFO: restored ${restored} runtime deploy key(s) after env install"
  else
    echo "INFO: no runtime deploy keys needed restore after env install"
  fi
}

prod_core_env_staging_dir() {
  local repo_root="$1"
  printf '%s/docker/env_file' "${repo_root}"
}

# Idempotent KEY=value upsert (no secrets logged).
prod_core_env_set_key() {
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

# After successful stack0 baked deploy: write STACK0_*_BAKED_* into .136 staging.
prod_core_env_sync_stack0_bake_keys_to_staging() {
  local repo_root="$1"
  local tag="$2"
  local staging env0
  staging="$(prod_core_env_staging_dir "${repo_root}")"
  env0="${staging}/.env.stack0.backend"
  [[ -f "${env0}" ]] || {
    echo "ERROR: staging missing ${env0}" >&2
    return 1
  }
  if [[ ! "${tag}" =~ ^prod-baked-[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]]; then
    echo "ERROR: invalid stack0 baked tag '${tag}'" >&2
    return 1
  fi
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
  local i
  for i in "${!keys[@]}"; do
    prod_core_env_set_key "${env0}" "${keys[$i]}" "${vals[$i]}"
  done
  echo "INFO: synced ${#keys[@]} STACK0 bake key(s) → staging ${env0}"
  echo "HINT: rebuild SOPS bundle when ready: prod-core-env-bundle-build.sh + encrypt"
}

# After successful eeprodruntime: write STACK2/STACK4 bake keys into .136 staging.
# mode: all|stack2|stack4
prod_core_env_sync_runtime_bake_keys_to_staging() {
  local repo_root="$1"
  local tag="$2"
  local mode="${3:-all}"
  local staging
  staging="$(prod_core_env_staging_dir "${repo_root}")"
  if [[ ! "${tag}" =~ ^prod-runtime-[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]]; then
    echo "ERROR: invalid runtime baked tag '${tag}'" >&2
    return 1
  fi
  local patched=0
  if [[ "${mode}" == "all" || "${mode}" == "stack2" ]]; then
    local env2="${staging}/.env.stack2"
    [[ -f "${env2}" ]] || {
      echo "ERROR: staging missing ${env2}" >&2
      return 1
    }
    prod_core_env_set_key "${env2}" PROD_CORE_RUNTIME_BAKED_TAG "${tag}"
    prod_core_env_set_key "${env2}" STACK2_LLAMA_CHAT_BAKED_IMAGE "eliteew-llama-chat:${tag}"
    patched=$((patched + 2))
  fi
  if [[ "${mode}" == "all" || "${mode}" == "stack4" ]]; then
    local env4="${staging}/.env.stack4"
    [[ -f "${env4}" ]] || {
      echo "ERROR: staging missing ${env4}" >&2
      return 1
    }
    prod_core_env_set_key "${env4}" PROD_CORE_RUNTIME_BAKED_TAG "${tag}"
    prod_core_env_set_key "${env4}" STACK4_TIKA_BAKED_IMAGE "eliteew-stack4-tika:${tag}"
    prod_core_env_set_key "${env4}" STACK4_OCRMYPDF_BAKED_IMAGE "eliteew-stack4-ocrmypdf:${tag}"
    prod_core_env_set_key "${env4}" STACK4_GOTENBERG_BAKED_IMAGE "eliteew-stack4-gotenberg:${tag}"
    prod_core_env_set_key "${env4}" STACK4_TESSERACT_BAKED_IMAGE "eliteew-stack4-tesseract:${tag}"
    prod_core_env_set_key "${env4}" STACK4_PAPERLESS_BAKED_IMAGE "eliteew-stack4-paperless:${tag}"
    patched=$((patched + 6))
  fi
  echo "INFO: synced ${patched} runtime bake key(s) → staging (mode=${mode} tag=${tag})"
  echo "HINT: rebuild SOPS bundle when ready: prod-core-env-bundle-build.sh + encrypt"
}
