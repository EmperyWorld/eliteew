#!/usr/bin/env bash
# W3 exit proof: SPDX fail-closed + pins + dry-run + fixture identity match.
# Full gcc: ELITEEW_TS_SELFTEST_SKIP_TOOLCHAIN_BUILD=0 (hours).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=work-root.sh
# shellcheck disable=SC1091
source "${ROOT}/scripts/work-root.sh"
cd "${ROOT}"

bash "${ROOT}/scripts/selftest-policy.sh"

PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"

TMP="$(mktemp -d)"
cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

# --- SPDX: allowlisted OK ---
cat >"${TMP}/ok.manifest" <<'EOF'
binutils GPL-3.0-or-later
gcc GPL-3.0-or-later
EOF
bash "${ROOT}/scripts/spdx-allowlist-gate.sh" --manifest "${TMP}/ok.manifest" | tee "${TMP}/spdx-ok.txt"
rg -q 'SPDX_GATE_OK' "${TMP}/spdx-ok.txt"

# --- SPDX: unknown must fail ---
cat >"${TMP}/bad.manifest" <<'EOF'
evil Proprietary-Not-On-Allowlist
EOF
if bash "${ROOT}/scripts/spdx-allowlist-gate.sh" --manifest "${TMP}/bad.manifest" >"${TMP}/spdx-bad.txt" 2>&1; then
  echo "selftest-w3: expected SPDX gate failure" >&2
  exit 1
fi
rg -q 'SPDX_GATE_FAIL' "${TMP}/spdx-bad.txt"

# --- Pins + required names ---
PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<'PY'
from pathlib import Path
from policy.pins import parse_pins, assert_required_pins
from policy.spdx_allowlist import load_allowlist, gate_manifest_rows
root = Path(".")
rows = parse_pins(root / "toolchain" / "PINS")
assert_required_pins(rows)
allow = load_allowlist(root / "licenses" / "ALLOWLIST")
gate_manifest_rows([(r.name, r.spdx) for r in rows], allow)
print("pins+spdx OK", len(rows))
PY

# --- Dry-run fetch + build ---
bash "${ROOT}/scripts/toolchain-fetch.sh" --dry-run
bash "${ROOT}/scripts/toolchain-build.sh" --dry-run

# --- Fixture identity: two clean "builds" → same identity ---
PREFIX1="${TMP}/prefix1"
PREFIX2="${TMP}/prefix2"
for p in "${PREFIX1}" "${PREFIX2}"; do
  mkdir -p "${p}/etc"
  cat >"${p}/etc/eliteew-ts-toolchain.env" <<EOF
toolchain_bootstrap=host-once
gcc_version=14.2.0
binutils_version=2.42
target=x86_64-pc-linux-gnu
source_date_epoch=1719792000
configure_flags=--prefix=/opt --disable-multilib
dumpversion=14.2.0
dumpmachine=x86_64-pc-linux-gnu
EOF
done

ID1="$(
  ELITEEW_TS_PINS="${ROOT}/toolchain/PINS" \
  bash "${ROOT}/scripts/toolchain-identity.sh" --prefix "${PREFIX1}" | awk -F= '/^identity=/{print $2}'
)"
ID2="$(
  ELITEEW_TS_PINS="${ROOT}/toolchain/PINS" \
  bash "${ROOT}/scripts/toolchain-identity.sh" --prefix "${PREFIX2}" | awk -F= '/^identity=/{print $2}'
)"
[[ -n "${ID1}" && "${ID1}" == "${ID2}" ]]
bash "${ROOT}/scripts/toolchain-identity.sh" --prefix "${PREFIX1}" --expect "${ID1}"

# Drift must fail
echo "dumpversion=99.0.0" >>"${PREFIX2}/etc/eliteew-ts-toolchain.env"
if bash "${ROOT}/scripts/toolchain-identity.sh" --prefix "${PREFIX2}" --expect "${ID1}" >/dev/null 2>"${TMP}/id-drift.txt"; then
  echo "selftest-w3: expected identity mismatch" >&2
  exit 1
fi
rg -q 'FAIL mismatch' "${TMP}/id-drift.txt"

SKIP_BUILD="${ELITEEW_TS_SELFTEST_SKIP_TOOLCHAIN_BUILD:-1}"
if [[ "${SKIP_BUILD}" != "0" ]]; then
  echo "[W3] skip full toolchain build (set ELITEEW_TS_SELFTEST_SKIP_TOOLCHAIN_BUILD=0 to run)"
  echo "[W3] selftest-w3 PASS"
  exit 0
fi

echo "[W3] full toolchain fetch+build (long)…"
bash "${ROOT}/scripts/toolchain-fetch.sh"
bash "${ROOT}/scripts/toolchain-build.sh"
PREFIX_LIVE="${ELITEEW_TS_TOOLCHAIN_PREFIX:-${ROOT}/work/toolchain-prefix}"
FIRST_ID="$(cat "${PREFIX_LIVE}/etc/eliteew-ts-toolchain.identity")"
rm -rf "${ELITEEW_TS_TOOLCHAIN_BUILD:-${ROOT}/work/toolchain-build}"
PASS2="${ELITEEW_TS_WORK_ROOT:-${ROOT}/work}/toolchain-prefix-pass2"
ELITEEW_TS_TOOLCHAIN_PREFIX="${PASS2}" \
  bash "${ROOT}/scripts/toolchain-build.sh"
SECOND_ID="$(cat "${PASS2}/etc/eliteew-ts-toolchain.identity")"
echo "[W3] pass1_identity=${FIRST_ID}"
echo "[W3] pass2_identity=${SECOND_ID}"
d1="$(awk -F= '/^dumpversion=/{print $2}' "${PREFIX_LIVE}/etc/eliteew-ts-toolchain.env")"
d2="$(awk -F= '/^dumpversion=/{print $2}' "${PASS2}/etc/eliteew-ts-toolchain.env")"
[[ "${d1}" == "${d2}" && -n "${d1}" ]]
echo "[W3] selftest-w3 PASS (full build dumpversion match ${d1})"
