#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression helper for prod_core_deploy_smoke_stack0_contract — live pass or negative DNS fail.
# Invariants:
# - Run on prod-core (.111) or any host with stack0-eliteew-api-prod-baked running.
# Related:
# - docker/scripts/prod-core-deploy-lib.sh, eliteew-stack0-baked-deploy.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=prod-core-deploy-lib.sh
source "${SCRIPT_DIR}/prod-core-deploy-lib.sh"
export PROD_CORE_DEPLOY_REPO_ROOT="${REPO_ROOT}"

usage() {
  cat <<EOF
Usage:
  bash docker/scripts/$(basename "$0") --live
  bash docker/scripts/$(basename "$0") --negative-dns

  --live          Run contract gate against current prod-baked runtime (must pass).
  --negative-dns  Prove gate rejects an unresolvable sidecar host (must fail checks).
EOF
}

run_live() {
  echo ">>> live contract gate"
  prod_core_deploy_smoke_stack0_contract
  echo "PASS: contract gate OK on live runtime"
}

run_negative_dns() {
  echo ">>> negative DNS contract gate (expect failure)"
  export STACK0_CONTRACT_SIDECAR_HOST="stack0-eliteew-api-worker-nonexistent.invalid"
  if prod_core_deploy_smoke_stack0_contract; then
    echo "FAIL: contract gate should reject host ${STACK0_CONTRACT_SIDECAR_HOST}" >&2
    exit 1
  fi
  echo "PASS: contract gate rejected bad DNS host"
}

case "${1:-}" in
  --live)
    run_live
    ;;
  --negative-dns)
    run_negative_dns
    ;;
  -h | --help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
