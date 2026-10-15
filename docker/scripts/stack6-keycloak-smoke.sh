#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Read-only smoke for stack6 Keycloak on prod-core (or local host with KEYCLOAK_HOST_PORT).
# Invariants:
# - No secrets; checks realm master + empery OIDC discovery + container health.
# - Default target: SSH prod-core; STACK6_SMOKE_LOCAL=1 for local curl only.
# - Living baked image must run `start --optimized`, be healthy, keep the SPI JAR,
#   and not log `kc.transaction-xa-enabled` (build-time mismatch). Persist proof
#   for a new tag is `kc.sh show-config` on the image before load, not this smoke.
# Related:
# - docker/stack/stack6.yml, eliteew-migration-command-center.sh
# - docker/scripts/eeprodstack6.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROD_CORE_SSH_HOST="${PROD_CORE_SSH_HOST:-prod-core}"
KEYCLOAK_HOST_PORT="${KEYCLOAK_HOST_PORT:-36000}"
REMOTE_REPO_ROOT="${REMOTE_REPO_ROOT:-/home/owned/powered_by_emperyworld}"
BASE_URL="http://127.0.0.1:${KEYCLOAK_HOST_PORT}"

failures=0

run_remote() {
  # shellcheck disable=SC2029
  ssh -o ConnectTimeout=8 -o BatchMode=yes "${PROD_CORE_SSH_HOST}" "$@"
}

check_local() {
  local label="$1"
  local url="$2"
  if curl -sf --connect-timeout 5 "${url}" >/dev/null; then
    echo "${label}_ok"
  else
    echo "${label}_FAIL"
    failures=$((failures + 1))
  fi
}

echo ">>> stack6 Keycloak smoke (port ${KEYCLOAK_HOST_PORT})"

if [[ "${STACK6_SMOKE_LOCAL:-0}" == "1" ]]; then
  check_local "keycloak_master" "${BASE_URL}/realms/master"
  check_local "keycloak_empery_oidc" "${BASE_URL}/realms/empery/.well-known/openid-configuration"
else
  if ! run_remote "curl -sf --connect-timeout 5 ${BASE_URL}/realms/master >/dev/null && echo keycloak_master_ok || echo keycloak_master_FAIL"; then
    echo "keycloak_ssh_FAIL"
    exit 1
  fi
  run_remote "curl -sf --connect-timeout 5 ${BASE_URL}/realms/empery/.well-known/openid-configuration >/dev/null && echo keycloak_empery_oidc_ok || echo keycloak_empery_oidc_FAIL" \
    || failures=$((failures + 1))
  inspect_out="$(
    run_remote 'set -euo pipefail
image=$(podman inspect stack6-keycloak --format "{{.ImageName}}")
health=$(podman inspect stack6-keycloak --format "{{.State.Health.Status}}")
status=$(podman inspect stack6-keycloak --format "{{.State.Status}}")
cmd=$(podman inspect stack6-keycloak --format "{{json .Config.Cmd}}")
echo "keycloak_image=${image}"
echo "keycloak_health=${health}"
echo "keycloak_status=${status}"
echo "keycloak_cmd=${cmd}"
if [[ "${health}" != "healthy" ]]; then
  echo keycloak_health_FAIL
  exit 1
fi
if [[ "${status}" != "running" ]]; then
  echo keycloak_status_FAIL
  exit 1
fi
if ! printf "%s" "${cmd}" | grep -q -- "--optimized"; then
  echo keycloak_optimized_FAIL
  exit 1
fi
if podman logs --tail 80 stack6-keycloak 2>&1 | grep -q "kc.transaction-xa-enabled"; then
  echo keycloak_xa_persist_FAIL
  exit 1
fi
echo keycloak_xa_persist_ok
if podman exec stack6-keycloak test -f /opt/keycloak/providers/eliteew-binding.jar; then
  echo keycloak_binding_provider_ok
else
  echo keycloak_binding_provider_FAIL
  exit 1
fi'
  )" || inspect_out="${inspect_out}"$'\n'"keycloak_inspect_FAIL"
  printf '%s\n' "${inspect_out}"
  if printf '%s' "${inspect_out}" | grep -Eq 'keycloak_(health|status|optimized|xa_persist|binding_provider|inspect)_FAIL'; then
    failures=$((failures + 1))
  fi
  # File log should be writable after stack6-prepare-host-dirs.sh
  run_remote "test -w ${REMOTE_REPO_ROOT}/docker/logs/stack6/keycloak 2>/dev/null && echo keycloak_logdir_writable_ok || echo keycloak_logdir_writable_WARN" || true
fi

if [[ "${STACK6_SMOKE_CHECK_PUBLIC:-1}" == "1" ]]; then
  if curl -sf --connect-timeout 8 https://auth.eliteew.ru/realms/empery/.well-known/openid-configuration >/dev/null; then
    echo "keycloak_public_oidc_ok"
  else
    echo "keycloak_public_oidc_FAIL"
    failures=$((failures + 1))
  fi
fi

if [[ "${failures}" -gt 0 ]]; then
  echo "stack6_keycloak_smoke_FAIL count=${failures}"
  exit 1
fi
echo "stack6_keycloak_smoke_ok"
