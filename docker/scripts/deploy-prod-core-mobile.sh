#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Safe prod-core (.111) Mobile OTA deploy only. API/stack0 — eeprodbaked (local bake → export).
# Related:
# - prod-core-deploy-lib.sh, eliteew-stack0-baked-deploy.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck source=prod-core-deploy-lib.sh
source "${SCRIPT_DIR}/prod-core-deploy-lib.sh"

PROD_CORE_HOST="${PROD_CORE_HOST:-prod-core}"
PROD_CORE_REMOTE_ROOT="${PROD_CORE_REMOTE_ROOT:-/home/owned/powered_by_emperyworld}"
DO_OTA=0
DO_API=0
ASSUME_YES=0
DRY_RUN=0

usage() {
  cat <<'EOF'
deploy-prod-core-mobile.sh — OTA to prod-core (.111)

  --ota              rsync binaries + recreate stack-mobile-release
  --api              DEPRECATED → use: eeprodbaked --yes --all
  --full             DEPRECATED for API; use eeprodbaked + --ota separately

Examples:
  ./docker/scripts/deploy-prod-core-mobile.sh --yes --ota
  eeprodbaked --yes --all    # API + frontend baked deploy
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ota) DO_OTA=1; shift ;;
    --api | --full | --build-frontend | --build | --publish)
      DO_API=1
      shift
      ;;
    --tag)
      shift 2
      ;;
    --yes) ASSUME_YES=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "${DO_API}" -eq 1 ]]; then
  echo "ERROR: --api/--full rebake on prod-core removed." >&2
  echo "Use: eeprodbaked --yes --all   (from command-center)" >&2
  echo "Legacy script archived in trash/20260812-150051/trash_reload/docker/scripts/trash/" >&2
  exit 2
fi

if [[ "${DO_OTA}" -eq 0 ]]; then
  echo "ERROR: specify --ota" >&2
  usage >&2
  exit 2
fi

run_cmd() {
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    printf '[dry-run] '
    printf '%q ' "$@"
    printf '\n'
  else
    "$@"
  fi
}

run_ssh() {
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    printf '[dry-run] ssh %s %q\n' "${PROD_CORE_HOST}" "$*"
  else
    ssh "${PROD_CORE_HOST}" "$@"
  fi
}

confirm() {
  local msg="$1"
  if [[ "${ASSUME_YES}" -eq 1 ]]; then
    echo "→ ${msg} (--yes)"
    return 0
  fi
  read -r -p "${msg} [y/N] " ans
  [[ "${ans}" =~ ^[Yy]$ ]]
}

confirm "Deploy OTA to ${PROD_CORE_HOST}?" || exit 0

run_cmd rsync -av \
  "${SCRIPT_DIR}/prod-core-deploy-lib.sh" \
  "${PROD_CORE_HOST}:${PROD_CORE_REMOTE_ROOT}/docker/scripts/"
run_cmd rsync -av --delete \
  "${REPO_ROOT}/local/binaries/" \
  "${PROD_CORE_HOST}:${PROD_CORE_REMOTE_ROOT}/local/binaries/"
run_ssh bash -s "${PROD_CORE_REMOTE_ROOT}" <<'REMOTE'
set -euo pipefail
REPO="$1"
cd "${REPO}"
source docker/scripts/prod-core-deploy-lib.sh
export PROD_CORE_DEPLOY_REPO_ROOT="${REPO}"
prod_core_deploy_recreate_ota_stack "${REPO}"
REMOTE

echo "✅ OTA deploy finished on ${PROD_CORE_HOST}"
