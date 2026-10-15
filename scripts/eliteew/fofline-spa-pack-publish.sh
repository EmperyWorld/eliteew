#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Stage signed FoFline SPA pack under /fofline-updates/ + write spa-latest.json.
# Invariants:
# - Never invents signatures; --sig required (fail-closed).
# - Writes spa-latest.json separately from shell latest.json (Tauri updater untouched).
# - Stages under docker/data/fofline-updates by default; does not rsync to prod-core.
# Related:
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §11.2
# - scripts/eliteew/fofline-publish-update.sh (shell OTA sibling)
# - scripts/eliteew/fofline-spa-pack-build.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PUBLIC_BASE="${FOFLINE_UPDATE_PUBLIC_BASE:-https://app.eliteew.ru/fofline-updates}"
OUT_DIR="${FOFLINE_UPDATES_OUT:-${ROOT}/docker/data/fofline-updates}"
PACK=""
SIG=""
NOTES="${FOFLINE_SPA_UPDATE_NOTES:-EliteEW FoFline SPA pack}"
APP_BUILD_ID_OVERRIDE=""

while [[ $# -gt 0 ]]; do
	case "$1" in
	--pack)
		PACK="${2:-}"
		shift 2
		;;
	--sig)
		SIG="${2:-}"
		shift 2
		;;
	--out)
		OUT_DIR="${2:-}"
		shift 2
		;;
	--notes)
		NOTES="${2:-}"
		shift 2
		;;
	--public-base)
		PUBLIC_BASE="${2:-}"
		shift 2
		;;
	--app-build-id)
		APP_BUILD_ID_OVERRIDE="${2:-}"
		shift 2
		;;
	-h | --help)
		sed -n '2,16p' "$0"
		cat <<EOF

Usage:
  bash scripts/eliteew/fofline-spa-pack-publish.sh \\
    --pack path/to/EliteEW_FoFline_SPA-<id>.tar.zst \\
    --sig path/to/EliteEW_FoFline_SPA-<id>.tar.zst.sig \\
    [--out docker/data/fofline-updates] \\
    [--notes "..."] \\
    [--public-base https://app.eliteew.ru/fofline-updates]

Writes:
  OUT/artifacts/<basename>
  OUT/artifacts/<basename>.sig  (or SIG basename)
  OUT/spa-latest.json

Does not merge into shell latest.json.
Then sync OUT to prod-core /srv/eliteew/fofline-updates (same volume as shell OTA).
EOF
		exit 0
		;;
	*)
		echo "Unknown arg: $1" >&2
		exit 2
		;;
	esac
done

if [[ -z "${PACK}" || -z "${SIG}" ]]; then
	echo "FAIL: --pack and --sig are required (unsigned publish forbidden)" >&2
	exit 2
fi
if [[ ! -f "${PACK}" ]]; then
	echo "FAIL: pack not found: ${PACK}" >&2
	exit 1
fi
if [[ ! -f "${SIG}" ]]; then
	echo "FAIL: signature not found: ${SIG}" >&2
	exit 1
fi
if ! command -v zstd >/dev/null 2>&1; then
	echo "FAIL: zstd required to read pack-manifest.json" >&2
	exit 1
fi

mkdir -p "${OUT_DIR}/artifacts"
BASE_NAME="$(basename "${PACK}")"
SIG_NAME="$(basename "${SIG}")"
PACK_ABS="$(cd "$(dirname "${PACK}")" && pwd)/${BASE_NAME}"
SIG_ABS="$(cd "$(dirname "${SIG}")" && pwd)/${SIG_NAME}"
DEST_PACK="${OUT_DIR}/artifacts/${BASE_NAME}"
DEST_SIG="${OUT_DIR}/artifacts/${SIG_NAME}"
DEST_PACK_ABS="$(mkdir -p "$(dirname "${DEST_PACK}")" && cd "$(dirname "${DEST_PACK}")" && pwd)/${BASE_NAME}"
DEST_SIG_ABS="$(cd "$(dirname "${DEST_SIG}")" && pwd)/${SIG_NAME}"

if [[ "${PACK_ABS}" != "${DEST_PACK_ABS}" ]]; then
	install -m 0644 "${PACK}" "${DEST_PACK}"
fi
if [[ "${SIG_ABS}" != "${DEST_SIG_ABS}" ]]; then
	install -m 0644 "${SIG}" "${DEST_SIG}"
fi
# Ensure modes when already staged in-place
chmod 0644 "${DEST_PACK}" "${DEST_SIG}" 2>/dev/null || true

# Prefer embedded pack-manifest; fall back to filename EliteEW_FoFline_SPA-<id>.tar.zst
MANIFEST_JSON=""
if MANIFEST_JSON="$(zstd -dc "${PACK}" | tar -xO ./pack-manifest.json 2>/dev/null)"; then
	:
elif MANIFEST_JSON="$(zstd -dc "${PACK}" | tar -xO pack-manifest.json 2>/dev/null)"; then
	:
else
	MANIFEST_JSON=""
fi

export FSP_PUB_MANIFEST_JSON="${MANIFEST_JSON}"
export FSP_PUB_APP_BUILD_ID_OVERRIDE="${APP_BUILD_ID_OVERRIDE}"
export FSP_PUB_BASE_NAME="${BASE_NAME}"
export FSP_PUB_NOTES="${NOTES}"
export FSP_PUB_DATE
FSP_PUB_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
export FSP_PUB_PUBLIC_BASE="${PUBLIC_BASE%/}"
export FSP_PUB_URL="${PUBLIC_BASE%/}/artifacts/${BASE_NAME}"
export FSP_PUB_SIG
FSP_PUB_SIG="$(tr -d '\n\r' <"${SIG}")"
export FSP_PUB_SHA256
FSP_PUB_SHA256="$(sha256sum "${PACK}" | awk '{print $1}')"
export FSP_PUB_OUT="${OUT_DIR}/spa-latest.json"
export FSP_PUB_INCLUDE_AUDIO=""

python3 <<'PY'
import json
import os
import re
import sys
from pathlib import Path

out = Path(os.environ["FSP_PUB_OUT"])
base_name = os.environ["FSP_PUB_BASE_NAME"]
override = (os.environ.get("FSP_PUB_APP_BUILD_ID_OVERRIDE") or "").strip()
raw = (os.environ.get("FSP_PUB_MANIFEST_JSON") or "").strip()
include_audio = None
app_build_id = override
deploy_id = None
kind = "fofline-spa"

if raw:
    try:
        man = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"FAIL: corrupt pack-manifest.json in archive: {e}", file=sys.stderr)
        sys.exit(1)
    if not isinstance(man, dict):
        print("FAIL: pack-manifest.json root must be object", file=sys.stderr)
        sys.exit(1)
    if not app_build_id:
        app_build_id = str(man.get("app_build_id") or "").strip()
    deploy_id = str(man.get("deploy_id") or app_build_id or "").strip() or None
    if "include_audio" in man:
        include_audio = bool(man.get("include_audio"))
    kind = str(man.get("kind") or kind)

if not app_build_id:
    m = re.match(r"EliteEW_FoFline_SPA-(.+)\.tar\.zst$", base_name)
    if m:
        app_build_id = m.group(1)

if not app_build_id:
    print(
        "FAIL: cannot resolve app_build_id (pack-manifest / --app-build-id / filename)",
        file=sys.stderr,
    )
    sys.exit(1)

if not deploy_id:
    deploy_id = app_build_id

doc = {
    "schema_version": 1,
    "kind": kind,
    "version": app_build_id,
    "app_build_id": app_build_id,
    "deploy_id": deploy_id,
    "notes": os.environ["FSP_PUB_NOTES"],
    "pub_date": os.environ["FSP_PUB_DATE"],
    "public_base": os.environ["FSP_PUB_PUBLIC_BASE"],
    "url": os.environ["FSP_PUB_URL"],
    "artifact": f"artifacts/{base_name}",
    "signature": os.environ["FSP_PUB_SIG"],
    "sha256": os.environ["FSP_PUB_SHA256"],
}
if include_audio is not None:
    doc["include_audio"] = include_audio

out.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
print(f"OK: wrote {out}")
print(f"OK: app_build_id={app_build_id} sha256={doc['sha256'][:12]}…")
print(f"OK: artifacts under {out.parent / 'artifacts'}")
print(
    "Next: sync to prod-core /srv/eliteew/fofline-updates "
    "(shell latest.json untouched; spa-latest.json is separate)"
)
PY
