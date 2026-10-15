#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Self-test for deploy provenance gate: source-path scope, build-artifact excludes,
# and OpenAPI regen allowlist (non-blocking leftovers).
# Invariants:
# - Read-only against git; no prod deploy side effects.
# Related:
# - docker/scripts/deploy-provenance-gate.sh
# - docker/scripts/deploy-provenance-lib.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy-provenance-lib.sh
source "${SCRIPT_DIR}/deploy-provenance-lib.sh"

REPO="$(deploy_provenance_repo_root)"
FAIL=0

echo "=== deploy provenance gate selftest ==="
echo "repo: ${REPO}"

if deploy_provenance_is_dirty_source "${REPO}"; then
  echo "WARN: blocking deploy source paths are dirty (gate would fail on --release):"
  deploy_provenance_dirty_blocking_source_files "${REPO}" | head -10
else
  echo "OK: blocking deploy source paths clean"
fi

if deploy_provenance_is_dirty_openapi_regen "${REPO}"; then
  echo "WARN: OpenAPI regen leftovers present (gate WARN-pass):"
  deploy_provenance_dirty_openapi_regen_files "${REPO}" | head -10
fi

# Build artifacts must not appear in source dirty list even if tracked changes linger.
while IFS= read -r artifact; do
  [[ -z "${artifact}" ]] && continue
  if deploy_provenance_dirty_source_files "${REPO}" | rg -Fxq "${artifact}"; then
    echo "FAIL: build artifact counted as dirty source: ${artifact}" >&2
    FAIL=1
  fi
done < <(deploy_provenance_build_artifact_excludes)

# Classifier lock: openapi regen paths must match allowlist; other src paths must not.
classify_ok=1
while IFS= read -r sample; do
  [[ -z "${sample}" ]] && continue
  expect="${sample%%|*}"
  path="${sample#*|}"
  if deploy_provenance_is_openapi_regen_path "${path}"; then
    got=allow
  else
    got=block
  fi
  if [[ "${got}" != "${expect}" ]]; then
    echo "FAIL: openapi regen classify ${path}: expected ${expect} got ${got}" >&2
    classify_ok=0
    FAIL=1
  fi
done <<'SAMPLES'
allow|shared/web/frontend/openapi/pilot/ugs.openapi.json
allow|shared/web/frontend/src/generated/ugs-openapi.ts
block|shared/web/frontend/src/generated/README.md
block|shared/web/frontend/src/services/api/ugs/schemas.ts
block|shared/api/schemas/ugs_admin.py
SAMPLES
if [[ "${classify_ok}" -eq 1 ]]; then
  echo "OK: openapi regen path classifier"
fi

# Pipe filter (blocking vs WARN-pass) must use shared/ prefixes, not retired EliteEW/.
pipe_got="$(
  printf '%s\n' \
    'shared/web/frontend/src/generated/desktop-openapi.ts' \
    'shared/web/frontend/openapi/pilot/desktop.openapi.json' \
    'shared/web/frontend/src/services/api/ugs/schemas.ts' \
    | deploy_provenance_is_openapi_regen_dirty_path
)"
if ! printf '%s\n' "${pipe_got}" | rg -Fxq 'shared/web/frontend/src/generated/desktop-openapi.ts'; then
  echo "FAIL: pipe filter missed shared generated OpenAPI leftover" >&2
  FAIL=1
fi
if ! printf '%s\n' "${pipe_got}" | rg -Fxq 'shared/web/frontend/openapi/pilot/desktop.openapi.json'; then
  echo "FAIL: pipe filter missed shared OpenAPI pilot leftover" >&2
  FAIL=1
fi
if printf '%s\n' "${pipe_got}" | rg -Fxq 'shared/web/frontend/src/services/api/ugs/schemas.ts'; then
  echo "FAIL: pipe filter treated non-pilot source as OpenAPI leftover" >&2
  FAIL=1
fi
if [[ "${FAIL}" -eq 0 ]]; then
  echo "OK: openapi regen pipe filter uses shared/ prefixes"
fi

if bash "${SCRIPT_DIR}/deploy-provenance-gate.sh" --release --dry-run >/dev/null 2>&1; then
  echo "OK: --release --dry-run exit 0"
else
  rc=$?
  if [[ "${rc}" -eq 42 ]]; then
    echo "OK: --release --dry-run would fail with exit 42 (dirty blocking source)"
  else
    echo "FAIL: unexpected gate dry-run exit ${rc}" >&2
    FAIL=1
  fi
fi

if [[ "${FAIL}" -ne 0 ]]; then
  exit 1
fi
echo "✅ deploy provenance gate selftest passed"
