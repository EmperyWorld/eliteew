#!/usr/bin/env bash
# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Live eval wrapper: search Recall@k / hit-rate against YAML fixture.
# Usage:
#   KBSEW_SERVICE_URL=http://127.0.0.1:8030 \
#   KBSEW_INTERNAL_SERVICE_TOKEN=… \
#   bash docker/scripts/kbsew-eval.sh
# Optional:
#   KBSEW_EVAL_DATASET=KBSEW/eval/sample_queries.yaml
#   KBSEW_EVAL_BARREL_ID=<uuid>
#   KBSEW_EVAL_MIN_HIT_RATE=1.0
# ---

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATASET="${KBSEW_EVAL_DATASET:-${ROOT}/KBSEW/eval/sample_queries.yaml}"
URL="${KBSEW_SERVICE_URL:-http://127.0.0.1:8030}"

if [[ -z "${KBSEW_INTERNAL_SERVICE_TOKEN:-}" && -z "${KBSEW_SMOKE_BEARER:-}" ]]; then
  echo "Set KBSEW_INTERNAL_SERVICE_TOKEN or KBSEW_SMOKE_BEARER" >&2
  exit 2
fi

if [[ ! -f "${DATASET}" ]]; then
  echo "Dataset not found: ${DATASET}" >&2
  exit 2
fi

echo "[kbsew-eval] url=${URL} dataset=${DATASET}"
exec python3 "${ROOT}/KBSEW/scripts/kbsew_eval.py" --dataset "${DATASET}" --url "${URL}"
