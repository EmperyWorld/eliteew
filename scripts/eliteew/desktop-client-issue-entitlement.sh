#!/usr/bin/env bash
# EliteEW · issue signed desktop-client entitlement blob (USB / cold start).
# Usage:
#   bash scripts/eliteew/desktop-client-issue-entitlement.sh \
#     --license-id <uuid> [--edition client] [--profile-id client-offline-ai] \
#     [--fingerprint fp_…] [--exp-days 365] [--out path.json]
# Env:
#   DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY  — required 32-byte seed hex
#   Or generate once: bash … --generate-keypair  (prints seed+pubkey; store seed in vault)
# Related: documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_PY="${ROOT}/.venv/bin/python"
if [[ ! -x "${API_PY}" ]]; then
  API_PY="$(command -v python3)"
fi

GENERATE=0
LICENSE_ID=""
EDITION="${ELITEEW_DESKTOP_CLIENT_EDITION:-client}"
PROFILE_ID="${ELITEEW_DESKTOP_CLIENT_PROFILE_ID:-client-offline-ai}"
FINGERPRINT=""
EXP_DAYS="${ELITEEW_DESKTOP_CLIENT_ENTITLEMENT_EXP_DAYS:-365}"
OUT=""
DEVICE_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --generate-keypair) GENERATE=1; shift ;;
    --license-id) LICENSE_ID="${2:-}"; shift 2 ;;
    --edition) EDITION="${2:-}"; shift 2 ;;
    --profile-id) PROFILE_ID="${2:-}"; shift 2 ;;
    --fingerprint) FINGERPRINT="${2:-}"; shift 2 ;;
    --device-id) DEVICE_ID="${2:-}"; shift 2 ;;
    --exp-days) EXP_DAYS="${2:-}"; shift 2 ;;
    --out) OUT="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

# Resolve --out before cd (relative paths are from monorepo root).
if [[ -n "${OUT}" && "${OUT}" != /* ]]; then
  OUT="${ROOT}/${OUT}"
fi

cd "${ROOT}/shared/api"
export DC_GENERATE="${GENERATE}"
export DC_LICENSE_ID="${LICENSE_ID}"
export DC_EDITION="${EDITION}"
export DC_PROFILE_ID="${PROFILE_ID}"
export DC_FINGERPRINT="${FINGERPRINT}"
export DC_DEVICE_ID="${DEVICE_ID}"
export DC_EXP_DAYS="${EXP_DAYS}"
export DC_OUT="${OUT}"

PYTHONPATH=.. "${API_PY}" <<'PY'
from __future__ import annotations

import json
import os
import sys
from datetime import UTC, datetime, timedelta

from api.services.desktop_client.entitlement_sign import (
    build_payload,
    generate_keypair_hex,
    sign_payload,
)

if os.environ.get("DC_GENERATE") == "1":
    seed, pub = generate_keypair_hex()
    print("=== entitlement keypair (store seed in vault / SOPS; pubkey → DESKTOP_CLIENT_ENTITLEMENT_PUBKEY) ===", file=sys.stderr)
    print(f"DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY={seed}")
    print(f"DESKTOP_CLIENT_ENTITLEMENT_PUBKEY={pub}")
    raise SystemExit(0)

license_id = os.environ.get("DC_LICENSE_ID", "").strip()
if not license_id:
    print("--license-id required (or --generate-keypair)", file=sys.stderr)
    raise SystemExit(2)

exp_days = int(os.environ.get("DC_EXP_DAYS") or "365")
expires = datetime.now(UTC) + timedelta(days=exp_days) if exp_days > 0 else None
fp = os.environ.get("DC_FINGERPRINT", "").strip() or None
device_id = os.environ.get("DC_DEVICE_ID", "").strip() or None

payload = build_payload(
    license_id=license_id,
    edition=(os.environ.get("DC_EDITION") or "client").strip(),
    profile_id=(os.environ.get("DC_PROFILE_ID") or "client-offline-ai").strip() or None,
    apps=None,
    machine_fingerprint=fp,
    device_id=device_id,
    expires_at=expires,
)
doc = sign_payload(payload)
text = json.dumps(doc, ensure_ascii=False, indent=2) + "\n"
out = os.environ.get("DC_OUT", "").strip()
if out:
    with open(out, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"wrote {out}", file=sys.stderr)
else:
    sys.stdout.write(text)
PY
