#!/usr/bin/env bash
# Pre-flight readiness check for EliteEW monorepo dev environment.
# Run: bash .vscode/preflight-check.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
WARN=0

ok() { PASS=$((PASS + 1)); printf '  [OK] %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  [FAIL] %s\n' "$1"; }
warn() { WARN=$((WARN + 1)); printf '  [WARN] %s\n' "$1"; }

section() { printf '\n## %s\n' "$1"; }

section 'Cursor rules'
test -f .cursor/rules/dev-tooling.mdc && ok 'dev-tooling.mdc' || fail 'dev-tooling.mdc'
grep -qE 'Absolute push ban|Абсолютный запрет push' .cursor/rules/git-agent-restrictions.mdc && ok 'git push ban' || fail 'git push ban'
test ! -e EliteEW/.cursor && test ! -e EliteEW/.cursorrules && ok 'EliteEW Cursor mirror retired' || fail 'EliteEW Cursor mirror must stay retired'

section 'CLI tooling'
for t in rg fd bat eza uv pnpm ruff gh shellcheck yq delta podman cursor; do
  command -v "$t" >/dev/null 2>&1 && ok "$t" || fail "$t"
done
command -v biome >/dev/null 2>&1 && warn 'global biome (use pnpm exec in frontend)' || ok 'biome via pnpm (expected)'

section 'Extensions'
if command -v cursor >/dev/null 2>&1; then
  INST="$(cursor --list-extensions 2>/dev/null | tr '[:upper:]' '[:lower:]' | sort)"
  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    id_lc="$(printf '%s' "$id" | tr '[:upper:]' '[:lower:]')"
    echo "$INST" | rg -qx "$id_lc" && ok "ext $id" || fail "ext $id"
  done < <(jq -r '.recommendations[]?' .vscode/extensions.json)
else
  fail 'cursor CLI'
fi

section 'Project deps'
test -x .venv/bin/python && ok 'API venv (.venv)' || fail 'API venv (.venv)'
test ! -d shared/api/.venv && ok 'no stray api/.venv' || fail 'remove shared/api/.venv (use .venv)'
test -d shared/web/frontend/node_modules && ok 'frontend node_modules' || fail 'frontend node_modules'
test ! -d DEWA && ok 'DEWA retired (not in workspace root)' || warn 'DEWA present at root (expected under trash/)'
test -f .editorconfig && ok '.editorconfig' || fail '.editorconfig'

section 'Format/lint gates'
(cd shared/web/frontend && pnpm exec biome check src/main.tsx >/dev/null 2>&1) && ok 'Biome EliteEW' || fail 'Biome EliteEW'
( # shellcheck source=scripts/eliteew/backend-venv-env.sh
  source scripts/eliteew/backend-venv-env.sh
  eliteew_backend_venv_init "$ROOT"
  eliteew_backend_venv_guard
  cd shared/api && uv run ruff check routers/desktop.py >/dev/null 2>&1) && ok 'Ruff API' || fail 'Ruff API'
bash -n docker/scripts/run-stack0-api-tests.sh && ok 'pytest wrapper syntax' || fail 'pytest wrapper'

section 'rg/fd'
rg -q 'FastAPI' shared/api/main.py && ok 'rg search' || fail 'rg search'
! rg -q 'react' shared/web/frontend/node_modules 2>/dev/null && ok 'rg ignores node_modules' || warn 'rg node_modules noise'
fd_count="$(fd 'vitest.config.ts' shared/web/frontend 2>/dev/null | wc -l)"
[[ "$fd_count" -eq 1 ]] && ok 'fd vitest configs' || fail "fd vitest count=$fd_count (expected 1 under shared/web/frontend)"

section 'Settings'
rg -q 'biomejs\.biome' .vscode/settings.json && ok 'settings Biome formatter' || fail 'settings Biome'
rg -q 'charliermarsh\.ruff' .vscode/settings.json && ok 'settings Ruff formatter' || fail 'settings Ruff'
rg -q 'push только по явной просьбе' .vscode/settings.json && ok 'settings AI git gate' || fail 'settings AI git gate'

section 'Git safety (local)'
git config --local --get core.pager | rg -q delta && ok 'delta pager' || warn 'delta pager not set locally'

section 'Cursor hooks'
test -f .cursor/hooks.json && ok 'hooks.json'
python3 -m py_compile .cursor/hooks/phase_gate_state.py \
  .cursor/hooks/session-bootstrap.py \
  .cursor/hooks/completion-gate.py \
  .cursor/hooks/deploy-line-gate.py \
  .cursor/hooks/doc-phase-gate.py \
  .cursor/hooks/test-phase-gate.py \
  .cursor/hooks/validate-agent-policy.py \
  .cursor/hooks/validate-documentation.py 2>/dev/null && ok 'hooks py_compile' || fail 'hooks py_compile'
bash .cursor/hooks/hooks-selftest.sh >/dev/null 2>&1 && ok 'hooks selftest' || fail 'hooks selftest'

printf '\nSUMMARY: PASS=%s FAIL=%s WARN=%s\n' "$PASS" "$FAIL" "$WARN"
[[ "$FAIL" -eq 0 ]]
