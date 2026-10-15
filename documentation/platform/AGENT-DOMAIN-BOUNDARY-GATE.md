# Agent Domain Boundary Gate

Phase 1 **domain-aware governance** for the `powered_by_emperyworld` monorepo.

## Artifacts

| Artifact | Role |
|----------|------|
| `.cursor/domain_matrix.json` | Machine-readable domain registry (paths, criticality, dependencies, constraints) |
| `.cursor/rules/domain-boundary-gate.mdc` | Agent rule: cross-domain HARD STOP + Mandatory Impact Analysis |
| `.cursor/hooks/domain-boundary-gate.py` | Phase 1 **warn-only** hook for domains tagged `legacy` in the matrix |

Soft-retired operator contours (`DEWA`, `EWGen`, `EWPower`, …) live under **`trash/`** and are **not** active domains. Mentions without an explicit restore-from-trash request are out of scope (see `.cursorrules` Scope Defaults).

## Domain resolution

1. Load `domain_matrix.json`.
2. Map each changed path to one or more `domains[].id` (longest prefix / glob win).
3. Skip paths listed in matrix `exclude.path_prefixes` and `exclude.path_globs` (runtime/build noise; aligned with `.cursorignore` hard-block intent).

**Intra-domain:** single domain ID across all touched paths → proceed with normal risk gate.

**Cross-domain:** ≥2 domain IDs → Mandatory Impact Analysis + **human approval** before implementation.

## Mandatory Impact Analysis

Required sections:

- **Affected Domains** — IDs, labels, paths
- **Potential Side Effects** — deploy, auth, API contract, runtime
- **Dependency Risk** — upstream/downstream from matrix `dependencies`
- **Shared Contract Paths** — if any path matches `shared_contract_paths`
- **Proposed Scope Expansion** — when operator must widen scope explicitly

## FE / product boundary invariants

Active product FE boundary (matrix + rule):

| Source domain | Forbidden without scope expansion |
|---------------|-----------------------------------|
| `eliteew_frontend` | Unrelated monorepo UI outside `shared/web/frontend/**` |
| (archived) | Soft-retired apps under `trash/` — restore only on operator request |

There is **no** living DEWA/EWGen frontend at workspace root. Historical dual-tree FE negative invariants are retired with those trees.

## Phase 1 hook (warn-only)

`domain-boundary-gate.py` on `preToolUse` (`Write|StrReplace|EditNotebook`):

- Emits `[DOMAIN BOUNDARY GATE]` when the matched domain has `warn_tags` including `legacy`.
- `failClosed: false` — never blocks.
- Missing or invalid matrix → fail-open + stderr warning.

Future Phase 2 may enforce cross-domain deny with operator override.

## Architecture Guard (CI static analysis)

Read-only validator for **import / sys.path drift** on git diffs:

| Artifact | Role |
|----------|------|
| `tools/architecture_guard/guard.py` | Cross-domain imports, unregistered top-level dirs; historical DEWA/EWGen path markers for restore/diff fixtures |
| `tools/architecture_guard/test_guard_violation.sh` | Regression proof (bad → exit 1, good → exit 0) |
| `tools/architecture_guard/README.md` | Operator/CI integration |

```bash
bash tools/architecture_guard/test_guard_violation.sh
python3 tools/architecture_guard/guard.py --base origin/main --head HEAD
```

Wired in `.github/workflows/eliteew-pr-gate.yml` as job **`architecture-integrity-check`** (step 1 of the unified gate).

Guard fixtures may still use `DEWA/` / `EWGen/` **logical paths** for negative tests; that does **not** mean those trees are live workspace roots.

## Full Pipeline Compliance

Monorepo quality and deploy follow a **fixed chain**. Do not skip an earlier stage.

```text
Architecture Integrity  →  Code Hygiene  →  Deployment
     (guard.py)            (ruff + biome)   (eeprodline / eeprodbaked)
```

| Stage | What | Tool / workflow | Fail behaviour |
|-------|------|-----------------|----------------|
| **1 — Architecture Integrity** | Cross-domain imports, illegal sys.path patterns, unregistered top-level dirs | `tools/architecture_guard/guard.py` · CI job `architecture-integrity-check` | **Exit 1** — no lint, no deploy |
| **2 — Code Hygiene** | Python style/contracts (EliteEW API) + U3 decision_engine import guard + TS/TSX lint (EliteEW SPA) | `u3-agentic-decision-engine-import-guard.sh` · `uv run ruff check` · `pnpm exec biome check` · CI job `code-hygiene-check` (`needs: architecture-integrity-check`) | **Exit 1** — no deploy |
| **3 — Deployment** | stack0 baked (A) or dev-bind (B) on prod-core | Line A release via `eliteew-deploy.sh release stack0 --all`; line B via `eeprodline` — from command-center `.136` | Operator smoke; rollback per runbooks |

**Local unified command** (same order as CI stages 1–2):

```bash
bash tools/check_all.sh
# optional refs for guard only:
CHECK_ALL_BASE=origin/main CHECK_ALL_HEAD=HEAD bash tools/check_all.sh
```

After hygiene passes locally, proceed with domain-specific tests (`bash docker/scripts/run-stack0-api-tests.sh`, focused Vitest) and deploy wrappers per `project-and-deploy.mdc`.

**CI workflow** (`.github/workflows/eliteew-pr-gate.yml`):

1. `architecture-integrity-check` — runs `guard.py` on PR/push diff.
2. `code-hygiene-check` — runs `tools/check_all.sh --skip-architecture` (U3 decision_engine guard + Ruff + Biome); **does not start** if step 1 failed.

Extended regression (full pytest gate, doc drift) remains **outside** this two-job PR gate — run on command-center or dedicated workflows before release cutover.

## Sources of truth

- `.cursor/domain_matrix.json` — active domains, excludes, shared contracts
- `.cursor/universe_map.md` — project registry
- `.cursor/skills/project-discovery-audit/scopes.md` — audit scope IDs
- `.cursorrules` — soft-retired trees under `trash/`

## Cursor mirror

Domain `cursor_governance` (`.cursor/**`, `.cursorrules`): SoT is monorepo root only — do not recreate the retired EliteEW mid-alias `.cursor` tree.

## Verification

```bash
bash .cursor/hooks/hooks-selftest.sh   # includes domain-boundary-gate section
python3 -m json.tool .cursor/domain_matrix.json >/dev/null
```

## Related

- `.cursor/rules/verified-proposal-protocol.mdc` — Commit Package; commit only after approval
- `.cursor/rules/task-intake-and-risk-gate.mdc` — Failure/Edge-Case Matrix
- `.cursor/rules/agent-code-verification.mdc` — Layer B/C on cross-domain contracts
- `.cursor/rules/cause-first-intake.mdc` — root cause before symptom locks
- `documentation/platform/AGENT-VERIFIED-PROPOSAL-PROTOCOL.md`
