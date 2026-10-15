#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Bake FoFline optional SPA asset groups (.tar.zst + files.json) per §17.2.
# Invariants:
# - Does not run pnpm build; requires existing dist-build.
# - Skips groups with zero files in dist (OK message).
# - Does not sign; pair with fofline-spa-pack-sign.sh per artifact.
# Related:
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §17
# - scripts/eliteew/fofline_spa_groups.py
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GROUPS_PY="${ROOT}/scripts/eliteew/fofline_spa_groups.py"
DIST_DEFAULT="${ROOT}/shared/web/frontend/dist-build"
DIST="${FOFLINE_SPA_DIST:-${DIST_DEFAULT}}"
OUT_DIR="${FOFLINE_SPA_PACK_OUT:-${ROOT}/docker/data/fofline-updates/artifacts}"

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
	-h | --help)
		sed -n '2,14p' "$0"
		cat <<EOF

Usage:
  bash scripts/eliteew/fofline-spa-assets-build.sh \\
    [--dist shared/web/frontend/dist-build] \\
    [--out-dir docker/data/fofline-updates/artifacts]

Writes per group:
  EliteEW_FoFline_SPA_GROUP-<app_build_id>-<group_id>.tar.zst
EOF
		exit 0
		;;
	*)
		echo "Unknown arg: $1" >&2
		exit 2
		;;
	esac
done

if [[ ! -d "${DIST}" || ! -f "${DIST}/app-build-version.txt" ]]; then
	echo "FAIL: usable dist required: ${DIST}" >&2
	exit 1
fi
if ! command -v zstd >/dev/null 2>&1; then
	echo "FAIL: zstd required" >&2
	exit 1
fi
if ! command -v rsync >/dev/null 2>&1; then
	echo "FAIL: rsync required" >&2
	exit 1
fi

APP_BUILD_ID="$(tr -d '[:space:]' <"${DIST}/app-build-version.txt")"
case "${APP_BUILD_ID}" in
*/* | *\\* | *..* | "")
	echo "FAIL: unsafe/empty app_build_id" >&2
	exit 1
	;;
esac

mkdir -p "${OUT_DIR}"
STAGE="$(mktemp -d /tmp/eliteew-fofline-spa-assets.XXXXXX)"
cleanup() { rm -rf "${STAGE}"; }
trap cleanup EXIT

export FSP_DIST="${DIST}"
export FSP_OUT_DIR="${OUT_DIR}"
export FSP_APP_BUILD_ID="${APP_BUILD_ID}"
export FSP_STAGE="${STAGE}"
export FSP_GROUPS_PY="${GROUPS_PY}"
export FSP_BUILT_AT
FSP_BUILT_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

python3 <<'PY'
import json
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(os.environ["FSP_GROUPS_PY"]).resolve().parent))
from fofline_spa_groups import (  # type: ignore
	GROUPS,
	iter_group_files,
	write_files_json,
)

dist = Path(os.environ["FSP_DIST"])
out_dir = Path(os.environ["FSP_OUT_DIR"])
stage = Path(os.environ["FSP_STAGE"])
app_build_id = os.environ["FSP_APP_BUILD_ID"]
built_at = os.environ["FSP_BUILT_AT"]
built = 0
skipped = 0

for group in GROUPS:
	gid = group["id"]
	files = iter_group_files(dist, group)
	if not files:
		print(f"INFO: skip group={gid} (no files in dist)", file=sys.stderr)
		skipped += 1
		continue
	gstage = stage / gid
	gstage.mkdir(parents=True)
	# Copy only selected files preserving relative paths
	for src in files:
		rel = src.relative_to(dist)
		dest = gstage / rel
		dest.parent.mkdir(parents=True, exist_ok=True)
		subprocess.check_call(["rsync", "-a", str(src), str(dest)])
	files_local = [p for p in gstage.rglob("*") if p.is_file()]
	write_files_json(
		gstage / "files.json",
		root=gstage,
		files=files_local,
		group_id=gid,
		app_build_id=app_build_id,
	)
	group_manifest = {
		"schema_version": 1,
		"kind": "fofline-spa-group",
		"group_id": gid,
		"app_build_id": app_build_id,
		"deploy_id": app_build_id,
		"built_at": built_at,
		"paths": group["paths"],
		"exclude_prefixes": group.get("exclude_prefixes") or [],
		"file_count": len(files_local),
	}
	(gstage / "group-manifest.json").write_text(
		json.dumps(group_manifest, indent=2) + "\n", encoding="utf-8"
	)
	artifact = out_dir / f"EliteEW_FoFline_SPA_GROUP-{app_build_id}-{gid}.tar.zst"
	tmp = stage / f"{gid}.tar.zst"
	subprocess.check_call(
		f"cd {gstage!s} && tar -cf - . | zstd -T0 -19 -q -o {tmp!s}",
		shell=True,
	)
	subprocess.check_call(["install", "-m", "0644", str(tmp), str(artifact)])
	size = artifact.stat().st_size
	print(f"OK: group={gid} files={len(files_local)} pack={artifact} bytes={size}")
	built += 1

print(f"OK: groups_built={built} skipped={skipped} app_build_id={app_build_id}")
if built == 0:
	print("FAIL: no groups produced (empty dist optional trees?)", file=sys.stderr)
	sys.exit(1)
PY

echo "Next: sign each EliteEW_FoFline_SPA_GROUP-*.tar.zst then fofline-spa-assets-publish.sh"
