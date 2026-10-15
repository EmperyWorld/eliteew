#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Stage signed FoFline SPA asset groups + write spa-assets-latest.json (§17.3).
# Invariants:
# - Fail-closed without --sig-dir (or per-group .sig next to packs).
# - Does not rewrite shell latest.json; does not replace spa-latest.json core channel.
# Related:
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §17
# - scripts/eliteew/fofline-spa-assets-build.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PUBLIC_BASE="${FOFLINE_UPDATE_PUBLIC_BASE:-https://app.eliteew.ru/fofline-updates}"
OUT_DIR="${FOFLINE_UPDATES_OUT:-${ROOT}/docker/data/fofline-updates}"
PACKS_DIR=""
APP_BUILD_ID=""
CORE_SPA_LATEST=""

while [[ $# -gt 0 ]]; do
	case "$1" in
	--packs-dir)
		PACKS_DIR="${2:-}"
		shift 2
		;;
	--out)
		OUT_DIR="${2:-}"
		shift 2
		;;
	--app-build-id)
		APP_BUILD_ID="${2:-}"
		shift 2
		;;
	--core-spa-latest)
		CORE_SPA_LATEST="${2:-}"
		shift 2
		;;
	--public-base)
		PUBLIC_BASE="${2:-}"
		shift 2
		;;
	-h | --help)
		sed -n '2,14p' "$0"
		cat <<EOF

Usage:
  bash scripts/eliteew/fofline-spa-assets-publish.sh \\
    --packs-dir docker/data/fofline-updates/artifacts \\
    --app-build-id <id> \\
    [--core-spa-latest docker/data/fofline-updates/spa-latest.json] \\
    [--out docker/data/fofline-updates]

Requires sibling .sig next to each EliteEW_FoFline_SPA_GROUP-<id>-<group>.tar.zst
Writes OUT/spa-assets-latest.json and stages packs under OUT/artifacts/
EOF
		exit 0
		;;
	*)
		echo "Unknown arg: $1" >&2
		exit 2
		;;
	esac
done

if [[ -z "${PACKS_DIR}" || -z "${APP_BUILD_ID}" ]]; then
	echo "FAIL: --packs-dir and --app-build-id required" >&2
	exit 2
fi
if [[ ! -d "${PACKS_DIR}" ]]; then
	echo "FAIL: packs-dir missing: ${PACKS_DIR}" >&2
	exit 1
fi

mkdir -p "${OUT_DIR}/artifacts"
export FSP_PACKS_DIR="$(cd "${PACKS_DIR}" && pwd)"
export FSP_OUT_DIR="$(cd "${OUT_DIR}" && pwd)"
export FSP_APP_BUILD_ID="${APP_BUILD_ID}"
export FSP_PUBLIC_BASE="${PUBLIC_BASE%/}"
export FSP_CORE_SPA_LATEST="${CORE_SPA_LATEST}"
export FSP_PUB_DATE
FSP_PUB_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

python3 <<'PY'
import json
import os
import re
import shutil
import sys
from pathlib import Path

packs_dir = Path(os.environ["FSP_PACKS_DIR"])
out_dir = Path(os.environ["FSP_OUT_DIR"])
artifacts = out_dir / "artifacts"
app_build_id = os.environ["FSP_APP_BUILD_ID"]
public_base = os.environ["FSP_PUBLIC_BASE"]
pat = re.compile(
	rf"^EliteEW_FoFline_SPA_GROUP-{re.escape(app_build_id)}-(.+)\.tar\.zst$"
)
groups = []
for pack in sorted(packs_dir.glob(f"EliteEW_FoFline_SPA_GROUP-{app_build_id}-*.tar.zst")):
	m = pat.match(pack.name)
	if not m:
		continue
	gid = m.group(1)
	sig = Path(str(pack) + ".sig")
	if not sig.is_file():
		print(f"FAIL: missing signature for {pack.name}", file=sys.stderr)
		sys.exit(1)
	dest_pack = artifacts / pack.name
	dest_sig = artifacts / sig.name
	if pack.resolve() != dest_pack.resolve():
		shutil.copy2(pack, dest_pack)
	if sig.resolve() != dest_sig.resolve():
		shutil.copy2(sig, dest_sig)
	dest_pack.chmod(0o644)
	dest_sig.chmod(0o644)
	sha = __import__("hashlib").sha256(dest_pack.read_bytes()).hexdigest()
	signature = dest_sig.read_text(encoding="utf-8").replace("\n", "").replace("\r", "")
	groups.append(
		{
			"id": gid,
			"artifact": f"artifacts/{pack.name}",
			"url": f"{public_base}/artifacts/{pack.name}",
			"sha256": sha,
			"signature": signature,
		}
	)

if not groups:
	print(
		f"FAIL: no signed group packs for app_build_id={app_build_id} in {packs_dir}",
		file=sys.stderr,
	)
	sys.exit(1)

core_ref = None
core_path = (os.environ.get("FSP_CORE_SPA_LATEST") or "").strip()
if core_path:
	cp = Path(core_path)
	if cp.is_file():
		core_doc = json.loads(cp.read_text(encoding="utf-8"))
		core_ref = {
			"app_build_id": core_doc.get("app_build_id"),
			"url": core_doc.get("url"),
			"sha256": core_doc.get("sha256"),
			"artifact": core_doc.get("artifact"),
		}

doc = {
	"schema_version": 1,
	"kind": "fofline-spa-assets",
	"app_build_id": app_build_id,
	"deploy_id": app_build_id,
	"pub_date": os.environ["FSP_PUB_DATE"],
	"public_base": public_base,
	"core": core_ref,
	"groups": groups,
}
out = out_dir / "spa-assets-latest.json"
out.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
print(f"OK: wrote {out}")
print(f"OK: groups={len(groups)} app_build_id={app_build_id}")
print("Next: sync OUT to prod-core /srv/eliteew/fofline-updates (spa-assets-latest.json)")
PY
