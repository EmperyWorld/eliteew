#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Restore prod-core critical host ports after Podman rootless reboot drift (stack0 + Keycloak).
# Invariants:
# - Local prod-core host only; idempotent when ports already accept connections.
# Related:
# - docker/scripts/podman-autostart-prod-core.sh
# - docker/scripts/fix-prod-core-baked-frontend-nginx.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck source=prod-core-deploy-lib.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/prod-core-deploy-lib.sh"
export PROD_CORE_DEPLOY_REPO_ROOT="${REPO_ROOT}"
API_PORT="${STACK0_API_HOST_PORT:-29000}"
FRONT_PORT="${STACK0_FRONTEND_HOST_PORT:-29001}"
KC_PORT="${STACK6_KEYCLOAK_HOST_PORT:-36000}"
MAX_ATTEMPTS="${PROD_CORE_PORT_GUARD_ATTEMPTS:-3}"
FAILURES=0

_host_port_ok() {
  local port="$1"
  curl -sf --connect-timeout 2 "http://127.0.0.1:${port}/" -o /dev/null 2>/dev/null \
    || curl -sf --connect-timeout 2 "http://127.0.0.1:${port}/api/health" -o /dev/null 2>/dev/null
}

_keycloak_port_ok() {
  curl -sf --connect-timeout 2 "http://127.0.0.1:${KC_PORT}/realms/empery" -o /dev/null 2>/dev/null
}

_wait_api_ready() {
  local attempt=1
  local max="${PROD_CORE_API_READY_ATTEMPTS:-60}"
  while (( attempt <= max )); do
    if podman exec stack0-eliteew-api-prod-baked curl -sf --connect-timeout 2 http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    attempt=$((attempt + 1))
  done
  return 1
}

_recover_stack0() {
  if _host_port_ok "${API_PORT}" && _host_port_ok "${FRONT_PORT}"; then
    echo "✅ stack0 host ports ${API_PORT}/${FRONT_PORT} OK"
    return 0
  fi

  echo "WARN: stack0 host ports ${API_PORT}/${FRONT_PORT} not accepting connections; attempting recovery" >&2
  cd "${REPO_ROOT}"

  local attempt=1
  local line
  line="$(prod_core_deploy_read_active_line)"
  while (( attempt <= MAX_ATTEMPTS )); do
    echo "[port-guard] stack0 attempt ${attempt}/${MAX_ATTEMPTS}: recreate active_line=${line}" >&2
    if ! prod_core_deploy_recreate_stack0_for_active_line "${REPO_ROOT}"; then
      echo "WARN: stack0 recreate failed on attempt ${attempt}" >&2
    fi

    _wait_api_ready || true

    if _host_port_ok "${API_PORT}" && _host_port_ok "${FRONT_PORT}"; then
      echo "✅ stack0 host ports restored on attempt ${attempt}"
      return 0
    fi

    sleep 5
    attempt=$((attempt + 1))
  done

  echo "WARN: stack0 host ports still failing after ${MAX_ATTEMPTS} recreate attempts" >&2
  return 1
}

_recover_stack6() {
  if _keycloak_port_ok; then
    echo "✅ Keycloak host port ${KC_PORT} OK"
    return 0
  fi

  echo "WARN: Keycloak host port ${KC_PORT} not accepting connections; force-recreate stack6" >&2
  cd "${REPO_ROOT}"
  mkdir -p docker/logs/stack6/keycloak-postgres
  podman unshare chown -R 70:70 docker/data/stack6/keycloak-postgres docker/logs/stack6/keycloak-postgres 2>/dev/null || true
  _kc_env="docker/env_file/.env.stack6"
  if [[ -n "${ELITEEW_ENV_RUNTIME_DIR:-}" && -f "${ELITEEW_ENV_RUNTIME_DIR}/.env.stack6" ]]; then
    _kc_env="${ELITEEW_ENV_RUNTIME_DIR}/.env.stack6"
  elif [[ -n "${XDG_RUNTIME_DIR:-}" && -f "${XDG_RUNTIME_DIR}/eliteew/env-runtime/.env.stack6" ]]; then
    _kc_env="${XDG_RUNTIME_DIR}/eliteew/env-runtime/.env.stack6"
  fi
  if grep -Eq '^STACK6_KEYCLOAK_IMAGE=.+' "${_kc_env}" 2>/dev/null; then
    podman compose -f docker/stack/stack6.yml -f docker/stack/stack6.prod-baked.override.yml \
      --env-file "${_kc_env}" up -d --force-recreate --pull=never keycloak-postgres keycloak || true
  else
    echo "WARN: STACK6_KEYCLOAK_IMAGE unset during Keycloak recover — refusing vanilla recreate" >&2
    return 1
  fi
  sleep 30

  if _keycloak_port_ok; then
    echo "✅ Keycloak host port ${KC_PORT} restored"
    return 0
  fi

  echo "WARN: Keycloak host port ${KC_PORT} still failing" >&2
  return 1
}

_recover_stack0 || FAILURES=$((FAILURES + 1))
_recover_stack6 || FAILURES=$((FAILURES + 1))

if (( FAILURES > 0 )); then
  exit 1
fi
exit 0
