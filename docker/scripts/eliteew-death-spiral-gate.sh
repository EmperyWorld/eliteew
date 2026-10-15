#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Release Gate 0 — death-spiral regression harness (API circuit/act-binding + FE companion/auth/shell).
# Invariants:
# - Prefer run-stack0-api-tests.sh (immutable container); host pytest only if wrapper unavailable.
# - Narrow Vitest paths only — never full frontend suite.
# Related:
# - documentation/product/ewa/EWA-DEATH-SPIRAL-REGRESSION-GATE.md
# - documentation/product/ewa/EWA-COMPANION-STABILITY-PERF-CONTRACT.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

API_K_FILTER='death_spiral or Reasoning_Loop or act_only or replanning_circuit or act_binding'
API_WRAPPER="${REPO_ROOT}/docker/scripts/run-stack0-api-tests.sh"
FE_ROOT="${REPO_ROOT}/shared/web/frontend"

echo "[eliteew-death-spiral-gate] API slice (-k '${API_K_FILTER}')"
if [[ -x "${API_WRAPPER}" ]] || [[ -f "${API_WRAPPER}" ]]; then
  if bash "${API_WRAPPER}" tests/ -k "${API_K_FILTER}" -q --tb=short; then
    echo "[eliteew-death-spiral-gate] API: container wrapper OK"
  else
    api_rc=$?
    echo "[eliteew-death-spiral-gate] WARN: container wrapper failed (rc=${api_rc}); trying host pytest" >&2
    export PYTHONPATH="${REPO_ROOT}/EliteEW${PYTHONPATH:+:${PYTHONPATH}}"
    cd "${REPO_ROOT}/shared/api"
    if [[ -x "${REPO_ROOT}/.venv/bin/python" ]]; then
      "${REPO_ROOT}/.venv/bin/python" -m pytest tests/ -k "${API_K_FILTER}" -q --tb=short
    else
      python3 -m pytest tests/ -k "${API_K_FILTER}" -q --tb=short
    fi
    cd "${REPO_ROOT}"
  fi
else
  echo "[eliteew-death-spiral-gate] WARN: wrapper missing; host pytest" >&2
  export PYTHONPATH="${REPO_ROOT}/EliteEW${PYTHONPATH:+:${PYTHONPATH}}"
  cd "${REPO_ROOT}/shared/api"
  if [[ -x "${REPO_ROOT}/.venv/bin/python" ]]; then
    "${REPO_ROOT}/.venv/bin/python" -m pytest tests/ -k "${API_K_FILTER}" -q --tb=short
  else
    python3 -m pytest tests/ -k "${API_K_FILTER}" -q --tb=short
  fi
  cd "${REPO_ROOT}"
fi

echo "[eliteew-death-spiral-gate] FE Vitest (companion + auth + shell)"
cd "${FE_ROOT}"
pnpm exec vitest run \
  src/services/ewa/__tests__/companionPlansFeatureProbe.test.ts \
  src/features/ewa/companionUx/__tests__/useCompanionLeftRailController.test.ts \
  src/features/ewa/companionOperations/__tests__/useCompanionTaskEventsStream.test.ts \
  src/services/auth/__tests__/authSessionDeathSpiral.test.ts \
  src/pages/Desktop/utils/__tests__/desktopShellStateFollowerInvalidate.test.ts \
  src/pages/Desktop/utils/__tests__/desktopShellStateMutationPipeline.test.ts
cd "${REPO_ROOT}"

echo "[eliteew-death-spiral-gate] PASS"
