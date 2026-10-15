#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Cursor stdio launcher for eliteew-kbsew-mcp; loads service token from local file.
# Invariants:
# - Does not print the token; requires SSH tunnel to KBSEW :28030 when URL is localhost.
# Related:
# - tools/eliteew-kbsew-mcp/README.md
# - documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PKG="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN_FILE="${KBSEW_TOKEN_FILE:-${ROOT}/docker/env_file/.kbsew-internal.token}"

export KBSEW_SERVICE_URL="${KBSEW_SERVICE_URL:-http://127.0.0.1:28030}"
if [[ -z "${KBSEW_INTERNAL_SERVICE_TOKEN:-}" ]]; then
  if [[ ! -f "${TOKEN_FILE}" ]]; then
    echo "ERROR: missing KBSEW token file: ${TOKEN_FILE}" >&2
    exit 1
  fi
  KBSEW_INTERNAL_SERVICE_TOKEN="$(tr -d '\r\n' <"${TOKEN_FILE}")"
  export KBSEW_INTERNAL_SERVICE_TOKEN
fi

BIN="${PKG}/.venv/bin/eliteew-kbsew-mcp"
if [[ -x "${BIN}" ]]; then
  exec "${BIN}"
fi
if command -v uv >/dev/null 2>&1; then
  cd "${PKG}"
  exec uv run eliteew-kbsew-mcp
fi
echo "ERROR: install package venv (cd tools/eliteew-kbsew-mcp && uv sync)" >&2
exit 1
