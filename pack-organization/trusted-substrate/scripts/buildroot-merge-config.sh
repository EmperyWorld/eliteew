#!/usr/bin/env bash
# Purpose: Merge Buildroot fragments into BR2_EXTERNAL defconfig + gate packages (W4).
# Related: config/buildroot/fragments · package-allowlist
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=work-root.sh
# shellcheck disable=SC1091
source "${ROOT}/scripts/work-root.sh"
FRAG_DIR="${ROOT}/config/buildroot/fragments"
ALLOW="${ROOT}/config/buildroot/package-allowlist"
OUT="${ROOT}/config/buildroot/external/configs/eliteew_ts_x86_64_defconfig"
CHECK_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check-only) CHECK_ONLY=1; shift ;;
    --out) OUT="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"

TMP="$(mktemp)"
{
  echo "# EliteEW Trusted Substrate defconfig — generated from ordered fragments"
  echo "# SoT fragments: config/buildroot/fragments/"
  echo
  cat "${FRAG_DIR}"/*.frag
} >"${TMP}"

PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from pathlib import Path
from policy.rootfs_packages import gate_config_text
text = Path("${TMP}").read_text(encoding="utf-8")
enabled = gate_config_text(text, Path("${ALLOW}"))
print(f"package_gate_ok count={len(enabled)}")
PY

if [[ "${CHECK_ONLY}" -eq 1 ]]; then
  rm -f "${TMP}"
  echo "[buildroot-merge-config] check-only OK"
  exit 0
fi

mv -f "${TMP}" "${OUT}"
echo "[buildroot-merge-config] wrote ${OUT}"
