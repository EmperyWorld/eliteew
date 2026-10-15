#!/usr/bin/env bash
# Purpose: Fail-closed SPDX allowlist CLI for Trusted Substrate (W3).
# Related: policy/spdx_allowlist.py · licenses/ALLOWLIST
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALLOWLIST="${ROOT}/licenses/ALLOWLIST"
MANIFEST=""

usage() {
  cat <<'EOF'
Usage: spdx-allowlist-gate.sh --manifest PATH
Manifest lines: package_name<TAB_or_spaces>SPDX_ID
Fails closed on unknown / empty SPDX.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest) MANIFEST="$2"; shift 2 ;;
    --allowlist) ALLOWLIST="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "${MANIFEST}" || ! -f "${MANIFEST}" ]]; then
  echo "spdx-allowlist-gate: --manifest required" >&2
  exit 2
fi

PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"

PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from pathlib import Path
from policy.spdx_allowlist import load_allowlist, gate_manifest_rows, SpdxAllowlistError

allow = load_allowlist(Path("${ALLOWLIST}"))
rows = []
for raw in Path("${MANIFEST}").read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#"):
        continue
    parts = line.split()
    if len(parts) < 2:
        raise SystemExit(f"bad_manifest_line: {raw!r}")
    rows.append((parts[0], parts[1]))
try:
    gate_manifest_rows(rows, allow)
except SpdxAllowlistError as exc:
    print(f"SPDX_GATE_FAIL {exc}", flush=True)
    raise SystemExit(1)
print("SPDX_GATE_OK", flush=True)
PY
