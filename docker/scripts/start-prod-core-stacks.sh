#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Boot-time compose up on prod-core (.111) — только pre-loaded baked images, без build/pull.
# Invariants:
# - ENV_DIR prefers runtime tmpfs (Config Plane); legacy disk env_file fallback with WARN.
# Related:
# - start-prod-core-remaining-stacks.sh, podman-autostart-prod-core.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PHASE="${1:-all}"
REMOTE="${REMOTE:-}"
COMPOSE=(podman compose)
# shellcheck source=prod-core-env-lib.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/prod-core-env-lib.sh"
ENV_DIR="$(prod_core_env_resolve_dir "${REPO_ROOT}")"

if [[ -n "${REMOTE}" ]]; then
  echo "ERROR: REMOTE= deploy removed. Use from command-center:" >&2
  echo "  eeprodbaked --yes --all" >&2
  echo "  eeprodruntime --yes --all" >&2
  exit 2
fi

_run() {
  (cd "${REPO_ROOT}" && "$@")
}

_env_file() {
  printf '%s' "${ENV_DIR}/$1"
}

_require_cdi() {
  # Refresh user CDI before stack2: /dev/dri/cardN can renumber after reboot while
  # /etc/cdi/nvidia.yaml stays stale (CDI inject → Exited). See STACK2-LLM-CONTRACT.md.
  local refresh="${SCRIPT_DIR}/prod-core/refresh-nvidia-cdi.sh"
  if [[ -x "${refresh}" ]]; then
    if ! bash "${refresh}"; then
      echo "WARN: refresh-nvidia-cdi.sh failed — falling back to existing CDI files" >&2
    fi
  fi
  if [[ -f "${XDG_CONFIG_HOME:-${HOME}/.config}/cdi/nvidia.yaml" ]] || [[ -f /etc/cdi/nvidia.yaml ]]; then
    return 0
  fi
  echo "BLOCKER: нет CDI nvidia.yaml (user ~/.config/cdi или /etc/cdi)" >&2
  return 1
}

_phase_networks() {
  _run bash docker/scripts/networks-create.sh
}

_phase_stack1() {
  _run "${COMPOSE[@]}" -f docker/stack/stack1.yml --env-file "$(_env_file .env.stack1)" up -d
}

_phase_stack6() {
  local ef
  ef="$(_env_file .env.stack6)"
  local -a cmd=("${COMPOSE[@]}" -f docker/stack/stack6.yml)
  if grep -Eq '^STACK6_KEYCLOAK_IMAGE=.+' "${ef}" 2>/dev/null; then
    cmd+=(-f docker/stack/stack6.prod-baked.override.yml)
  else
    echo "WARN: STACK6_KEYCLOAK_IMAGE unset — vanilla quay fallback (SPI bake missing)" >&2
  fi
  cmd+=(--env-file "${ef}" up -d)
  _run "${cmd[@]}"
}

_phase_stack_ewa() {
  _run mkdir -p docker/data/ewa/postgresql
  _run podman unshare chown -R 1000:1000 docker/data/ewa/postgresql
  _run "${COMPOSE[@]}" -f docker/stack/stack-ewa-postgres.yml --env-file "$(_env_file .env.stack-ewa)" up -d
}

_phase_stack2_chat() {
  _require_cdi
  # shellcheck source=prod-core-deploy-lib.sh
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/prod-core-deploy-lib.sh"
  export PROD_CORE_DEPLOY_REPO_ROOT="${REPO_ROOT}"
  prod_core_deploy_ensure_stack2_tool_router_env "$(_env_file .env.stack2)"
  local -a cmd=("${COMPOSE[@]}" -f docker/stack/stack2.yml -f docker/stack/stack2.prod-core.override.yml)
  if grep -q '^STACK2_LLAMA_CHAT_BAKED_IMAGE=' "$(_env_file .env.stack2)" 2>/dev/null; then
    cmd+=(-f docker/stack/stack2.prod-core.baked.override.yml)
  else
    echo "WARN: STACK2_LLAMA_CHAT_BAKED_IMAGE unset — run eeprodruntime first" >&2
  fi
  # Boot/autostart: force-recreate so container HostConfig does not keep stale cardN maj:min.
  if [[ "${ELITEEW_AUTOSTART_BOOT:-0}" == "1" ]] || [[ "${ELITEEW_STACK2_FORCE_RECREATE:-0}" == "1" ]]; then
    cmd+=(--env-file "$(_env_file .env.stack2)" up -d --force-recreate --pull=never llama-chat)
  else
    cmd+=(--env-file "$(_env_file .env.stack2)" up -d llama-chat)
  fi
  _run "${cmd[@]}"
}

_phase_stack4() {
  local env_file
  env_file="$(_env_file .env.stack4)"
  local -a required_baked_keys=(
    STACK4_TIKA_BAKED_IMAGE
    STACK4_OCRMYPDF_BAKED_IMAGE
    STACK4_GOTENBERG_BAKED_IMAGE
    STACK4_TESSERACT_BAKED_IMAGE
    STACK4_PAPERLESS_BAKED_IMAGE
  )
  local -a missing_keys=()
  local key
  if [[ ! -f "${env_file}" ]]; then
    echo "ERROR: stack4 env file missing: ${env_file}" >&2
    echo "Run from command-center: eeprodruntime --yes --stack4-only" >&2
    return 1
  fi
  for key in "${required_baked_keys[@]}"; do
    if ! grep -Eq "^${key}=.+" "${env_file}"; then
      missing_keys+=("${key}")
    fi
  done
  if [[ "${#missing_keys[@]}" -gt 0 ]]; then
    echo "ERROR: stack4 baked image env incomplete in ${env_file}: ${missing_keys[*]}" >&2
    echo "Prod-core must not build/pull stack4 fallback images. Run from command-center:" >&2
    echo "  eeprodruntime --yes --stack4-only" >&2
    return 1
  fi
  local -a cmd=("${COMPOSE[@]}" -f docker/stack/stack4.yml)
  cmd+=(-f docker/stack/stack4.prod-baked.override.yml)
  cmd+=(--env-file "${env_file}" up -d)
  _run "${cmd[@]}"
  # shellcheck source=prod-core-deploy-lib.sh
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/prod-core-deploy-lib.sh"
  export PROD_CORE_DEPLOY_REPO_ROOT="${REPO_ROOT}"
  prod_core_deploy_smoke_stack4
}

_phase_stack0() {
  # Honor prod-line active_line (baked | dev-bind); dual-tag short names before compose.
  # shellcheck source=prod-core-deploy-lib.sh
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/prod-core-deploy-lib.sh"
  export PROD_CORE_DEPLOY_REPO_ROOT="${REPO_ROOT}"
  prod_core_deploy_recreate_stack0_for_active_line "${REPO_ROOT}"
}

# Back-compat alias for callers that still name the baked phase.
_phase_stack0_baked() {
  _phase_stack0
}

_phase_smoke() {
  _run bash -c 'curl -sf --connect-timeout 5 http://127.0.0.1:29000/api/health && echo API_ok || echo API_fail'
  _run bash -c 'curl -sf --connect-timeout 5 http://127.0.0.1:29001/ -o /dev/null && echo FRONT_ok || echo FRONT_fail'
}

case "${PHASE}" in
  networks) _phase_networks ;;
  stack1) _phase_networks; _phase_stack1 ;;
  stack6) _phase_stack6 ;;
  stack-ewa) _phase_stack_ewa ;;
  stack2) _phase_stack2_chat ;;
  stack4) _phase_stack4 ;;
  stack0) _phase_stack0 ;;
  smoke) _phase_smoke ;;
  all)
    _phase_networks
    _phase_stack1
    _phase_stack6
    _phase_stack_ewa
    if _require_cdi; then
      _phase_stack2_chat || echo "SKIP stack2" >&2
    fi
    _phase_stack4
    _phase_stack0
    _phase_smoke
    ;;
  -h | --help)
    echo "Usage: ELITEEW_PROD_CORE_LOCAL=1 bash $0 {networks|stack1|stack6|stack2|stack4|stack0|smoke|all}"
    exit 0
    ;;
  *)
    echo "Unknown phase: ${PHASE}" >&2
    exit 1
    ;;
esac

echo "✅ Phase '${PHASE}' done (env_dir=${ENV_DIR})"
