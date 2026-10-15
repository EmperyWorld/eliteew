#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression helper for prod_core_deploy_verify_external_user_path — public edge + single upstream.
# Invariants:
# - --public runs from command-center; --upstream requires prod-core podman context.
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
  bash docker/scripts/$(basename "$0") --all
  bash docker/scripts/$(basename "$0") --public
  bash docker/scripts/$(basename "$0") --upstream

  --all       Public edge checks + single upstream (prod-core podman required).
  --public    curl https://app.eliteew.ru/api/health + Socket.IO handshake sid.
  --upstream  frontend getent eliteew-api-prod must resolve one live API IP.

Env:
  STACK0_USER_PATH_PUBLIC_ORIGIN   default https://app.eliteew.ru
  STACK0_USER_PATH_CURL_INSECURE   default 1 (-k for edge TLS)
EOF
}

case "${1:-}" in
  --all)
    prod_core_deploy_verify_external_user_path
    ;;
  --public)
    prod_core_deploy_verify_public_user_path
    ;;
  --upstream)
    prod_core_deploy_verify_single_upstream
    ;;
  -h | --help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
