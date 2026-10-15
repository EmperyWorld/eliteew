#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Read-only deploy chaos scorecard: local git state, EWGen drift, prod-core probe, findings JSON.
# Invariants:
# - Never mutates git or prod-core; safe for CI and DEWA mission logs.
# Related:
# - docker/scripts/deploy-provenance-lib.sh
# - documentation/platform/audit/RUNBOOK-*.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy-provenance-lib.sh
source "${SCRIPT_DIR}/deploy-provenance-lib.sh"
# shellcheck source=eliteew-ops-lib.sh
source "${SCRIPT_DIR}/eliteew-ops-lib.sh"

MODE="stdout"
LIVE=0
OUT_FILE=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Read-only deploy provenance audit (chaos scorecard JSON).

Options:
  --export           alias for stdout JSON (default)
  --live             probe prod-core via SSH (${DEWA_OPS_PROD_CORE_SSH:-prod-core})
  --out FILE         write JSON to FILE instead of stdout
  -h, --help

Examples:
  bash docker/scripts/$(basename "$0") --export
  bash docker/scripts/$(basename "$0") --live --out /tmp/deploy-audit.json
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --export) MODE="stdout" ;;
    --live) LIVE=1 ;;
    --out) OUT_FILE="${2:?}"; shift ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

REPO="$(deploy_provenance_repo_root)"
TMP_LOCAL="$(mktemp)"
trap 'rm -f "${TMP_LOCAL}"' EXIT

deploy_provenance_collect_local_json "${REPO}" audit >"${TMP_LOCAL}"

REMOTE='{"error":"live_probe_skipped"}'
if [[ "${LIVE}" == "1" ]]; then
  REMOTE="$(deploy_provenance_remote_probe_json || echo '{"error":"live_probe_failed"}')"
fi

RESULT="$(deploy_provenance_score_findings "${TMP_LOCAL}" "${REMOTE}")"

if [[ -n "${OUT_FILE}" ]]; then
  mkdir -p "$(dirname "${OUT_FILE}")"
  printf '%s\n' "${RESULT}" >"${OUT_FILE}"
  echo "✅ audit written: ${OUT_FILE}" >&2
else
  printf '%s\n' "${RESULT}"
fi
