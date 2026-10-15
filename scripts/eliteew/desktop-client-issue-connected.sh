#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Wave 3b.1 — issue license + portal peer in one ops path (hand-to-hand).
# Invariants:
# - Prints license_key once; writes WG client conf under gitignored peers dir.
# - Requires DESKTOP_CLIENT_OPS_TOKEN + portal endpoint env on API for peer create.
# Related: documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SLUG=""
LABEL=""
LICENSE_ID=""
SKIP_LICENSE=0
EDITION="${ELITEEW_DESKTOP_CLIENT_EDITION:-connected}"
PROFILE_ID="${ELITEEW_DESKTOP_CLIENT_PROFILE_ID:-}"
OUT_DIR="${ROOT}/docker/data/portal-private-tunnel/peers"
API_BASE="${DESKTOP_CLIENT_API_BASE:-https://app.eliteew.ru}"

while [[ $# -gt 0 ]]; do
	case "$1" in
	--slug) SLUG="${2:-}"; shift 2 ;;
	--label) LABEL="${2:-}"; shift 2 ;;
	--license-id) LICENSE_ID="${2:-}"; shift 2 ;;
	--skip-license) SKIP_LICENSE=1; shift ;;
	--edition) EDITION="${2:-}"; shift 2 ;;
	--profile-id) PROFILE_ID="${2:-}"; shift 2 ;;
	--out-dir) OUT_DIR="${2:-}"; shift 2 ;;
	--api-base) API_BASE="${2:-}"; shift 2 ;;
	-h | --help)
		sed -n '2,14p' "$0"
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
export DC_LICENSE_ID="${LICENSE_ID}" DC_SKIP_LICENSE="${SKIP_LICENSE}"
export DC_EDITION="${EDITION}" DC_PROFILE_ID="${PROFILE_ID}"

python3 <<'PY'
import json
import os
import sys
import urllib.error
import urllib.request

slug = os.environ["DC_SLUG"]
label = (os.environ.get("DC_LABEL") or "").strip() or None
api = os.environ["DC_API_BASE"].rstrip("/")
token = os.environ["DESKTOP_CLIENT_OPS_TOKEN"]
conf_path = os.environ["DC_CONF"]
skip_license = os.environ.get("DC_SKIP_LICENSE", "0") == "1"
license_id = (os.environ.get("DC_LICENSE_ID") or "").strip() or None
edition = (os.environ.get("DC_EDITION") or "connected").strip() or "connected"
profile_id = (os.environ.get("DC_PROFILE_ID") or "").strip() or None


def post(path: str, body: dict) -> dict:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{api}{path}",
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Desktop-Client-Ops-Token": token,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"FAIL: HTTP {e.code} {path}: {err}") from e


if not skip_license and not license_id:
    issued = post(
        "/api/v1/desktop-client/license/issue",
        {"label": label, "edition": edition, "profile_id": profile_id},
    )
    license_id = issued["license_id"]
    print("=== desktop-client license (show once; deliver out of band) ===", file=sys.stderr)
    print(issued["license_key"], flush=True)
    print(f"license_id={license_id}", file=sys.stderr)

peer_body = {"slug": slug, "label": label}
if license_id:
    peer_body["license_id"] = license_id

doc = post("/api/v1/desktop-client/portal-peers", peer_body)
with open(conf_path, "w", encoding="utf-8") as f:
    f.write(doc["client_conf"])
os.chmod(conf_path, 0o600)
peer = doc["peer"]
print(
    f"OK: peer_id={peer['id']} ip={peer['assigned_ip']} "
    f"license_id={peer.get('license_id')} sync={peer['edge_sync_status']} conf={conf_path}",
    flush=True,
)
print(conf_path)
PY
