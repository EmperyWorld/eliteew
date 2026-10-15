#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Сборка prod-baked образов stack0 (API + workers + frontend): сначала базовые образы
# (кэш venv), затем тонкий COPY api/dist. Новые теги не перетирают текущий prod.
# Invariants:
# - Запуск из корня репозитория; runtime podman|docker через ELITEEW_CONTAINER_RUNTIME.
# - Тег задаётся STACK0_PROD_BAKED_TAG (default: prod-baked-YYYYMMDD).
# Related:
# - docker/builders/stack0-api/Dockerfile.prod-baked
# - docker/builders/stack0-frontend/Dockerfile.prod-baked
# - documentation/platform/docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=stack0-backend-lock-integrity.sh
source "${SCRIPT_DIR}/stack0-backend-lock-integrity.sh"
# shellcheck source=stack0-backend-import-probe.sh
source "${SCRIPT_DIR}/stack0-backend-import-probe.sh"
# shellcheck source=deploy-provenance-lib.sh
source "${SCRIPT_DIR}/deploy-provenance-lib.sh"

stack0_backend_assert_all_locks_fresh
stack0_backend_collect_build_metadata
export DEPLOY_PROVENANCE_BUILD_GIT_SHA="${BUILD_GIT_SHA}"
echo ">>> frozen build git sha: ${DEPLOY_PROVENANCE_BUILD_GIT_SHA}"

if [[ "${SKIP_DEPLOY_PROVENANCE_GATE:-0}" != "1" ]]; then
  bash "${SCRIPT_DIR}/deploy-provenance-gate.sh" --release
fi

ENV_FILE="${REPO_ROOT}/docker/env_file/.env.stack0.backend"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
BAKED_TAG="${STACK0_PROD_BAKED_TAG:-prod-baked-$(date +%Y%m%d)}"
SKIP_FRONTEND_BUILD="${STACK0_PROD_BAKED_SKIP_FRONTEND_BUILD:-0}"
SKIP_BASE_IMAGES="${STACK0_PROD_BAKED_SKIP_BASE_IMAGES:-0}"
REFRESH_OPENAPI_PILOTS="${STACK0_PROD_BAKED_REFRESH_OPENAPI_PILOTS:-0}"
BAKED_ONLY="${STACK0_PROD_BAKED_ONLY:-all}"
DOCKER_BUILD_NETWORK="${DOCKER_BUILD_NETWORK:-}"
# STACK0_BUILD_NO_CACHE=1 → --no-cache on base + thin baked layers (clean rebuild).
BUILD_NO_CACHE="${STACK0_BUILD_NO_CACHE:-0}"

API_DOCKERFILE="${REPO_ROOT}/docker/builders/stack0-api/Dockerfile.prod-baked"
FRONTEND_DOCKERFILE="${REPO_ROOT}/docker/builders/stack0-frontend/Dockerfile.prod-baked"

usage() {
  cat <<EOF
Usage:
  bash docker/scripts/$(basename "$0")

Env:
  STACK0_PROD_BAKED_TAG              — суффикс тега (default: prod-baked-YYYYMMDD)
  STACK0_PROD_BAKED_SKIP_FRONTEND_BUILD=1 — не запускать pnpm build
  STACK0_PROD_BAKED_SKIP_BASE_IMAGES=1  — не пересобирать базовые stack0-api targets
  STACK0_PROD_BAKED_ONLY=all|backend|frontend — какие thin-слои собирать (default all)
  STACK0_BUILD_NO_CACHE=1            — --no-cache for base + thin baked layers
  ELITEEW_CONTAINER_RUNTIME          — podman|docker (default podman)
  DOCKER_BUILD_NETWORK               — например host для wheel download

После сборки:
  bash docker/scripts/export-stack0-prod-baked-images.sh user@new-host
EOF
}

if [[ "${1-}" == "-h" || "${1-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${CONTAINER_RUNTIME}" != "docker" && "${CONTAINER_RUNTIME}" != "podman" ]]; then
  echo "ERROR: unsupported ELITEEW_CONTAINER_RUNTIME='${CONTAINER_RUNTIME}'" >&2
  exit 1
fi
if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
  echo "ERROR: runtime '${CONTAINER_RUNTIME}' не найден в PATH." >&2
  exit 1
fi

# .env.stack0.backend задаёт HOME=/tmp для runtime контейнеров — не использовать для podman build.
if [[ "${HOME}" == "/tmp" && -n "${USER:-}" && -d "/home/${USER}" ]]; then
  export HOME="/home/${USER}"
fi

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

_normalize_image_ref() {
  local ref="$1"
  if [[ -z "${ref}" ]]; then
    return 1
  fi
  if [[ "${ref}" != */* ]]; then
    printf 'docker.io/library/%s' "${ref}"
  else
    printf '%s' "${ref}"
  fi
}

_resolve_local_image() {
  local ref="$1"
  if [[ "${ref}" == docker.io/library/* ]]; then
    local short="${ref#docker.io/library/}"
    if "${CONTAINER_RUNTIME}" image exists "localhost/${short}" 2>/dev/null; then
      printf 'localhost/%s' "${short}"
      return 0
    fi
    if "${CONTAINER_RUNTIME}" image exists "${short}" 2>/dev/null; then
      printf '%s' "${short}"
      return 0
    fi
  fi
  if "${CONTAINER_RUNTIME}" image exists "${ref}" 2>/dev/null; then
    printf '%s' "${ref}"
    return 0
  fi
  printf '%s' "${ref}"
}

resolve_stack0_base_images() {
  STACK0_API_IMAGE="$(_resolve_local_image "$(_normalize_image_ref "$(_load_env_var STACK0_API_IMAGE eliteew-api:v3)")")"
  STACK0_QUEUE_WORKER_IMAGE="$(_resolve_local_image "$(_normalize_image_ref "$(_load_env_var STACK0_QUEUE_WORKER_IMAGE "$(_load_env_var STACK0_API_WORKER_IMAGE "$(_load_env_var STACK0_API_IMAGE eliteew-api:v3)")")")")"
  STACK0_CELERY_WORKER_IMAGE="$(_resolve_local_image "$(_normalize_image_ref "$(_load_env_var STACK0_CELERY_WORKER_IMAGE "$(_load_env_var STACK0_API_IMAGE eliteew-api:v3)")")")"
  STACK0_CELERY_BEAT_IMAGE="$(_resolve_local_image "$(_normalize_image_ref "$(_load_env_var STACK0_CELERY_BEAT_IMAGE "$(_load_env_var STACK0_API_IMAGE eliteew-api:v3)")")")"
  STACK0_SITE_STUDIO_WORKER_IMAGE="$(_resolve_local_image "$(_normalize_image_ref "$(_load_env_var STACK0_SITE_STUDIO_WORKER_IMAGE "$(_load_env_var STACK0_API_IMAGE eliteew-api:v3)")")")"
  STACK0_FRONTEND_BASE_IMAGE="$(_resolve_local_image "$(_normalize_image_ref "$(_load_env_var STACK0_FRONTEND_IMAGE eliteew-frontend-fedora:latest)")")"
  echo ">>> base image refs: api=${STACK0_API_IMAGE} frontend=${STACK0_FRONTEND_BASE_IMAGE}"
}

# Always derive baked image names from BAKED_TAG for this bake.
# Stale STACK0_*_BAKED_IMAGE in the shell (e.g. previous release keys synced to
# staging and exported into the environment) must not pin an older tag.
export STACK0_API_BAKED_IMAGE="eliteew-api:${BAKED_TAG}"
export STACK0_QUEUE_WORKER_BAKED_IMAGE="eliteew-queue-worker:${BAKED_TAG}"
export STACK0_CELERY_WORKER_BAKED_IMAGE="eliteew-celery-worker:${BAKED_TAG}"
export STACK0_CELERY_BEAT_BAKED_IMAGE="eliteew-celery-beat:${BAKED_TAG}"
export STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE="eliteew-site-studio-worker:${BAKED_TAG}"
export STACK0_FRONTEND_BAKED_IMAGE="eliteew-frontend:${BAKED_TAG}"

echo "=== EliteEW prod-baked images ==="
echo "Repo root : ${REPO_ROOT}"
echo "Runtime   : ${CONTAINER_RUNTIME}"
echo "Baked tag : ${BAKED_TAG}"
echo "Targets   : ${BAKED_ONLY}"
echo ""

case "${BAKED_ONLY}" in
  all | backend | frontend) ;;
  *)
    echo "ERROR: STACK0_PROD_BAKED_ONLY must be all|backend|frontend (got '${BAKED_ONLY}')" >&2
    exit 1
    ;;
esac

resolve_stack0_base_images

_build_frontend_base() {
  local -a fcmd=("${CONTAINER_RUNTIME}" build --jobs "$(nproc)")
  if [[ "${BUILD_NO_CACHE}" == "1" ]]; then
    fcmd+=(--no-cache)
    echo ">>> Base frontend image ${STACK0_FRONTEND_BASE_IMAGE} (no-cache)…"
  else
    echo ">>> Base frontend image ${STACK0_FRONTEND_BASE_IMAGE}…"
  fi
  if [[ -n "${DOCKER_BUILD_NETWORK}" ]]; then
    fcmd+=(--network "${DOCKER_BUILD_NETWORK}")
  fi
  fcmd+=(
    -f "${REPO_ROOT}/docker/builders/stack0-frontend/Dockerfile"
    -t "${STACK0_FRONTEND_BASE_IMAGE}"
    "${REPO_ROOT}"
  )
  "${fcmd[@]}"
}

if [[ "${SKIP_BASE_IMAGES}" != "1" && "${BAKED_ONLY}" != "frontend" ]]; then
  if [[ "${BUILD_NO_CACHE}" == "1" ]]; then
    echo ">>> Base backend images (venv, no-cache)…"
  else
    echo ">>> Base backend images (venv cache)…"
  fi
  STACK0_BUILD_NO_CACHE="${BUILD_NO_CACHE}" bash "${SCRIPT_DIR}/build-stack0-backend-images.sh"
  if [[ "${BAKED_ONLY}" == "all" ]]; then
    if [[ "${BUILD_NO_CACHE}" == "1" ]] || ! "${CONTAINER_RUNTIME}" image exists "${STACK0_FRONTEND_BASE_IMAGE}" 2>/dev/null; then
      _build_frontend_base
    fi
  fi
elif [[ "${BAKED_ONLY}" == "frontend" ]]; then
  if [[ "${SKIP_BASE_IMAGES}" != "1" ]]; then
    if [[ "${BUILD_NO_CACHE}" == "1" ]] || ! "${CONTAINER_RUNTIME}" image exists "${STACK0_FRONTEND_BASE_IMAGE}" 2>/dev/null; then
      _build_frontend_base
    fi
  else
    echo ">>> SKIP base images (STACK0_PROD_BAKED_SKIP_BASE_IMAGES=1)"
  fi
else
  echo ">>> SKIP base images (STACK0_PROD_BAKED_SKIP_BASE_IMAGES=1)"
fi

# Re-resolve after optional base build so thin prod-baked layers use fresh localhost/* refs.
if [[ "${SKIP_BASE_IMAGES}" != "1" ]]; then
  resolve_stack0_base_images
fi

if [[ "${BAKED_ONLY}" == "backend" && "${SKIP_FRONTEND_BUILD}" != "1" ]]; then
  SKIP_FRONTEND_BUILD=1
  echo ">>> backend-only: skip pnpm (use existing dist-build; pass SKIP_FRONTEND_BUILD=0 to override)"
fi

if [[ "${REFRESH_OPENAPI_PILOTS}" == "1" ]]; then
  if [[ "${SKIP_FRONTEND_BUILD}" == "1" ]]; then
    echo "ERROR: STACK0_PROD_BAKED_REFRESH_OPENAPI_PILOTS=1 requires a frontend build" >&2
    exit 2
  fi
  echo ">>> refresh OpenAPI pilots from release tree (before pnpm build)…"
  bash "${SCRIPT_DIR}/stack0-refresh-openapi-pilots.sh"
fi

if [[ "${SKIP_FRONTEND_BUILD}" != "1" ]]; then
  echo ">>> Frontend pnpm build:react-compiler…"
  (
    cd "${REPO_ROOT}/shared/web/frontend"
    pnpm run build:react-compiler
    node scripts/verify-app-build-id.mjs
  )
else
  echo ">>> SKIP frontend build (STACK0_PROD_BAKED_SKIP_FRONTEND_BUILD=1)"
  if [[ -f "${REPO_ROOT}/shared/web/frontend/dist-build/app-build-version.txt" ]]; then
    echo ">>> Using existing dist-build deploy id: $(tr -d '\n' <"${REPO_ROOT}/shared/web/frontend/dist-build/app-build-version.txt")"
  fi
fi

if [[ ! -d "${REPO_ROOT}/shared/web/frontend/dist-build" ]]; then
  echo "ERROR: отсутствует shared/web/frontend/dist-build — сначала pnpm build:react-compiler" >&2
  exit 1
fi

DIST_DIR="${REPO_ROOT}/shared/web/frontend/dist-build"
deploy_provenance_write_dist_manifest "${DIST_DIR}" "baked-release" "baked" >/dev/null
readarray -t _manifest_exports < <(deploy_provenance_read_manifest_exports "${DIST_DIR}/deployment-manifest.json")
export BUILD_DEPLOY_ID="${_manifest_exports[0]:-unknown}"
export BUILD_MANIFEST_SHA256="${_manifest_exports[1]:-unknown}"
echo ">>> deployment-manifest: deploy_id=${BUILD_DEPLOY_ID} manifest_sha256=${BUILD_MANIFEST_SHA256:0:12}…"

_build_baked() {
  local dockerfile="$1"
  local target="$2"
  local tag="$3"
  shift 3
  local -a build_args=("$@")
  if [[ "${BUILD_NO_CACHE}" == "1" ]]; then
    echo ">>> ${CONTAINER_RUNTIME} build --no-cache --target ${target} -t ${tag}"
  else
    echo ">>> ${CONTAINER_RUNTIME} build --target ${target} -t ${tag}"
  fi
  local -a cmd=("${CONTAINER_RUNTIME}" build --jobs "$(nproc)")
  if [[ "${CONTAINER_RUNTIME}" == "podman" ]]; then
    cmd+=(--pull=never)
  else
    cmd+=(--pull=false)
  fi
  if [[ "${BUILD_NO_CACHE}" == "1" ]]; then
    cmd+=(--no-cache)
  fi
  cmd+=(
    -f "${dockerfile}"
    --target "${target}"
    -t "${tag}"
  )
  if [[ -n "${DOCKER_BUILD_NETWORK}" ]]; then
    cmd+=(--network "${DOCKER_BUILD_NETWORK}")
  fi
  if [[ -n "${BUILD_GIT_SHA:-}" ]]; then
    cmd+=(
      --build-arg "BUILD_GIT_SHA=${BUILD_GIT_SHA}"
      --build-arg "BUILD_LOCK_HASH=${BUILD_LOCK_HASH}"
      --build-arg "BUILD_QUEUE_WORKER_LOCK_HASH=${BUILD_QUEUE_WORKER_LOCK_HASH}"
    )
  fi
  if [[ -n "${BUILD_DEPLOY_ID:-}" ]]; then
    cmd+=(
      --build-arg "BUILD_DEPLOY_ID=${BUILD_DEPLOY_ID}"
      --build-arg "BUILD_MANIFEST_SHA256=${BUILD_MANIFEST_SHA256:-unknown}"
    )
  fi
  cmd+=("${build_args[@]}" "${REPO_ROOT}")
  "${cmd[@]}"
}

if [[ "${BAKED_ONLY}" == "all" || "${BAKED_ONLY}" == "backend" ]]; then
  _build_baked "${API_DOCKERFILE}" api-baked "${STACK0_API_BAKED_IMAGE}" \
    --build-arg "STACK0_API_IMAGE=${STACK0_API_IMAGE}"

  _build_baked "${API_DOCKERFILE}" queue-worker-baked "${STACK0_QUEUE_WORKER_BAKED_IMAGE}" \
    --build-arg "STACK0_QUEUE_WORKER_IMAGE=${STACK0_QUEUE_WORKER_IMAGE}"

  _build_baked "${API_DOCKERFILE}" celery-worker-baked "${STACK0_CELERY_WORKER_BAKED_IMAGE}" \
    --build-arg "STACK0_CELERY_WORKER_IMAGE=${STACK0_CELERY_WORKER_IMAGE}"

  _build_baked "${API_DOCKERFILE}" celery-beat-baked "${STACK0_CELERY_BEAT_BAKED_IMAGE}" \
    --build-arg "STACK0_CELERY_BEAT_IMAGE=${STACK0_CELERY_BEAT_IMAGE}"

  _build_baked "${API_DOCKERFILE}" site-studio-worker-baked "${STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE}" \
    --build-arg "STACK0_SITE_STUDIO_WORKER_IMAGE=${STACK0_SITE_STUDIO_WORKER_IMAGE}"

  echo "=== Post-bake import probes (prod-baked backend images) ==="
  stack0_backend_probe_prod_baked_backend_images \
    "${STACK0_API_BAKED_IMAGE}" \
    "${STACK0_QUEUE_WORKER_BAKED_IMAGE}" \
    "${STACK0_CELERY_WORKER_BAKED_IMAGE}" \
    "${STACK0_CELERY_BEAT_BAKED_IMAGE}" \
    "${STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE}"
fi

if [[ "${BAKED_ONLY}" == "all" || "${BAKED_ONLY}" == "frontend" ]]; then
  _build_baked "${FRONTEND_DOCKERFILE}" frontend-baked "${STACK0_FRONTEND_BAKED_IMAGE}" \
    --build-arg "STACK0_FRONTEND_BASE_IMAGE=${STACK0_FRONTEND_BASE_IMAGE}"
fi

cat <<EOF

✅ Prod-baked образы (${BAKED_ONLY}):
EOF
if [[ "${BAKED_ONLY}" == "all" || "${BAKED_ONLY}" == "backend" ]]; then
  echo "  ${STACK0_API_BAKED_IMAGE}"
  echo "  ${STACK0_QUEUE_WORKER_BAKED_IMAGE}"
  echo "  ${STACK0_CELERY_WORKER_BAKED_IMAGE}"
  echo "  ${STACK0_CELERY_BEAT_BAKED_IMAGE}"
  echo "  ${STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE}"
fi
if [[ "${BAKED_ONLY}" == "all" || "${BAKED_ONLY}" == "frontend" ]]; then
  echo "  ${STACK0_FRONTEND_BAKED_IMAGE}"
fi
cat <<EOF

Экспорт на целевой хост:
  STACK0_PROD_BAKED_EXPORT_ONLY=${BAKED_ONLY} bash docker/scripts/export-stack0-prod-baked-images.sh user@prod-core-host ${BAKED_TAG}

Compose (не затирает stack0-*-prod):
  podman compose \\
    -f docker/stack/stack0_b.yml \\
    -f docker/stack/stack0_b.prod-baked.override.yml \\
    --env-file docker/env_file/.env.stack0.backend up -d
EOF
