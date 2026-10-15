#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Подъём оставшихся prod-core стеков: stack6 (fix perms), stack11, stack12, yandex-tunnel.
# Invariants:
# - ENV_DIR prefers runtime tmpfs (Config Plane); legacy disk env_file fallback with WARN.
# - stack6 postgres UID 70:70.
# Related:
# - docker/scripts/start-prod-core-stacks.sh
# - docker/scripts/prod-core-env-lib.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REMOTE="${REMOTE-}"
if [[ -z "${REMOTE}" ]]; then
  host_short="$(hostname -s 2>/dev/null || true)"
  if [[ "${host_short}" == "whitep" || "${ELITEEW_PROD_CORE_LOCAL:-0}" == "1" ]]; then
    REMOTE=""
  else
    REMOTE="prod-core"
  fi
fi
REMOTE_BASE="${REMOTE_BASE:-/home/owned/powered_by_emperyworld}"
PHASE="${1:-all}"
# shellcheck source=prod-core-env-lib.sh
source "${SCRIPT_DIR}/prod-core-env-lib.sh"

_run() {
  if [[ -n "${REMOTE}" ]]; then
    ssh "${REMOTE}" "cd ${REMOTE_BASE} && $*"
  else
    cd "${REPO_ROOT}"
    eval "$@"
  fi
}

_prod_core_env_file() {
  local basename="$1"
  if [[ -n "${REMOTE}" ]]; then
    ssh "${REMOTE}" "cd ${REMOTE_BASE} && source docker/scripts/prod-core-env-lib.sh && prod_core_env_file_path '${REMOTE_BASE}' '${basename}'"
  else
    prod_core_env_file_path "${REPO_ROOT}" "${basename}"
  fi
}

_fix_stack6_perms() {
  _run "mkdir -p docker/logs/stack6/keycloak-postgres && podman unshare chown -R 70:70 docker/data/stack6/keycloak-postgres docker/logs/stack6/keycloak-postgres"
}

_phase_stack6() {
  local ef
  ef="$(_prod_core_env_file .env.stack6)"
  _fix_stack6_perms
  if grep -Eq '^STACK6_KEYCLOAK_IMAGE=.+' "${ef}" 2>/dev/null; then
    _run "podman compose -f docker/stack/stack6.yml -f docker/stack/stack6.prod-baked.override.yml --env-file $(printf '%q' "${ef}") up -d"
  else
    echo "WARN: STACK6_KEYCLOAK_IMAGE unset — vanilla quay fallback" >&2
    _run "podman compose -f docker/stack/stack6.yml --env-file $(printf '%q' "${ef}") up -d"
  fi
}

_phase_stack11() {
  local ef
  ef="$(_prod_core_env_file .env.stack11)"
  _run "podman unshare chown -R 101:102 docker/data/stack11/prosody 2>/dev/null || true"
  _run "podman compose -f docker/stack/stack11.yml --env-file $(printf '%q' "${ef}") up -d"
}

_phase_stack12() {
  local ef
  ef="$(_prod_core_env_file .env.stack12)"
  _run "podman compose -f docker/stack/stack12.yml --env-file $(printf '%q' "${ef}") up -d"
}

_phase_tunnel() {
  local ef
  ef="$(_prod_core_env_file .env.yandex-tunnel)"
  _run "ENV_FILE=$(printf '%q' "${ef}") bash docker/scripts/yandex-tunnel/compose-up.sh"
}

case "${PHASE}" in
  stack6) _phase_stack6 ;;
  stack11) _phase_stack11 ;;
  stack12) _phase_stack12 ;;
  tunnel) _phase_tunnel ;;
  all)
    _phase_stack6
    _phase_stack11
    _phase_stack12
    _phase_tunnel
    ;;
  *)
    echo "Usage: REMOTE=prod-core bash $0 {stack6|stack11|stack12|tunnel|all}" >&2
    exit 2
    ;;
esac

echo "✅ Phase '${PHASE}' on ${REMOTE:-local prod-core}"
