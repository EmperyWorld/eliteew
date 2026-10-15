#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Сборка/retag runtime-образов stack2 (llama-chat) и stack4 для prod-core (.111) на command-center.
# Invariants:
# - На .111 нет podman build / compose build / pull в deploy path.
# - GGUF-модели остаются bind-mount на .111 (STACK2_LLAMA_MODELS_PATH), не в образе.
# Related:
# - export-prod-core-runtime-images.sh, eliteew-prod-core-runtime-deploy.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"

RUNTIME_TAG="${PROD_CORE_RUNTIME_BAKED_TAG:-prod-runtime-$(date +%Y%m%d-%H%M)}"
RUNTIME_ONLY="${PROD_CORE_RUNTIME_BAKED_ONLY:-all}"
SKIP_PULL="${PROD_CORE_RUNTIME_SKIP_PULL:-0}"

LLAMA_CHAT_UPSTREAM="${STACK2_LLAMA_CHAT_UPSTREAM:-ghcr.io/ggml-org/llama.cpp:server-cuda}"
STACK4_TIKA_UPSTREAM="${STACK4_TIKA_UPSTREAM:-docker.io/apache/tika:3.3.1.0}"
STACK4_GOTENBERG_UPSTREAM="${STACK4_GOTENBERG_UPSTREAM:-docker.io/gotenberg/gotenberg:8.33.0}"
STACK4_PAPERLESS_UPSTREAM="${STACK4_PAPERLESS_UPSTREAM:-ghcr.io/paperless-ngx/paperless-ngx:2.20.15}"

export STACK2_LLAMA_CHAT_BAKED_IMAGE="${STACK2_LLAMA_CHAT_BAKED_IMAGE:-eliteew-llama-chat:${RUNTIME_TAG}}"
export STACK4_TIKA_BAKED_IMAGE="${STACK4_TIKA_BAKED_IMAGE:-eliteew-stack4-tika:${RUNTIME_TAG}}"
export STACK4_OCRMYPDF_BAKED_IMAGE="${STACK4_OCRMYPDF_BAKED_IMAGE:-eliteew-stack4-ocrmypdf:${RUNTIME_TAG}}"
export STACK4_GOTENBERG_BAKED_IMAGE="${STACK4_GOTENBERG_BAKED_IMAGE:-eliteew-stack4-gotenberg:${RUNTIME_TAG}}"
export STACK4_TESSERACT_BAKED_IMAGE="${STACK4_TESSERACT_BAKED_IMAGE:-eliteew-stack4-tesseract:${RUNTIME_TAG}}"
export STACK4_PAPERLESS_BAKED_IMAGE="${STACK4_PAPERLESS_BAKED_IMAGE:-eliteew-stack4-paperless:${RUNTIME_TAG}}"

_pull_tag() {
  local upstream="$1"
  local tag="$2"
  if [[ "${SKIP_PULL}" == "1" ]]; then
    if "${CONTAINER_RUNTIME}" image exists "${tag}" 2>/dev/null; then
      echo ">>> skip pull (exists): ${tag}"
      return 0
    fi
    echo "ERROR: ${tag} missing and PROD_CORE_RUNTIME_SKIP_PULL=1" >&2
    return 1
  fi
  echo ">>> pull ${upstream} -> ${tag}"
  "${CONTAINER_RUNTIME}" pull "${upstream}"
  "${CONTAINER_RUNTIME}" tag "${upstream}" "${tag}"
}

_build_stack4_local() {
  local dockerfile_dir="$1"
  local tag="$2"
  echo ">>> build ${tag}"
  local -a cmd=("${CONTAINER_RUNTIME}" build)
  if [[ "${SKIP_PULL}" == "1" ]]; then
    cmd+=(--pull=never)
  fi
  cmd+=(
    -f "${dockerfile_dir}/Dockerfile"
    -t "${tag}"
    "${dockerfile_dir}"
  )
  "${cmd[@]}"
}

case "${RUNTIME_ONLY}" in
  all | stack2 | stack4) ;;
  *)
    echo "ERROR: PROD_CORE_RUNTIME_BAKED_ONLY must be all|stack2|stack4 (got '${RUNTIME_ONLY}')" >&2
    exit 1
    ;;
esac

echo "=== prod-core runtime images (command-center) ==="
echo "tag: ${RUNTIME_TAG} | only: ${RUNTIME_ONLY}"

if [[ "${RUNTIME_ONLY}" == "all" || "${RUNTIME_ONLY}" == "stack2" ]]; then
  _pull_tag "${LLAMA_CHAT_UPSTREAM}" "${STACK2_LLAMA_CHAT_BAKED_IMAGE}"
fi

if [[ "${RUNTIME_ONLY}" == "all" || "${RUNTIME_ONLY}" == "stack4" ]]; then
  _pull_tag "${STACK4_TIKA_UPSTREAM}" "${STACK4_TIKA_BAKED_IMAGE}"
  _pull_tag "${STACK4_GOTENBERG_UPSTREAM}" "${STACK4_GOTENBERG_BAKED_IMAGE}"
  _pull_tag "${STACK4_PAPERLESS_UPSTREAM}" "${STACK4_PAPERLESS_BAKED_IMAGE}"
  _build_stack4_local "${REPO_ROOT}/docker/builders/stack4-ocrmypdf" "${STACK4_OCRMYPDF_BAKED_IMAGE}"
  _build_stack4_local "${REPO_ROOT}/docker/builders/stack4-tesseract" "${STACK4_TESSERACT_BAKED_IMAGE}"
fi

cat <<EOF

✅ Runtime images (${RUNTIME_ONLY}):
EOF
if [[ "${RUNTIME_ONLY}" == "all" || "${RUNTIME_ONLY}" == "stack2" ]]; then
  echo "  ${STACK2_LLAMA_CHAT_BAKED_IMAGE}"
fi
if [[ "${RUNTIME_ONLY}" == "all" || "${RUNTIME_ONLY}" == "stack4" ]]; then
  echo "  ${STACK4_TIKA_BAKED_IMAGE}"
  echo "  ${STACK4_OCRMYPDF_BAKED_IMAGE}"
  echo "  ${STACK4_GOTENBERG_BAKED_IMAGE}"
  echo "  ${STACK4_TESSERACT_BAKED_IMAGE}"
  echo "  ${STACK4_PAPERLESS_BAKED_IMAGE}"
fi
echo ""
echo "Export: PROD_CORE_RUNTIME_BAKED_ONLY=${RUNTIME_ONLY} bash docker/scripts/export-prod-core-runtime-images.sh prod-core ${RUNTIME_TAG}"
