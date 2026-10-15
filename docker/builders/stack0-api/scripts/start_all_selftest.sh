#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lightweight contract selftest for start_all.sh and scripts/lib helpers.
# Invariants:
# - No network or container required; safe on command-center host with repo checkout.
# Related:
# - docker/builders/stack0-api/scripts/start_all.sh
# - shared/api/tests/test_stack0_start_all_contract.py
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_ALL="${SCRIPT_DIR}/start_all.sh"
LIB_DIR="${SCRIPT_DIR}/lib"

fail() {
    echo "start_all_selftest: $*" >&2
    exit 1
}

[ -f "${START_ALL}" ] || fail "missing ${START_ALL}"
[ -f "${LIB_DIR}/stack0_preflight.py" ] || fail "missing stack0_preflight.py"
[ -f "${LIB_DIR}/stack0_preflight_lib.py" ] || fail "missing stack0_preflight_lib.py"
[ -f "${LIB_DIR}/parse_ewa_database_url.py" ] || fail "missing parse_ewa_database_url.py"
[ -f "${LIB_DIR}/redis_flushall_on_start.py" ] || fail "missing redis_flushall_on_start.py"

if command -v shellcheck >/dev/null 2>&1; then
    shellcheck -S warning "${START_ALL}" "${SCRIPT_DIR}/start_all_selftest.sh"
else
    echo "start_all_selftest: shellcheck not installed — skipping"
fi

grep -q 'STACK0_ENABLE_LEGACY_ML_CACHE_DIRS' "${START_ALL}" || fail 'legacy ML cache gate missing'
grep -q 'stack0_site_studio_startup_preflight' "${START_ALL}" && fail 'shell Site Studio preflight must stay removed (Wave 1)'
grep -q 'Финальная проверка зависимостей' "${START_ALL}" && fail 'duplicate final TCP peek block must stay removed (Wave 2)'
grep -q 'STACK0_PREFLIGHT_PY' "${START_ALL}" || fail 'stack0_preflight.py wiring missing'
grep -q 'stack0_preflight.py' "${START_ALL}" || fail 'preflight invocation missing'
grep -q '/dev/tcp' "${START_ALL}" && fail 'shell /dev/tcp probes must stay removed (Python preflight)'
grep -qE '\bcurl[\s-]' "${START_ALL}" && fail 'shell curl HTTP probes must stay removed (Python preflight)'
grep -q 'Import checklist fail-closed' "${START_ALL}" && fail 'import checklist must live in Python preflight only'
grep -q 'workers=1' "${START_ALL}" || fail 'Socket.IO workers=1 invariant missing'
grep -q 'deps-celery-beat' "${SCRIPT_DIR}/../Dockerfile" && fail 'deps-celery-beat must stay removed from Dockerfile'

# SCRIPT_DIR = docker/builders/stack0-api/scripts → ../../.. = docker/
COMPOSE="$(cd "${SCRIPT_DIR}/../../.." && pwd)/stack/stack0_b.yml"
[ -f "${COMPOSE}" ] || fail "missing ${COMPOSE}"
grep -q 'eliteew-api-preflight:' "${COMPOSE}" || fail 'compose eliteew-api-preflight service missing'
grep -q 'stack0-api-preflight' "${COMPOSE}" || fail 'compose profile stack0-api-preflight missing'
grep -qE 'condition:[[:space:]]*service_completed_successfully' "${COMPOSE}" && fail 'do not wire completed-successfully depends_on (podman-compose hang)'
HELPER="$(cd "${SCRIPT_DIR}/../../../.." && pwd)/docker/scripts/stack0-api-preflight-run.sh"
[ -f "${HELPER}" ] || fail "missing ${HELPER}"
bash -n "${HELPER}" || fail "bash -n failed for stack0-api-preflight-run.sh"

MAT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)/docker/scripts/stack0-env-materialize-roles.sh"
[ -f "${MAT}" ] || fail "missing ${MAT}"
bash -n "${MAT}" || fail "bash -n failed for stack0-env-materialize-roles.sh"
grep -q '\.env\.stack0\.shared' "${COMPOSE}" || fail 'compose role env .env.stack0.shared missing'
grep -q '\.env\.stack0\.api' "${COMPOSE}" || fail 'compose role env .env.stack0.api missing'
grep -q '\.env\.stack0\.jobs' "${COMPOSE}" || fail 'compose role env .env.stack0.jobs missing'
# API service must not mount jobs-only file as sole role (shared+api pair)
api_env="$(awk '/^  eliteew-api-prod:/{p=1} p&&/^  [a-z]/{if($0 !~ /^  eliteew-api-prod:/) exit} p' "${COMPOSE}")"
echo "${api_env}" | grep -q '\.env\.stack0\.api' || fail 'eliteew-api-prod must mount .env.stack0.api'
echo "${api_env}" | grep -q '\.env\.stack0\.jobs' && fail 'eliteew-api-prod must not mount .env.stack0.jobs'
worker_env="$(awk '/^  eliteew-celery-worker-prod:/{p=1} p&&/^  [a-z]/{if($0 !~ /^  eliteew-celery-worker-prod:/) exit} p' "${COMPOSE}")"
echo "${worker_env}" | grep -q '\.env\.stack0\.jobs' || fail 'celery-worker must mount .env.stack0.jobs'
echo "${worker_env}" | grep -q '\.env\.stack0\.api' && fail 'celery-worker must not mount .env.stack0.api'

PYTHON_BIN="${PYTHON_BIN:-python3}"
if env -u EWA_DATABASE_URL "${PYTHON_BIN}" "${LIB_DIR}/parse_ewa_database_url.py" >/dev/null 2>&1; then
    fail 'parse_ewa_database_url unset env must exit non-zero'
else
    ec=$?
    [ "${ec}" -eq 2 ] || fail "parse_ewa_database_url unset env expected exit 2, got ${ec}"
fi

echo "start_all_selftest: OK"
