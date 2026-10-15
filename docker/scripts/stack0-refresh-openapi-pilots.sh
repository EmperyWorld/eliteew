#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Bake-time OpenAPI pilot refresh from the **current monorepo API tree** (not live
# prod-core schema). Export → extract-pilots → openapi:pilots:lite → freshness.
# Invariants:
# - Runs on command-center only; never builds on prod-core.
# - Must run **after** deploy-provenance-gate (may dirty pilot/generated paths).
# - Must run **before** pnpm build:react-compiler so SPA ships matching types.
# - Does not commit; operator commits refreshed pilots after bake when desired.
# Related:
# - docker/scripts/eliteew-stack0-baked-deploy.sh (--refresh-openapi-pilots)
# - docker/scripts/build-stack0-prod-baked-images.sh
# - documentation/api/FRONTEND-BACKEND-HTTP.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
FRONTEND_DIR="${REPO_ROOT}/shared/web/frontend"
STAGING_ENV="${REPO_ROOT}/docker/env_file/.env.stack0.backend"
DEFAULTS_ENV="${SCRIPT_DIR}/openapi-export.env.defaults"
OUT_REL="documentation/api/eliteew-openapi-export.json"
OUT_ABS="${REPO_ROOT}/${OUT_REL}"
MERGED_ENV="$(mktemp "${TMPDIR:-/tmp}/eliteew-openapi-export-env.XXXXXX")"
EXPORT_TMP="$(mktemp "${TMPDIR:-/tmp}/eliteew-openapi-export.XXXXXX.json")"

cleanup() {
  rm -f "${MERGED_ENV}" "${EXPORT_TMP}"
}
trap cleanup EXIT

usage() {
  cat <<EOF
Usage: $(basename "$0") [--dry-run]

Export OpenAPI from the current shared/api tree, then refresh lite pilots +
generated TypeScript under shared/web/frontend.

Environment:
  OPENAPI_EXPORT              Override export JSON path (default: ${OUT_REL})
  STACK0_OPENAPI_EXPORT_PYTHON  Host python for export (default: .venv)
EOF
}

DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
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

if [[ -n "${OPENAPI_EXPORT:-}" ]]; then
  if [[ "${OPENAPI_EXPORT}" = /* ]]; then
    OUT_ABS="${OPENAPI_EXPORT}"
  else
    OUT_ABS="${REPO_ROOT}/${OPENAPI_EXPORT}"
  fi
fi

echo "=== stack0 refresh OpenAPI pilots (tree export → extract → lite TS) ==="
echo "repo   : ${REPO_ROOT}"
echo "export : ${OUT_ABS}"
echo "staging: ${STAGING_ENV}"

if [[ ! -f "${DEFAULTS_ENV}" ]]; then
  echo "ERROR: missing defaults env ${DEFAULTS_ENV}" >&2
  exit 1
fi
if [[ ! -f "${STAGING_ENV}" ]]; then
  echo "ERROR: missing staging env ${STAGING_ENV}" >&2
  exit 1
fi
if [[ ! -d "${FRONTEND_DIR}" ]]; then
  echo "ERROR: missing frontend dir ${FRONTEND_DIR}" >&2
  exit 1
fi

# defaults first, staging overrides (no secrets in defaults file).
{
  cat "${DEFAULTS_ENV}"
  echo ""
  cat "${STAGING_ENV}"
} >"${MERGED_ENV}"

resolve_python() {
  if [[ -n "${STACK0_OPENAPI_EXPORT_PYTHON:-}" ]]; then
    echo "${STACK0_OPENAPI_EXPORT_PYTHON}"
    return 0
  fi
  local venv_py="${REPO_ROOT}/.venv/bin/python"
  if [[ -x "${venv_py}" ]]; then
    echo "${venv_py}"
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return 0
  fi
  return 1
}

export_openapi_from_tree() {
  local py
  py="$(resolve_python)" || {
    echo "ERROR: no python for OpenAPI export (set STACK0_OPENAPI_EXPORT_PYTHON or .venv)" >&2
    return 1
  }
  echo ">>> OpenAPI export via host python: ${py}"
  # shellcheck disable=SC1090
  set -a
  # shellcheck disable=SC1090,SC1091
  source "${MERGED_ENV}"
  set +a
  (
    cd "${REPO_ROOT}/shared/api"
    PYTHONPATH=.. "${py}" scripts/export_openapi.py "${EXPORT_TMP}"
  )
}

install_export_json() {
  mkdir -p "$(dirname "${OUT_ABS}")"
  if [[ -e "${OUT_ABS}" ]]; then
    bash "${REPO_ROOT}/scripts/eliteew/trash-move.sh" "${OUT_ABS}" >/dev/null
  fi
  mv -f "${EXPORT_TMP}" "${OUT_ABS}"
  EXPORT_TMP="$(mktemp "${TMPDIR:-/tmp}/eliteew-openapi-export.XXXXXX.json")"
  python3 -c "import json,sys; json.load(open(sys.argv[1]))" "${OUT_ABS}"
  echo ">>> wrote ${OUT_ABS} ($(wc -c <"${OUT_ABS}" | tr -d ' ') bytes)"
}

regen_pilots() {
  echo ">>> openapi:extract-pilots + openapi:pilots:lite + check-pilot-freshness"
  (
    cd "${FRONTEND_DIR}"
    export OPENAPI_EXPORT="${OUT_ABS}"
    pnpm run openapi:extract-pilots
    pnpm run openapi:pilots:lite
    pnpm run openapi:check-pilot-freshness
  )
}

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "DRY-RUN: would export OpenAPI from tree, write ${OUT_ABS}, then:"
  echo "  cd shared/web/frontend && OPENAPI_EXPORT=… pnpm run openapi:extract-pilots && openapi:pilots:lite && openapi:check-pilot-freshness"
  exit 0
fi

export_openapi_from_tree
install_export_json
regen_pilots

echo "✅ OpenAPI pilots refreshed from release tree (working tree may be dirty — commit pilots when ready)"
echo "HINT: next SPA build will embed generated types from this refresh"
echo "HINT: leftover dirty under openapi/pilot + src/generated/*-openapi.ts is non-blocking for provenance gate; commit when ready"
