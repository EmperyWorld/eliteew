#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unified local/CI quality chain: Architecture Guard → U3 decision_engine guard → Ruff → Biome.
# Invariants:
# - Stops on first failure; does not modify application code.
# - sys.path Check 3: door domains `desktop_client` / `mobile_android` (legacy dewa/ewgen ids retained)
# Related:
# - tools/architecture_guard/guard.py, scripts/eliteew/u3-agentic-decision-engine-import-guard.sh
# - .github/workflows/eliteew-pr-gate.yml
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${ROOT}/tools/architecture_guard/guard.py"
U3_DE_GUARD="${ROOT}/scripts/eliteew/u3-agentic-decision-engine-import-guard.sh"
API_DIR="${ROOT}/shared/api"
FE_DIR="${ROOT}/shared/web/frontend"

SKIP_ARCH=0
GUARD_BASE="${CHECK_ALL_BASE:-HEAD^}"
GUARD_HEAD="${CHECK_ALL_HEAD:-HEAD}"

usage() {
  cat <<EOF
Usage: bash tools/check_all.sh [options]

Runs in order:
  1. Architecture Guard (domain_matrix.json)
  2. U3 decision_engine import guard (no state_machine / fsm_port)
  3. Ruff check (shared/api)
  4. Biome check (shared/web/frontend/src)

Options:
  --skip-architecture   Skip step 1 (CI hygiene job after architecture-integrity-check)
  --base REF            Git base for Architecture Guard (default: HEAD^ or CHECK_ALL_BASE)
  --head REF            Git head for Architecture Guard (default: HEAD or CHECK_ALL_HEAD)
  -h, --help            Show this help

Environment:
  CHECK_ALL_BASE, CHECK_ALL_HEAD  Override default git refs for guard
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-architecture)
      SKIP_ARCH=1
      shift
      ;;
    --base)
      GUARD_BASE="${2:?--base requires a ref}"
      shift 2
      ;;
    --head)
      GUARD_HEAD="${2:?--head requires a ref}"
      shift 2
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

step() {
  echo ""
  echo "== check_all: $1 =="
}

if [[ "${SKIP_ARCH}" -eq 0 ]]; then
  step "Architecture Guard (${GUARD_BASE}..${GUARD_HEAD})"
  python3 "${GUARD}" --repo "${ROOT}" --base "${GUARD_BASE}" --head "${GUARD_HEAD}"
fi

step "U3 decision_engine import guard"
bash "${U3_DE_GUARD}"

step "Ruff (shared/api)"
if ! command -v uv >/dev/null 2>&1; then
  echo "ERROR: uv not found — install uv or run from command-center venv." >&2
  exit 1
fi
(
  cd "${API_DIR}"
  uv run ruff check .
)

step "Biome (shared/web/frontend)"
if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm not found — install pnpm for frontend Biome gate." >&2
  exit 1
fi
(
  cd "${FE_DIR}"
  pnpm exec biome check src/ --formatter-enabled=false
)

echo ""
echo "check_all: Architecture Integrity → Code Hygiene — OK"
