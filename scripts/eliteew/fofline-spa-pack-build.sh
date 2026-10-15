#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Bake FoFline core SPA pack (.tar.zst) from product frontend dist-build for OTA.
# Invariants:
# - Does not run full pnpm build unless --dist is missing (then FAIL; operator rebuilds).
# - Default core excludes all §17.2 optional groups (audio/, ewa/, …); use assets-build for groups.
# - Legacy --include-audio re-embeds audio/ only into core (prefer group packs).
# - Embeds pack-manifest.json + files.json (per-file sha256) with app_build_id.
# - Does not sign; pair with fofline-spa-pack-sign.sh + fofline-spa-pack-publish.sh.
# Related:
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §11.2 / §17
# - scripts/eliteew/fofline-spa-assets-build.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GROUPS_PY="${ROOT}/scripts/eliteew/fofline_spa_groups.py"
DIST_DEFAULT="${ROOT}/shared/web/frontend/dist-build"
DIST="${FOFLINE_SPA_DIST:-${DIST_DEFAULT}}"
OUT_DIR="${FOFLINE_SPA_PACK_OUT:-${ROOT}/docker/data/fofline-updates/artifacts}"
OUT_FILE=""
INCLUDE_AUDIO=0
WITH_GROUPS=0
if [[ "${FOFLINE_SPA_INCLUDE_AUDIO:-0}" == "1" || "${FOFLINE_SPA_INCLUDE_AUDIO:-}" == "true" ]]; then
	INCLUDE_AUDIO=1
fi

while [[ $# -gt 0 ]]; do
	case "$1" in
	--dist)
		DIST="${2:-}"
		shift 2
		;;
	--out-dir)
		OUT_DIR="${2:-}"
		shift 2
		;;
	--out)
		OUT_FILE="${2:-}"
		shift 2
		;;
	--include-audio)
		INCLUDE_AUDIO=1
		shift
		;;
	--with-groups)
		WITH_GROUPS=1
		shift
		;;
	-h | --help)
		sed -n '2,18p' "$0"
		cat <<EOF

Usage:
  bash scripts/eliteew/fofline-spa-pack-build.sh \\
    [--dist shared/web/frontend/dist-build] \\
    [--out-dir docker/data/fofline-updates/artifacts] \\
    [--out /path/to/EliteEW_FoFline_SPA-<id>.tar.zst] \\
    [--include-audio] \\
    [--with-groups]

Env:
  FOFLINE_SPA_DIST, FOFLINE_SPA_PACK_OUT, FOFLINE_SPA_INCLUDE_AUDIO=1

Default core excludes §17 optional groups (audio/, ewa/, wallpapers, …).
Optional: --with-groups also runs fofline-spa-assets-build.sh.
Sign next:
  bash scripts/eliteew/fofline-spa-pack-sign.sh --pack <artifact>
  bash scripts/eliteew/fofline-spa-pack-publish.sh --pack <artifact> --sig <artifact>.sig
EOF
		exit 0
		;;
	*)
		echo "Unknown arg: $1" >&2
		exit 2
		;;
	esac
done

if [[ ! -d "${DIST}" ]]; then
	echo "FAIL: dist not found: ${DIST}" >&2
	echo "HINT: build frontend on command-center (do not invent dist); then re-run." >&2
	exit 1
fi
if [[ ! -f "${DIST}/index.html" ]]; then
	echo "FAIL: ${DIST}/index.html missing — not a usable SPA dist" >&2
	exit 1
fi
if [[ ! -f "${DIST}/app-build-version.txt" ]]; then
	echo "FAIL: ${DIST}/app-build-version.txt missing" >&2
	exit 1
fi
if ! command -v zstd >/dev/null 2>&1; then
	echo "FAIL: zstd required on PATH" >&2
	exit 1
fi
if ! command -v rsync >/dev/null 2>&1; then
	echo "FAIL: rsync required on PATH" >&2
	exit 1
fi

APP_BUILD_ID="$(tr -d '[:space:]' <"${DIST}/app-build-version.txt")"
if [[ -z "${APP_BUILD_ID}" ]]; then
	echo "FAIL: empty app-build-version.txt" >&2
	exit 1
fi
# Filename-safe (expect deploy_id shape; reject path separators)
case "${APP_BUILD_ID}" in
*/* | *\\* | *..*)
	echo "FAIL: unsafe app_build_id: ${APP_BUILD_ID}" >&2
	exit 1
	;;
esac

ARTIFACT_NAME="EliteEW_FoFline_SPA-${APP_BUILD_ID}.tar.zst"
if [[ -z "${OUT_FILE}" ]]; then
	mkdir -p "${OUT_DIR}"
	OUT_FILE="${OUT_DIR%/}/${ARTIFACT_NAME}"
else
	mkdir -p "$(dirname "${OUT_FILE}")"
fi

STAGE="$(mktemp -d /tmp/eliteew-fofline-spa-pack.XXXXXX)"
cleanup() {
	# temp only — never trash project paths
	rm -rf "${STAGE}"
}
trap cleanup EXIT

PACK_ROOT="${STAGE}/pack"
mkdir -p "${PACK_ROOT}"

RSYNC_EXCLUDES=()
while IFS= read -r excl; do
	[[ -z "${excl}" ]] && continue
	# Legacy: --include-audio keeps audio/ inside core (prefer group packs).
	if [[ "${INCLUDE_AUDIO}" -eq 1 && "${excl}" == "audio/" ]]; then
		continue
	fi
	RSYNC_EXCLUDES+=(--exclude "${excl}")
done < <(python3 "${GROUPS_PY}" print-core-excludes)
if [[ "${#RSYNC_EXCLUDES[@]}" -gt 0 ]]; then
	echo "INFO: core excludes optional groups: ${RSYNC_EXCLUDES[*]}"
fi
if [[ "${INCLUDE_AUDIO}" -eq 1 ]]; then
	echo "INFO: legacy --include-audio: audio/ embedded in core (prefer fofline-spa-assets-build.sh)"
fi

# Prefer rsync over cp -f (overwrite policy / trash gate). No --delete (fresh STAGE).
rsync -a "${RSYNC_EXCLUDES[@]}" "${DIST%/}/" "${PACK_ROOT}/"

DEPLOY_SNIPPET="{}"
if [[ -f "${DIST}/deployment-manifest.json" ]]; then
	DEPLOY_SNIPPET="$(
		python3 - "${DIST}/deployment-manifest.json" <<'PY'
import json, sys
from pathlib import Path
raw = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
keys = ("schema_version", "deploy_id", "built_at", "built_on_host", "lines")
snip = {k: raw[k] for k in keys if k in raw}
arts = raw.get("artifacts")
if isinstance(arts, dict):
    for k in ("frontend_dist_sha256", "stack0_frontend_image", "stack0_api_image"):
        if k in arts:
            snip.setdefault("artifacts", {})[k] = arts[k]
print(json.dumps(snip, separators=(",", ":")))
PY
	)"
fi

export FSP_APP_BUILD_ID="${APP_BUILD_ID}"
export FSP_INCLUDE_AUDIO="${INCLUDE_AUDIO}"
export FSP_DIST="${DIST}"
export FSP_DEPLOY_SNIPPET="${DEPLOY_SNIPPET}"
export FSP_PACK_ROOT="${PACK_ROOT}"
export FSP_BUILT_AT
FSP_BUILT_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

python3 <<'PY'
import json
import os
from pathlib import Path

root = Path(os.environ["FSP_PACK_ROOT"])
include_audio = os.environ["FSP_INCLUDE_AUDIO"] == "1"
try:
    deploy = json.loads(os.environ.get("FSP_DEPLOY_SNIPPET") or "{}")
except json.JSONDecodeError:
    deploy = {}

manifest = {
    "schema_version": 1,
    "kind": "fofline-spa",
    "app_build_id": os.environ["FSP_APP_BUILD_ID"],
    "deploy_id": os.environ["FSP_APP_BUILD_ID"],
    "include_audio": include_audio,
    "core_excludes_optional_groups": True,
    "has_files_json": True,
    "source_dist": os.environ["FSP_DIST"],
    "built_at": os.environ["FSP_BUILT_AT"],
    "deployment_manifest_snippet": deploy if isinstance(deploy, dict) else {},
}
# Prefer deploy_id from snippet when present
dep_id = manifest["deployment_manifest_snippet"].get("deploy_id")
if isinstance(dep_id, str) and dep_id.strip():
    manifest["deploy_id"] = dep_id.strip()

(root / "pack-manifest.json").write_text(
    json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
)
print(f"OK: wrote {root / 'pack-manifest.json'}")
PY

python3 "${GROUPS_PY}" write-core-files-json \
	--pack-root "${PACK_ROOT}" \
	--app-build-id "${APP_BUILD_ID}"

# Archive from pack root so extract yields index.html + pack-manifest.json at top
TMP_OUT="${STAGE}/out.tar.zst"
(
	cd "${PACK_ROOT}"
	tar -cf - .
) | zstd -T0 -19 -q -o "${TMP_OUT}"

install -m 0644 "${TMP_OUT}" "${OUT_FILE}"

BYTES="$(wc -c <"${OUT_FILE}" | tr -d ' ')"
HUMAN="$(du -h "${OUT_FILE}" | awk '{print $1}')"
echo "OK: pack ${OUT_FILE}"
echo "OK: app_build_id=${APP_BUILD_ID} include_audio=${INCLUDE_AUDIO} size=${HUMAN} (${BYTES} bytes)"
echo "Next: bash scripts/eliteew/fofline-spa-pack-sign.sh --pack ${OUT_FILE}"

if [[ "${WITH_GROUPS}" -eq 1 ]]; then
	echo "INFO: --with-groups → fofline-spa-assets-build.sh"
	bash "${ROOT}/scripts/eliteew/fofline-spa-assets-build.sh" \
		--dist "${DIST}" \
		--out-dir "${OUT_DIR}"
fi
