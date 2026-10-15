# Architecture Guard

Read-only static validator for **domain boundary drift**. Scans a git diff (or single files in tests) against [`.cursor/domain_matrix.json`](../../.cursor/domain_matrix.json).

## Checks

| # | Name | Severity | Description |
|---|------|----------|-------------|
| 1 | Cross-domain import | **FAIL** (exit 1) | Python/TS imports from another domain without a `shared_contract_paths` entry |
| 2 | Shadow domain | **WARN** | New top-level directory not covered by any `domains[].path_patterns` |
| 3 | sys.path leak | **FAIL** (exit 1) | `sys.path.insert/append` in **desktop_client** / **mobile_android** (and legacy DEWA/EWGen) pointing outside own domain / neutral paths |

Neutral paths (always allowed): `shared/tools/**`, `nexus-root/protocol/**`, and globs listed in `shared_contract_paths`.

Infrastructure paths exempt from Check 2 warnings: `tools/`, `.github/`, `.gitlab/`, `.vscode/`.

## Usage

From monorepo root:

```bash
# PR / last commit (default: HEAD^..HEAD)
python3 tools/architecture_guard/guard.py --repo . --base HEAD^ --head HEAD

# Compare to main
python3 tools/architecture_guard/guard.py --base origin/main --head HEAD

# Single file (fixtures / local debug)
python3 tools/architecture_guard/guard.py validate-file path/to/file.py \
  --as-path DEWA/backend/app/services/example.py
```

Exit codes: **0** = pass (warnings may be printed), **1** = architecture error.

## Regression proof

```bash
bash tools/architecture_guard/test_guard_violation.sh
```

Simulates bad cross-domain import + bad sys.path (expect fail) and legal shared/tools import (expect pass).

## CI integration

### Monorepo PR gate (canonical)

`.github/workflows/eliteew-pr-gate.yml`:

1. `architecture-integrity-check`
2. `code-hygiene-check` (`needs: architecture-integrity-check`)

### Standalone / other CI

```yaml
- name: Architecture Guard
  run: python3 tools/architecture_guard/guard.py --base "${{ github.event.pull_request.base.sha }}" --head HEAD
```

### Local unified chain

```bash
bash tools/check_all.sh
```

### GitHub Actions (manual snippet)

### GitLab CI (example)

```yaml
architecture-guard:
  script:
    - python3 tools/architecture_guard/guard.py --base "${CI_MERGE_REQUEST_DIFF_BASE_SHA}" --head HEAD
```

### Pre-commit (optional)

```yaml
- repo: local
  hooks:
    - id: architecture-guard
      name: Architecture Guard
      entry: python3 tools/architecture_guard/guard.py --base HEAD --head HEAD
      language: system
      pass_filenames: false
      stages: [commit]
```

For pre-commit on staged-only changes, use `--base HEAD` with a wrapper that diffs against the index, or run in CI on PRs.

## Adding a new domain

1. Edit **`.cursor/domain_matrix.json`** — add a `domains[]` entry with `id`, `label`, and `path_patterns` (e.g. `myproduct/**`).
2. If other domains may import shared types from your area, add globs under **`shared_contract_paths`**.
3. Re-run `bash tools/architecture_guard/test_guard_violation.sh` and a sample `guard.py` diff on a branch touching the new tree.
4. Cursor SoT is monorepo-root `.cursor/` only (`EliteEW/.cursor` retired).

The guard **does not** modify `domain_matrix.json`; registration is a separate human/agent step.

## Related

- `.cursor/rules/domain-boundary-gate.mdc` — agent HARD STOP on cross-domain writes
- `.cursor/hooks/domain-boundary-gate.py` — Phase 1 warn-only on DEWA/legacy writes
- `documentation/platform/AGENT-DOMAIN-BOUNDARY-GATE.md`
