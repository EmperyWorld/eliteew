#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Immutable-build gate: fail closed on dirty tracked tree for release; tiered hotfix override.
# Invariants:
# - Exit ${DEPLOY_PROVENANCE_GATE_EXIT} (42) on hard gate failure.
# - OpenAPI pilot/generated leftovers alone WARN-pass (after --refresh-openapi-pilots).
# - Set SKIP_DEPLOY_PROVENANCE_GATE=1 to bypass (emergency only, logged).
# Related:
# - docker/scripts/deploy-provenance-lib.sh
# - documentation/platform/audit/STANDARDIZATION-ADR.md
# - documentation/api/FRONTEND-BACKEND-HTTP.md (§Bake-time)
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy-provenance-lib.sh
source "${SCRIPT_DIR}/deploy-provenance-lib.sh"

TIER=""
ACK_DIRTY=0
DRY_RUN=0

usage() {
  cat <<EOF
Usage: $(basename "$0") --release | --hotfix [options]

Enforce git cleanliness before production build/sync/deploy.

Tiers:
  --release          Hard fail if monorepo has uncommitted tracked changes (Line A rebake)
  --hotfix           Allow dirty tree only with --acknowledge-dirty (Line B sync)

Options:
  --acknowledge-dirty  Record dirty state and continue (hotfix tier only)
  --dry-run            Print verdict without exiting non-zero
  -h, --help

OpenAPI regen leftovers (non-blocking WARN):
  shared/web/frontend/openapi/pilot/**
  shared/web/frontend/src/generated/*-openapi.ts
  (expected after --refresh-openapi-pilots; still commit when ready)

Bypass (emergency):
  SKIP_DEPLOY_PROVENANCE_GATE=1

Exit code ${DEPLOY_PROVENANCE_GATE_EXIT} on gate failure.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release) TIER="release" ;;
    --hotfix) TIER="hotfix" ;;
    --acknowledge-dirty) ACK_DIRTY=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if [[ -z "${TIER}" ]]; then
  echo "ERROR: specify --release or --hotfix" >&2
  usage >&2
  exit 2
fi

if [[ "${SKIP_DEPLOY_PROVENANCE_GATE:-0}" == "1" ]]; then
  echo "WARN: SKIP_DEPLOY_PROVENANCE_GATE=1 — provenance gate bypassed" >&2
  exit 0
fi

REPO="$(deploy_provenance_repo_root)"
DIRTY=0
OPENAPI_REGEN_DIRTY=0
if deploy_provenance_is_dirty_source "${REPO}"; then
  DIRTY=1
fi
if deploy_provenance_is_dirty_openapi_regen "${REPO}"; then
  OPENAPI_REGEN_DIRTY=1
fi

EWGEN_DIRTY=0
if python3 -c "import json,sys; d=json.loads(sys.argv[1]); sys.exit(0 if d.get('dirty') else 1)" \
  "$(deploy_provenance_ewgen_state_json "${REPO}")" 2>/dev/null; then
  EWGEN_DIRTY=1
fi

GATE_OK=1

fail_gate() {
  local msg="$1"
  GATE_OK=0
  echo "ERROR: [DEPLOY PROVENANCE GATE] ${msg}" >&2
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo ">>> dry-run: would exit ${DEPLOY_PROVENANCE_GATE_EXIT}" >&2
    return 0
  fi
  exit "${DEPLOY_PROVENANCE_GATE_EXIT}"
}

if [[ "${EWGEN_DIRTY}" == "1" && "${TIER}" == "release" ]]; then
  echo "WARN: EWGen nested repo has uncommitted tracked changes (not blocking stack0 release)" >&2
fi

if [[ "${OPENAPI_REGEN_DIRTY}" == "1" ]]; then
  echo "WARN: OpenAPI pilot/generated leftovers (non-blocking after --refresh-openapi-pilots):" >&2
  deploy_provenance_dirty_openapi_regen_files "${REPO}" | head -30 >&2
  echo "WARN: commit openapi/pilot + src/generated/*-openapi.ts when ready (gate allows release)" >&2
fi

if [[ "${DIRTY}" == "1" ]]; then
  echo ">>> dirty blocking source-path files:" >&2
  deploy_provenance_dirty_blocking_source_files "${REPO}" | head -30 >&2
  if [[ "${TIER}" == "release" ]]; then
    fail_gate "release build requires clean deploy source paths (commit or stash first)"
  elif [[ "${ACK_DIRTY}" != "1" ]]; then
    fail_gate "hotfix sync on dirty source paths requires --acknowledge-dirty"
  else
    echo "WARN: hotfix proceeding with dirty deploy source paths (--acknowledge-dirty)" >&2
  fi
fi

if [[ "${GATE_OK}" == "1" ]]; then
  echo "✅ deploy provenance gate passed (tier=${TIER} dirty=${DIRTY} openapi_regen_dirty=${OPENAPI_REGEN_DIRTY} ewgen_dirty=${EWGEN_DIRTY})"
  exit 0
fi

if [[ "${DRY_RUN}" == "1" ]]; then
  echo ">>> dry-run: gate would fail (exit ${DEPLOY_PROVENANCE_GATE_EXIT})" >&2
fi
exit "${DEPLOY_PROVENANCE_GATE_EXIT}"
