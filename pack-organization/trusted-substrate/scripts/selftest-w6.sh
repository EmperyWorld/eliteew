#!/usr/bin/env bash
# W6 exit proof: A/B apply + rollback once + OS-pending blocks payload + sig required.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

bash "${ROOT}/scripts/selftest-policy.sh"

PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"

TMP="$(mktemp -d)"
cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

export ELITEEW_TS_PAYLOAD_SLOTS="${TMP}/slots"
bash "${ROOT}/scripts/payload-slot-init.sh" --slots "${TMP}/slots"

openssl genpkey -algorithm Ed25519 -out "${TMP}/key.pem" 2>/dev/null
openssl pkey -in "${TMP}/key.pem" -pubout -out "${TMP}/pub.pem"
printf 'electron-payload-v1\n' >"${TMP}/p1.bin"
printf 'electron-payload-v2\n' >"${TMP}/p2.bin"
bash "${ROOT}/scripts/image-sign.sh" --image "${TMP}/p1.bin" --key "${TMP}/key.pem"
bash "${ROOT}/scripts/image-sign.sh" --image "${TMP}/p2.bin" --key "${TMP}/key.pem"

# First apply on empty slots → active B, no rollback (previous empty)
bash "${ROOT}/scripts/payload-apply.sh" \
  --payload "${TMP}/p1.bin" --version v1 \
  --pubkey "${TMP}/pub.pem" --slots "${TMP}/slots"
STATUS0="$(bash "${ROOT}/scripts/payload-slot-status.sh" --slots "${TMP}/slots")"
rg -q '^active=B$' <<<"${STATUS0}"
rg -q '^version_B=v1$' <<<"${STATUS0}"
rg -q '^rollback_available=0$' <<<"${STATUS0}"
test -x "${TMP}/slots/B/EliteEW.AppImage"
if bash "${ROOT}/scripts/payload-rollback.sh" --slots "${TMP}/slots" 2>"${TMP}/rb0.txt"; then
  echo "selftest-w6: expected first-apply rollback to fail" >&2
  exit 1
fi
rg -q 'rollback_not_available' "${TMP}/rb0.txt"

# Second apply → inactive A, rollback available to B
bash "${ROOT}/scripts/payload-apply.sh" \
  --payload "${TMP}/p2.bin" --version v2 \
  --pubkey "${TMP}/pub.pem" --slots "${TMP}/slots"
STATUS="$(bash "${ROOT}/scripts/payload-slot-status.sh" --slots "${TMP}/slots")"
rg -q '^active=A$' <<<"${STATUS}"
rg -q '^version_A=v2$' <<<"${STATUS}"
rg -q '^rollback_available=1$' <<<"${STATUS}"

# rollback once → B (v1)
bash "${ROOT}/scripts/payload-rollback.sh" --slots "${TMP}/slots"
STATUS2="$(bash "${ROOT}/scripts/payload-slot-status.sh" --slots "${TMP}/slots")"
rg -q '^active=B$' <<<"${STATUS2}"
rg -q '^rollback_available=0$' <<<"${STATUS2}"
test -x "${TMP}/slots/B/EliteEW.AppImage"

if bash "${ROOT}/scripts/payload-rollback.sh" --slots "${TMP}/slots" 2>"${TMP}/rb2.txt"; then
  echo "selftest-w6: expected second rollback to fail" >&2
  exit 1
fi
rg -q 'rollback_not_available' "${TMP}/rb2.txt"

# --slots without env: init + apply to alternate tree
ALT="${TMP}/alt-slots"
unset ELITEEW_TS_PAYLOAD_SLOTS
bash "${ROOT}/scripts/payload-apply.sh" \
  --payload "${TMP}/p1.bin" --version alt1 \
  --pubkey "${TMP}/pub.pem" --slots "${ALT}"
STATUS_ALT="$(bash "${ROOT}/scripts/payload-slot-status.sh" --slots "${ALT}")"
rg -q "slots_root=${ALT}" <<<"${STATUS_ALT}"
rg -q '^active=B$' <<<"${STATUS_ALT}"
test -x "${ALT}/B/EliteEW.AppImage"
export ELITEEW_TS_PAYLOAD_SLOTS="${TMP}/slots"

cat >"${TMP}/slots/state.env" <<EOF
ACTIVE_SLOT=B
ROLLBACK_AVAILABLE=0
VERSION_A=v2
VERSION_B=v1
OS_UPDATE_PENDING=1
EOF
ln -sfn B "${TMP}/slots/current"
if bash "${ROOT}/scripts/payload-apply.sh" \
  --payload "${TMP}/p2.bin" --version v2b \
  --pubkey "${TMP}/pub.pem" --slots "${TMP}/slots" 2>"${TMP}/osblock.txt"; then
  echo "selftest-w6: expected OS pending block" >&2
  exit 1
fi
rg -q 'os_update_pending_blocks_payload' "${TMP}/osblock.txt"

cat >"${TMP}/slots/state.env" <<EOF
ACTIVE_SLOT=B
ROLLBACK_AVAILABLE=0
VERSION_A=v2
VERSION_B=v1
OS_UPDATE_PENDING=0
EOF
printf 'evil\n' >"${TMP}/evil.bin"
if bash "${ROOT}/scripts/payload-apply.sh" \
  --payload "${TMP}/evil.bin" --version evil \
  --pubkey "${TMP}/pub.pem" --slots "${TMP}/slots" 2>"${TMP}/unsigned.txt"; then
  echo "selftest-w6: expected unsigned refuse" >&2
  exit 1
fi

PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<'PY'
from policy.payload_slots import PayloadSlot, PayloadSlotState, apply_to_inactive, rollback_once
s0 = PayloadSlotState(PayloadSlot.A, False, "v0", "")
s1 = apply_to_inactive(s0, new_version="v1")
assert s1.active is PayloadSlot.B and s1.rollback_available
s2 = rollback_once(s1)
assert s2.active is PayloadSlot.A and not s2.rollback_available
empty = PayloadSlotState(PayloadSlot.A, False, "", "")
s3 = apply_to_inactive(empty, new_version="v1")
assert not s3.rollback_available
print("payload_slots_policy_ok")
PY

echo "[W6] selftest-w6 PASS"
