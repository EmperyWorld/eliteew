#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fail-closed KBSEW liveness from command-center (SSH to prod-core).
# Primary ops signal until Prometheus scrape job `kbsew` exists.
# Invariants:
# - Checks container running + /health + /ready (not health alone).
# - Exit 0 only when all three pass.
# Related:
# - documentation/product/KBSEW.md §Metrics
# - docker/scripts/kbsew-ensure-running.sh
# ---
set -euo pipefail

PROD_CORE="${DEWA_OPS_PROD_CORE_SSH:-192.168.1.111}"
HOST_PORT="${KBSEW_HOST_PORT:-28030}"
NAME="${KBSEW_CONTAINER_NAME:-stack-kbsew}"

ssh -o ConnectTimeout=10 -o BatchMode=yes "${PROD_CORE}" bash -s "${NAME}" "${HOST_PORT}" <<'REMOTE'
set -euo pipefail
name="$1"
port="$2"
status="$(podman inspect "${name}" --format '{{.State.Status}}' 2>/dev/null || echo missing)"
echo "container=${name} status=${status}"
[[ "${status}" == "running" ]] || {
  echo "ERROR: ${name} not running" >&2
  exit 1
}
curl -sf --max-time 5 "http://127.0.0.1:${port}/health" >/dev/null
curl -sf --max-time 5 "http://127.0.0.1:${port}/ready" >/dev/null
echo "OK: health+ready on :${port}"
REMOTE
