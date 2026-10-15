#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Sign + stage O4 soft-revoke denylist.json for /desktop-client-updates/.
# Invariants:
# - Requires DESKTOP_CLIENT_DENYLIST_SIGNING_KEY (Wave 8 role-separated; not entitlement).
# - Ops passes --license-id (repeatable); --license-id __empty__ clears list.
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${DESKTOP_CLIENT_UPDATES_OUT:-${ROOT}/docker/data/desktop-client-updates}"
NOTE=""
LICENSE_IDS=()
CLEAR=0

while [[ $# -gt 0 ]]; do
	case "$1" in
	--license-id)
		if [[ "${2:-}" == "__empty__" ]]; then
			CLEAR=1
		else
			LICENSE_IDS+=("${2:-}")
		fi
		shift 2
		;;
	--out)
		OUT_DIR="${2:-}"
		shift 2
		;;
	--note)
		NOTE="${2:-}"
		shift 2
		;;
	-h | --help)
		cat <<EOF
Usage:
  export DESKTOP_CLIENT_DENYLIST_SIGNING_KEY=<32-byte hex seed>
  bash scripts/eliteew/desktop-client-publish-denylist.sh \\
    --license-id <uuid> [--license-id <uuid2>] \\
    [--out docker/data/desktop-client-updates] \\
    [--note "soft revoke"]

Clear all soft-revokes:
  bash scripts/eliteew/desktop-client-publish-denylist.sh --license-id __empty__

Writes denylist.json next to latest.json / latest.v2.json. Sync OUT → prod-core
/srv/eliteew/desktop-client-updates (same volume as O2 OTA).
EOF
		exit 0
		;;
	*)
		echo "Unknown arg: $1" >&2
		exit 2
		;;
	esac
done

if [[ "${CLEAR}" -eq 0 && ${#LICENSE_IDS[@]} -eq 0 ]]; then
	echo "FAIL: pass at least one --license-id (or --license-id __empty__)" >&2
	exit 2
fi
SEED="${DESKTOP_CLIENT_DENYLIST_SIGNING_KEY:-}"
if [[ -z "${SEED}" || "${SEED}" == *REPLACE_WITH* || ${#SEED} -ne 64 ]]; then
	echo "FAIL: DESKTOP_CLIENT_DENYLIST_SIGNING_KEY must be a 32-byte hex seed (Wave 8)" >&2
	exit 2
fi

mkdir -p "${OUT_DIR}"
OUT_FILE="${OUT_DIR}/denylist.json"

if [[ "${CLEAR}" -eq 1 ]]; then
	IDS_JSON='[]'
else
	IDS_JSON="$(printf '%s\n' "${LICENSE_IDS[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')"
fi

export IDS_JSON DENYLIST_NOTE="${NOTE}" OUT_FILE ROOT
python3 <<'PY'
import json
import os
import sys

root = os.environ["ROOT"]
sys.path.insert(0, os.path.join(root, "EliteEW"))
sys.path.insert(0, os.path.join(root, "EliteEW", "api"))
from api.services.desktop_client.denylist_sign import build_denylist_payload, sign_denylist

ids = json.loads(os.environ["IDS_JSON"])
note = (os.environ.get("DENYLIST_NOTE") or "").strip() or None
payload = build_denylist_payload(revoked_license_ids=ids, note=note)
doc = sign_denylist(payload)
out = os.environ["OUT_FILE"]
os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
with open(out, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"OK: wrote {out} revoked={len(payload['revoked_license_ids'])}")
PY
