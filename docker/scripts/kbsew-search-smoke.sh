#!/usr/bin/env bash
# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Manual/live smoke for KBSEW barrel search against marketing_nw (book-berezin.pdf).
# Usage:
#   KBSEW_SERVICE_URL=http://127.0.0.1:8030 \
#   KBSEW_INTERNAL_SERVICE_TOKEN=... \
#   bash docker/scripts/kbsew-search-smoke.sh
# ---

set -euo pipefail

KBSEW_SERVICE_URL="${KBSEW_SERVICE_URL:-http://stack-kbsew:8030}"
BARREL_ID="${KBSEW_SMOKE_BARREL_ID:-da11ce9f-1d46-4747-8112-7210ebf9f6f2}"
QUERY="${KBSEW_SMOKE_QUERY:-маркетинг бренд позиционирование}"

headers=(-H "content-type: application/json" -H "accept: application/json")
if [[ -n "${KBSEW_INTERNAL_SERVICE_TOKEN:-}" ]]; then
  headers+=(-H "X-KBSEW-Service-Token: ${KBSEW_INTERNAL_SERVICE_TOKEN}")
elif [[ -n "${KBSEW_SMOKE_BEARER:-}" ]]; then
  headers+=(-H "authorization: Bearer ${KBSEW_SMOKE_BEARER}")
else
  echo "Set KBSEW_INTERNAL_SERVICE_TOKEN or KBSEW_SMOKE_BEARER" >&2
  exit 2
fi

payload=$(printf '{"query":%s,"barrel_id":%s}' "$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$QUERY")" "$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$BARREL_ID")")

echo "[kbsew-search-smoke] POST ${KBSEW_SERVICE_URL}/api/v1/kbsew/search barrel=${BARREL_ID}"
curl -sf "${KBSEW_SERVICE_URL%/}/metrics" >/dev/null
response=$(curl -sf "${headers[@]}" -X POST "${KBSEW_SERVICE_URL%/}/api/v1/kbsew/search" -d "$payload")
KBSEW_RESPONSE="$response" python3 - <<'PY'
import json
import os

body = json.loads(os.environ["KBSEW_RESPONSE"])
chunks = body.get("chunks") or []
if not chunks:
    raise SystemExit("FAIL: empty chunks")
joined = "\n".join(chunks).casefold()
needles = ("маркет", "бренд", "позици", "berezin", "берез")
if not any(n in joined for n in needles):
    raise SystemExit(f"FAIL: snippets do not look like book-berezin content: {joined[:400]!r}")
print(f"OK: {len(chunks)} chunks, sample={chunks[0][:180]!r}")
PY
