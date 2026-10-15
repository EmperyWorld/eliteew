#!/usr/bin/env bash
# Build all EliteEW stack0 backend image targets from docker/builders/stack0-api.
# Runtime is selected via ELITEEW_CONTAINER_RUNTIME (docker|podman, default podman).
# Tags are read from docker/env_file/.env.stack0.backend (STACK0_*_IMAGE vars).
#
# Usage (repo root):
#   bash docker/scripts/build-stack0-backend-images.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=stack0-backend-lock-integrity.sh
source "${SCRIPT_DIR}/stack0-backend-lock-integrity.sh"
# shellcheck source=stack0-backend-import-probe.sh
source "${SCRIPT_DIR}/stack0-backend-import-probe.sh"

CTX="${REPO_ROOT}/docker/builders/stack0-api"
DOCKERFILE="${CTX}/Dockerfile"
ENV_FILE="${REPO_ROOT}/docker/env_file/.env.stack0.backend"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"

_need_file() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    echo "ERROR: отсутствует файл: $f" >&2
    exit 1
  fi
}

_need_file "${DOCKERFILE}"
_need_file "${CTX}/constraints.txt"

stack0_backend_assert_all_locks_fresh

for lock in api queue-worker site-studio-worker; do
  _need_file "${CTX}/requirements/locks/${lock}.lock"
done

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: укажите env-файл: ${ENV_FILE}" >&2
  exit 1
fi

if [[ "${CONTAINER_RUNTIME}" != "docker" && "${CONTAINER_RUNTIME}" != "podman" ]]; then
  echo "ERROR: unsupported ELITEEW_CONTAINER_RUNTIME='${CONTAINER_RUNTIME}' (use docker|podman)" >&2
  exit 1
fi
if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
  echo "ERROR: runtime binary not found in PATH: ${CONTAINER_RUNTIME}" >&2
  exit 1
fi
if [[ "${CONTAINER_RUNTIME}" == "podman" ]]; then
  export PODMAN_COMPOSE_PROVIDER="${PODMAN_COMPOSE_PROVIDER:-podman-compose}"
  if ! command -v "${PODMAN_COMPOSE_PROVIDER}" >/dev/null 2>&1; then
    echo "ERROR: podman compose provider not found: ${PODMAN_COMPOSE_PROVIDER}" >&2
    echo "       install podman-compose or set PODMAN_COMPOSE_PROVIDER to a valid provider." >&2
    exit 1
  fi
fi

eval "$(
  grep -E '^(STACK0_API_IMAGE|STACK0_QUEUE_WORKER_IMAGE|STACK0_API_WORKER_IMAGE|STACK0_CELERY_WORKER_IMAGE|STACK0_CELERY_BEAT_IMAGE|STACK0_SITE_STUDIO_WORKER_IMAGE)=' "${ENV_FILE}" 2>/dev/null \
    | sed '/^#/d' \
    | sed 's/^/export /'
)" || true

: "${STACK0_API_IMAGE:?Set STACK0_API_IMAGE in env file}"

STACK0_QUEUE_WORKER_IMAGE="${STACK0_QUEUE_WORKER_IMAGE:-${STACK0_API_WORKER_IMAGE:-${STACK0_API_IMAGE}}}"
STACK0_SITE_STUDIO_WORKER_IMAGE="${STACK0_SITE_STUDIO_WORKER_IMAGE:-${STACK0_API_IMAGE}}"
STACK0_CELERY_WORKER_IMAGE="${STACK0_CELERY_WORKER_IMAGE:-${STACK0_API_IMAGE}}"
STACK0_CELERY_BEAT_IMAGE="${STACK0_CELERY_BEAT_IMAGE:-${STACK0_API_IMAGE}}"

DOCKER_BUILD_NETWORK="${DOCKER_BUILD_NETWORK:-}"
# Set STACK0_BUILD_NO_CACHE=1 for a clean base rebuild (no layer cache).
BUILD_NO_CACHE="${STACK0_BUILD_NO_CACHE:-0}"

stack0_backend_collect_build_metadata
echo ">>> base BUILD_LOCK_HASH=${BUILD_LOCK_HASH}"

build_one() {
  local target="$1"
  local tag="$2"
  if [[ "${BUILD_NO_CACHE}" == "1" ]]; then
    echo ">>> ${CONTAINER_RUNTIME} build --no-cache --target ${target} -t ${tag}"
  else
    echo ">>> ${CONTAINER_RUNTIME} build --target ${target} -t ${tag}"
  fi
  local jobs
  jobs="$(nproc)"
  local -a cmd=("${CONTAINER_RUNTIME}" build --jobs "${jobs}" -f "${DOCKERFILE}" --target "${target}" -t "${tag}")
  cmd+=(--build-arg "BUILD_LOCK_HASH=${BUILD_LOCK_HASH}")
  cmd+=(--build-arg "BUILD_JOBS=${jobs}")
  if [[ "${BUILD_NO_CACHE}" == "1" ]]; then
    cmd+=(--no-cache)
  fi
  if [[ -n "${DOCKER_BUILD_NETWORK}" ]]; then
    cmd+=(--network "${DOCKER_BUILD_NETWORK}")
  fi
  cmd+=("${CTX}")
  "${cmd[@]}"
}

build_one api "${STACK0_API_IMAGE}"
build_one queue-worker "${STACK0_QUEUE_WORKER_IMAGE}"
build_one celery-worker "${STACK0_CELERY_WORKER_IMAGE}"
build_one celery-beat "${STACK0_CELERY_BEAT_IMAGE}"
build_one site-studio-worker "${STACK0_SITE_STUDIO_WORKER_IMAGE}"

echo "=== Post-build import probes (api + queue-worker + celery base images) ==="
stack0_backend_probe_backend_base_images "${STACK0_API_IMAGE}" "${STACK0_QUEUE_WORKER_IMAGE}"
# Celery shares api.lock venv — greenlet/sqlalchemy asyncio must be present (no pip hotfix).
stack0_backend_probe_api_venv_image "${STACK0_CELERY_WORKER_IMAGE}"
stack0_backend_probe_api_venv_image "${STACK0_CELERY_BEAT_IMAGE}"

echo "✅ Готово. Образы: api, queue-worker, celery-worker, celery-beat, site-studio-worker."
