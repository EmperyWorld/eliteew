#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Stack0 smoke Music Player wire: shell-state music_playlists + audio content list.
# Invariants:
# - Без MUSIC_PLAYER_SMOKE_TOKEN — exit 1 (не skip-success).
# - shell-state.music_playlists[0] = favorites id eliteew-music-favorites.
# Related:
# - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
# ---
set -euo pipefail

API_BASE="${MUSIC_PLAYER_SMOKE_BASE_URL:-${API_BASE:-http://127.0.0.1:29000}}"
SHELL_URL="${API_BASE%/}/api/v1/desktop/shell-state"
CONTENT_URL="${API_BASE%/}/api/v1/content?content_type=audio&limit=5&offset=0"
TOKEN="${MUSIC_PLAYER_SMOKE_TOKEN:-}"

failures=0

if [[ -z "${TOKEN}" ]]; then
	echo "[music-player-stack0-smoke] FAIL: MUSIC_PLAYER_SMOKE_TOKEN обязателен" >&2
	exit 1
fi

auth_header=(-H "Authorization: Bearer ${TOKEN}")

echo "[music-player-stack0-smoke] GET shell-state (${SHELL_URL})"
shell_body="$(curl -sf --connect-timeout 8 "${auth_header[@]}" "${SHELL_URL}" || true)"
if [[ -z "${shell_body}" ]]; then
	echo "[music-player-stack0-smoke] shell_state_FAIL (empty/http)" >&2
	failures=$((failures + 1))
elif echo "${shell_body}" | python3 -c '
import json, sys
d = json.load(sys.stdin)
pls = d.get("music_playlists")
assert isinstance(pls, list) and len(pls) >= 1
assert pls[0].get("id") == "eliteew-music-favorites"
assert pls[0].get("name") == "Любимые"
assert isinstance(pls[0].get("track_ids"), list)
print("playlists", len(pls), "favorites_ok")
'; then
	echo "[music-player-stack0-smoke] shell_state_music_playlists_ok"
else
	echo "[music-player-stack0-smoke] shell_state_music_playlists_FAIL" >&2
	echo "${shell_body}" | head -c 400 >&2
	echo
	failures=$((failures + 1))
fi

echo "[music-player-stack0-smoke] GET content audio list (${CONTENT_URL})"
content_body="$(curl -sf --connect-timeout 12 "${auth_header[@]}" "${CONTENT_URL}" || true)"
if [[ -z "${content_body}" ]]; then
	echo "[music-player-stack0-smoke] content_audio_FAIL (empty/http)" >&2
	failures=$((failures + 1))
elif echo "${content_body}" | python3 -c '
import json, sys
d = json.load(sys.stdin)
assert isinstance(d, dict)
items = d.get("items")
assert isinstance(items, list)
assert isinstance(d.get("total"), int)
print("audio_items", len(items), "total", d.get("total"))
'; then
	echo "[music-player-stack0-smoke] content_audio_list_ok"
else
	echo "[music-player-stack0-smoke] content_audio_list_FAIL (schema)" >&2
	echo "${content_body}" | head -c 400 >&2
	echo
	failures=$((failures + 1))
fi

if [[ "${failures}" -gt 0 ]]; then
	echo "[music-player-stack0-smoke] FAIL count=${failures}" >&2
	exit 1
fi

echo "[music-player-stack0-smoke] OK"
