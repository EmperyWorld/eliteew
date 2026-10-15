#!/usr/bin/env bash
# Smoke-test zero-trust pre-commit helpers (no real commit).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); printf '  [OK] %s\n' "$1"; }
bad() { FAIL=$((FAIL + 1)); printf '  [FAIL] %s\n' "$1"; }

section() { printf '\n## %s\n' "$1"; }

section 'Syntax'
if bash -n scripts/eliteew/zero-trust-pre-commit.sh \
  && bash -n scripts/eliteew/install-zero-trust-git-hooks.sh \
  && bash -n .githooks/pre-commit; then
  ok 'bash -n hook scripts'
else
  bad 'bash -n hook scripts'
fi

section 'Phase dispatch'
if bash scripts/eliteew/zero-trust-pre-commit.sh critical >/dev/null 2>&1; then
  ok 'critical phase runs'
else
  bad 'critical phase runs'
fi

section 'Hooks path'
if [[ -x .githooks/pre-commit ]]; then
  ok '.githooks/pre-commit executable'
else
  bad '.githooks/pre-commit executable'
fi

printf '\nResult: %s pass, %s fail\n' "${PASS}" "${FAIL}"
[[ "${FAIL}" -eq 0 ]]
