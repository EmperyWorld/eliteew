#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression proof for Architecture Guard — bad fixtures exit 1, good fixtures exit 0.
# Related:
# - tools/architecture_guard/guard.py
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="$ROOT/tools/architecture_guard/guard.py"
FIX="$ROOT/tools/architecture_guard/fixtures"

run_expect_fail() {
  local name="$1"
  shift
  if python3 "$GUARD" "$@"; then
    echo "FAIL: expected exit 1 for $name" >&2
    exit 1
  fi
  echo "OK: $name failed as expected"
}

run_expect_ok() {
  local name="$1"
  shift
  python3 "$GUARD" "$@"
  echo "OK: $name passed"
}

run_expect_fail "bad_cross_domain" \
  validate-file "$FIX/bad_cross_domain.py" \
  --as-path shared/api/routers/desktop_client/evil_plane.py

run_expect_fail "bad_syspath" \
  validate-file "$FIX/bad_syspath.py" \
  --as-path pack-organization/connection-agent/evil_syspath.py

run_expect_ok "good_shared_tools" \
  validate-file "$FIX/good_shared_tools.py" \
  --as-path shared/api/services/i18n_rewrite_plane.py

echo "Architecture Guard regression proof: all scenarios passed."
