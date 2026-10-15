#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# Socket.IO + SSO session kill regression slice (R-01 / audit A-01).
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

exec bash docker/scripts/run-stack0-api-tests.sh \
  tests/test_socket_sso_replacement_kill.py \
  tests/test_websocket_session_kill.py \
  "$@"
