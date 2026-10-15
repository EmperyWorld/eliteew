#!/usr/bin/env bash
# W5 exit proof: ceremony paths + sign/verify OK + tamper fail-closed + no private keys in tree.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

bash "${ROOT}/scripts/selftest-policy.sh"

PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"

TMP="$(mktemp -d)"
cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

# Docs present
test -f docs/KEYS-CEREMONY.md
test -f docs/IMAGE-INTEGRITY.md
test -f config/signing/README.md

# No private key markers in tracked signing config
PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<'PY'
from pathlib import Path
from policy.image_signing import assert_private_key_material_absent
root = Path("config/signing")
for p in root.rglob("*"):
    if p.is_file():
        assert_private_key_material_absent(p.read_text(encoding="utf-8", errors="ignore"))
print("signing_config_no_private_ok")
PY

# Ephemeral Ed25519 keypair
openssl genpkey -algorithm Ed25519 -out "${TMP}/key.pem" 2>/dev/null
openssl pkey -in "${TMP}/key.pem" -pubout -out "${TMP}/pub.pem"
printf 'eliteew-ts-w5-fixture-image\n' >"${TMP}/image.bin"

bash "${ROOT}/scripts/image-sign.sh" \
  --image "${TMP}/image.bin" \
  --key "${TMP}/key.pem" \
  --signature "${TMP}/image.bin.sig"

bash "${ROOT}/scripts/image-verify.sh" \
  --image "${TMP}/image.bin" \
  --signature "${TMP}/image.bin.sig" \
  --pubkey "${TMP}/pub.pem"

# Tamper must fail
echo 'tampered' >>"${TMP}/image.bin"
if bash "${ROOT}/scripts/image-verify.sh" \
  --image "${TMP}/image.bin" \
  --signature "${TMP}/image.bin.sig" \
  --pubkey "${TMP}/pub.pem"; then
  echo "selftest-w5: expected tamper verify failure" >&2
  exit 1
fi
echo "tamper_fail_closed_ok"

# Missing signature fail
rm -f "${TMP}/image.bin.sig"
printf 'fresh\n' >"${TMP}/image2.bin"
if bash "${ROOT}/scripts/image-verify.sh" \
  --image "${TMP}/image2.bin" \
  --signature "${TMP}/image2.bin.sig" \
  --pubkey "${TMP}/pub.pem"; then
  echo "selftest-w5: expected missing sig failure" >&2
  exit 1
fi

# Refuse private key under config/
mkdir -p "${TMP}/config/evil"
cp "${TMP}/key.pem" "${TMP}/config/evil/key.pem"
if bash "${ROOT}/scripts/image-sign.sh" \
  --image "${TMP}/image2.bin" \
  --key "${TMP}/config/evil/key.pem" \
  --signature "${TMP}/x.sig" 2>"${TMP}/refuse.txt"; then
  echo "selftest-w5: expected refuse key under config/" >&2
  exit 1
fi
rg -q 'refusing private key under tracked' "${TMP}/refuse.txt"

# Forbidden scan: private pem in stage
STAGE="${TMP}/stage"
mkdir -p "${STAGE}/etc"
cp "${TMP}/key.pem" "${STAGE}/etc/leak.pem"
PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from pathlib import Path
from policy.image_forbidden_globs import scan_forbidden_paths
hits = scan_forbidden_paths(Path("${STAGE}"))
assert hits, "expected pem forbidden"
print("forbidden_pem_ok", hits[0])
PY

# Verity plan dry-run
bash "${ROOT}/scripts/integrity-verity.sh" --image "${TMP}/image2.bin"

echo "[W5] selftest-w5 PASS"
