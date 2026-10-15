#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Narrow lock for FoFline SPA core + asset-group bake/publish (A1).
# Invariants:
# - Uses fake .sig only inside mktemp (same pattern as desktop-client-publish-update-selftest).
# - Asserts default core excludes §17 optional groups; files.json present; unsigned publish fails.
# Related:
# - scripts/eliteew/fofline-spa-pack-build.sh
# - scripts/eliteew/fofline-spa-assets-build.sh
# - scripts/eliteew/fofline-spa-assets-publish.sh
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §17
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD="${ROOT}/scripts/eliteew/fofline-spa-pack-build.sh"
ASSETS_BUILD="${ROOT}/scripts/eliteew/fofline-spa-assets-build.sh"
ASSETS_PUBLISH="${ROOT}/scripts/eliteew/fofline-spa-assets-publish.sh"
PUBLISH="${ROOT}/scripts/eliteew/fofline-spa-pack-publish.sh"
SIGN="${ROOT}/scripts/eliteew/fofline-spa-pack-sign.sh"
GROUPS_PY="${ROOT}/scripts/eliteew/fofline_spa_groups.py"
STAGE="$(mktemp -d /tmp/eliteew-fofline-spa-selftest.XXXXXX)"
cleanup() { rm -rf "${STAGE}"; }
trap cleanup EXIT

bash -n "${BUILD}"
bash -n "${ASSETS_BUILD}"
bash -n "${ASSETS_PUBLISH}"
bash -n "${PUBLISH}"
bash -n "${SIGN}"
bash -n "$0"
python3 -m py_compile "${GROUPS_PY}"
echo "OK: bash -n + py_compile"

DIST="${STAGE}/dist"
mkdir -p \
	"${DIST}/assets" \
	"${DIST}/audio/tour-a/ru/man" \
	"${DIST}/audio/tts-style-samples" \
	"${DIST}/ewa" \
	"${DIST}/desktop-wallpapers" \
	"${DIST}/site-studio-template-assets" \
	"${DIST}/o-proekte" \
	"${DIST}/fonts" \
	"${DIST}/avatars" \
	"${DIST}/music-evolution/soloists"
printf '%s\n' '<!doctype html><title>fofline-spa-selftest</title>' >"${DIST}/index.html"
printf '%s\n' 'console.log("ok")' >"${DIST}/assets/app.js"
printf '%s\n' 'FAKE_AUDIO_GUIDE' >"${DIST}/audio/tour-a/ru/man/intro.wav"
printf '%s\n' 'FAKE_TTS' >"${DIST}/audio/tts-style-samples/sample.wav"
printf '%s\n' 'FAKE_EWA' >"${DIST}/ewa/demo.mp4"
printf '%s\n' 'FAKE_WP' >"${DIST}/desktop-wallpapers/1.webp"
printf '%s\n' 'FAKE_SS' >"${DIST}/site-studio-template-assets/x.png"
printf '%s\n' 'FAKE_OP' >"${DIST}/o-proekte/index.html"
printf '%s\n' 'FAKE_FONT' >"${DIST}/fonts/OpenSans.woff2"
printf '%s\n' 'FAKE_AV' >"${DIST}/avatars/hero.webp"
printf '%s\n' 'FAKE_ME' >"${DIST}/music-evolution/soloists/a.json"
printf '%s\n' 'selftest-build-id-42' >"${DIST}/app-build-version.txt"
cat >"${DIST}/deployment-manifest.json" <<'EOF'
{
  "schema_version": 1,
  "deploy_id": "selftest-build-id-42",
  "built_at": "2026-08-09T00:00:00Z",
  "built_on_host": "selftest",
  "artifacts": {
    "frontend_dist_sha256": "deadbeef"
  },
  "lines": { "active": "baked" }
}
EOF

bash "${BUILD}" --dist "${DIST}" --out "${STAGE}/EliteEW_FoFline_SPA-selftest-build-id-42.tar.zst"
PACK="${STAGE}/EliteEW_FoFline_SPA-selftest-build-id-42.tar.zst"
test -f "${PACK}"

LIST="$(zstd -dc "${PACK}" | tar -t)"
echo "${LIST}" | grep -E '(^|/)pack-manifest\.json$' >/dev/null
echo "${LIST}" | grep -E '(^|/)files\.json$' >/dev/null
echo "${LIST}" | grep -E '(^|/)index\.html$' >/dev/null
for forbidden in audio ewa desktop-wallpapers site-studio-template-assets o-proekte fonts avatars music-evolution; do
	if echo "${LIST}" | grep -E "(^|/)${forbidden}(/|$)" >/dev/null; then
		echo "FAIL: optional group path ${forbidden}/ present in default core pack" >&2
		exit 1
	fi
done
echo "OK: core excludes §17 optional groups and embeds pack-manifest.json + files.json"

# Legacy --include-audio embeds audio/ but still excludes other groups
bash "${BUILD}" --dist "${DIST}" --include-audio --out "${STAGE}/with-audio.tar.zst"
WITH_AUDIO_LIST="$(zstd -dc "${STAGE}/with-audio.tar.zst" | tar -t)"
if ! echo "${WITH_AUDIO_LIST}" | grep -E '(^|/)audio(/|$)' >/dev/null; then
	echo "FAIL: --include-audio did not embed audio/" >&2
	exit 1
fi
if echo "${WITH_AUDIO_LIST}" | grep -E '(^|/)ewa(/|$)' >/dev/null; then
	echo "FAIL: --include-audio must not embed ewa/" >&2
	exit 1
fi
echo "OK: --include-audio embeds audio/ only"

# files.json schema in core
zstd -dc "${PACK}" | tar -xO ./files.json >"${STAGE}/core-files.json"
python3 - "${STAGE}/core-files.json" <<'PY'
import json, sys
from pathlib import Path
doc = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert doc["schema_version"] == 1
assert doc["kind"] == "fofline-spa-files"
assert doc["group_id"] == "core-spa"
assert doc["app_build_id"] == "selftest-build-id-42"
assert doc["file_count"] == len(doc["files"])
assert any(f["path"] == "index.html" for f in doc["files"])
assert all(len(f["sha256"]) == 64 for f in doc["files"])
print("OK: core files.json schema")
PY

# Asset groups bake
bash "${ASSETS_BUILD}" --dist "${DIST}" --out-dir "${STAGE}/group-artifacts"
G_EWA="${STAGE}/group-artifacts/EliteEW_FoFline_SPA_GROUP-selftest-build-id-42-ewa-media.tar.zst"
G_AUDIO="${STAGE}/group-artifacts/EliteEW_FoFline_SPA_GROUP-selftest-build-id-42-audio-guides.tar.zst"
G_TTS="${STAGE}/group-artifacts/EliteEW_FoFline_SPA_GROUP-selftest-build-id-42-audio-tts-samples.tar.zst"
test -f "${G_EWA}"
test -f "${G_AUDIO}"
test -f "${G_TTS}"
EWA_LIST="$(zstd -dc "${G_EWA}" | tar -t)"
echo "${EWA_LIST}" | grep -E '(^|/)ewa/' >/dev/null
echo "${EWA_LIST}" | grep -E '(^|/)files\.json$' >/dev/null
echo "${EWA_LIST}" | grep -E '(^|/)group-manifest\.json$' >/dev/null
AUDIO_LIST="$(zstd -dc "${G_AUDIO}" | tar -t)"
if echo "${AUDIO_LIST}" | grep -E 'tts-style-samples' >/dev/null; then
	echo "FAIL: audio-guides must exclude tts-style-samples" >&2
	exit 1
fi
TTS_LIST="$(zstd -dc "${G_TTS}" | tar -t)"
echo "${TTS_LIST}" | grep -E 'tts-style-samples' >/dev/null
echo "OK: asset groups bake + audio split"

# Fake sigs + assets publish
for g in "${STAGE}/group-artifacts"/EliteEW_FoFline_SPA_GROUP-selftest-build-id-42-*.tar.zst; do
	printf 'fake-group-sig\n' >"${g}.sig"
done
bash "${ASSETS_PUBLISH}" \
	--packs-dir "${STAGE}/group-artifacts" \
	--app-build-id "selftest-build-id-42" \
	--out "${STAGE}/out-assets" \
	--public-base "https://app.eliteew.ru/fofline-updates"

python3 - "${STAGE}/out-assets/spa-assets-latest.json" <<'PY'
import json, sys
from pathlib import Path
doc = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert doc["schema_version"] == 1
assert doc["kind"] == "fofline-spa-assets"
assert doc["app_build_id"] == "selftest-build-id-42"
assert isinstance(doc["groups"], list) and len(doc["groups"]) >= 3
ids = {g["id"] for g in doc["groups"]}
assert "ewa-media" in ids
assert "audio-guides" in ids
for g in doc["groups"]:
    assert g["sha256"] and len(g["sha256"]) == 64
    assert g["signature"] == "fake-group-sig"
    assert g["url"].startswith("https://app.eliteew.ru/fofline-updates/artifacts/")
    art = Path(sys.argv[1]).parent / g["artifact"]
    assert art.is_file(), art
print("OK: spa-assets-latest.json schema")
PY

# Missing group sig must fail
rm -f "${G_EWA}.sig"
if bash "${ASSETS_PUBLISH}" \
	--packs-dir "${STAGE}/group-artifacts" \
	--app-build-id "selftest-build-id-42" \
	--out "${STAGE}/out-assets-fail" 2>/dev/null; then
	echo "FAIL: expected missing group sig to fail" >&2
	exit 1
fi
echo "OK: assets publish fail-closed without group sig"
# restore for cleanliness
printf 'fake-group-sig\n' >"${G_EWA}.sig"

printf 'fake-fofline-spa-sig\n' >"${PACK}.sig"

bash "${PUBLISH}" \
	--pack "${PACK}" \
	--sig "${PACK}.sig" \
	--out "${STAGE}/out" \
	--notes "selftest-spa" \
	--public-base "https://app.eliteew.ru/fofline-updates"

python3 - "${STAGE}/out/spa-latest.json" <<'PY'
import json, sys
from pathlib import Path

doc = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
required = [
    "schema_version",
    "kind",
    "version",
    "app_build_id",
    "deploy_id",
    "notes",
    "pub_date",
    "public_base",
    "url",
    "artifact",
    "signature",
    "sha256",
]
for k in required:
    assert k in doc, (k, doc)
assert doc["schema_version"] == 1
assert doc["kind"] == "fofline-spa"
assert doc["app_build_id"] == "selftest-build-id-42"
assert doc["version"] == doc["app_build_id"]
assert doc["public_base"] == "https://app.eliteew.ru/fofline-updates"
assert doc["url"].endswith("EliteEW_FoFline_SPA-selftest-build-id-42.tar.zst")
assert doc["artifact"].startswith("artifacts/")
assert doc["signature"] == "fake-fofline-spa-sig"
assert len(doc["sha256"]) == 64
assert doc.get("include_audio") is False
art = Path(sys.argv[1]).parent / doc["artifact"]
assert art.is_file(), art
sig_alt = Path(sys.argv[1]).parent / "artifacts" / (art.name + ".sig")
assert sig_alt.is_file() or any(
    p.suffix == ".sig" for p in (Path(sys.argv[1]).parent / "artifacts").iterdir()
), "missing staged .sig"
print("OK: spa-latest.json schema")
PY

# Missing sig must fail
if bash "${PUBLISH}" --pack "${PACK}" --sig "${STAGE}/missing.sig" --out "${STAGE}/out2" 2>/dev/null; then
	echo "FAIL: expected missing sig to fail" >&2
	exit 1
fi
echo "OK: missing-sig fail-closed"

# Sign helper must fail closed without key
unset TAURI_SIGNING_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY_PATH || true
if bash "${SIGN}" --pack "${PACK}" 2>/dev/null; then
	echo "FAIL: expected sign without key to fail" >&2
	exit 1
fi
echo "OK: sign helper fail-closed without key"

echo "PASS fofline-spa-pack-selftest"
