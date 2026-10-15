#!/usr/bin/env bash
# Purpose: W0 exit proof — Trusted Substrate policy contract locks.
# Related: documentation/product/desktop/ELITEEW-TRUSTED-SUBSTRATE-PLAN.md §W0
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f config/payload-electron.example.env ]]; then
  echo "FAIL: missing config/payload-electron.example.env" >&2
  exit 1
fi

if [[ ! -f config/payload-tauri.example.env ]]; then
  echo "FAIL: missing config/payload-tauri.example.env" >&2
  exit 1
fi

if ! rg -n 'payload_trust|os_trust' policy/ >/dev/null; then
  echo "FAIL: policy/ must mention payload_trust|os_trust" >&2
  exit 1
fi

PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "${PYTHON_BIN}" ]]; then
  if [[ -x "${ROOT}/../../.venv/bin/python" ]]; then
    PYTHON_BIN="${ROOT}/../../.venv/bin/python"
  else
    PYTHON_BIN="$(command -v python3)"
  fi
fi

echo "[W0] selftest-policy using: ${PYTHON_BIN}"
PYTHONPATH="${ROOT}${PYTHONPATH:+:${PYTHONPATH}}" \
  "${PYTHON_BIN}" -m pytest tests/test_trusted_substrate_policy.py -q
echo "[W0] selftest-policy PASS"
