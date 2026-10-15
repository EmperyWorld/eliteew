#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Operator/CI one-shot for stack0 API preflight (same logic as start_all.sh).
# Invariants:
# - Does not replace the fail-closed gate inside start_all.sh.
# - Does not wire compose depends_on (podman-compose 1.5 hang on non-zero wait).
# Related:
# - docker/stack/stack0_b.yml (eliteew-api-preflight, profile stack0-api-preflight)
# - documentation/platform/docker-re_doc/STACK0-API-STARTUP.md
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT}/docker/stack/stack0_b.yml"
ENV_FILE="${STACK0_BACKEND_ENV_FILE:-${ROOT}/docker/env_file/.env.stack0.backend}"
BAKED=0
JSON=0
EXTRA_ARGS=()

usage() {
    cat <<EOF
Usage: $(basename "$0") [--baked] [--json] [--] [extra compose run args…]

Runs eliteew-api-preflight once (profile stack0-api-preflight) and exits with
the preflight exit code. Authoritative API startup gate remains in start_all.sh.

Options:
  --baked   Also use stack0_b.prod-baked.override.yml (needs STACK0_API_BAKED_IMAGE)
  --json    Pass --json to stack0_preflight.py (STACK0_PREFLIGHT_CLI_ARGS=--json)
  -h, --help

Environment:
  STACK0_BACKEND_ENV_FILE   compose --env-file (default: docker/env_file/.env.stack0.backend)
  PODMAN_COMPOSE_PROVIDER   optional; script uses \`podman compose\` when available
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --baked) BAKED=1; shift ;;
        --json) JSON=1; shift ;;
        -h | --help) usage; exit 0 ;;
        --) shift; EXTRA_ARGS+=("$@"); break ;;
        *) EXTRA_ARGS+=("$1"); shift ;;
    esac
done

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "stack0-api-preflight-run: missing env file: ${ENV_FILE}" >&2
    exit 2
fi

if [[ "${JSON}" -eq 1 ]]; then
    export STACK0_PREFLIGHT_CLI_ARGS="--json"
fi

COMPOSE_ARGS=(-f "${COMPOSE_FILE}")
if [[ "${BAKED}" -eq 1 ]]; then
    COMPOSE_ARGS+=(-f "${ROOT}/docker/stack/stack0_b.prod-baked.override.yml")
fi
COMPOSE_ARGS+=(--env-file "${ENV_FILE}" --profile stack0-api-preflight)

if podman compose version >/dev/null 2>&1; then
    COMPOSE=(podman compose)
else
    COMPOSE=(podman-compose)
fi

cd "${ROOT}"
exec "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" run --rm "${EXTRA_ARGS[@]}" eliteew-api-preflight
