#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Point local git core.hooksPath at .githooks/ and ensure executables.
# Invariants:
# - Modifies local git config only when operator runs this script explicitly.
# Related:
# - documentation/platform/ZERO-TRUST-GIT-HOOKS.md
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

chmod +x \
  .githooks/pre-commit \
  scripts/eliteew/zero-trust-pre-commit.sh \
  scripts/eliteew/zero-trust-pre-commit-selftest.sh 2>/dev/null || true

if command -v pre-commit >/dev/null 2>&1; then
  pre-commit install
  echo "✅ pre-commit hooks installed (includes zero-trust phases)"
else
  git config core.hooksPath .githooks
  echo "✅ core.hooksPath=$(git config --get core.hooksPath)"
  echo "Tip: install pre-commit on command-center for hook parity with CI docs."
fi

echo "Self-test: bash scripts/eliteew/zero-trust-pre-commit-selftest.sh"
