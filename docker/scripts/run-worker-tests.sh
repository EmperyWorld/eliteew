#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# Companion worker + Celery step idempotency regression slice (R-02 / audit A-03).
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

exec bash docker/scripts/run-stack0-api-tests.sh \
  tests/test_celery_task_retry_idempotency_risk.py \
  tests/test_companion_task_retry_idempotency.py \
  "$@"
