#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lightweight stack0 smoke for Image Studio: API health + OpenAPI path presence.
# Does not burn UGS credits (no generate call).
# Invariants:
# - Fails if /api/health is down or OpenAPI lacks /api/v1/image-studio/text-to-image.
# Related:
# - documentation/product/IMAGE-STUDIO.md
# ---
set -euo pipefail

API_BASE="${IMAGE_STUDIO_SMOKE_BASE_URL:-${API_BASE:-http://127.0.0.1:29000}}"
HEALTH_URL="${API_BASE%/}/api/health"
OPENAPI_URL="${API_BASE%/}/openapi.json"
failures=0

echo "[image-studio-stack0-smoke] GET health (${HEALTH_URL})"
if curl -sf --connect-timeout 8 "${HEALTH_URL}" >/dev/null; then
	echo "[image-studio-stack0-smoke] health_ok"
else
	echo "[image-studio-stack0-smoke] health_FAIL" >&2
	failures=$((failures + 1))
fi

echo "[image-studio-stack0-smoke] OpenAPI has image-studio text-to-image"
openapi_ok=0
for candidate in "${OPENAPI_URL}" "${API_BASE%/}/api/openapi.json" "${API_BASE%/}/api/v1/openapi.json"; do
	body="$(curl -sf --connect-timeout 12 "${candidate}" 2>/dev/null || true)"
	if [[ -z "${body}" ]]; then
		continue
	fi
	if printf '%s' "${body}" | python3 -c '
import json, sys
raw = sys.stdin.read().strip()
if not raw or raw[0] not in "{[":
    raise SystemExit("not_json")
d = json.loads(raw)
paths = d.get("paths") or {}
need = "/api/v1/image-studio/text-to-image"
alt = "/image-studio/text-to-image"
if need not in paths and alt not in paths:
    raise SystemExit("missing_path")
print("path_ok")
' 2>/dev/null; then
		echo "[image-studio-stack0-smoke] openapi_image_studio_ok (${candidate})"
		openapi_ok=1
		break
	fi
done
if [[ "${openapi_ok}" -eq 0 ]]; then
	echo "[image-studio-stack0-smoke] openapi_image_studio_FAIL (no usable OpenAPI JSON with image-studio path)" >&2
	failures=$((failures + 1))
fi

if [[ "${failures}" -gt 0 ]]; then
	echo "[image-studio-stack0-smoke] DONE with ${failures} failure(s)" >&2
	exit 1
fi
echo "[image-studio-stack0-smoke] DONE ok"
