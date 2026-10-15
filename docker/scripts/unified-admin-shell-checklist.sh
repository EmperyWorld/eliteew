#!/usr/bin/env bash
# Unified Admin shell — machine checklist (nav matrix + mount + lazy contracts).
#
# Does NOT curl SPA sections as full-path proof. Runs narrow Vitest locks that
# prove ADMIN_SHELL_SECTIONS ↔ smoke checklist ↔ lazy factories stay aligned.
#
# Usage (repo root):
#   bash docker/scripts/unified-admin-shell-checklist.sh
#
# Manual operator UI steps: documentation/platform/UNIFIED-ADMIN-SHELL.md §Smoke

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND="${ROOT}/shared/web/frontend"

log() { printf '[unified-admin-checklist] %s\n' "$*"; }
fail() { printf '[unified-admin-checklist] FAIL: %s\n' "$*" >&2; exit 1; }

[[ -d "${FRONTEND}" ]] || fail "missing frontend tree: ${FRONTEND}"
command -v pnpm >/dev/null 2>&1 || fail "pnpm not on PATH"

log "Vitest: shell config / smoke checklist / lazy / section matrix / url / telemetry"
cd "${FRONTEND}"
pnpm exec vitest run \
  src/pages/Admin/__tests__/adminShellConfig.test.ts \
  src/pages/Admin/__tests__/adminSectionLazy.contract.test.ts \
  src/pages/Admin/__tests__/adminShellUrl.test.ts \
  src/pages/Admin/__tests__/ugsAdminShellUrl.test.ts \
  src/pages/Admin/__tests__/adminShellNavTelemetry.test.ts \
  src/pages/Admin/__tests__/UnifiedAdminPage.sectionMatrix.test.tsx \
  --reporter=dot

log "PASS — machine checklist green; still run manual Smoke in UNIFIED-ADMIN-SHELL.md"
