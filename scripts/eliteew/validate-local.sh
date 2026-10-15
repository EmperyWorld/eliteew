#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# CI-parity local validation for EliteEW (frontend check:release + backend ruff + pytest).
# Invariants:
# - Single execution pass; must not re-exec itself.
# Related:
# - .github/workflows/eliteew-pr-gate.yml
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND="${ROOT}/shared/web/frontend"
API="${ROOT}/shared/api"

RUN_FRONTEND=1
RUN_BACKEND=1

usage() {
  cat <<'EOF'
Usage: bash scripts/eliteew/validate-local.sh [options]

CI-parity gate (mirrors eliteew-pr-gate workflow):
  - Frontend: pnpm run check:release
  - Backend:  uv run ruff check + pytest -m "not slow and not integration"

Options:
  --frontend-only   Skip backend checks.
  --backend-only    Skip frontend checks.
  -h, --help        Show this help.

Environment:
  ELITEEW_VALIDATE_INTEGRATION=1   Include integration pytest marker.
  ELITEEW_VALIDATE_FULL=1          Run full pytest suite (no marker filter).
  ELITEEW_SCAN_DIST=1              Force frontend dist secret scan even if empty.
EOF
}

log() {
  printf '[validate-local] %s\n' "$*"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --frontend-only)
      RUN_BACKEND=0
      shift
      ;;
    --backend-only)
      RUN_FRONTEND=0
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

if [[ ! -d "$FRONTEND" || ! -d "$API" ]]; then
  echo "validate-local: expected EliteEW frontend/api under ${ROOT}" >&2
  exit 1
fi

log "EliteEW CI-parity validation (single pass)"

if [[ "$RUN_FRONTEND" -eq 1 ]]; then
  log "frontend: pnpm run check:release"
  (cd "$FRONTEND" && pnpm run check:release)
fi

if [[ "$RUN_BACKEND" -eq 1 ]]; then
  log "backend: ruff check"
  (cd "$API" && uv run ruff check .)
  log "backend: pytest"
  if [[ "${ELITEEW_VALIDATE_FULL:-}" == "1" ]]; then
    (cd "$API" && uv run pytest tests -q --tb=line)
  elif [[ "${ELITEEW_VALIDATE_INTEGRATION:-}" == "1" ]]; then
    (cd "$API" && uv run pytest tests -q --tb=line -m "not slow")
  else
    (cd "$API" && uv run pytest tests -q --tb=line -m "not slow and not integration")
  fi
fi

DIST_ASSETS="${FRONTEND}/dist-build/assets"
if [[ "$RUN_FRONTEND" -eq 1 ]] && { [[ -d "${DIST_ASSETS}" ]] || [[ "${ELITEEW_SCAN_DIST:-}" == "1" ]]; }; then
  log "frontend: scan-frontend-dist-secrets"
  bash "${ROOT}/scripts/eliteew/scan-frontend-dist-secrets.sh"
fi

log "PASSED"
