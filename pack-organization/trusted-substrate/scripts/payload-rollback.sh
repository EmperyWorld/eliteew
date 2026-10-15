#!/usr/bin/env bash
# Purpose: Roll back once to previous payload slot (W6).
# Related: policy/payload_slots.py · docs/PAYLOAD-UPDATE.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLOTS="${ELITEEW_TS_PAYLOAD_SLOTS:-${ROOT}/work/payload-slots}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slots) SLOTS="$2"; shift 2 ;;
    -h|--help) echo "Usage: payload-rollback.sh [--slots DIR]"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ ! -f "${SLOTS}/state.env" ]]; then
  echo "payload-rollback: missing state ${SLOTS}/state.env" >&2
  exit 1
fi

PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"

# shellcheck disable=SC1090
source "${SLOTS}/state.env"

set +e
NEW_STATE="$(
  PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from policy.payload_slots import PayloadSlotError, PayloadSlotState, parse_slot, rollback_once
try:
    state = PayloadSlotState(
        active=parse_slot("${ACTIVE_SLOT:-A}"),
        rollback_available=bool(int("${ROLLBACK_AVAILABLE:-0}")),
        version_a="${VERSION_A:-}",
        version_b="${VERSION_B:-}",
    )
    new = rollback_once(state)
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
  echo "payload-rollback: ${NEW_STATE}" >&2
  exit 1
fi

mapfile -t NS <<<"${NEW_STATE}"
NEW_ACTIVE="${NS[0]}"
NEW_RB="${NS[1]}"
NEW_VA="${NS[2]}"
NEW_VB="${NS[3]}"

if [[ ! -x "${SLOTS}/${NEW_ACTIVE}/EliteEW.AppImage" ]]; then
  echo "payload-rollback: rollback_target_empty (no EliteEW.AppImage in ${NEW_ACTIVE})" >&2
  exit 1
fi

cat >"${SLOTS}/state.env" <<EOF
ACTIVE_SLOT=${NEW_ACTIVE}
ROLLBACK_AVAILABLE=${NEW_RB}
VERSION_A=${NEW_VA}
VERSION_B=${NEW_VB}
OS_UPDATE_PENDING=${OS_UPDATE_PENDING:-0}
EOF
ln -sfn "${NEW_ACTIVE}" "${SLOTS}/current"
echo "[payload-rollback] active=${NEW_ACTIVE} rollback_available=${NEW_RB}"
bash "${ROOT}/scripts/payload-slot-status.sh" --slots "${SLOTS}"
