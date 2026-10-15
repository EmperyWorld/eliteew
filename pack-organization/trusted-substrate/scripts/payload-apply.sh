#!/usr/bin/env bash
# Purpose: Apply signed shell payload to inactive A/B slot and activate (W6; Electron or Tauri binary).
# Related: policy/payload_slots.py · scripts/image-verify.sh · docs/PAYLOAD-UPDATE.md · docs/PAYLOAD-TAURI.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLOTS="${ELITEEW_TS_PAYLOAD_SLOTS:-${ROOT}/work/payload-slots}"
PAYLOAD=""
VERSION=""
PUB="${ELITEEW_TS_SIGNING_PUB:-${ROOT}/config/signing/image-signing.pub.pem}"
SIG=""

usage() {
  cat <<'EOF'
Usage: payload-apply.sh --payload PATH --version VER [--signature PATH] [--slots DIR] [--pubkey PATH]
Verifies detached signature (W5), writes inactive slot, switches active, enables one rollback
only when the previous active slot already had a version (seeded).
Refuses if OS_UPDATE_PENDING=1 in state.env (SoT OS channel precedence).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --payload) PAYLOAD="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --signature) SIG="$2"; shift 2 ;;
    --slots) SLOTS="$2"; shift 2 ;;
    --pubkey) PUB="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "${PAYLOAD}" || -z "${VERSION}" ]]; then
  usage >&2
  exit 2
fi
if [[ ! -f "${PAYLOAD}" ]]; then
  echo "payload-apply: payload missing: ${PAYLOAD}" >&2
  exit 1
fi
if [[ ! -f "${SLOTS}/state.env" ]]; then
  bash "${ROOT}/scripts/payload-slot-init.sh" --slots "${SLOTS}"
fi

SIG="${SIG:-${PAYLOAD}.sig}"
bash "${ROOT}/scripts/image-verify.sh" --image "${PAYLOAD}" --signature "${SIG}" --pubkey "${PUB}"

PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"

# shellcheck disable=SC1090
source "${SLOTS}/state.env"
OS_PENDING="${OS_UPDATE_PENDING:-0}"

set +e
NEW_STATE="$(
  PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from policy.payload_slots import (
    PayloadSlotError,
    PayloadSlotState,
    apply_to_inactive,
    parse_slot,
)
try:
    state = PayloadSlotState(
        active=parse_slot("${ACTIVE_SLOT:-A}"),
        rollback_available=bool(int("${ROLLBACK_AVAILABLE:-0}")),
        version_a="${VERSION_A:-}",
        version_b="${VERSION_B:-}",
    )
    new = apply_to_inactive(
        state,
        new_version="${VERSION}",
        os_update_pending=bool(int("${OS_PENDING}")),
    )
except PayloadSlotError as exc:
    print(exc)
    raise SystemExit(1)
print(new.active.value)
print(int(new.rollback_available))
print(new.version_a)
print(new.version_b)
PY
)"
rc=$?
set -e
if [[ "${rc}" -ne 0 ]]; then
  echo "payload-apply: ${NEW_STATE}" >&2
  exit 1
fi

mapfile -t NS <<<"${NEW_STATE}"
NEW_ACTIVE="${NS[0]}"
NEW_RB="${NS[1]}"
NEW_VA="${NS[2]}"
NEW_VB="${NS[3]}"

TARGET="${SLOTS}/${NEW_ACTIVE}"
mkdir -p "${TARGET}"
cp -f "${PAYLOAD}" "${TARGET}/EliteEW.AppImage"
chmod +x "${TARGET}/EliteEW.AppImage"
cp -f "${SIG}" "${TARGET}/EliteEW.AppImage.sig"

cat >"${SLOTS}/state.env" <<EOF
ACTIVE_SLOT=${NEW_ACTIVE}
ROLLBACK_AVAILABLE=${NEW_RB}
VERSION_A=${NEW_VA}
VERSION_B=${NEW_VB}
OS_UPDATE_PENDING=${OS_PENDING}
EOF
ln -sfn "${NEW_ACTIVE}" "${SLOTS}/current"

echo "[payload-apply] active=${NEW_ACTIVE} version=${VERSION} rollback_available=${NEW_RB}"
bash "${ROOT}/scripts/payload-slot-status.sh" --slots "${SLOTS}"
