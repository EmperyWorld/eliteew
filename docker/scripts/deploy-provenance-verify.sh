#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Verify local git/manifest parity with prod-core runtime (deploy_id, BUILD_GIT_SHA labels).
# Invariants:
# - Read-only; exit non-zero when P0 findings present (--strict).
# Related:
# - docker/scripts/deploy-provenance-audit.sh
# - documentation/platform/audit/RUNBOOK-ORPHAN-ARTIFACT-DETECTION.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy-provenance-lib.sh
source "${SCRIPT_DIR}/deploy-provenance-lib.sh"
# shellcheck source=eliteew-ops-lib.sh
source "${SCRIPT_DIR}/eliteew-ops-lib.sh"

LIVE=0
STRICT=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Compare local HEAD/deploy_id with prod-core runtime provenance.

Options:
  --live             SSH probe ${DEWA_OPS_PROD_CORE_SSH:-prod-core} (required for full verify)
  --strict           exit 1 if any P0 finding
  -h, --help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --live) LIVE=1 ;;
    --strict) STRICT=1 ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

if [[ "${LIVE}" != "1" ]]; then
  echo "ERROR: --live required (no local-only runtime parity)" >&2
  exit 2
fi

TMP="$(mktemp)"
trap 'rm -f "${TMP}"' EXIT

bash "${SCRIPT_DIR}/deploy-provenance-audit.sh" --live >"${TMP}"
echo "--- deploy provenance verify ---"
python3 -m json.tool "${TMP}"

P0="$(python3 - "${TMP}" <<'PY'
import json, sys
from pathlib import Path
data = json.loads(Path(sys.argv[1]).read_text())
p0 = [f for f in data.get("findings", []) if f.get("severity") == "P0"]
print(len(p0))
for f in p0:
    print(f"  P0: {f.get('code')}: {f.get('message')}")
PY
)"

P0_COUNT="$(echo "${P0}" | head -1)"
if [[ "${P0_COUNT}" != "0" ]]; then
  echo "ERROR: ${P0_COUNT} P0 finding(s)" >&2
  echo "${P0}" | tail -n +2 >&2
  if [[ "${STRICT}" == "1" ]]; then
    exit 1
  fi
else
  echo "✅ no P0 provenance drift detected"
fi
