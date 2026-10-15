#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Selftest: stack0/stack4 compose name-collision fail-closed helper.
# Invariants:
# - Exit 0 only when collision logs are rejected and clean logs pass.
# Related:
# - docker/scripts/prod-core-deploy-lib.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=prod-core-deploy-lib.sh
source "${SCRIPT_DIR}/prod-core-deploy-lib.sh"

tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT

printf '%s\n' 'Error: creating container storage: the container name "stack0-eliteew-celery-worker-prod-baked" is already in use' >"${tmp}"
if prod_core_deploy_compose_log_fail_closed "${tmp}" "selftest" 2>/dev/null; then
  echo "FAIL: expected fail-closed on name already in use" >&2
  exit 1
fi

printf '%s\n' 'name already in use by container xyz' >"${tmp}"
if prod_core_deploy_compose_log_fail_closed "${tmp}" "selftest" 2>/dev/null; then
  echo "FAIL: expected fail-closed on short name-already-in-use form" >&2
  exit 1
fi

printf '%s\n' 'stack0-eliteew-api-prod-baked' 'compose up ok' >"${tmp}"
if ! prod_core_deploy_compose_log_fail_closed "${tmp}" "selftest"; then
  echo "FAIL: clean log should pass" >&2
  exit 1
fi

echo "PASS: stack0 recreate fail-closed selftest"
