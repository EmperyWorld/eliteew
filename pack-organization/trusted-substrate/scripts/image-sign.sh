#!/usr/bin/env bash
# Purpose: Detached-sign a Trusted Substrate release image (W5). Ed25519 via OpenSSL.
# Related: docs/KEYS-CEREMONY.md · policy/image_signing.py
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE=""
PRIV="${ELITEEW_TS_SIGNING_KEY:-${ROOT}/work/signing-keys/image-signing.key.pem}"
OUT_SIG=""

usage() {
  cat <<'EOF'
Usage: image-sign.sh --image PATH [--key PATH] [--signature PATH]
Writes detached signature PATH.sig (or --signature).
Private key MUST NOT live in git — default work/signing-keys/ (gitignored).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image) IMAGE="$2"; shift 2 ;;
    --key) PRIV="$2"; shift 2 ;;
    --signature) OUT_SIG="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "${IMAGE}" || ! -f "${IMAGE}" ]]; then
  echo "image-sign: --image required" >&2
  exit 2
fi
if [[ ! -f "${PRIV}" ]]; then
  echo "image-sign: private key missing: ${PRIV}" >&2
  echo "  see docs/KEYS-CEREMONY.md" >&2
  exit 1
fi
# Refuse signing if key path looks like it is inside tracked config without work/
case "${PRIV}" in
  */config/*|*/payload-templates/*)
    echo "image-sign: refusing private key under tracked tree path: ${PRIV}" >&2
    exit 1
    ;;
esac

OUT_SIG="${OUT_SIG:-${IMAGE}.sig}"
PARTIAL="${OUT_SIG}.partial"
rm -f "${PARTIAL}"
# Ed25519 = PureEdDSA (no separate digest flag)
openssl pkeyutl -sign -inkey "${PRIV}" -rawin -in "${IMAGE}" -out "${PARTIAL}"
mv -f "${PARTIAL}" "${OUT_SIG}"
echo "[image-sign] wrote ${OUT_SIG}"
sha256sum "${IMAGE}" | awk '{print "image_sha256="$1}'
