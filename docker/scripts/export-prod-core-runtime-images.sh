#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Экспорт runtime-образов stack2/stack4 (save → scp → load) на prod-core.
# Related:
# - build-prod-core-runtime-images.sh, eliteew-prod-core-runtime-deploy.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"

RUNTIME_TAG="${2:-${PROD_CORE_RUNTIME_BAKED_TAG:-prod-runtime-$(date +%Y%m%d)}}"
EXPORT_ONLY="${PROD_CORE_RUNTIME_BAKED_EXPORT_ONLY:-all}"
REMOTE="${1:-}"
REMOTE_ARCHIVE_ROOT="${PROD_CORE_RUNTIME_BAKED_REMOTE_DIR:-}"

usage() {
  cat <<EOF
Usage: bash docker/scripts/$(basename "$0") user@prod-core [prod-runtime-tag]

  PROD_CORE_RUNTIME_BAKED_EXPORT_ONLY=all|stack2|stack4
  PROD_CORE_RUNTIME_BAKED_REMOTE_DIR — disk path on prod-core (default /tmp)
EOF
}

if [[ "${1-}" == "-h" || "${1-}" == "--help" || -z "${REMOTE}" ]]; then
  usage
  exit 0
fi

STACK2_LLAMA_CHAT_BAKED_IMAGE="${STACK2_LLAMA_CHAT_BAKED_IMAGE:-eliteew-llama-chat:${RUNTIME_TAG}}"
STACK4_TIKA_BAKED_IMAGE="${STACK4_TIKA_BAKED_IMAGE:-eliteew-stack4-tika:${RUNTIME_TAG}}"
STACK4_OCRMYPDF_BAKED_IMAGE="${STACK4_OCRMYPDF_BAKED_IMAGE:-eliteew-stack4-ocrmypdf:${RUNTIME_TAG}}"
STACK4_GOTENBERG_BAKED_IMAGE="${STACK4_GOTENBERG_BAKED_IMAGE:-eliteew-stack4-gotenberg:${RUNTIME_TAG}}"
STACK4_TESSERACT_BAKED_IMAGE="${STACK4_TESSERACT_BAKED_IMAGE:-eliteew-stack4-tesseract:${RUNTIME_TAG}}"
STACK4_PAPERLESS_BAKED_IMAGE="${STACK4_PAPERLESS_BAKED_IMAGE:-eliteew-stack4-paperless:${RUNTIME_TAG}}"

case "${EXPORT_ONLY}" in
  all | stack2 | stack4) ;;
  *)
    echo "ERROR: PROD_CORE_RUNTIME_BAKED_EXPORT_ONLY must be all|stack2|stack4" >&2
    exit 1
    ;;
esac

IMAGES=()
if [[ "${EXPORT_ONLY}" == "all" || "${EXPORT_ONLY}" == "stack2" ]]; then
  IMAGES+=("${STACK2_LLAMA_CHAT_BAKED_IMAGE}")
fi
if [[ "${EXPORT_ONLY}" == "all" || "${EXPORT_ONLY}" == "stack4" ]]; then
  IMAGES+=(
    "${STACK4_TIKA_BAKED_IMAGE}"
    "${STACK4_OCRMYPDF_BAKED_IMAGE}"
    "${STACK4_GOTENBERG_BAKED_IMAGE}"
    "${STACK4_TESSERACT_BAKED_IMAGE}"
    "${STACK4_PAPERLESS_BAKED_IMAGE}"
  )
fi

for img in "${IMAGES[@]}"; do
  if ! "${CONTAINER_RUNTIME}" image exists "${img}" 2>/dev/null; then
    echo "ERROR: локально нет образа ${img} — сначала build-prod-core-runtime-images.sh" >&2
    exit 1
  fi
done

REMOTE_DIR="/tmp/eliteew-prod-runtime-${RUNTIME_TAG}"
if [[ -n "${REMOTE_ARCHIVE_ROOT}" ]]; then
  REMOTE_DIR="${REMOTE_ARCHIVE_ROOT%/}/${RUNTIME_TAG}"
  echo ">>> remote archive dir (disk): ${REMOTE}:${REMOTE_DIR}"
  ssh "${REMOTE}" "mkdir -p '${REMOTE_DIR}'"
else
  echo ">>> remote archive dir (tmpfs): ${REMOTE}:${REMOTE_DIR}"
  ssh "${REMOTE}" "mkdir -p '${REMOTE_DIR}'"
fi

for img in "${IMAGES[@]}"; do
  safe_name="${img//[:\/]/_}"
  ARCHIVE="/tmp/eliteew-prod-runtime-${RUNTIME_TAG}-${safe_name}.tar"
  rm -f "${ARCHIVE}"
  echo ">>> save ${img}"
  "${CONTAINER_RUNTIME}" save -o "${ARCHIVE}" "${img}"
  scp "${ARCHIVE}" "${REMOTE}:${REMOTE_DIR}/${safe_name}.tar"
  ssh "${REMOTE}" bash -s <<EOF
set -euo pipefail
RT="\${ELITEEW_CONTAINER_RUNTIME:-podman}"
command -v "\${RT}" >/dev/null 2>&1 || RT=docker
"\${RT}" load -i "${REMOTE_DIR}/${safe_name}.tar"
rm -f "${REMOTE_DIR}/${safe_name}.tar"
EOF
  rm -f "${ARCHIVE}"
done

echo "✅ Runtime images loaded on ${REMOTE} (${EXPORT_ONLY})"
