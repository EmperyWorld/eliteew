#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# command-center → prod-core: Maven-build Keycloak 26.7.1 binding SPI, bake image, export, recreate stack6.
# Invariants:
# - Never podman/mvn bake on prod-core 192.168.1.111.
# - Default flow is not attached; live login stays on the previous browser flow until enforce.
# Related:
# - docker/builders/stack6-keycloak/Containerfile
# - documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=eliteew-ops-lib.sh
source "${SCRIPT_DIR}/eliteew-ops-lib.sh"

ASSUME_YES=0
BUILD_ONLY=0
SKIP_BUILD=0
SKIP_TESTS=0
TAG=""
IMAGE_NAME="localhost/eliteew-keycloak"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Build Keycloak 26.7.1 + EliteEW binding SPI on command-center, export to prod-core, recreate stack6.

Options:
  --yes              skip confirmation (required for remote recreate)
  --build-only       Maven package + local podman build; do not export or recreate
  --skip-build       export+recreate only (image for tag must exist locally)
  --skip-tests       skip mvn test (not for release)
  --tag TAG          default: prod-stack6-YYYYMMDD-HHMM
  --dry-run
  -h, --help

Canonical CLI:
  bash docker/scripts/eliteew-deploy.sh release stack6 --all
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      ASSUME_YES=1
      shift
      ;;
    --build-only)
      BUILD_ONLY=1
      shift
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=1
      shift
      ;;
    --dry-run)
      export DEWA_DRY_RUN=1
      shift
      ;;
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --all)
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

if [[ "${BUILD_ONLY}" -eq 1 && "${SKIP_BUILD}" -eq 1 ]]; then
  echo "ERROR: --build-only and --skip-build conflict" >&2
  exit 2
fi

if [[ -z "${TAG}" ]]; then
  TAG="prod-stack6-$(date +%Y%m%d-%H%M)"
fi

refuse_prod_core_build() {
  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [[ "${ip}" == "192.168.1.111" ]]; then
    echo "ERROR: refuse stack6 bake on prod-core 192.168.1.111" >&2
    exit 1
  fi
}

ensure_java_home() {
  if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]]; then
    return 0
  fi
  local javac_path
  javac_path="$(command -v javac || true)"
  if [[ -z "${javac_path}" ]]; then
    echo "ERROR: javac is required to build the stack6 binding SPI" >&2
    return 1
  fi
  export JAVA_HOME
  JAVA_HOME="$(dirname "$(dirname "$(readlink -f "${javac_path}")")")"
  [[ -x "${JAVA_HOME}/bin/java" ]] || {
    echo "ERROR: resolved JAVA_HOME is invalid" >&2
    return 1
  }
}

confirm() {
  local msg="$1"
  if dewa_ops_is_dry_run; then
    echo "→ ${msg} (dry-run)"
    return 0
  fi
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

refuse_prod_core_build
dewa_ops_require_podman

PROVIDER_DIR="${DEWA_OPS_REPO_ROOT}/docker/keycloak/providers/eliteew-binding"
JAR="${PROVIDER_DIR}/target/eliteew-binding.jar"
IMAGE="${IMAGE_NAME}:${TAG}"
BUILD_CTX="$(mktemp -d /tmp/eliteew-stack6-bake.XXXXXX)"
cleanup() { rm -rf "${BUILD_CTX}"; }
trap cleanup EXIT

echo "=== stack6 Keycloak 26.7.1 bake ==="
echo "image: ${IMAGE}"
echo "mode: build_only=${BUILD_ONLY} skip_build=${SKIP_BUILD}"

if [[ "${SKIP_BUILD}" -eq 0 ]]; then
  ensure_java_home
  if [[ "${SKIP_TESTS}" -eq 1 ]]; then
    run_cmd mvn -f "${PROVIDER_DIR}/pom.xml" -q -DskipTests package
  else
    run_cmd mvn -f "${PROVIDER_DIR}/pom.xml" -q test package
  fi
  if [[ ! -f "${JAR}" ]]; then
    echo "ERROR: missing ${JAR}" >&2
    exit 1
  fi
  cp -a "${JAR}" "${BUILD_CTX}/eliteew-binding.jar"
  cp -a "${DEWA_OPS_REPO_ROOT}/docker/builders/stack6-keycloak/Containerfile" "${BUILD_CTX}/Containerfile"
  run_cmd podman build -t "${IMAGE}" -f "${BUILD_CTX}/Containerfile" "${BUILD_CTX}"
fi

if [[ "${BUILD_ONLY}" -eq 1 ]]; then
  echo "stack6_bake_build_only_ok image=${IMAGE}"
  exit 0
fi

confirm "Export ${IMAGE} to ${DEWA_OPS_PROD_CORE_SSH} and recreate stack6-keycloak?" || exit 0

REMOTE_DIR="/tmp/eliteew-stack6-${TAG}"
ARCHIVE="${BUILD_CTX}/eliteew-keycloak-${TAG}.tar"
run_cmd podman save -o "${ARCHIVE}" "${IMAGE}"
run_cmd ssh "${DEWA_OPS_PROD_CORE_SSH}" "mkdir -p '${REMOTE_DIR}'"
run_cmd scp "${ARCHIVE}" "${DEWA_OPS_PROD_CORE_SSH}:${REMOTE_DIR}/eliteew-keycloak.tar"
run_cmd rsync -av \
  "${DEWA_OPS_REPO_ROOT}/docker/stack/stack6.yml" \
  "${DEWA_OPS_REPO_ROOT}/docker/stack/stack6.prod-baked.override.yml" \
  "${DEWA_OPS_PROD_CORE_SSH}:${DEWA_OPS_REMOTE_REPO}/docker/stack/"

if dewa_ops_is_dry_run; then
  dewa_ops_log_dry_run "ssh load+recreate stack6 ${IMAGE}"
  exit 0
fi

ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s \
  "${DEWA_OPS_REMOTE_REPO}" "${IMAGE}" "${REMOTE_DIR}" <<'REMOTE'
set -euo pipefail
REPO="$1"
IMAGE="$2"
REMOTE_DIR="$3"
podman load -i "${REMOTE_DIR}/eliteew-keycloak.tar"
ENV_FILE="${REPO}/docker/env_file/.env.stack6"
if [[ -n "${ELITEEW_ENV_RUNTIME_DIR:-}" && -f "${ELITEEW_ENV_RUNTIME_DIR}/.env.stack6" ]]; then
  ENV_FILE="${ELITEEW_ENV_RUNTIME_DIR}/.env.stack6"
elif [[ -n "${XDG_RUNTIME_DIR:-}" && -f "${XDG_RUNTIME_DIR}/eliteew/env-runtime/.env.stack6" ]]; then
  ENV_FILE="${XDG_RUNTIME_DIR}/eliteew/env-runtime/.env.stack6"
fi
python3 - "$ENV_FILE" "$IMAGE" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
image = sys.argv[2]
text = path.read_text(encoding="utf-8") if path.exists() else ""
lines = [ln for ln in text.splitlines() if not ln.startswith("STACK6_KEYCLOAK_IMAGE=")]
lines.append(f"STACK6_KEYCLOAK_IMAGE={image}")
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY
cd "${REPO}"
export STACK6_KEYCLOAK_IMAGE="${IMAGE}"
podman compose -f docker/stack/stack6.yml -f docker/stack/stack6.prod-baked.override.yml \
  --env-file "${ENV_FILE}" up -d --force-recreate --no-build keycloak
echo "stack6_keycloak_recreated image=${IMAGE}"
REMOTE

echo "stack6_bake_release_ok image=${IMAGE}"
echo "Next: bash docker/scripts/stack6-keycloak-smoke.sh"
echo "Do not attach eliteew-desktop-conditional-access-v2 until its exact graph is VERIFIED and ELITEEW_KC_ATOMIC_AUTH_ENFORCE=1"
