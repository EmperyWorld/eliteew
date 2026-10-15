#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Download pinned WireGuard for Windows MSI into src-tauri/windows/wireguard/.
# Invariants:
# - Fail-closed on HTTP/sha256 mismatch; never invent signatures.
# - MSI is gitignored; VERSION.json is the pin SoT.
# Related:
# - src-tauri/windows/wireguard/VERSION.json
# - documentation/product/desktop/DESKTOP-CLIENT-WINDOWS-BUILD-VM.md
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WG_DIR="${ROOT}/src-tauri/windows/wireguard"
PIN="${WG_DIR}/VERSION.json"
OUT="${WG_DIR}/wireguard-amd64.msi"

if [[ ! -f "$PIN" ]]; then
	echo "FAIL: missing pin $PIN" >&2
	exit 2
fi

python3 - "$PIN" "$OUT" <<'PY'
import hashlib, json, sys, urllib.request
from pathlib import Path

pin_path, out_path = Path(sys.argv[1]), Path(sys.argv[2])
doc = json.loads(pin_path.read_text())
url = doc["url"]
want = doc["sha256"].lower().strip()
out_path.parent.mkdir(parents=True, exist_ok=True)

if out_path.is_file():
    h = hashlib.sha256(out_path.read_bytes()).hexdigest()
    if h == want:
        print(f"OK: cached {out_path.name} sha256={h}")
        raise SystemExit(0)
    print(f"WARN: stale MSI sha256={h} expected={want}; re-fetch", file=sys.stderr)

print(f"[STEP] fetch {url}")
req = urllib.request.Request(url, headers={"User-Agent": "EliteEW-desktop-client-fetch/1.0"})
with urllib.request.urlopen(req, timeout=120) as resp:
    data = resp.read()
got = hashlib.sha256(data).hexdigest()
if got != want:
    print(f"FAIL: sha256 mismatch got={got} want={want}", file=sys.stderr)
    raise SystemExit(3)
out_path.write_bytes(data)
print(f"OK: wrote {out_path} ({len(data)} bytes) sha256={got}")
PY
