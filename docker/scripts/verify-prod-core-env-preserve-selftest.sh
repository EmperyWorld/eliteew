#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Selftest: runtime deploy bake keys survive simulated env-push overwrite.
# Related:
# - prod-core-env-lib.sh (snapshot/restore)
# - documentation/platform/PROD-CORE-CONFIG-PLANE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=prod-core-env-lib.sh
source "${SCRIPT_DIR}/prod-core-env-lib.sh"

RUNTIME="$(mktemp -d)"
SNAP="$(mktemp -d)"
STAGING=""
cleanup() {
  # shellcheck disable=SC2317
  rm -rf "${RUNTIME}" "${SNAP}" "${STAGING}"
}
trap cleanup EXIT

cat >"${RUNTIME}/.env.stack0.backend" <<'EOF'
API_HOST_PORT=29000
STACK0_PROD_BAKED_TAG=prod-baked-20260720-0439
STACK0_API_BAKED_IMAGE=localhost/eliteew-api:prod-baked-20260720-0439
STACK0_FRONTEND_BAKED_IMAGE=localhost/eliteew-frontend:prod-baked-20260720-0439
EOF

cat >"${RUNTIME}/.env.stack2" <<'EOF'
LLAMA_CHAT_HOST_PORT=8080
STACK2_LLAMA_CHAT_BAKED_IMAGE=eliteew-llama-chat:prod-runtime-20260720-0439
PROD_CORE_RUNTIME_BAKED_TAG=prod-runtime-20260720-0439
EOF

cat >"${RUNTIME}/.env.stack4" <<'EOF'
STACK4_TIKA_HOST_PORT=33004
STACK4_TIKA_BAKED_IMAGE=eliteew-stack4-tika:prod-runtime-20260720-0439
EOF

cat >"${RUNTIME}/.env.stack6" <<'EOF'
STACK6_KEYCLOAK_IMAGE=localhost/eliteew-keycloak:prod-stack6-20260908-0936
EOF

prod_core_env_snapshot_runtime_deploy_keys "${RUNTIME}" "${SNAP}"

# Simulate SOPS bundle overwrite without bake tags.
cat >"${RUNTIME}/.env.stack0.backend" <<'EOF'
API_HOST_PORT=29000
EOF
cat >"${RUNTIME}/.env.stack2" <<'EOF'
LLAMA_CHAT_HOST_PORT=8080
EOF
cat >"${RUNTIME}/.env.stack4" <<'EOF'
STACK4_TIKA_HOST_PORT=33004
EOF
cat >"${RUNTIME}/.env.stack6" <<'EOF'
KEYCLOAK_HOST_PORT=36000
EOF

prod_core_env_restore_runtime_deploy_keys "${RUNTIME}" "${SNAP}"

fail=0
assert_has() {
  local file="$1" key="$2" want="$3"
  local got
  got="$(grep -E "^${key}=" "${file}" | tail -n1 | cut -d= -f2- || true)"
  if [[ "${got}" != "${want}" ]]; then
    echo "FAIL: ${file} ${key}: got='${got}' want='${want}'" >&2
    fail=1
  else
    echo "OK: ${key}"
  fi
}

assert_has "${RUNTIME}/.env.stack0.backend" STACK0_PROD_BAKED_TAG "prod-baked-20260720-0439"
assert_has "${RUNTIME}/.env.stack0.backend" STACK0_API_BAKED_IMAGE "localhost/eliteew-api:prod-baked-20260720-0439"
assert_has "${RUNTIME}/.env.stack0.backend" STACK0_FRONTEND_BAKED_IMAGE "localhost/eliteew-frontend:prod-baked-20260720-0439"
assert_has "${RUNTIME}/.env.stack2" STACK2_LLAMA_CHAT_BAKED_IMAGE "eliteew-llama-chat:prod-runtime-20260720-0439"
assert_has "${RUNTIME}/.env.stack2" PROD_CORE_RUNTIME_BAKED_TAG "prod-runtime-20260720-0439"
assert_has "${RUNTIME}/.env.stack4" STACK4_TIKA_BAKED_IMAGE "eliteew-stack4-tika:prod-runtime-20260720-0439"
assert_has "${RUNTIME}/.env.stack6" STACK6_KEYCLOAK_IMAGE "localhost/eliteew-keycloak:prod-stack6-20260908-0936"

# --- staging sync (Wave B) ---
STAGING="$(mktemp -d)"
mkdir -p "${STAGING}/docker/env_file"
cat >"${STAGING}/docker/env_file/.env.stack0.backend" <<'EOF'
API_HOST_PORT=29000
EOF
cat >"${STAGING}/docker/env_file/.env.stack2" <<'EOF'
LLAMA_CHAT_HOST_PORT=8080
EOF
cat >"${STAGING}/docker/env_file/.env.stack4" <<'EOF'
STACK4_TIKA_HOST_PORT=33004
EOF

prod_core_env_sync_stack0_bake_keys_to_staging "${STAGING}" "prod-baked-20260720-0439"
prod_core_env_sync_runtime_bake_keys_to_staging "${STAGING}" "prod-runtime-20260720-0439" "all"

assert_has "${STAGING}/docker/env_file/.env.stack0.backend" STACK0_API_BAKED_IMAGE "eliteew-api:prod-baked-20260720-0439"
assert_has "${STAGING}/docker/env_file/.env.stack2" STACK2_LLAMA_CHAT_BAKED_IMAGE "eliteew-llama-chat:prod-runtime-20260720-0439"
assert_has "${STAGING}/docker/env_file/.env.stack4" STACK4_TIKA_BAKED_IMAGE "eliteew-stack4-tika:prod-runtime-20260720-0439"

# --- stack4 compose log fail-closed (Wave C) ---
# shellcheck source=prod-core-deploy-lib.sh
source "${SCRIPT_DIR}/prod-core-deploy-lib.sh"
LOG_OK="$(mktemp)"
LOG_BAD="$(mktemp)"
echo "stack4-tika" >"${LOG_OK}"
echo 'Error: creating container storage: the container name "stack4-tika" is already in use' >"${LOG_BAD}"
if ! prod_core_deploy_stack4_compose_log_fail_closed "${LOG_OK}"; then
  echo "FAIL: clean compose log should pass" >&2
  fail=1
else
  echo "OK: compose log fail-closed clean"
fi
if prod_core_deploy_stack4_compose_log_fail_closed "${LOG_BAD}"; then
  echo "FAIL: name-already-in-use log should fail closed" >&2
  fail=1
else
  echo "OK: compose log fail-closed collision"
fi
rm -f "${LOG_OK}" "${LOG_BAD}"

if [[ "${fail}" -ne 0 ]]; then
  echo "ERROR: verify-prod-core-env-preserve-selftest failed" >&2
  exit 1
fi
echo "✅ verify-prod-core-env-preserve-selftest OK"
