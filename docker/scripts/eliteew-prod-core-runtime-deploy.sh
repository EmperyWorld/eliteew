#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# command-center → prod-core: build/pull runtime images locally, export, recreate stack2/stack4.
# Invariants:
# - No podman build / pull / compose build on .111.
# - GGUF models remain on prod-core host (STACK2_LLAMA_MODELS_PATH).
# Related:
# - build-prod-core-runtime-images.sh, export-prod-core-runtime-images.sh
# - documentation/platform/docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md
# ---
set -euo pipefail

# shellcheck source=eliteew-ops-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/eliteew-ops-lib.sh"
# shellcheck source=prod-core-deploy-lib.sh
source "${DEWA_OPS_REPO_ROOT}/docker/scripts/prod-core-deploy-lib.sh"

MODE="all"
ASSUME_YES=0
SKIP_BUILD=0
SKIP_ENV_PUSH=0
RUNTIME_TAG=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Build runtime images on command-center, export to prod-core, recreate containers.

Modes:
  --all              stack2 llama-chat + stack4 (default)
  --stack2-only      llama-chat only
  --stack4-only      stack4 OCR/Tika/Paperless only

Options:
  --yes              skip confirmation
  --tag TAG          prod-runtime-YYYYMMDD-HHMM (default: auto)
  --skip-build       export+recreate only (images for tag must exist locally)
  --skip-env-push    do not push env bundle before recreate
  --dry-run
  -h, --help

Alias: eeprodruntime (after source eliteew-docker-aliases.sh)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)
      MODE="all"
      shift
      ;;
    --stack2-only)
      MODE="stack2"
      shift
      ;;
    --stack4-only)
      MODE="stack4"
      shift
      ;;
    --yes)
      ASSUME_YES=1
      shift
      ;;
    --tag)
      RUNTIME_TAG="${2:-}"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --skip-env-push)
      SKIP_ENV_PUSH=1
      shift
      ;;
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

if [[ -z "${RUNTIME_TAG}" ]]; then
  RUNTIME_TAG="$(prod_core_deploy_default_runtime_baked_tag)"
fi
prod_core_deploy_validate_runtime_baked_tag "${RUNTIME_TAG}" || exit 1

confirm() {
  local msg="$1"
  if [[ "${ASSUME_YES}" -eq 1 ]]; then
    echo "→ ${msg} (--yes)"
    return 0
  fi
  read -r -p "${msg} [y/N] " ans
  [[ "${ans}" =~ ^[Yy]$ ]]
}

run_cmd() {
  if dewa_ops_is_dry_run; then
    dewa_ops_log_dry_run "$*"
  else
    "$@"
  fi
}

echo "=== prod-core runtime deploy (local images → export → recreate) ==="
echo "host: ${DEWA_OPS_PROD_CORE_SSH}"
echo "mode: ${MODE} | tag: ${RUNTIME_TAG}"
confirm "Deploy runtime ${MODE} to ${DEWA_OPS_PROD_CORE_SSH}?" || exit 0

dewa_ops_require_podman

export PROD_CORE_RUNTIME_BAKED_TAG="${RUNTIME_TAG}"
export PROD_CORE_RUNTIME_BAKED_ONLY="${MODE}"
export PROD_CORE_RUNTIME_BAKED_EXPORT_ONLY="${MODE}"
export PROD_CORE_RUNTIME_BAKED_REMOTE_DIR="${DEWA_OPS_REMOTE_REPO}/docker/tmp/prod-runtime-images"

echo "=== Step 1/3: build runtime images (command-center) ==="
if [[ "${SKIP_BUILD}" -eq 1 ]]; then
  echo ">>> SKIP build"
else
  if [[ "${SKIP_DEPLOY_PROVENANCE_GATE:-0}" != "1" ]]; then
    bash "${DEWA_OPS_REPO_ROOT}/docker/scripts/deploy-provenance-gate.sh" --release
  fi
  run_cmd bash "${DEWA_OPS_REPO_ROOT}/docker/scripts/build-prod-core-runtime-images.sh"
fi

echo "=== Step 2/3: export → ${DEWA_OPS_PROD_CORE_SSH} ==="
run_cmd bash "${DEWA_OPS_REPO_ROOT}/docker/scripts/export-prod-core-runtime-images.sh" \
  "${DEWA_OPS_PROD_CORE_SSH}" "${RUNTIME_TAG}"

echo "=== Step 2b: sync deploy lib + compose overrides ==="
if ! dewa_ops_is_dry_run; then
  run_cmd rsync -av \
    "${DEWA_OPS_REPO_ROOT}/docker/scripts/prod-core-deploy-lib.sh" \
    "${DEWA_OPS_REPO_ROOT}/docker/scripts/prod-core-env-lib.sh" \
    "${DEWA_OPS_PROD_CORE_SSH}:${DEWA_OPS_REMOTE_REPO}/docker/scripts/"
  run_cmd rsync -av \
    "${DEWA_OPS_REPO_ROOT}/docker/stack/stack2.prod-core.baked.override.yml" \
    "${DEWA_OPS_REPO_ROOT}/docker/stack/stack4.prod-baked.override.yml" \
    "${DEWA_OPS_PROD_CORE_SSH}:${DEWA_OPS_REMOTE_REPO}/docker/stack/"
fi

if [[ "${SKIP_ENV_PUSH}" -eq 0 ]]; then
  echo "=== Step 2c: push env bundle → ${DEWA_OPS_PROD_CORE_SSH} ==="
  run_cmd bash "${DEWA_OPS_REPO_ROOT}/docker/scripts/eliteew-prod-core-env-push.sh" --yes
  # Belt-and-suspenders: restore/infer STACK0 bake tags if bundle omitted them.
  if ! dewa_ops_is_dry_run; then
    echo "=== Step 2d: ensure STACK0 baked image env on prod-core ==="
    ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s "${DEWA_OPS_REMOTE_REPO}" <<'REMOTE'
set -euo pipefail
REPO="$1"
cd "${REPO}"
source docker/scripts/prod-core-deploy-lib.sh
export PROD_CORE_DEPLOY_REPO_ROOT="${REPO}"
prod_core_deploy_ensure_stack0_baked_image_env "$(prod_core_deploy_env_file "${REPO}" .env.stack0.backend)" || true
REMOTE
  fi
else
  echo ">>> SKIP env push (--skip-env-push)"
fi

echo "=== Step 3/3: patch env + recreate on prod-core ==="
if dewa_ops_is_dry_run; then
  dewa_ops_log_dry_run "ssh recreate mode=${MODE}"
  exit 0
fi

ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s \
  "${DEWA_OPS_REMOTE_REPO}" "${RUNTIME_TAG}" "${MODE}" <<'REMOTE'
set -euo pipefail
REPO="$1"
TAG="$2"
MODE="$3"
cd "${REPO}"
source docker/scripts/prod-core-deploy-lib.sh
export PROD_CORE_DEPLOY_REPO_ROOT="${REPO}"

case "${MODE}" in
  all)
    prod_core_deploy_patch_runtime_baked_env "${TAG}"
    prod_core_deploy_recreate_stack2_chat_baked "${REPO}"
    prod_core_deploy_recreate_stack4_baked "${REPO}"
    ;;
  stack2)
    prod_core_deploy_patch_runtime_baked_env_stack2_only "$(prod_core_deploy_env_file "${REPO}" .env.stack2)" "${TAG}"
    prod_core_deploy_recreate_stack2_chat_baked "${REPO}"
    ;;
  stack4)
    prod_core_deploy_patch_runtime_baked_env_stack4_only "$(prod_core_deploy_env_file "${REPO}" .env.stack4)" "${TAG}"
    prod_core_deploy_recreate_stack4_baked "${REPO}"
    ;;
  *)
    echo "ERROR: unknown mode ${MODE}" >&2
    exit 1
    ;;
esac
REMOTE

echo "=== smoke ==="
ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s "${DEWA_OPS_REMOTE_REPO}" "${MODE}" <<'REMOTE'
set -euo pipefail
REPO="$1"
MODE="$2"
cd "${REPO}"
source docker/scripts/prod-core-deploy-lib.sh
export PROD_CORE_DEPLOY_REPO_ROOT="${REPO}"
failures=0
if [[ "${MODE}" == "all" || "${MODE}" == "stack2" ]]; then
  sleep 15
  prod_core_deploy_smoke_stack2_chat || failures=$((failures + 1))
fi
if [[ "${MODE}" == "all" || "${MODE}" == "stack4" ]]; then
  prod_core_deploy_smoke_stack4 || failures=$((failures + 1))
fi
exit "${failures}"
REMOTE

if ! dewa_ops_is_dry_run; then
  echo "=== Step 4/4: sync runtime bake keys → staging (Config Plane) ==="
  # shellcheck source=prod-core-env-lib.sh
  source "${DEWA_OPS_REPO_ROOT}/docker/scripts/prod-core-env-lib.sh"
  prod_core_env_sync_runtime_bake_keys_to_staging "${DEWA_OPS_REPO_ROOT}" "${RUNTIME_TAG}" "${MODE}" || true
fi

echo ""
echo "✅ prod-core runtime deploy complete tag=${RUNTIME_TAG} mode=${MODE}"
