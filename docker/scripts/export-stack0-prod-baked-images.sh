#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Экспорт prod-baked образов stack0 (save | ssh load) на целевой prod-core без rsync всего репо.
# Invariants:
# - Образы должны быть собраны build-stack0-prod-baked-images.sh на исходном хосте.
# - На удалённом хосте нужен podman или docker (ELITEEW_CONTAINER_RUNTIME).
# Related:
# - docker/scripts/build-stack0-prod-baked-images.sh
# - docker/scripts/sync-prod-core-deploy-tree.sh
# - documentation/platform/docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${REPO_ROOT}/docker/env_file/.env.stack0.backend"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
_load_env_var() {
  local key="$1"
  local default="${2:-}"
  local val=""
  if [[ -f "${ENV_FILE}" ]]; then
    val="$(
      grep -E "^${key}=" "${ENV_FILE}" 2>/dev/null \
        | tail -n 1 \
        | cut -d= -f2- \
        | sed 's/^"\(.*\)"$/\1/' \
        | sed "s/^'\(.*\)'$/\1/"
    )"
  fi
  if [[ -n "${val}" ]]; then
    printf '%s' "${val}"
  else
    printf '%s' "${default}"
  fi
}

BAKED_TAG="${2:-${STACK0_PROD_BAKED_TAG:-prod-baked-$(date +%Y%m%d)}}"
EXPORT_ONLY="${STACK0_PROD_BAKED_EXPORT_ONLY:-all}"
REMOTE="${1:-}"
REMOTE_ARCHIVE_ROOT="${STACK0_PROD_BAKED_REMOTE_DIR:-}"

usage() {
  cat <<EOF
Usage:
  bash docker/scripts/$(basename "$0") user@prod-core-host [prod-baked-tag]

Пример:
  bash docker/scripts/build-stack0-prod-baked-images.sh
  bash docker/scripts/$(basename "$0") owned@192.168.1.137 prod-baked-20260610

  STACK0_PROD_BAKED_EXPORT_ONLY=all|backend|frontend — какие образы экспортировать (default all)
  STACK0_PROD_BAKED_REMOTE_DIR          — каталог на prod-core для tar (default: /tmp; deploy script sets disk path)
EOF
}

if [[ "${1-}" == "-h" || "${1-}" == "--help" || -z "${REMOTE}" ]]; then
  usage
  exit 0
fi

if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
  echo "ERROR: runtime '${CONTAINER_RUNTIME}' не найден." >&2
  exit 1
fi
if ! command -v sha256sum >/dev/null 2>&1; then
  echo "ERROR: sha256sum не найден локально; checksum verify обязателен." >&2
  exit 1
fi

if [[ "${HOME}" == "/tmp" && -n "${USER:-}" && -d "/home/${USER}" ]]; then
  export HOME="/home/${USER}"
fi

if [[ -f "${ENV_FILE}" ]]; then
  : # intentionally do not `source` env file (HOME=/tmp breaks podman local image store)
fi

# Prefer CLI/env BAKED_TAG for image names. Do NOT reuse stale STACK0_*_BAKED_IMAGE
# from .env.stack0.backend (that caused exporting old 0439 images into a 0759 deploy dir).
# Optional STACK0_*_BAKED_IMAGE override still wins when explicitly exported in the shell.
_resolve_baked_image() {
  local key="$1"
  local short="$2"
  local override="${!key:-}"
  if [[ -n "${override}" ]]; then
    printf '%s' "${override}"
    return 0
  fi
  if "${CONTAINER_RUNTIME}" image exists "localhost/${short}" 2>/dev/null; then
    printf 'localhost/%s' "${short}"
    return 0
  fi
  printf '%s' "${short}"
}

STACK0_API_BAKED_IMAGE="$(_resolve_baked_image STACK0_API_BAKED_IMAGE "eliteew-api:${BAKED_TAG}")"
STACK0_QUEUE_WORKER_BAKED_IMAGE="$(_resolve_baked_image STACK0_QUEUE_WORKER_BAKED_IMAGE "eliteew-queue-worker:${BAKED_TAG}")"
STACK0_CELERY_WORKER_BAKED_IMAGE="$(_resolve_baked_image STACK0_CELERY_WORKER_BAKED_IMAGE "eliteew-celery-worker:${BAKED_TAG}")"
STACK0_CELERY_BEAT_BAKED_IMAGE="$(_resolve_baked_image STACK0_CELERY_BEAT_BAKED_IMAGE "eliteew-celery-beat:${BAKED_TAG}")"
STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE="$(_resolve_baked_image STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE "eliteew-site-studio-worker:${BAKED_TAG}")"
STACK0_FRONTEND_BAKED_IMAGE="$(_resolve_baked_image STACK0_FRONTEND_BAKED_IMAGE "eliteew-frontend:${BAKED_TAG}")"

case "${EXPORT_ONLY}" in
  all | backend | frontend) ;;
  *)
    echo "ERROR: STACK0_PROD_BAKED_EXPORT_ONLY must be all|backend|frontend (got '${EXPORT_ONLY}')" >&2
    exit 1
    ;;
esac

IMAGES=()
if [[ "${EXPORT_ONLY}" == "all" || "${EXPORT_ONLY}" == "backend" ]]; then
  IMAGES+=(
    "${STACK0_API_BAKED_IMAGE}"
    "${STACK0_QUEUE_WORKER_BAKED_IMAGE}"
    "${STACK0_CELERY_WORKER_BAKED_IMAGE}"
    "${STACK0_CELERY_BEAT_BAKED_IMAGE}"
    "${STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE}"
  )
fi
if [[ "${EXPORT_ONLY}" == "all" || "${EXPORT_ONLY}" == "frontend" ]]; then
  IMAGES+=("${STACK0_FRONTEND_BAKED_IMAGE}")
fi

for img in "${IMAGES[@]}"; do
  if ! "${CONTAINER_RUNTIME}" image exists "${img}" 2>/dev/null; then
    echo "ERROR: локально нет образа ${img} — сначала build-stack0-prod-baked-images.sh" >&2
    exit 1
  fi
done

REMOTE_DIR="/tmp/eliteew-prod-baked-${BAKED_TAG}"
if [[ -n "${REMOTE_ARCHIVE_ROOT}" ]]; then
  REMOTE_DIR="${REMOTE_ARCHIVE_ROOT%/}/${BAKED_TAG}"
  echo ">>> remote archive dir (disk): ${REMOTE}:${REMOTE_DIR}"
  ssh "${REMOTE}" "mkdir -p '${REMOTE_DIR}' && rm -f /tmp/eliteew-prod-baked-*.tar 2>/dev/null || true"
else
  echo ">>> remote archive dir (tmpfs): ${REMOTE}:${REMOTE_DIR}"
  ssh "${REMOTE}" "mkdir -p '${REMOTE_DIR}'"
fi
echo ">>> export scope: ${EXPORT_ONLY} (${#IMAGES[@]} image(s))"
echo ">>> save/load per image (avoids podman multi-tag load aliasing backend → frontend)"
for img in "${IMAGES[@]}"; do
  safe_name="${img//[:\/]/_}"
  ARCHIVE="/tmp/eliteew-prod-baked-${BAKED_TAG}-${safe_name}.tar"
  REMOTE_ARCHIVE="${REMOTE_DIR}/${safe_name}.tar"
  local_sha=""
  remote_sha=""
  rm -f "${ARCHIVE}"
  echo ">>> ${CONTAINER_RUNTIME} save ${img} → ${ARCHIVE}"
  "${CONTAINER_RUNTIME}" save -o "${ARCHIVE}" "${img}"
  local_sha="$(sha256sum "${ARCHIVE}" | awk '{print $1}')"
  echo ">>> sha256 local ${safe_name}.tar = ${local_sha}"
  echo ">>> scp → ${REMOTE}:${REMOTE_ARCHIVE}"
  scp "${ARCHIVE}" "${REMOTE}:${REMOTE_ARCHIVE}"
  remote_sha="$(
    ssh "${REMOTE}" bash -s "${REMOTE_ARCHIVE}" <<'EOF'
set -euo pipefail
archive="$1"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${archive}" | awk '{print $1}'
else
  python3 - "${archive}" <<'PY'
import hashlib
import sys
from pathlib import Path

path = Path(sys.argv[1])
print(hashlib.sha256(path.read_bytes()).hexdigest())
PY
fi
EOF
  )"
  if [[ -z "${remote_sha}" || "${remote_sha}" != "${local_sha}" ]]; then
    echo "ERROR: checksum mismatch for ${safe_name}.tar local=${local_sha} remote=${remote_sha}" >&2
    ssh "${REMOTE}" "rm -f '${REMOTE_ARCHIVE}'" || true
    rm -f "${ARCHIVE}"
    exit 1
  fi
  echo ">>> sha256 remote ${safe_name}.tar = ${remote_sha} (ok)"
  # Short name without localhost/ — compose env uses eliteew-*:tag; podman load
  # typically stores localhost/… and short-name resolution needs a TTY otherwise.
  short_img="${img#localhost/}"
  ssh "${REMOTE}" bash -s <<EOF
set -euo pipefail
RT="\${ELITEEW_CONTAINER_RUNTIME:-podman}"
if ! command -v "\${RT}" >/dev/null 2>&1; then
  RT=docker
fi
"\${RT}" load -i "${REMOTE_ARCHIVE}"
rm -f "${REMOTE_ARCHIVE}"
# Dual-tag so STACK0_*_BAKED_IMAGE=eliteew-*:tag resolves without short-name prompt.
if "\${RT}" image exists "localhost/${short_img}" 2>/dev/null; then
  "\${RT}" tag "localhost/${short_img}" "${short_img}"
fi
if "\${RT}" image exists "${short_img}" 2>/dev/null && ! "\${RT}" image exists "localhost/${short_img}" 2>/dev/null; then
  "\${RT}" tag "${short_img}" "localhost/${short_img}"
fi
EOF
  rm -f "${ARCHIVE}"
done

echo ">>> Loaded images on ${REMOTE}:"
for img in "${IMAGES[@]}"; do
  echo "  - ${img}"
done
echo "✅ Образы загружены на ${REMOTE}. Дальше: sync-prod-core-deploy-tree.sh + compose up с prod-baked override."
