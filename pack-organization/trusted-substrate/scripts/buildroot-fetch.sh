#!/usr/bin/env bash
# Purpose: Fetch pinned Buildroot release into CA cache (W4).
# Related: config/buildroot/BUILDROOT.pin
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=work-root.sh
# shellcheck disable=SC1091
source "${ROOT}/scripts/work-root.sh"
PIN="${ELITEEW_TS_BUILDROOT_PIN:-${ROOT}/config/buildroot/BUILDROOT.pin}"
CACHE="${ELITEEW_TS_BUILDROOT_CACHE:-${ROOT}/work/buildroot-cache}"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --pin) PIN="$2"; shift 2 ;;
    --cache) CACHE="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"

mapfile -t ROWS < <(
  PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from pathlib import Path
from policy.pins import parse_pins
from policy.spdx_allowlist import load_allowlist, gate_manifest_rows
rows = parse_pins(Path("${PIN}"))
allow = load_allowlist(Path("${ROOT}") / "licenses" / "ALLOWLIST")
gate_manifest_rows([(r.name, r.spdx) for r in rows], allow)
for r in rows:
    print(f"{r.name}|{r.archive}|{r.url}|{r.sha256}")
PY
)

mkdir -p "${CACHE}/sha256"
echo "[buildroot-fetch] pin=${PIN} cache=${CACHE} dry_run=${DRY_RUN}"

for row in "${ROWS[@]}"; do
  IFS='|' read -r name archive url sha256 <<<"${row}"
  dest_dir="${CACHE}/sha256/${sha256}"
  dest="${dest_dir}/${archive}"
  if [[ -f "${dest}" ]]; then
    got="$(sha256sum "${dest}" | awk '{print $1}')"
    [[ "${got}" == "${sha256}" ]] || { echo "corrupt cache ${name}" >&2; exit 1; }
    echo "[buildroot-fetch] cache-hit ${name}"
    continue
  fi
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    echo "[buildroot-fetch] dry-run would-fetch ${name} ${url}"
    continue
  fi
  mkdir -p "${dest_dir}"
  tmp="${dest}.partial"
  echo "[buildroot-fetch] fetch ${name}"
  curl -fL --retry 3 --retry-delay 2 -o "${tmp}" "${url}"
  got="$(sha256sum "${tmp}" | awk '{print $1}')"
  if [[ "${got}" != "${sha256}" ]]; then
    rm -f "${tmp}"
    echo "sha256 mismatch ${name}" >&2
    exit 1
  fi
  mv -f "${tmp}" "${dest}"
  echo "[buildroot-fetch] ok ${name}"
done
echo "[buildroot-fetch] DONE"
