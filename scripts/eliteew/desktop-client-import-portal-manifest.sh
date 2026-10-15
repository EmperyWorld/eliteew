#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Wave 3b.1 — import peers.manifest.json into desktop_client_portal_peers (additive).
# Invariants:
# - Requires DESKTOP_CLIENT_OPS_TOKEN; does not invent private keys (pubkey must be set).
# - Historical IPs .101–.149 allowed on import; create allocator still uses .150–.254.
# Related: documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MANIFEST=""
API_BASE="${DESKTOP_CLIENT_API_BASE:-https://app.eliteew.ru}"

while [[ $# -gt 0 ]]; do
	case "$1" in
	--manifest) MANIFEST="${2:-}"; shift 2 ;;
	--api-base) API_BASE="${2:-}"; shift 2 ;;
	-h | --help)
		sed -n '2,12p' "$0"
		exit 0
		;;
	*)
		echo "Unknown arg: $1" >&2
		exit 2
		;;
	esac
done

if [[ -z "${MANIFEST}" ]]; then
	MANIFEST="${ROOT}/docker/data/portal-private-tunnel/peers.manifest.json"
fi
if [[ ! -f "${MANIFEST}" ]]; then
	echo "FAIL: manifest not found: ${MANIFEST}" >&2
	exit 2
fi
if [[ -z "${DESKTOP_CLIENT_OPS_TOKEN:-}" ]]; then
	echo "FAIL: DESKTOP_CLIENT_OPS_TOKEN required" >&2
	exit 2
fi

export DC_MANIFEST="${MANIFEST}" DC_API_BASE="${API_BASE}"

python3 <<'PY'
import json
import os
import urllib.error
import urllib.request

path = os.environ["DC_MANIFEST"]
api = os.environ["DC_API_BASE"].rstrip("/")
token = os.environ["DESKTOP_CLIENT_OPS_TOKEN"]
raw = json.loads(open(path, encoding="utf-8").read())
peers = raw.get("peers") if isinstance(raw, dict) else None
if not isinstance(peers, list):
    raise SystemExit("FAIL: peers[] missing in manifest")
body = json.dumps({"peers": peers}).encode("utf-8")
req = urllib.request.Request(
    f"{api}/api/v1/desktop-client/portal-peers/import",
    data=body,
    method="POST",
    headers={
        "Content-Type": "application/json",
        "X-Desktop-Client-Ops-Token": token,
    },
)
try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        doc = json.loads(resp.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    err = e.read().decode("utf-8", errors="replace")
    raise SystemExit(f"FAIL: HTTP {e.code}: {err}") from e

print(
    f"OK: imported={doc.get('imported')} updated={doc.get('updated')} "
    f"skipped={doc.get('skipped')} sync_enqueued={doc.get('edge_sync_enqueued')}",
    flush=True,
)
errs = doc.get("errors") or []
if errs:
    print("errors:", errs[:10], flush=True)
PY
