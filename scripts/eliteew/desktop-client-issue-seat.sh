#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Issue downloadable desktop-client seat package via API (writes Postgres).
# Invariants:
# - Requires DESKTOP_CLIENT_OPS_TOKEN; calls POST /api/v1/desktop-client/seats/issue (DB INSERT).
# - Modes: offline (default) | cloud | both. Optional --allowed-email for online bind (#015).
# - Optional --allow-fofline for FoFline entitlement (W2; default off).
# - Prefer Admin Platform Ops → Portal peers → «Выдать место» for operators.
# Related: documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md (ops issue paths)
#   documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §4 / W2
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="offline"
LABEL=""
SLUG=""
ALLOWED_EMAIL=""
ALLOW_FOFLINE="0"
DEVICE_REQUEST=""
OUT=""
API_BASE="${DESKTOP_CLIENT_API_BASE:-https://app.eliteew.ru}"

while [[ $# -gt 0 ]]; do
	case "$1" in
	--mode) MODE="${2:-}"; shift 2 ;;
	--label) LABEL="${2:-}"; shift 2 ;;
	--slug) SLUG="${2:-}"; shift 2 ;;
	--allowed-email) ALLOWED_EMAIL="${2:-}"; shift 2 ;;
	--allow-fofline) ALLOW_FOFLINE="1"; shift ;;
	--device-request) DEVICE_REQUEST="${2:-}"; shift 2 ;;
	--out) OUT="${2:-}"; shift 2 ;;
	--api-base) API_BASE="${2:-}"; shift 2 ;;
	-h | --help)
		sed -n '2,16p' "$0"
		exit 0
		;;
	*)
		echo "Unknown arg: $1" >&2
		exit 2
		;;
	esac
done

if [[ -z "${DESKTOP_CLIENT_OPS_TOKEN:-}" ]]; then
	echo "FAIL: DESKTOP_CLIENT_OPS_TOKEN required" >&2
	exit 2
fi

if [[ -z "${DEVICE_REQUEST}" || ! -f "${DEVICE_REQUEST}" ]]; then
	echo "FAIL: --device-request <file> required" >&2
	exit 2
fi

export DC_MODE="${MODE}" DC_LABEL="${LABEL}" DC_SLUG="${SLUG}" \
	DC_ALLOWED_EMAIL="${ALLOWED_EMAIL}" DC_ALLOW_FOFLINE="${ALLOW_FOFLINE}" \
	DC_DEVICE_REQUEST="${DEVICE_REQUEST}" \
	DC_API_BASE="${API_BASE}" DC_OUT="${OUT}"

python3 <<'PY'
import base64
import json
import os
import sys
import urllib.error
import urllib.request

mode = (os.environ.get("DC_MODE") or "offline").strip() or "offline"
label = (os.environ.get("DC_LABEL") or "").strip() or None
slug = (os.environ.get("DC_SLUG") or "").strip() or None
allowed_email = (os.environ.get("DC_ALLOWED_EMAIL") or "").strip() or None
allow_fofline = (os.environ.get("DC_ALLOW_FOFLINE") or "0").strip() in ("1", "true", "yes")
api = os.environ["DC_API_BASE"].rstrip("/")
token = os.environ["DESKTOP_CLIENT_OPS_TOKEN"]
out = (os.environ.get("DC_OUT") or "").strip()

req_path = os.environ["DC_DEVICE_REQUEST"]
with open(req_path, encoding="utf-8") as fh:
    device_request = json.load(fh)
body = {
    "mode": mode,
    "label": label,
    "slug": slug,
    "allowed_email": allowed_email,
    "allow_fofline": allow_fofline,
    "device_request": device_request,
}
data = json.dumps(body).encode("utf-8")
req = urllib.request.Request(
    f"{api}/api/v1/desktop-client/seats/issue",
    data=data,
    method="POST",
    headers={
        "Content-Type": "application/json",
        "X-Desktop-Client-Ops-Token": token,
    },
)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        doc = json.loads(resp.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    err = e.read().decode("utf-8", errors="replace")
    raise SystemExit(f"FAIL: HTTP {e.code}: {err}") from e

filename = doc.get("filename") or "eliteew-seat.json"
package = doc["package"]
if out:
    path = out
    if package.get("encoding") == "ecap_v3" and not path.endswith(".ecap"):
        path = f"{path.rsplit('.', 1)[0]}.ecap" if "." in os.path.basename(path) else f"{path}.ecap"
elif package.get("encoding") == "ecap_v3":
    path = os.path.join("/tmp", filename if filename.endswith(".ecap") else "eliteew-capsule-seat.ecap")
else:
    path = os.path.join("/tmp", filename)

if package.get("encoding") == "ecap_v3":
    b64 = package.get("package_b64")
    if not isinstance(b64, str) or not b64.strip():
        raise SystemExit("FAIL: ecap_v3 response missing package_b64")
    blob = base64.b64decode(b64)
    if not blob.startswith(b"EECAP3"):
        raise SystemExit("FAIL: decoded seat is not Capsule v3 (EECAP3 magic)")
    with open(path, "wb") as f:
        f.write(blob)
else:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(package, f, ensure_ascii=False, indent=2)
        f.write("\n")
os.chmod(path, 0o600)
meta_note = "ecap_v3 binary" if package.get("encoding") == "ecap_v3" else "json"
print(f"OK: {meta_note} file={path}", file=sys.stderr)
print(path)
PY
