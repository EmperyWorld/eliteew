#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Command-center → prod-core (.111): build thin prod-baked layers locally, export images,
# patch env, recreate stack0 — без rebake на удалённом хосте.
# Invariants:
# - Prod-core only via stack0_*.prod-baked.override.yml (never bare eectl recreate).
# - Partial deploy (--frontend-only | --backend-only) patches only relevant env keys.
# - Exclusive flock via prod_core_deploy_acquire_baked_deploy_lock (no concurrent releases).
# Related:
# - build-stack0-prod-baked-images.sh, export-stack0-prod-baked-images.sh, stack0-refresh-openapi-pilots.sh
# - prod-core-deploy-lib.sh, documentation/platform/docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md
# ---
set -euo pipefail

# shellcheck source=eliteew-ops-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/eliteew-ops-lib.sh"
# shellcheck source=prod-core-deploy-lib.sh
source "${DEWA_OPS_REPO_ROOT}/docker/scripts/prod-core-deploy-lib.sh"
# shellcheck source=prod-line-lib.sh
source "${DEWA_OPS_REPO_ROOT}/docker/scripts/prod-line-lib.sh"
# shellcheck source=stack0-backend-lock-integrity.sh
source "${DEWA_OPS_REPO_ROOT}/docker/scripts/stack0-backend-lock-integrity.sh"
# shellcheck source=stack0-backend-import-probe.sh
source "${DEWA_OPS_REPO_ROOT}/docker/scripts/stack0-backend-import-probe.sh"

# .env.stack0.backend may set HOME=/tmp for runtime containers — restore for host tools (sops/age).
if [[ "${HOME}" == "/tmp" && -n "${USER:-}" && -d "/home/${USER}" ]]; then
  export HOME="/home/${USER}"
fi

# Stale bake image env from a previous release must not pin an older tag for this run.
unset STACK0_API_BAKED_IMAGE STACK0_QUEUE_WORKER_BAKED_IMAGE \
  STACK0_CELERY_WORKER_BAKED_IMAGE STACK0_CELERY_BEAT_BAKED_IMAGE \
  STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE STACK0_FRONTEND_BAKED_IMAGE

MODE="all"
ASSUME_YES=0
SKIP_BASE=1
BUILD_NO_CACHE=0
WITH_FRONTEND_BUILD=0
SKIP_FRONTEND_BUILD=0
SKIP_BUILD=0
SKIP_ENV_PUSH=0
REFRESH_OPENAPI_PILOTS=0
ENFORCE_BASE_MATCH="${STACK0_PROD_BAKED_BASE_MATCH_STRICT:-1}"
ROLLBACK_ON_SMOKE_FAIL="${STACK0_PROD_BAKED_ROLLBACK_ON_SMOKE_FAIL:-1}"
CLEANUP_OLD_IMAGES=1
RETAIN_BAKED_IMAGES="${STACK0_PROD_BAKED_RETAIN_IMAGES:-2}"
BAKED_TAG=""
EXPECTED_DEPLOY_ID=""
ROLLBACK_SNAPSHOT_PATH=""
FORCE_OVER_DEV_LINE=0
FORCE_BAKED_DEPLOY_UNLOCK=0
# empty = auto (on for --all); on|off = explicit
MAINTENANCE_OPT=""

# shellcheck source=eliteew-maintenance-window.sh
source "${DEWA_OPS_REPO_ROOT}/docker/scripts/eliteew-maintenance-window.sh"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Build prod-baked images on command-center, export to prod-core, recreate containers.
No pnpm/podman build on .111.

Modes (required, pick one):
  --all              frontend + backend baked (default deploy id sync nginx↔API)
  --frontend-only    nginx SPA only (API deploy id unchanged until --all/--backend-only)
  --backend-only     API + workers (uses existing dist-build unless --with-frontend-build)

Options:
  --yes              skip confirmation
  --tag TAG          baked tag (default: prod-baked-YYYYMMDD-HHMM)
  --rebuild-base     run base image build (venv cache) before thin COPY layers
  --no-cache         pass STACK0_BUILD_NO_CACHE=1 (base + thin layers without build cache)
  --with-frontend-build   pnpm build:react-compiler before bake (default for --all and --frontend-only)
  --skip-frontend-build   use existing dist-build (default for --backend-only)
  --refresh-openapi-pilots
                         before pnpm build: export OpenAPI from current API tree,
                         extract pilots + regenerate lite TS (same-release FE types).
                         Requires frontend build (not compatible with --skip-frontend-build /
                         --skip-build). Leaves pilot/generated dirty — commit after bake.
  --skip-build            skip local bake (images for --tag must already exist)
  --skip-env-push         do not push env bundle before recreate
  --allow-base-drift      do not fail when base image digest differs on prod-core
  --no-rollback           disable env+recreate rollback when post-deploy smoke fails
  --retain-images N       keep last N prod-baked tags per stack0 image repo on prod-core (default: 2)
  --no-image-cleanup      skip cleanup of old prod-baked images on prod-core
  --force-over-dev-line   allow baked deploy while prod-core dev-bind line is active
  --force-unlock          steal stack0 baked deploy flock (TERM holder PID from lock meta)
  --maintenance           force user-visible maintenance window (publish warning early)
  --no-maintenance        skip maintenance window (default for --all is ON; notice/downtime from DB)
  --notice-seconds N      override DB user lead time before advertised starts_at (default from admin/DB: 600)
  --duration-seconds N    override DB expected downtime / retry_after (default from admin/DB: 120)
  --dry-run          print plan only (DEWA_DRY_RUN=1)
  -h, --help

Post-deploy gates (backend/all): internal smoke + contract, then external user-path
(https://app.eliteew.ru + single upstream DNS). Failure triggers rollback when enabled.

Examples:
  bash docker/scripts/$(basename "$0") --yes --all
  bash docker/scripts/$(basename "$0") --yes --all --refresh-openapi-pilots
  bash docker/scripts/$(basename "$0") --yes --all --no-maintenance
  bash docker/scripts/$(basename "$0") --yes --frontend-only
  bash docker/scripts/$(basename "$0") --yes --backend-only --with-frontend-build
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)
      MODE="all"
      shift
      ;;
    --frontend-only)
      MODE="frontend"
      shift
      ;;
    --backend-only)
      MODE="backend"
      shift
      ;;
    --yes)
      ASSUME_YES=1
      shift
      ;;
    --tag)
      BAKED_TAG="${2:-}"
      shift 2
      ;;
    --rebuild-base)
      SKIP_BASE=0
      shift
      ;;
    --no-cache)
      BUILD_NO_CACHE=1
      SKIP_BASE=0
      shift
      ;;
    --with-frontend-build)
      WITH_FRONTEND_BUILD=1
      SKIP_FRONTEND_BUILD=0
      shift
      ;;
    --skip-frontend-build)
      SKIP_FRONTEND_BUILD=1
      shift
      ;;
    --refresh-openapi-pilots)
      REFRESH_OPENAPI_PILOTS=1
      shift
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --skip-env-push)
      SKIP_ENV_PUSH=1
      shift
      ;;
    --allow-base-drift)
      ENFORCE_BASE_MATCH=0
      shift
      ;;
    --no-rollback)
      ROLLBACK_ON_SMOKE_FAIL=0
      shift
      ;;
    --retain-images)
      RETAIN_BAKED_IMAGES="${2:-}"
      shift 2
      ;;
    --no-image-cleanup)
      CLEANUP_OLD_IMAGES=0
      shift
      ;;
    --force-over-dev-line)
      FORCE_OVER_DEV_LINE=1
      shift
      ;;
    --force-unlock)
      FORCE_BAKED_DEPLOY_UNLOCK=1
      shift
      ;;
    --maintenance)
      MAINTENANCE_OPT="on"
      shift
      ;;
    --no-maintenance)
      MAINTENANCE_OPT="off"
      shift
      ;;
    --notice-seconds)
      ELITEEW_MAINTENANCE_NOTICE_SECONDS="${2:-}"
      ELITEEW_MAINTENANCE_NOTICE_CLI="${ELITEEW_MAINTENANCE_NOTICE_SECONDS}"
      shift 2
      ;;
    --duration-seconds)
      ELITEEW_MAINTENANCE_DURATION_SECONDS="${2:-}"
      ELITEEW_MAINTENANCE_DURATION_CLI="${ELITEEW_MAINTENANCE_DURATION_SECONDS}"
      shift 2
      ;;
    --dry-run)
      export DEWA_DRY_RUN=1
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

# Full local bake exports complete prod-baked images; strict base-tag parity on .111 is
# misleading (especially after --rebuild-base). Keep strict mode only for --skip-build.
if [[ "${SKIP_BUILD}" -eq 0 && "${ENFORCE_BASE_MATCH}" -eq 1 ]]; then
  echo "INFO: full bake — skip strict base parity (export/recreate carries baked layers)."
  ENFORCE_BASE_MATCH=0
fi

if [[ -z "${BAKED_TAG}" ]]; then
  BAKED_TAG="$(prod_core_deploy_default_baked_tag)"
fi
prod_core_deploy_validate_baked_tag "${BAKED_TAG}" || exit 1

# Maintenance: default ON for --all; notice/downtime from DB (fallback 600s/120s). Opt-out --no-maintenance.
DO_MAINTENANCE=0
case "${MAINTENANCE_OPT}" in
  on) DO_MAINTENANCE=1 ;;
  off) DO_MAINTENANCE=0 ;;
  *)
    if [[ "${MODE}" == "all" ]]; then
      DO_MAINTENANCE=1
    fi
    ;;
esac
export ELITEEW_MAINTENANCE_WINDOW_ID="deploy-${BAKED_TAG}"
export ELITEEW_MAINTENANCE_SOURCE="stack0-baked-deploy"
export ELITEEW_MAINTENANCE_NOTICE_CLI="${ELITEEW_MAINTENANCE_NOTICE_CLI:-}"
export ELITEEW_MAINTENANCE_DURATION_CLI="${ELITEEW_MAINTENANCE_DURATION_CLI:-}"
if [[ -z "${ELITEEW_MAINTENANCE_NOTICE_SECONDS:-}" ]]; then
  ELITEEW_MAINTENANCE_NOTICE_SECONDS=600
fi
export ELITEEW_MAINTENANCE_NOTICE_SECONDS
if [[ -z "${ELITEEW_MAINTENANCE_DURATION_SECONDS:-}" ]]; then
  ELITEEW_MAINTENANCE_DURATION_SECONDS=120
fi
export ELITEEW_MAINTENANCE_DURATION_SECONDS

if ! [[ "${RETAIN_BAKED_IMAGES}" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --retain-images must be integer >= 0 (got '${RETAIN_BAKED_IMAGES}')" >&2
  exit 2
fi
ROLLBACK_SNAPSHOT_PATH="${DEWA_OPS_REMOTE_REPO}/docker/tmp/prod-baked-images/${BAKED_TAG}/stack0-env-before-${MODE}.env"

# Exclusive lock BEFORE any up-baked side effects / build / export (anti-race).
prod_core_deploy_acquire_baked_deploy_lock "${BAKED_TAG}" "${FORCE_BAKED_DEPLOY_UNLOCK}" || exit 1

prod_line_assert_baked_deploy_allowed "${FORCE_OVER_DEV_LINE}" || exit 1

case "${MODE}" in
  all | frontend)
    SKIP_FRONTEND_BUILD=0
    ;;
  backend)
    if [[ "${WITH_FRONTEND_BUILD}" -eq 1 ]]; then
      SKIP_FRONTEND_BUILD=0
    else
      SKIP_FRONTEND_BUILD=1
    fi
    ;;
esac

if [[ "${REFRESH_OPENAPI_PILOTS}" -eq 1 ]]; then
  if [[ "${SKIP_BUILD}" -eq 1 ]]; then
    echo "ERROR: --refresh-openapi-pilots requires a local bake (incompatible with --skip-build)" >&2
    exit 2
  fi
  if [[ "${SKIP_FRONTEND_BUILD}" -eq 1 ]]; then
    echo "ERROR: --refresh-openapi-pilots requires a frontend build (incompatible with --skip-frontend-build / backend-only without --with-frontend-build)" >&2
    exit 2
  fi
fi

confirm() {
  local msg="$1"
  if [[ "${ASSUME_YES}" -eq 1 ]]; then
    echo "→ ${msg} (--yes)"
    return 0
  fi
  if [[ ! -t 0 ]]; then
    echo "ERROR: non-interactive dispatch requires --yes (DEWA Operations / CI)" >&2
    return 1
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

resolve_local_image_fingerprint() {
  local image_ref="$1"
  podman image inspect --format '{{if .Digest}}{{.Digest}}{{else}}{{.Id}}{{end}}' "${image_ref}" 2>/dev/null || true
}

resolve_remote_image_fingerprint() {
  local image_ref="$1"
  ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s "${image_ref}" <<'REMOTE'
set -euo pipefail
image_ref="$1"
RT="${ELITEEW_CONTAINER_RUNTIME:-podman}"
if ! command -v "${RT}" >/dev/null 2>&1; then
  RT=docker
fi
if ! "${RT}" image inspect "${image_ref}" >/dev/null 2>&1; then
  echo "__MISSING__"
  exit 0
fi
"${RT}" image inspect --format '{{if .Digest}}{{.Digest}}{{else}}{{.Id}}{{end}}' "${image_ref}"
REMOTE
}

verify_base_parity() {
  local mode="$1"
  local strict="${2:-1}"
  local label image_ref local_fp remote_fp
  local failed=0
  local -a checks=()
  if [[ "${mode}" == "all" || "${mode}" == "backend" ]]; then
    checks+=("api|${_api_base}")
  fi
  if [[ "${mode}" == "all" || "${mode}" == "frontend" ]]; then
    checks+=("frontend|${_front_base}")
  fi

  if ((${#checks[@]} == 0)); then
    return 0
  fi

  for entry in "${checks[@]}"; do
    label="${entry%%|*}"
    image_ref="${entry#*|}"
    local_fp="$(resolve_local_image_fingerprint "${image_ref}")"
    if [[ -z "${local_fp}" ]]; then
      echo "WARN: ${label} base fingerprint unavailable locally (${image_ref})" >&2
      continue
    fi
    remote_fp="$(resolve_remote_image_fingerprint "${image_ref}")"
    if [[ "${remote_fp}" == "__MISSING__" ]]; then
      echo "WARN: ${label} base image missing on prod-core (${image_ref}); load will proceed via baked image" >&2
      continue
    fi
    if [[ -z "${remote_fp}" ]]; then
      echo "WARN: ${label} base fingerprint unavailable on prod-core (${image_ref})" >&2
      continue
    fi
    if [[ "${local_fp}" != "${remote_fp}" ]]; then
      echo "WARN: ${label} base mismatch ${image_ref}" >&2
      echo "      local=${local_fp}" >&2
      echo "      remote=${remote_fp}" >&2
      if [[ "${strict}" -eq 1 ]]; then
        failed=1
      fi
    else
      echo "✅ ${label} base parity OK (${image_ref})"
    fi
  done

  if [[ "${failed}" -ne 0 ]]; then
    echo "ERROR: base parity mismatch detected (strict mode)." >&2
    echo "HINT: use --allow-base-drift only for emergency deploys." >&2
    return 1
  fi
}

cleanup_old_prod_baked_images() {
  local keep_count="$1"
  if [[ "${keep_count}" -le 0 ]]; then
    echo ">>> skip prod-baked cleanup (retain=${keep_count})"
    return 0
  fi
  ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s "${keep_count}" <<'REMOTE'
set -euo pipefail
keep_count="$1"
python3 - "${keep_count}" <<'PY'
import subprocess
import sys
from collections import defaultdict

keep = int(sys.argv[1])
if keep <= 0:
    print(">>> cleanup: disabled")
    raise SystemExit(0)

target_short_repos = {
    "eliteew-api",
    "eliteew-queue-worker",
    "eliteew-celery-worker",
    "eliteew-celery-beat",
    "eliteew-site-studio-worker",
    "eliteew-frontend",
}
prefix = "prod-baked-"


def run(*args: str) -> str:
    return subprocess.check_output(args, text=True)


images_raw = run("podman", "images", "--format", "{{.Repository}}|{{.Tag}}|{{.ID}}")


def image_id_keys(value: str) -> set[str]:
    image_id = value.strip()
    if not image_id:
        return set()
    bare = image_id.removeprefix("sha256:")
    return {image_id, bare, bare[:12]}


used_ids: set[str] = set()
for container_id in run("podman", "ps", "-a", "--format", "{{.ID}}").splitlines():
    container_id = container_id.strip()
    if not container_id:
        continue
    try:
        inspected = run("podman", "inspect", "--format", "{{.ImageID}}", container_id)
    except subprocess.CalledProcessError:
        continue
    used_ids.update(image_id_keys(inspected))

images_by_repo: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
for raw in images_raw.splitlines():
    if not raw.strip():
        continue
    repo, tag, image_id = raw.split("|", 2)
    short_repo = repo.rsplit("/", 1)[-1]
    if short_repo not in target_short_repos:
        continue
    if not tag.startswith(prefix):
        continue
    images_by_repo[short_repo].append((tag, image_id, repo))

remove_refs: list[str] = []
for short_repo, rows in images_by_repo.items():
    rows.sort(key=lambda row: row[0], reverse=True)
    for tag, image_id, repo in rows[keep:]:
        if image_id_keys(image_id) & used_ids:
            continue
        remove_refs.append(f"{repo}:{tag}")

if not remove_refs:
    print(f">>> cleanup: no stale prod-baked images (retain={keep})")
    raise SystemExit(0)

for ref in remove_refs:
    print(f">>> cleanup remove {ref}")
    subprocess.run(["podman", "image", "rm", ref], check=False)
print(f">>> cleanup attempted {len(remove_refs)} image(s)")
PY
REMOTE
}

echo "=== prod-core baked deploy (local build → export → recreate) ==="
echo "host   : ${DEWA_OPS_PROD_CORE_SSH}"
echo "remote : ${DEWA_OPS_REMOTE_REPO}"
echo "mode   : ${MODE}"
echo "tag    : ${BAKED_TAG}"
echo "skip base: ${SKIP_BASE} | skip pnpm: ${SKIP_FRONTEND_BUILD} | refresh openapi pilots: ${REFRESH_OPENAPI_PILOTS}"
echo "base parity strict: ${ENFORCE_BASE_MATCH} | rollback on smoke fail: ${ROLLBACK_ON_SMOKE_FAIL}"
echo "image cleanup: ${CLEANUP_OLD_IMAGES} | retain prod-baked tags: ${RETAIN_BAKED_IMAGES}"
echo "maintenance: ${DO_MAINTENANCE} | notice: ${ELITEEW_MAINTENANCE_NOTICE_SECONDS}s | duration: ${ELITEEW_MAINTENANCE_DURATION_SECONDS}s"
echo ""

confirm "Deploy ${MODE} to ${DEWA_OPS_PROD_CORE_SSH} tag=${BAKED_TAG}?" || exit 1

export ELITEEW_MAINTENANCE_ENABLED="${DO_MAINTENANCE}"
export ELITEEW_MAINTENANCE_SOURCE="stack0-baked-deploy"
export ELITEEW_MAINTENANCE_WINDOW_ID="deploy-${BAKED_TAG}"

# Publish warning ASAP so bake/export overlap the user lead time (not an idle pad after export).
eliteew_maintenance_publish_warning_if_enabled

dewa_ops_require_podman
if [[ "${SKIP_FRONTEND_BUILD}" -eq 0 ]]; then
  dewa_ops_require_pnpm
fi

_api_base="$(dewa_ops_load_env_var STACK0_API_IMAGE eliteew-api:v3)"
_front_base="$(dewa_ops_load_env_var STACK0_FRONTEND_IMAGE eliteew-frontend-fedora:latest)"
_need_api_base=0
_need_front_base=0
if [[ "${MODE}" == "all" || "${MODE}" == "backend" ]]; then
  if ! dewa_ops_podman_image_exists "${_api_base}"; then
    _need_api_base=1
  fi
fi
if [[ "${MODE}" == "all" || "${MODE}" == "frontend" ]]; then
  if ! dewa_ops_podman_image_exists "${_front_base}"; then
    _need_front_base=1
  fi
fi
if [[ "${_need_api_base}" -eq 1 || "${_need_front_base}" -eq 1 ]]; then
  if [[ "${SKIP_BASE}" -eq 1 ]]; then
    echo "WARN: base images missing locally — enabling --rebuild-base"
    echo "      api base: ${_api_base} (need=${_need_api_base})"
    echo "      frontend base: ${_front_base} (need=${_need_front_base})"
    SKIP_BASE=0
  fi
fi

# Thin bake does not reinstall Python deps. If api.lock moved (or base lacks greenlet),
# force --rebuild-base so prod never ships a venv without SQLAlchemy asyncio support.
if [[ "${SKIP_BASE}" -eq 1 && "${SKIP_BUILD}" -eq 0 && ( "${MODE}" == "all" || "${MODE}" == "backend" ) ]]; then
  if dewa_ops_podman_image_exists "${_api_base}"; then
    stack0_backend_collect_build_metadata
    _base_lock="$(stack0_backend_image_build_lock_hash "${_api_base}" || true)"
    _force_base=0
    if [[ -z "${_base_lock}" || "${_base_lock}" == "unknown" ]]; then
      echo "WARN: ${_api_base} has no BUILD_LOCK_HASH — enabling --rebuild-base (stamp required)"
      _force_base=1
    elif [[ "${_base_lock}" != "${BUILD_LOCK_HASH}" ]]; then
      echo "WARN: ${_api_base} BUILD_LOCK_HASH drift — enabling --rebuild-base"
      echo "      base=${_base_lock}"
      echo "      tree=${BUILD_LOCK_HASH}"
      _force_base=1
    fi
    if stack0_backend_base_missing_asyncio_deps "${_api_base}"; then
      echo "WARN: ${_api_base} missing greenlet/sqlalchemy.asyncio — enabling --rebuild-base"
      _force_base=1
    fi
    if [[ "${_force_base}" -eq 1 ]]; then
      SKIP_BASE=0
    fi
  fi
fi

export STACK0_PROD_BAKED_TAG="${BAKED_TAG}"
export STACK0_PROD_BAKED_ONLY="${MODE}"
export STACK0_PROD_BAKED_EXPORT_ONLY="${MODE}"
export STACK0_PROD_BAKED_SKIP_BASE_IMAGES="${SKIP_BASE}"
export STACK0_PROD_BAKED_SKIP_FRONTEND_BUILD="${SKIP_FRONTEND_BUILD}"
export STACK0_PROD_BAKED_REFRESH_OPENAPI_PILOTS="${REFRESH_OPENAPI_PILOTS}"
export STACK0_PROD_BAKED_REMOTE_DIR="${DEWA_OPS_REMOTE_REPO}/docker/tmp/prod-baked-images"
export STACK0_BUILD_NO_CACHE="${BUILD_NO_CACHE}"

echo "=== Step 1/4: build thin prod-baked layers (command-center) ==="
if [[ "${BUILD_NO_CACHE}" -eq 1 ]]; then
  echo ">>> STACK0_BUILD_NO_CACHE=1 (base + thin layers without build cache)"
fi
if [[ "${SKIP_BUILD}" -eq 1 ]]; then
  echo ">>> SKIP build (--skip-build); expecting images tagged ${BAKED_TAG}"
else
  run_cmd bash "${DEWA_OPS_REPO_ROOT}/docker/scripts/build-stack0-prod-baked-images.sh"
fi

echo "=== Step 1b/4: base parity check (.136 vs .111) ==="
if dewa_ops_is_dry_run; then
  dewa_ops_log_dry_run "verify_base_parity mode=${MODE} strict=${ENFORCE_BASE_MATCH}"
else
  verify_base_parity "${MODE}" "${ENFORCE_BASE_MATCH}"
fi

if [[ -f "${DEWA_OPS_FRONTEND_DIR}/dist-build/app-build-version.txt" ]]; then
  EXPECTED_DEPLOY_ID="$(tr -d '\n\r' <"${DEWA_OPS_FRONTEND_DIR}/dist-build/app-build-version.txt")"
  echo "deploy id in dist-build: ${EXPECTED_DEPLOY_ID}"
fi

echo "=== Step 2/4: export images → ${DEWA_OPS_PROD_CORE_SSH} ==="
run_cmd bash "${DEWA_OPS_REPO_ROOT}/docker/scripts/export-stack0-prod-baked-images.sh" \
  "${DEWA_OPS_PROD_CORE_SSH}" "${BAKED_TAG}"

if [[ "${SKIP_ENV_PUSH}" -eq 0 ]]; then
  echo "=== Step 2c/4: push env bundle → ${DEWA_OPS_PROD_CORE_SSH} ==="
  run_cmd bash "${DEWA_OPS_REPO_ROOT}/docker/scripts/eliteew-prod-core-env-push.sh" --yes
else
  echo ">>> SKIP env push (--skip-env-push)"
fi

echo "=== Step 2d/4: sync deploy scripts → ${DEWA_OPS_PROD_CORE_SSH} ==="
if dewa_ops_is_dry_run; then
  dewa_ops_log_dry_run "sync-prod-core-deploy-tree ${DEWA_OPS_REMOTE_REPO}"
else
  run_cmd bash "${DEWA_OPS_REPO_ROOT}/docker/scripts/sync-prod-core-deploy-tree.sh" \
    "${DEWA_OPS_PROD_CORE_SSH}" "${DEWA_OPS_REMOTE_REPO}"
fi

# Only wait remaining time until advertised starts_at (0 if bake/export already ate the lead time).
eliteew_maintenance_wait_until_starts_if_enabled

echo "=== Step 3/4: patch env + recreate on prod-core ==="
eliteew_maintenance_phase_if_enabled "active"
if dewa_ops_is_dry_run; then
  dewa_ops_log_dry_run "ssh patch env + recreate mode=${MODE} snapshot=${ROLLBACK_SNAPSHOT_PATH}"
else
  ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s \
    "${DEWA_OPS_REMOTE_REPO}" "${BAKED_TAG}" "${MODE}" "${ROLLBACK_SNAPSHOT_PATH}" <<'REMOTE'
set -euo pipefail
REPO="$1"
TAG="$2"
MODE="$3"
ROLLBACK_SNAPSHOT_PATH="${4:-}"
cd "${REPO}"
# shellcheck source=prod-core-deploy-lib.sh
source docker/scripts/prod-core-deploy-lib.sh
export PROD_CORE_DEPLOY_REPO_ROOT="${REPO}"
ENV_FILE="$(prod_core_deploy_env_file "${REPO}" .env.stack0.backend)"
mkdir -p "$(dirname "${ROLLBACK_SNAPSHOT_PATH}")"
cp -f "${ENV_FILE}" "${ROLLBACK_SNAPSHOT_PATH}"
echo ">>> rollback snapshot saved: ${ROLLBACK_SNAPSHOT_PATH}"

case "${MODE}" in
  all)
    prod_core_deploy_patch_baked_env "${ENV_FILE}" "${TAG}"
    prod_core_deploy_recreate_stack0_baked "${REPO}"
    ;;
  backend)
    prod_core_deploy_patch_baked_env_backend_only "${ENV_FILE}" "${TAG}"
    prod_core_deploy_recreate_stack0_backend_baked "${REPO}"
    ;;
  frontend)
    prod_core_deploy_patch_baked_env_frontend_only "${ENV_FILE}" "${TAG}"
    prod_core_deploy_recreate_stack0_frontend_baked "${REPO}"
    ;;
  *)
    echo "ERROR: unknown mode ${MODE}" >&2
    exit 1
    ;;
esac
if [[ "${MODE}" == "all" || "${MODE}" == "backend" ]]; then
  echo ">>> post-recreate: refresh baked frontend nginx resolver/upstream"
  bash docker/scripts/fix-prod-core-baked-frontend-nginx.sh
fi
if [[ "${ELITEEW_PODMAN_EGRESS_ENFORCE:-1}" != "0" ]]; then
  echo ">>> post-recreate: re-apply Podman egress policy"
  if [[ -x "${HOME}/bin/eliteew-podman-egress-lock.sh" ]]; then
    bash "${HOME}/bin/eliteew-podman-egress-lock.sh" --apply || echo "WARN: egress apply failed" >&2
  else
    echo "WARN: ${HOME}/bin/eliteew-podman-egress-lock.sh missing — run eliteew-podman-egress.sh install" >&2
  fi
fi
REMOTE
fi

eliteew_maintenance_phase_if_enabled "recovering"

echo "=== Step 4/4: smoke ==="
if dewa_ops_is_dry_run; then
  dewa_ops_log_dry_run "smoke prod-core"
  exit 0
fi

smoke_failed=0
if ! ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s "${DEWA_OPS_REMOTE_REPO}" "${MODE}" "${EXPECTED_DEPLOY_ID}" <<'REMOTE'
set -euo pipefail
REPO="$1"
MODE="$2"
EXPECTED_DEPLOY_ID="${3:-}"
cd "${REPO}"
source docker/scripts/prod-core-deploy-lib.sh
export PROD_CORE_DEPLOY_REPO_ROOT="${REPO}"

if [[ "${MODE}" == "all" || "${MODE}" == "backend" ]]; then
  if ! prod_core_deploy_wait_api_baked; then
    echo "WARN: API boot slow — retry wait in 30s" >&2
    sleep 30
    prod_core_deploy_wait_api_baked || echo "WARN: API still booting — smoke will retry" >&2
  fi
fi

if [[ "${MODE}" == "all" ]]; then
  if ! prod_core_deploy_smoke_stack0; then
    sleep 30
    prod_core_deploy_wait_api_baked || true
    prod_core_deploy_smoke_stack0 || exit 1
  fi
  if ! prod_core_deploy_smoke_stack0_contract; then
    sleep 10
    prod_core_deploy_wait_api_baked || true
    prod_core_deploy_smoke_stack0_contract || exit 1
  fi
  if [[ -n "${EXPECTED_DEPLOY_ID}" ]]; then
    nginx_id="$(curl -sf http://127.0.0.1:29001/app-build-version.txt | tr -d '\n\r' || true)"
    if [[ "${nginx_id}" != "${EXPECTED_DEPLOY_ID}" ]]; then
      echo "ERROR: nginx deploy id ${nginx_id} != expected ${EXPECTED_DEPLOY_ID}" >&2
      exit 1
    fi
    echo "✅ nginx deploy id: ${nginx_id}"
  fi
elif [[ "${MODE}" == "frontend" ]]; then
  curl -sf http://127.0.0.1:29001/ >/dev/null || { echo "ERROR: frontend :29001 failed" >&2; exit 1; }
  nginx_id="$(curl -sf http://127.0.0.1:29001/app-build-version.txt | tr -d '\n\r' || true)"
  if [[ -z "${nginx_id}" ]]; then
    echo "ERROR: nginx app-build-version.txt empty" >&2
    exit 1
  fi
  if [[ -n "${EXPECTED_DEPLOY_ID}" && "${nginx_id}" != "${EXPECTED_DEPLOY_ID}" ]]; then
    echo "ERROR: nginx deploy id ${nginx_id} != expected ${EXPECTED_DEPLOY_ID}" >&2
    exit 1
  fi
  echo "✅ frontend ok deploy id=${nginx_id}"
  echo "NOTE: API may still report old deploy id until --all or --backend-only with same dist-build"
elif [[ "${MODE}" == "backend" ]]; then
  prod_core_deploy_wait_api_baked || exit 1
  curl -sf http://127.0.0.1:29000/api/health >/dev/null || { echo "ERROR: API health failed" >&2; exit 1; }
  api_id="$(podman exec stack0-eliteew-api-prod-baked cat /app/frontend-dist/app-build-version.txt 2>/dev/null | tr -d '\n\r' || true)"
  echo "✅ API health ok embedded deploy id=${api_id}"
  if ! prod_core_deploy_smoke_stack0_contract; then
    sleep 10
    prod_core_deploy_wait_api_baked || true
    prod_core_deploy_smoke_stack0_contract || exit 1
  fi
fi
REMOTE
then
  smoke_failed=1
fi

if [[ "${smoke_failed}" -eq 0 && ( "${MODE}" == "all" || "${MODE}" == "backend" ) ]]; then
  echo "=== Step 4d/4: external user-path gate (command-center → public edge) ==="
  if ! prod_core_deploy_verify_public_user_path; then
    echo "ERROR: public user-path gate failed (edge unreachable or Socket.IO handshake broken)" >&2
    smoke_failed=1
  fi
  if ! ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s "${DEWA_OPS_REMOTE_REPO}" <<'REMOTE'
set -euo pipefail
REPO="$1"
cd "${REPO}"
# shellcheck source=prod-core-deploy-lib.sh
source docker/scripts/prod-core-deploy-lib.sh
export PROD_CORE_DEPLOY_REPO_ROOT="${REPO}"
prod_core_deploy_verify_single_upstream
REMOTE
  then
    echo "ERROR: single-upstream user-path gate failed (DNS split-brain on prod-core)" >&2
    smoke_failed=1
  fi
fi

if [[ "${smoke_failed}" -ne 0 ]]; then
  if [[ "${ROLLBACK_ON_SMOKE_FAIL}" -eq 1 ]]; then
    echo "WARN: post-deploy smoke failed; attempting rollback from snapshot"
    if ! ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s "${DEWA_OPS_REMOTE_REPO}" "${MODE}" "${ROLLBACK_SNAPSHOT_PATH}" <<'REMOTE'
set -euo pipefail
REPO="$1"
MODE="$2"
ROLLBACK_SNAPSHOT_PATH="$3"
cd "${REPO}"
# shellcheck source=prod-core-deploy-lib.sh
source docker/scripts/prod-core-deploy-lib.sh
export PROD_CORE_DEPLOY_REPO_ROOT="${REPO}"
ENV_FILE="$(prod_core_deploy_env_file "${REPO}" .env.stack0.backend)"
if [[ ! -f "${ROLLBACK_SNAPSHOT_PATH}" ]]; then
  echo "ERROR: rollback snapshot missing: ${ROLLBACK_SNAPSHOT_PATH}" >&2
  exit 1
fi
cp -f "${ROLLBACK_SNAPSHOT_PATH}" "${ENV_FILE}"
echo ">>> rollback env restored from ${ROLLBACK_SNAPSHOT_PATH}"
case "${MODE}" in
  all)
    prod_core_deploy_recreate_stack0_baked "${REPO}"
    ;;
  backend)
    prod_core_deploy_recreate_stack0_backend_baked "${REPO}"
    ;;
  frontend)
    prod_core_deploy_recreate_stack0_frontend_baked "${REPO}"
    ;;
  *)
    echo "ERROR: unknown mode ${MODE} for rollback" >&2
    exit 1
    ;;
esac
if [[ "${MODE}" == "all" || "${MODE}" == "backend" ]]; then
  prod_core_deploy_wait_api_baked || true
fi
if ! prod_core_deploy_smoke_stack0; then
  sleep 20
  prod_core_deploy_wait_api_baked || true
  prod_core_deploy_smoke_stack0 || exit 1
fi
if [[ "${MODE}" == "all" || "${MODE}" == "backend" ]]; then
  if ! prod_core_deploy_smoke_stack0_contract; then
    sleep 10
    prod_core_deploy_wait_api_baked || true
    prod_core_deploy_smoke_stack0_contract || exit 1
  fi
fi
echo "✅ rollback complete"
REMOTE
    then
      echo "ERROR: rollback attempt failed; manual recovery required." >&2
    fi
  else
    echo "WARN: rollback disabled (--no-rollback); leaving failed deploy state for investigation." >&2
  fi
  eliteew_maintenance_complete_if_enabled
  exit 1
fi

eliteew_maintenance_complete_if_enabled

if [[ "${CLEANUP_OLD_IMAGES}" -eq 1 ]]; then
  echo "=== Step 4b/4: cleanup old prod-baked images (retain=${RETAIN_BAKED_IMAGES}) ==="
  if dewa_ops_is_dry_run; then
    dewa_ops_log_dry_run "cleanup_old_prod_baked_images retain=${RETAIN_BAKED_IMAGES}"
  else
    cleanup_old_prod_baked_images "${RETAIN_BAKED_IMAGES}"
  fi
else
  echo ">>> SKIP image cleanup (--no-image-cleanup)"
fi

echo ""
echo "✅ prod-core baked deploy complete"
echo "   mode: ${MODE}"
echo "   tag:  ${BAKED_TAG}"
if [[ -n "${EXPECTED_DEPLOY_ID}" ]]; then
  echo "   deploy id: ${EXPECTED_DEPLOY_ID}"
fi
echo "   verify: curl -sf https://app.eliteew.ru/api/health"
echo "   verify: bash docker/scripts/verify-stack0-user-path-gate.sh --all"
echo "   verify: bash docker/scripts/deploy-provenance-verify.sh --live --strict"
if ! dewa_ops_is_dry_run; then
  if [[ "${SKIP_DEPLOY_PROVENANCE_VERIFY:-0}" != "1" ]]; then
    echo "=== Step 5/5: deploy provenance verify ==="
    bash "${DEWA_OPS_REPO_ROOT}/docker/scripts/deploy-provenance-verify.sh" --live --strict
  fi
  export PROD_LINE_EXPORT_ROOT PROD_LINE_MOUNT PROD_LINE_MANIFEST_FILE
  prod_line_write_state baked || true
  echo "=== Step 5b/5: sync STACK0 bake keys → staging (Config Plane) ==="
  # shellcheck source=prod-core-env-lib.sh
  source "${DEWA_OPS_REPO_ROOT}/docker/scripts/prod-core-env-lib.sh"
  prod_core_env_sync_stack0_bake_keys_to_staging "${DEWA_OPS_REPO_ROOT}" "${BAKED_TAG}" || true
fi
