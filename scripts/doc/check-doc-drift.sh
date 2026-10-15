#!/usr/bin/env bash
# Lightweight documentation drift checks for active EliteEW canon.
# Run from repo root: bash scripts/doc/check-doc-drift.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=../_lib/repo-root.sh
source "$SCRIPT_DIR/../_lib/repo-root.sh"
ROOT="$(eliteew_repo_root "$SCRIPT_DIR")"
DOC="$ROOT/documentation"
INDEX="$DOC/INDEX.md"
TOPOLOGY="$DOC/platform/PRODUCTION-TOPOLOGY-STATE.md"
LAN_WORKERS="$DOC/platform/docker-re_doc/LAN-WORKERS-141.md"
fail=0

echo "== Doc drift check =="

# 1) INDEX.md count vs repository docs.
actual="$(find "$DOC" -type f -name '*.md' | wc -l | tr -d ' ')"
if [[ -f "$INDEX" ]]; then
  claimed="$(rg -o 'файлов `\.md`:\*\* [0-9]+' "$INDEX" 2>/dev/null | rg -o '[0-9]+' | head -1 || true)"
  if [[ -n "$claimed" && "$claimed" != "$actual" ]]; then
    echo "WARN: INDEX.md claims $claimed files; find reports $actual"
  else
    echo "OK: markdown count $actual (INDEX aligned or no counter)"
  fi
else
  echo "WARN: missing $INDEX"
  fail=1
fi

# 2) Current topology must describe the post-cutover host model.
if [[ ! -f "$TOPOLOGY" ]]; then
  echo "FAIL: missing PRODUCTION-TOPOLOGY-STATE.md"
  fail=1
else
  required_topology=(
    '192.168.1.111'
    'prod-core'
    'prod-baked'
    '192.168.1.136'
    'command-center'
    '192.168.1.141'
    'gpu141'
  )
  for pat in "${required_topology[@]}"; do
    if ! rg -q --fixed-strings "$pat" "$TOPOLOGY"; then
      echo "FAIL: topology missing required marker: $pat"
      fail=1
    fi
  done
  if [[ "$fail" -eq 0 ]]; then
    echo "OK: PRODUCTION-TOPOLOGY-STATE.md has current host markers"
  fi
fi

# 3) LAN-WORKERS must not describe punisher as default prod.
if [[ -f "$LAN_WORKERS" ]]; then
  if rg -q 'Default prod.*prod-core|Current Baseline' "$LAN_WORKERS" && rg -q '192\.168\.1\.111|prod-core' "$LAN_WORKERS"; then
    echo "OK: LAN-WORKERS-141 describes prod-core as current baseline"
  else
    echo "FAIL: LAN-WORKERS-141 missing prod-core current baseline"
    fail=1
  fi
  if rg -q 'Да \(default prod\)|workers default|punisher.*default prod' "$LAN_WORKERS"; then
    echo "FAIL: LAN-WORKERS-141 still implies punisher workers are default prod"
    fail=1
  fi
fi

# 4) Stale terms in active canon (exclude archive and worklog history).
echo "--- Stale term scan (active canon) ---"
stale_patterns=(
  'React 18'
  'eslint'
  'prettier'
  'VictoriaLogs'
  'SearXNG'
)
for pat in "${stale_patterns[@]}"; do
  hits="$(rg -l --glob '*.md' --glob '!documentation/archive/**' --glob '!documentation/worklog/**' "$pat" "$DOC" 2>/dev/null | head -5 || true)"
  if [[ -n "$hits" ]]; then
    echo "INFO: '$pat' mentioned in active docs (review context):"
    echo "$hits" | sed 's/^/  /'
  fi
done

# 5) Active platform docs should not imply .136 is primary public API runtime.
punisher_hits="$(rg 'default prod.*punisher|API.*192\.168\.1\.136.*29000|punisher.*API.*29000' "$DOC/platform"   --glob '*.md'   --glob '!**/archive/**'   --glob '!**/PODMAN-MIGRATION-PLAN.md'   --glob '!**/worklog/**'   2>/dev/null || true)"
if [[ -n "$punisher_hits" ]]; then
  echo "FAIL: active platform docs still imply punisher/.136 as primary API runtime:"
  echo "$punisher_hits" | head -20 | sed 's/^/  /'
  fail=1
else
  echo "OK: no active platform docs imply punisher/.136 primary API runtime"
fi

# 6) Prod-core examples should prefer baked container names unless explicitly legacy.
legacy_prod_hits="$(rg 'stack0-eliteew-api-prod[^-]' "$DOC/platform"   --glob '*.md'   --glob '!**/archive/**'   --glob '!**/PODMAN-MIGRATION-PLAN.md'   2>/dev/null | rg -v 'legacy|Legacy|punisher|dev|\.136|prod-baked|prod-core baked' || true)"
if [[ -n "$legacy_prod_hits" ]]; then
  echo "WARN: active platform docs mention non-baked stack0 API without nearby legacy label:"
  echo "$legacy_prod_hits" | head -20 | sed 's/^/  /'
  if [[ "${ELITEEW_DOC_DRIFT_STRICT:-0}" == "1" ]]; then
    fail=1
  fi
else
  echo "OK: baked/legacy stack0 API references are labelled"
fi

# 7) validate-local path must exist if docs advertise it.
if rg -q 'validate-local\.sh' "$ROOT/.cursorrules" "$ROOT/README.md" "$DOC" 2>/dev/null; then
  if [[ -f "$ROOT/scripts/eliteew/validate-local.sh" ]]; then
    echo "OK: documented validate-local.sh path exists"
  else
    echo "WARN: docs mention validate-local.sh but no known path exists"
    fail=1
  fi
fi

if [[ "$fail" -eq 0 ]]; then
  echo "== Drift check: PASS =="
  exit 0
fi

echo "== Drift check: WARN/FAIL (see above) =="
exit 1
