#!/usr/bin/env bash
# Smoke an EliteEW install profile (local resolve + optional live API).
# Canon: documentation/platform/ELITEEW-ONPREM-TEAM-CORE-PACK.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="$ROOT/shared/api"
PY="${UV_PROJECT_ENVIRONMENT:-$ROOT/.venv}/bin/python"
if [[ ! -x "$PY" ]]; then
  PY="${PYTHON:-python3}"
fi

PROFILE="onprem-team-core"
API_BASE=""
TOKEN=""

usage() {
  cat <<'EOF'
Usage: smoke-install-profile.sh [--profile ID] [--api-base URL] [--token JWT]

  --profile ID     Install profile id (default: onprem-team-core)
  --api-base URL   Optional API v1 base, e.g. https://host/api/v1
  --token JWT      Bearer for GET /desktop/install-profile (required with --api-base)

Local checks always run (manifest/profile resolve). Live API is optional.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="${2:?}"
      shift 2
      ;;
    --api-base)
      API_BASE="${2:?}"
      shift 2
      ;;
    --token)
      TOKEN="${2:?}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown arg: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -n "$API_BASE" && -z "$TOKEN" ]]; then
  echo "ERROR: --api-base requires --token" >&2
  exit 2
fi

export PYTHONPATH="${PYTHONPATH:-}:.."
cd "$API"

echo "[STEP] smoke_install_profile_local profile=$PROFILE"
LOCAL_OUT="$("$PY" - <<PY
from api.services.desktop_app_manifests.profiles import (
    load_profile,
    resolve_enabled_app_components,
)
from api.services.desktop_app_manifests.runtime import DEFAULT_PROFILE_BY_EDITION

p = load_profile("$PROFILE")
comps = resolve_enabled_app_components("$PROFILE")
default_for_edition = DEFAULT_PROFILE_BY_EDITION[p.edition]
print(f"edition={p.edition}")
print(f"profile_id={p.id}")
print(f"mode={p.mode}")
print(f"access_mode={p.access_mode}")
print(f"seat_activation_required={str(p.seat_activation_required).lower()}")
print(f"include_legacy={p.include_legacy}")
print(f"enabled_components={len(comps)}")
print(f"default_profile_for_edition={default_for_edition}")
print("components=" + ",".join(sorted(comps)))
print("recommended_env_edition=" + p.edition)
print("recommended_env_profile=" + p.id)
PY
)"
echo "$LOCAL_OUT"

EDITION="$(echo "$LOCAL_OUT" | sed -n 's/^edition=//p' | head -1)"
PROFILE_ID="$(echo "$LOCAL_OUT" | sed -n 's/^profile_id=//p' | head -1)"
COUNT="$(echo "$LOCAL_OUT" | sed -n 's/^enabled_components=//p' | head -1)"
ACCESS_MODE="$(echo "$LOCAL_OUT" | sed -n 's/^access_mode=//p' | head -1)"
SEAT_ACTIVATION_REQUIRED="$(echo "$LOCAL_OUT" | sed -n 's/^seat_activation_required=//p' | head -1)"

if [[ -z "$EDITION" || -z "$PROFILE_ID" || -z "$COUNT" || -z "$ACCESS_MODE" || -z "$SEAT_ACTIVATION_REQUIRED" || "$COUNT" -lt 1 ]]; then
  echo "FAIL: local profile resolve" >&2
  exit 1
fi
if [[ "$ACCESS_MODE" == "community" && "$SEAT_ACTIVATION_REQUIRED" != "false" ]]; then
  echo "FAIL: community profile requires seat activation" >&2
  exit 1
fi
if [[ "$PROFILE_ID" == "onprem-team-core" && ( "$ACCESS_MODE" != "community" || "$SEAT_ACTIVATION_REQUIRED" != "false" ) ]]; then
  echo "FAIL: onprem-team-core must remain community without seat activation" >&2
  exit 1
fi

PACK_ENV="$ROOT/shared/apps/_profiles/packs/${PROFILE}.env.example"
if [[ -f "$PACK_ENV" ]]; then
  echo "[STEP] pack_env_example path=$PACK_ENV"
  if ! grep -q "ELITEEW_PRODUCT_EDITION=${EDITION}" "$PACK_ENV"; then
    echo "FAIL: pack env missing ELITEEW_PRODUCT_EDITION=${EDITION}" >&2
    exit 1
  fi
  if ! grep -q "ELITEEW_INSTALL_PROFILE=${PROFILE_ID}" "$PACK_ENV"; then
    echo "FAIL: pack env missing ELITEEW_INSTALL_PROFILE=${PROFILE_ID}" >&2
    exit 1
  fi
  echo "ok pack_env_example"
else
  echo "[STEP] pack_env_example skip (no packs/${PROFILE}.env.example)"
fi

if [[ -z "$API_BASE" ]]; then
  echo "PASS: local install-profile smoke profile=$PROFILE_ID edition=$EDITION components=$COUNT"
  exit 0
fi

BASE="${API_BASE%/}"
URL="${BASE}/desktop/install-profile"
echo "[STEP] smoke_install_profile_live url=$URL"
RESP="$(curl -sfS -H "Authorization: Bearer ${TOKEN}" -H "Accept: application/json" "$URL")"
LIVE_EDITION="$(echo "$RESP" | "$PY" -c 'import json,sys; print(json.load(sys.stdin).get("edition",""))')"
LIVE_PROFILE="$(echo "$RESP" | "$PY" -c 'import json,sys; print(json.load(sys.stdin).get("profile_id",""))')"
LIVE_N="$(echo "$RESP" | "$PY" -c 'import json,sys; print(len(json.load(sys.stdin).get("enabled_app_components") or []))')"
LIVE_ACCESS="$(echo "$RESP" | "$PY" -c 'import json,sys; print(json.load(sys.stdin).get("access_mode",""))')"
LIVE_SEAT="$(echo "$RESP" | "$PY" -c 'import json,sys; print(str(json.load(sys.stdin).get("seat_activation_required","")).lower())')"

echo "live edition=$LIVE_EDITION profile_id=$LIVE_PROFILE access_mode=$LIVE_ACCESS seat_activation_required=$LIVE_SEAT enabled_components=$LIVE_N"
if [[ "$LIVE_EDITION" != "$EDITION" || "$LIVE_PROFILE" != "$PROFILE_ID" || "$LIVE_ACCESS" != "$ACCESS_MODE" || "$LIVE_SEAT" != "$SEAT_ACTIVATION_REQUIRED" ]]; then
  echo "FAIL: live install-profile mismatch (expected edition=$EDITION profile=$PROFILE_ID access=$ACCESS_MODE seat=$SEAT_ACTIVATION_REQUIRED)" >&2
  exit 1
fi
if [[ "$LIVE_N" -lt 1 ]]; then
  echo "FAIL: live enabled_app_components empty" >&2
  exit 1
fi

echo "PASS: live+local install-profile smoke profile=$PROFILE_ID edition=$EDITION components=$COUNT live_n=$LIVE_N"
