#!/usr/bin/env bash
# Purpose: Compute / verify EliteEW toolchain identity (W3 rebuild policy).
# Related: policy/toolchain_identity.py · docs/TOOLCHAIN-FROM-SOURCE.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=work-root.sh
# shellcheck disable=SC1091
source "${ROOT}/scripts/work-root.sh"
PINS="${ELITEEW_TS_PINS:-${ROOT}/toolchain/PINS}"
PREFIX="${ELITEEW_TS_TOOLCHAIN_PREFIX:-${ROOT}/work/toolchain-prefix}"
WRITE=0
EXPECT=""

usage() {
  cat <<'EOF'
Usage: toolchain-identity.sh [--write] [--expect HEX] [--prefix DIR] [--pins PATH]
Identity = sha256(pins_digest + artifact_manifest_digest).
Artifact manifest = deterministic text from $PREFIX/etc/eliteew-ts-toolchain.env
  (versions/flags/dumpversion) — NOT bit-identical gcc binary guarantee.
Without --write, prints identity. With --expect, exits 1 on mismatch.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --write) WRITE=1; shift ;;
    --expect) EXPECT="$2"; shift 2 ;;
    --prefix) PREFIX="$2"; shift 2 ;;
    --pins) PINS="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"

ENV_FILE="${PREFIX}/etc/eliteew-ts-toolchain.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[toolchain-identity] FAIL missing ${ENV_FILE}" >&2
  echo "  build first or pass a fixture prefix for tests" >&2
  exit 1
fi

IDENTITY="$(
  PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from pathlib import Path
from policy.toolchain_identity import pins_digest, digest_file, combine_identity
pins = pins_digest(Path("${PINS}"))
artifact = digest_file(Path("${ENV_FILE}"))
print(combine_identity(pins_sha256=pins, artifact_sha256=artifact))
PY
)"

echo "identity=${IDENTITY}"
echo "pins=${PINS}"
echo "artifact_env=${ENV_FILE}"

if [[ "${WRITE}" -eq 1 ]]; then
  mkdir -p "${PREFIX}/etc"
  echo "${IDENTITY}" >"${PREFIX}/etc/eliteew-ts-toolchain.identity"
  echo "[toolchain-identity] wrote ${PREFIX}/etc/eliteew-ts-toolchain.identity"
fi

if [[ -n "${EXPECT}" ]]; then
  if [[ "${IDENTITY}" != "${EXPECT}" ]]; then
    echo "[toolchain-identity] FAIL mismatch expected=${EXPECT} actual=${IDENTITY}" >&2
    exit 1
  fi
  echo "[toolchain-identity] match OK"
fi
