#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared helpers for EliteEW operator scripts (dry-run, paths, prod-core SSH).
# Env/function prefix `DEWA_OPS_*` / `dewa_ops_*` kept for operator compat.
# ---

_DEWA_OPS_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${POWERED_BY_EMPERYWORLD_ROOT:-}" ]]; then
  DEWA_OPS_REPO_ROOT="$(cd "${POWERED_BY_EMPERYWORLD_ROOT}" && pwd)"
else
  DEWA_OPS_REPO_ROOT="$(cd "${_DEWA_OPS_LIB_DIR}/../.." && pwd)"
fi
DEWA_OPS_FRONTEND_DIR="${DEWA_OPS_REPO_ROOT}/shared/web/frontend"
DEWA_OPS_PROD_CORE_SSH="${DEWA_OPS_PROD_CORE_SSH:-prod-core}"
DEWA_OPS_REMOTE_REPO="${DEWA_OPS_REMOTE_REPO:-/home/owned/powered_by_emperyworld}"
export DEWA_OPS_REPO_ROOT DEWA_OPS_FRONTEND_DIR DEWA_OPS_PROD_CORE_SSH DEWA_OPS_REMOTE_REPO

dewa_ops_bootstrap_path() {
  if [[ -n "${DEWA_OPS_PATH_BOOTSTRAPPED:-}" ]]; then
    return 0
  fi
  local -a path_additions=()
  path_additions+=("${HOME}/.local/bin")
  if [[ -d "${HOME}/.nvm/versions/node" ]]; then
    local latest_node=""
    latest_node="$(
      find "${HOME}/.nvm/versions/node" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null \
        | sort -V \
        | tail -n 1
    )"
    if [[ -n "${latest_node}" ]]; then
      path_additions+=("${HOME}/.nvm/versions/node/${latest_node}/bin")
    fi
  fi
  if ((${#path_additions[@]} > 0)); then
    local prefix=""
    prefix="$(IFS=:; echo "${path_additions[*]}")"
    export PATH="${prefix}:${PATH}"
  fi
  export DEWA_OPS_PATH_BOOTSTRAPPED=1
}

dewa_ops_bootstrap_path

dewa_ops_is_dry_run() {
  [[ "${DEWA_DRY_RUN:-}" == "1" ]]
}

dewa_ops_log_dry_run() {
  echo "[dry-run] $*"
}

dewa_ops_require_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "ERROR: pnpm не найден в PATH" >&2
    exit 1
  fi
}

dewa_ops_require_podman() {
  if ! command -v podman >/dev/null 2>&1; then
    echo "ERROR: podman не найден в PATH" >&2
    exit 1
  fi
}

dewa_ops_load_env_var() {
  local key="$1"
  local default="${2:-}"
  local env_file="${DEWA_OPS_REPO_ROOT}/docker/env_file/.env.stack0.backend"
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

dewa_ops_podman_image_exists() {
  local ref="$1"
  podman image exists "${ref}" 2>/dev/null
}
