#!/usr/bin/env bash
# Purpose: Fetch pinned toolchain archives into content-addressed cache (W3).
# Related: toolchain/PINS · docs/TOOLCHAIN-FROM-SOURCE.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=work-root.sh
# shellcheck disable=SC1091
source "${ROOT}/scripts/work-root.sh"
PINS="${ELITEEW_TS_PINS:-${ROOT}/toolchain/PINS}"
CACHE="${ELITEEW_TS_TOOLCHAIN_CACHE:-${ROOT}/work/toolchain-cache}"
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: toolchain-fetch.sh [--dry-run] [--pins PATH] [--cache DIR]
Fetch https archives from PINS into CACHE/sha256/<digest>/<archive>.
Fails closed on sha256 mismatch.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --pins) PINS="$2"; shift 2 ;;
    --cache) CACHE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"

mapfile -t ROWS < <(
  PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from pathlib import Path
from policy.pins import parse_pins, assert_required_pins
from policy.spdx_allowlist import load_allowlist, gate_manifest_rows
rows = parse_pins(Path("${PINS}"))
assert_required_pins(rows)
allow = load_allowlist(Path("${ROOT}") / "licenses" / "ALLOWLIST")
gate_manifest_rows([(r.name, r.spdx) for r in rows], allow)
for r in rows:
    print(f"{r.name}|{r.archive}|{r.url}|{r.sha256}|{r.spdx}")
PY
)

mkdir -p "${CACHE}/sha256"
echo "[toolchain-fetch] pins=${PINS} cache=${CACHE} dry_run=${DRY_RUN}"

for row in "${ROWS[@]}"; do
  IFS='|' read -r name archive url sha256 spdx <<<"${row}"
  dest_dir="${CACHE}/sha256/${sha256}"
  dest="${dest_dir}/${archive}"
  if [[ -f "${dest}" ]]; then
    got="$(sha256sum "${dest}" | awk '{print $1}')"
    if [[ "${got}" != "${sha256}" ]]; then
      echo "[toolchain-fetch] FAIL cache corrupt ${name}: got=${got}" >&2
      exit 1
    fi
    echo "[toolchain-fetch] cache-hit ${name}"
    continue
  fi
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    echo "[toolchain-fetch] dry-run would-fetch ${name} ${url}"
    continue
  fi
  mkdir -p "${dest_dir}"
  tmp="${dest}.partial"
  echo "[toolchain-fetch] fetch ${name} → ${dest}"
  curl -fL --retry 3 --retry-delay 2 -o "${tmp}" "${url}"
  got="$(sha256sum "${tmp}" | awk '{print $1}')"
  if [[ "${got}" != "${sha256}" ]]; then
    rm -f "${tmp}"
    echo "[toolchain-fetch] FAIL sha256 ${name}: expected=${sha256} got=${got}" >&2
    exit 1
  fi
  mv -f "${tmp}" "${dest}"
  echo "[toolchain-fetch] ok ${name}"
done

echo "[toolchain-fetch] DONE"
