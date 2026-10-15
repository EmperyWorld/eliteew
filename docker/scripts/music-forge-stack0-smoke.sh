#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Stack0 smoke MusicForge: capabilities + обязательный admin Config envelope (P0).
# Invariants:
# - Без MUSIC_FORGE_SMOKE_TOKEN — exit 1 (не skip-success).
# - Admin GET /config/revisions обязан вернуть JSON object с items+total.
# Related:
# - documentation/product/MUSIC-FORGE-APP.md
# ---
set -euo pipefail

API_BASE="${MUSIC_FORGE_SMOKE_BASE_URL:-${API_BASE:-http://127.0.0.1:29000}}"
CAPABILITIES_URL="${API_BASE%/}/api/v1/music-forge/capabilities"
ADMIN_PREFIX="${API_BASE%/}/api/v1/music-forge/admin"
TOKEN="${MUSIC_FORGE_SMOKE_TOKEN:-}"

failures=0

if [[ -z "${TOKEN}" ]]; then
	echo "[music-forge-stack0-smoke] FAIL: MUSIC_FORGE_SMOKE_TOKEN обязателен" >&2
	exit 1
fi

auth_header=(-H "Authorization: Bearer ${TOKEN}")

# Global stack0 auth middleware requires Bearer even for capabilities.
echo "[music-forge-stack0-smoke] GET capabilities (${CAPABILITIES_URL})"
caps_body="$(curl -sf --connect-timeout 8 "${auth_header[@]}" "${CAPABILITIES_URL}" || true)"
if [[ -z "${caps_body}" ]]; then
	echo "[music-forge-stack0-smoke] capabilities_FAIL (empty/http)" >&2
	failures=$((failures + 1))
elif echo "${caps_body}" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert isinstance(d, dict); modes=d.get("modes") or []; assert isinstance(modes, list) and len(modes)>=1; assert d.get("default_mode_key"); print("modes", len(modes), "default", d.get("default_mode_key"))'; then
	echo "[music-forge-stack0-smoke] capabilities_ok (modes+default_mode_key)"
else
	echo "[music-forge-stack0-smoke] capabilities_FAIL (schema/modes)" >&2
	echo "${caps_body}" | head -c 400 >&2
	echo
	failures=$((failures + 1))
fi

echo "[music-forge-stack0-smoke] GET admin config/revisions (envelope)"
rev_body="$(curl -sf --connect-timeout 12 "${auth_header[@]}" "${ADMIN_PREFIX}/config/revisions" || true)"
if [[ -z "${rev_body}" ]]; then
	echo "[music-forge-stack0-smoke] admin_config_revisions_FAIL (empty/http)" >&2
	failures=$((failures + 1))
elif echo "${rev_body}" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert isinstance(d, dict) and isinstance(d.get("items"), list) and isinstance(d.get("total"), int); assert not isinstance(d, list)'; then
	echo "[music-forge-stack0-smoke] admin_config_revisions_ok"
else
	echo "[music-forge-stack0-smoke] admin_config_revisions_FAIL (not envelope)" >&2
	echo "${rev_body}" | head -c 400 >&2
	failures=$((failures + 1))
fi

echo "[music-forge-stack0-smoke] GET admin stats/overview"
if curl -sf --connect-timeout 12 "${auth_header[@]}" "${ADMIN_PREFIX}/stats/overview" | head -c 400; then
	echo
	echo "[music-forge-stack0-smoke] admin_overview_ok"
else
	echo "[music-forge-stack0-smoke] admin_overview_FAIL" >&2
	failures=$((failures + 1))
fi

echo "[music-forge-stack0-smoke] GET admin probe/comfy"
if curl -sf --connect-timeout 12 "${auth_header[@]}" "${ADMIN_PREFIX}/probe/comfy" | head -c 600; then
	echo
	echo "[music-forge-stack0-smoke] admin_probe_ok"
else
	echo "[music-forge-stack0-smoke] admin_probe_FAIL" >&2
	failures=$((failures + 1))
fi

if [[ "${failures}" -gt 0 ]]; then
	echo "[music-forge-stack0-smoke] FAIL count=${failures}" >&2
	exit 1
fi

echo "[music-forge-stack0-smoke] OK"
