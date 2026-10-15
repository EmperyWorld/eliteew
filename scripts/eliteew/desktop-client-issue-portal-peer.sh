#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Ops helper — create desktop-client portal peer via API (Wave 3b).
# Invariants:
# - Requires DESKTOP_CLIENT_OPS_TOKEN + API base; writes conf under gitignored peers dir.
# - Does not replace portalctl for manifest peers (.101–.149).
# Related: documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SLUG=""
LABEL=""
OUT_DIR="${ROOT}/docker/data/portal-private-tunnel/peers"
API_BASE="${DESKTOP_CLIENT_API_BASE:-https://app.eliteew.ru}"

while [[ $# -gt 0 ]]; do
	case "$1" in
	--slug) SLUG="${2:-}"; shift 2 ;;
	--label) LABEL="${2:-}"; shift 2 ;;
	--out-dir) OUT_DIR="${2:-}"; shift 2 ;;
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

if [[ -z "${SLUG}" ]]; then
	echo "FAIL: --slug required" >&2
	exit 2
fi
if [[ -z "${DESKTOP_CLIENT_OPS_TOKEN:-}" ]]; then
	echo "FAIL: DESKTOP_CLIENT_OPS_TOKEN required" >&2
	exit 2
fi

mkdir -p "${OUT_DIR}"
CONF_PATH="${OUT_DIR}/${SLUG}.conf"
export DC_SLUG="${SLUG}" DC_LABEL="${LABEL}" DC_API_BASE="${API_BASE}" DC_CONF="${CONF_PATH}"

python3 <<'PY'
import json
import os
import urllib.error
import urllib.request

slug = os.environ["DC_SLUG"]
label = (os.environ.get("DC_LABEL") or "").strip() or None
api = os.environ["DC_API_BASE"].rstrip("/")
token = os.environ["DESKTOP_CLIENT_OPS_TOKEN"]
conf_path = os.environ["DC_CONF"]
body = json.dumps({"slug": slug, "label": label}).encode("utf-8")
req = urllib.request.Request(
    f"{api}/api/v1/desktop-client/portal-peers",
    data=body,
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

with open(conf_path, "w", encoding="utf-8") as f:
    f.write(doc["client_conf"])
os.chmod(conf_path, 0o600)
peer = doc["peer"]
print(
    f"OK: peer_id={peer['id']} ip={peer['assigned_ip']} "
    f"sync={peer['edge_sync_status']} conf={conf_path}",
    flush=True,
)
print(conf_path)
PY
