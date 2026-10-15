#!/usr/bin/env bash
# Purpose: Fail-closed verify of detached Trusted Substrate image signature (W5).
# Related: docs/KEYS-CEREMONY.md · policy/image_signing.py
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE=""
SIG=""
PUB="${ELITEEW_TS_SIGNING_PUB:-${ROOT}/config/signing/image-signing.pub.pem}"

usage() {
  cat <<'EOF'
Usage: image-verify.sh --image PATH [--signature PATH] [--pubkey PATH]
Exit 0 only if OpenSSL Ed25519 detached verify succeeds.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image) IMAGE="$2"; shift 2 ;;
    --signature) SIG="$2"; shift 2 ;;
    --pubkey) PUB="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

SIG="${SIG:-${IMAGE}.sig}"

PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"

OUTCOME="$(
  PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from pathlib import Path
from policy.image_signing import classify_verify_inputs
o = classify_verify_inputs(
    image=Path("${IMAGE}"),
    signature=Path("${SIG}"),
    pubkey=Path("${PUB}"),
)
print(o.value if o is not None else "inputs_ok")
PY
)"

if [[ "${OUTCOME}" != "inputs_ok" ]]; then
  echo "[image-verify] FAIL ${OUTCOME}" >&2
  exit 1
fi

if openssl pkeyutl -verify -pubin -inkey "${PUB}" -rawin -in "${IMAGE}" -sigfile "${SIG}" >/dev/null 2>&1; then
  echo "[image-verify] OK image=${IMAGE}"
  exit 0
fi

echo "[image-verify] FAIL tamper_or_bad_sig" >&2
exit 1
