#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Run Architectural Integrity Sentinel (AIS) in the immutable stack0 API test container.
# Invariants:
# - Delegates to run-stack0-api-tests.sh; no bare host pytest for AIS contract tests.
# Related:
# - shared/api/tests/architecture/
# - tests/architecture/RULES.md
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

exec bash docker/scripts/run-stack0-api-tests.sh tests/architecture/ "$@"
