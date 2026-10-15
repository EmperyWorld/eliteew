#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Single bump for desktop-client TREE_SEMVER mirrors + release-state header.
# Invariants:
# - Write SoT is package.json; refuses when existing mirrors disagree.
# - Does not publish OTA or edit channel live/lag rows (operator updates matrix after ship).
# Related:
# - documentation/product/desktop/DESKTOP-CLIENT-VERSION-SOT.md
# - pack-organization/connection-agent/src/releaseVersion.contract.test.ts
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DC="${ROOT}/pack-organization/connection-agent"
PKG="${DC}/package.json"
CARGO="${DC}/src-tauri/Cargo.toml"
TAURI="${DC}/src-tauri/tauri.conf.json"
APP_VER="${DC}/src/lib/launcher/appVersion.ts"
STATE="${DC}/docs/release-state.v1.json"
HISTORY="${DC}/docs/RELEASE-NOTES-history.ru.json"
TO=""
WITH_NOTES_STUB=0

usage() {
	sed -n '2,14p' "$0"
	echo "Usage: $0 --to X.Y.Z [--with-notes-stub]" >&2
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--to)
		TO="${2:-}"
		shift 2
		;;
	--with-notes-stub)
		WITH_NOTES_STUB=1
		shift
		;;
	-h | --help)
		usage
		exit 0
		;;
	*)
		echo "Unknown arg: $1" >&2
		usage
		exit 2
		;;
	esac
done

if [[ ! "${TO}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	echo "FAIL: --to must be semver X.Y.Z (got '${TO}')" >&2
	exit 2
fi

python3 - "$PKG" "$CARGO" "$TAURI" "$APP_VER" "$STATE" "$TO" "$WITH_NOTES_STUB" "$HISTORY" <<'PY'
import json
import re
import sys
from pathlib import Path

pkg_path, cargo_path, tauri_path, app_path, state_path, new_ver, stub, hist_path = sys.argv[1:9]
stub = stub == "1"

def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8")

pkg = json.loads(read_text(Path(pkg_path)))
old = str(pkg.get("version") or "").strip()
if not re.fullmatch(r"\d+\.\d+\.\d+", old):
    raise SystemExit(f"FAIL: package.json version invalid: {old!r}")

cargo = read_text(Path(cargo_path))
m_cargo = re.search(r'(?m)^version\s*=\s*"([^"]+)"', cargo)
if not m_cargo:
    raise SystemExit("FAIL: Cargo.toml package version not found")
tauri = json.loads(read_text(Path(tauri_path)))
app = read_text(Path(app_path))
m_app = re.search(r"export const APP_VERSION = '([^']+)'", app)
if not m_app:
    raise SystemExit("FAIL: APP_VERSION export not found")
state = json.loads(read_text(Path(state_path)))

mirrors = {
    "package.json": old,
    "Cargo.toml": m_cargo.group(1),
    "tauri.conf.json": str(tauri.get("version") or ""),
    "appVersion.ts": m_app.group(1),
    "release-state.v1.json": str(state.get("tree_semver") or ""),
}
bad = {k: v for k, v in mirrors.items() if v != old}
if bad:
    raise SystemExit(
        "FAIL: TREE mirrors disagree before bump (fix parity first): "
        + ", ".join(f"{k}={v!r}" for k, v in sorted(bad.items()))
        + f"; package.json={old!r}"
    )

if new_ver == old:
    raise SystemExit(f"FAIL: already at {old}")

pkg["version"] = new_ver
Path(pkg_path).write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

cargo_new, n = re.subn(
    r'(?m)^version\s*=\s*"[^"]+"',
    f'version = "{new_ver}"',
    cargo,
    count=1,
)
if n != 1:
    raise SystemExit("FAIL: could not rewrite Cargo.toml version")
Path(cargo_path).write_text(cargo_new, encoding="utf-8")

tauri["version"] = new_ver
Path(tauri_path).write_text(json.dumps(tauri, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

app_new, n = re.subn(
    r"export const APP_VERSION = '[^']+'",
    f"export const APP_VERSION = '{new_ver}'",
    app,
    count=1,
)
if n != 1:
    raise SystemExit("FAIL: could not rewrite APP_VERSION")
Path(app_path).write_text(app_new, encoding="utf-8")

state["tree_semver"] = new_ver
state["updated"] = __import__("datetime").date.today().isoformat()
# After bump, Linux public rows that were live at old tree become lag until publish.
for ch in ("connected", "fofline"):
    row = ((state.get("channels") or {}).get(ch) or {}).get("linux-x86_64-rpm")
    if isinstance(row, dict) and row.get("status") == "live" and row.get("semver") == old:
        row["status"] = "lag"
        row["reason"] = "pending_publish_after_bump"
Path(state_path).write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if stub:
    hist = json.loads(read_text(Path(hist_path)))
    entries = hist.get("entries")
    if not isinstance(entries, list):
        raise SystemExit("FAIL: RELEASE-NOTES-history.ru.json entries missing")
    if not any(isinstance(e, dict) and e.get("version") == new_ver for e in entries):
        entries.insert(
            0,
            {
                "version": new_ver,
                "title": f"Release {new_ver}",
                "summary": "TODO: fill user-facing release notes before publish.",
            },
        )
        hist["entries"] = entries
        Path(hist_path).write_text(
            json.dumps(hist, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

print(f"OK: bumped TREE_SEMVER {old} → {new_ver}")
print("Next: fill RELEASE-NOTES; update CHANNEL_MATRIX after public ship; run --tree-only preflight + vitest releaseVersion.")
PY
