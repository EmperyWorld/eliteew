# Zero-Trust Git Hooks

**Status:** Active (2026-07-05)  
**Owner:** platform / deploy integrity  
**Entry:** `scripts/eliteew/zero-trust-pre-commit.sh`, `.githooks/pre-commit`

## Purpose

Enforce **atomic, traceable commits** before code reaches prod-core deploy gates. Complements (does not replace):

- `docker/scripts/deploy-provenance-gate.sh` — release/hotfix build gate
- Cursor agent hooks — session workflow, not commit-time enforcement
- **Verified Proposal Protocol** — agents prepare a Commit Package and commit only after operator approval (`AGENT-VERIFIED-PROPOSAL-PROTOCOL.md`); this hook still runs whenever a commit is made

## Install

On command-center (operator):

```bash
bash scripts/eliteew/install-zero-trust-git-hooks.sh
```

Uses `pre-commit install` when `pre-commit` is available; otherwise sets `core.hooksPath=.githooks`.

Self-test:

```bash
bash scripts/eliteew/zero-trust-pre-commit-selftest.sh
```

## Three enforcement layers

### 1. Critical path atomicity (No Frankenstein commits)

Scans `git status --porcelain` for dirty paths under:

| Prefix | Role |
|--------|------|
| `docker/scripts/` | Deploy CLI, provenance gates |
| `docker/builders/` | Baked image Dockerfiles |
| `docker/stack/` | Compose stacks |
| `documentation/platform/docker-re_doc/` | Operator runbooks |

**Blocks when:**

- Any critical file has unstaged or partial staging (`MM`, ` M`, untracked `??`).
- A commit stages **only non-critical** files while any critical path remains dirty.

**Goal:** Infrastructure and feature commits cannot be mixed accidentally; each critical-path change must be a complete, staged unit.

### 2. Format and lint (No messy code)

On **staged** files only (living trees):

| Path pattern | Tool |
|--------------|------|
| `shared/api/**/*.py` | `uv run ruff format` + `ruff check` (host: `.venv`) |
| `shared/web/frontend/src/**/*.{ts,tsx}` | `pnpm exec biome check --write` |
| `docker/scripts/*.sh`, `scripts/eliteew/*.sh` | `bash -n` + `shellcheck` (if installed) |

Auto-formatted files are re-staged before the commit completes.

**Soft-retired paths:** `scripts/eliteew/zero-trust-pre-commit.sh` may still contain dormant `DEWA/backend` / `DEWA/frontend` branches. Those trees are not living workspace roots (soft-retired under `trash/`); the branches are no-ops unless an operator restores the trees. Do not document DEWA/EWGen as active dual-repo lint targets.

### 3. Smoke tests (No broken logic)

Lightweight, **staged-file-scoped** checks:

- **Frontend:** `vitest run` on co-located `*.test.ts(x)` / `*.spec.ts(x)`; UltimateDocEditor changes also run analytical pipeline + safeEditorGetHtml tests.
- **API:** `docker/scripts/run-stack0-api-tests.sh` on staged `tests/` files or matching `test_<module>.py`.

Skips when no applicable staged sources (docs-only commit).

## Emergency bypass

```bash
SKIP_ZERO_TRUST_PRE_COMMIT=1 git commit -m "..."
```

Logged to stderr. Not for routine deploy work — use only for incident recovery with operator approval.

## Relationship to deploy provenance

| Gate | When | Scope |
|------|------|-------|
| **Zero-Trust pre-commit** | Every `git commit` (when installed) | Staged atomicity + lint + smoke |
| **deploy-provenance-gate --release** | Before `eeprodbaked` / bake | Full deploy source-path cleanliness |

A commit can pass pre-commit while release gate still requires a clean tree for bake — that is intentional (pre-commit prevents *new* Frankenstein commits; release gate validates deploy moment).

## Related

- `documentation/platform/docker-re_doc/DEPLOY-CLI-PROVENANCE.md`
- `documentation/platform/AGENT-VERIFIED-PROPOSAL-PROTOCOL.md`
- `documentation/platform/TESTING-STRATEGY.md` — host venv / immutable runner
- `.pre-commit-config.yaml`
