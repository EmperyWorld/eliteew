#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Opt-in API-level smoke for KBSEW: /health, /ready, /metrics, tokenized barrels,
# optional status (active_jobs/completed_jobs/trace_id) + search.
# Heavier full ingest cycle stays in Playwright (KBSEW_E2E_RUN=1).
# Usage (repo root):
#   KBSEW_E2E_RUN=1 \
#   KBSEW_SERVICE_URL=http://127.0.0.1:28030 \
#   KBSEW_INTERNAL_SERVICE_TOKEN=… \
#   bash docker/scripts/kbsew-e2e-smoke.sh
# Optional:
#   KBSEW_SMOKE_BARREL_ID=<uuid>   — also GET status + POST search
#   KBSEW_SMOKE_QUERY=…           — search query (default: short probe)
#   KBSEW_SMOKE_BEARER=…          — admin JWT instead of service token
#   KBSEW_E2E_PLAYWRIGHT=1        — after API smoke, run Playwright full-cycle
# Related:
# - documentation/product/KBSEW.md
# - docker/scripts/kbsew-search-smoke.sh
# - shared/web/frontend/e2e/kbsew-full-cycle.spec.ts
# ---

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
URL="${KBSEW_SERVICE_URL:-http://127.0.0.1:28030}"
URL="${URL%/}"
BARREL_ID="${KBSEW_SMOKE_BARREL_ID:-}"
QUERY="${KBSEW_SMOKE_QUERY:-kbsew}"
RUN_PLAYWRIGHT="${KBSEW_E2E_PLAYWRIGHT:-0}"

usage() {
  cat <<'EOF'
Opt-in KBSEW API e2e smoke (no Playwright by default).

  KBSEW_E2E_RUN=1 KBSEW_INTERNAL_SERVICE_TOKEN=… \
    bash docker/scripts/kbsew-e2e-smoke.sh

Env:
  KBSEW_E2E_RUN=1                 Required or script exits 0 (skipped)
  KBSEW_SERVICE_URL               Default http://127.0.0.1:28030
  KBSEW_INTERNAL_SERVICE_TOKEN    Service auth (preferred)
  KBSEW_SMOKE_BEARER              Admin JWT alternative
  KBSEW_SMOKE_BARREL_ID           Optional: status + search against barrel
  KBSEW_SMOKE_QUERY               Optional search query (default: kbsew)
  KBSEW_E2E_PLAYWRIGHT=1          Also run Playwright full-cycle (needs more env)

Playwright-only (ingest upload → job → search), from shared/web/frontend:
  KBSEW_E2E_RUN=1 KBSEW_E2E_BASE_URL=… KBSEW_E2E_ADMIN_BEARER=… \
  KBSEW_E2E_SERVICE_TOKEN=… KBSEW_E2E_BARREL_ID=… \
  corepack pnpm@11.7.0 exec playwright test e2e/kbsew-full-cycle.spec.ts
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${KBSEW_E2E_RUN:-}" != "1" ]]; then
  echo "[kbsew-e2e-smoke] SKIP: set KBSEW_E2E_RUN=1 to run live API smoke" >&2
  exit 0
fi

if [[ -z "${KBSEW_INTERNAL_SERVICE_TOKEN:-}" && -z "${KBSEW_SMOKE_BEARER:-}" ]]; then
  echo "[kbsew-e2e-smoke] ERROR: set KBSEW_INTERNAL_SERVICE_TOKEN or KBSEW_SMOKE_BEARER" >&2
  exit 2
fi

AUTH_HEADERS=()
if [[ -n "${KBSEW_INTERNAL_SERVICE_TOKEN:-}" ]]; then
  AUTH_HEADERS+=(-H "X-KBSEW-Service-Token: ${KBSEW_INTERNAL_SERVICE_TOKEN}")
else
  AUTH_HEADERS+=(-H "authorization: Bearer ${KBSEW_SMOKE_BEARER}")
fi

step() {
  echo "[kbsew-e2e-smoke] $*"
}

fail() {
  echo "[kbsew-e2e-smoke] FAIL: $*" >&2
  exit 1
}

step "GET ${URL}/health"
health_body="$(curl -sfS "${URL}/health")" || fail "/health not 2xx"
echo "${health_body}" | python3 -c 'import json,sys; json.load(sys.stdin)' >/dev/null \
  || fail "/health body is not JSON"

step "GET ${URL}/ready (fail-closed)"
ready_body="$(curl -sfS "${URL}/ready")" || fail "/ready not 2xx (PG/Qdrant/MinIO)"
echo "${ready_body}" | python3 -c 'import json,sys; json.load(sys.stdin)' >/dev/null \
  || fail "/ready body is not JSON"

step "GET ${URL}/metrics"
curl -sfS "${URL}/metrics" >/dev/null || fail "/metrics not 2xx"

step "GET ${URL}/api/v1/kbsew/barrels (tokenized)"
barrels_body="$(curl -sfS "${AUTH_HEADERS[@]}" "${URL}/api/v1/kbsew/barrels")" \
  || fail "/barrels not 2xx (auth or gateway)"
echo "${barrels_body}" | python3 -c '
import json, sys
rows = json.load(sys.stdin)
if not isinstance(rows, list):
    raise SystemExit("barrels payload must be a list")
print(f"OK: barrels={len(rows)}")
'

if [[ -n "${BARREL_ID}" ]]; then
  step "GET status barrel=${BARREL_ID}"
  status_body="$(curl -sfS "${AUTH_HEADERS[@]}" \
    "${URL}/api/v1/kbsew/barrels/${BARREL_ID}/status")" \
    || fail "/barrels/{id}/status not 2xx"
  KBSEW_STATUS_JSON="${status_body}" python3 - <<'PY'
import json
import os
import sys

body = json.loads(os.environ["KBSEW_STATUS_JSON"])
for key in ("active_jobs", "completed_jobs"):
    val = body.get(key)
    if val is None:
        # completed_jobs may be omitted on older images; warn but continue.
        if key == "completed_jobs":
            print("WARN: completed_jobs missing (older KBSEW image?)", file=sys.stderr)
            continue
        raise SystemExit(f"missing {key}")
    if not isinstance(val, list):
        raise SystemExit(f"{key} must be a list")
    for job in val:
        if not isinstance(job, dict) or "id" not in job or "status" not in job:
            raise SystemExit(f"invalid job row in {key}")
        # trace_id optional; when present must be str or null
        if "trace_id" in job and job["trace_id"] is not None and not isinstance(job["trace_id"], str):
            raise SystemExit("trace_id must be str|null")
print(
    f"OK: active_jobs={len(body.get('active_jobs') or [])} "
    f"completed_jobs={len(body.get('completed_jobs') or [])}"
)
PY

  step "POST search barrel=${BARREL_ID}"
  payload="$(
    python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1], "barrel_id": sys.argv[2], "limit": 3}))' \
      "${QUERY}" "${BARREL_ID}"
  )"
  search_body="$(curl -sfS "${AUTH_HEADERS[@]}" \
    -H "content-type: application/json" \
    -H "accept: application/json" \
    -X POST "${URL}/api/v1/kbsew/search" \
    -d "${payload}")" || fail "/search not 2xx"
  echo "${search_body}" | python3 -c '
import json, sys
body = json.load(sys.stdin)
chunks = body.get("chunks")
if not isinstance(chunks, list):
    raise SystemExit("search.chunks must be a list")
print(f"OK: search chunks={len(chunks)}")
'
else
  step "SKIP status/search (set KBSEW_SMOKE_BARREL_ID to exercise them)"
fi

if [[ "${RUN_PLAYWRIGHT}" == "1" ]]; then
  step "Playwright full-cycle (KBSEW_E2E_PLAYWRIGHT=1)"
  missing=0
  for key in KBSEW_E2E_BASE_URL KBSEW_E2E_ADMIN_BEARER KBSEW_E2E_SERVICE_TOKEN KBSEW_E2E_BARREL_ID; do
    if [[ -z "${!key:-}" ]]; then
      echo "[kbsew-e2e-smoke] ERROR: ${key} required for Playwright mode" >&2
      missing=1
    fi
  done
  if [[ "${missing}" -ne 0 ]]; then
    exit 2
  fi
  (
    cd "${ROOT}/shared/web/frontend"
    export KBSEW_E2E_RUN=1
    corepack pnpm@11.7.0 exec playwright test e2e/kbsew-full-cycle.spec.ts
  )
fi

step "PASS"
