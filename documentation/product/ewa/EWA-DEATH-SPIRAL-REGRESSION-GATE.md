# EWA Death-Spiral Regression Gate (Release Gate 0)

**Status:** living  
**Date:** 2026-07-26  
**Scope:** Regression locks that prove agentic / companion / auth / desktop shell death spirals stay bounded before Release Gate 0 exit.  
**Out of scope:** WorkflowBuilder; K3 legacy-Act deletion (Phase C Cause — see note below).

Gate 0 locks **current** fail-closed behavior. It does not rewrite production Act ownership.

## Four classes → tests → gate command

| Class | Failure mode locked | Primary test files | Notes |
|-------|---------------------|--------------------|-------|
| **A — Agentic circuit** | Unbounded replanning / revision churn → HITL with `Reasoning_Loop_Detected` | `shared/api/tests/test_agentic_death_spiral_gate.py`, `test_agentic_replanning_circuit_breaker.py` | Cap via `EWA_AGENTIC_MAX_REPLANNING_ATTEMPTS`; reset only on successful Act |
| **B — Act binding** | Think→Act without tree node / scheduler mismatch loops | `test_agentic_act_binding_policy.py` (+ thin re-exports in death-spiral gate pack) | Companion HITL tools require `node_id`; Gate A does not delete legacy Act (K3) |
| **C — Companion FE** | Opaque 404 probe loop (#185 left-rail), SSE + `activeRunIdsKey` reconnect storm | `companionPlansFeatureProbe.test.ts`, `useCompanionLeftRailController.test.ts`, `useCompanionTaskEventsStream.test.ts` | Probe cache stops repeat `/companion-plans/active`; SSE no immediate reconnect storm after key churn |
| **D — Auth + shell** | Socket recover + terminate storm; follower shell_state PATCH storm | `authSessionDeathSpiral.test.ts`, `desktopShellStateFollowerInvalidate.test.ts`, `desktopShellStateMutationPipeline.test.ts` | One teardown wave; follower zero PATCH / keepalive under write storm |

### Gate command

From monorepo root (command-center):

```bash
bash docker/scripts/eliteew-death-spiral-gate.sh
```

The script runs:

1. API slice via `run-stack0-api-tests.sh` with  
   `-k 'death_spiral or Reasoning_Loop or act_only or replanning_circuit or act_binding'`  
   (host pytest fallback only if the container wrapper is unavailable — wrapper remains canon).
2. Narrow Vitest on the FE paths listed above.
3. `bash -n` self-check is satisfied by shipping a syntactically valid script; operators may re-run `bash -n docker/scripts/eliteew-death-spiral-gate.sh`.

## Failure / Edge-Case Matrix

| Axis | Behavior |
|------|----------|
| **Offline-mode** | Agentic: session stays in PG; circuit still opens on repeated tool/parse failures when worker runs; UI shows HITL / honest failed — no silent unbounded replan. Companion plans: opaque/offline 404 → probe `disabled`, no fetch storm. Auth: locked session → socket recover no-op. Shell follower: no PATCH while offline leader may still coalesce. |
| **Dual-flag / conflict** | Substrate / scheduler flags unchanged by Gate A. Probe `disabled` wins over poll/focus refresh (no API). Auth teardown lock wins over parallel `recoverSocketAuthConnection` + `executeAuthSessionTermination`. Shell: follower role + single-tab gate wins over local mutation scheduling for network PATCH. |
| **Permission / access boundary** | Agentic routes remain `principal_id`-scoped. Plans API probe is session-module state (not cross-user). Auth termination clears principal-scoped LS / query cache. Follower tabs must not PATCH `shell-state` (single-tab policy). |
| **Regression command** | `bash docker/scripts/eliteew-death-spiral-gate.sh` |

## K3 note (Phase C Cause)

**K3** in [`EWA-AGENTIC-KERNEL-REDESIGN.md`](EWA-AGENTIC-KERNEL-REDESIGN.md) (scheduler-only Act; delete remaining legacy Act behind flag) is **Phase C Cause** work. **Gate A locks current behavior** — including act-binding and circuit breaker on the path that still exists today — and is **not** permission to remove legacy Act in this phase.

## Related canon

| Doc | Why |
|-----|-----|
| [`EWA-AGENTIC-KERNEL-REDESIGN.md`](EWA-AGENTIC-KERNEL-REDESIGN.md) §S6 | Death-spiral → HITL, not silent replan churn |
| [`EWA-COMPANION-STABILITY-PERF-CONTRACT.md`](EWA-COMPANION-STABILITY-PERF-CONTRACT.md) | Soft-limit / SSE-first / regression harness |
| [`../FRONTEND-AUTH.md`](../FRONTEND-AUTH.md) | OIDC, session_replaced, logout cascade |
| [`../desktop/DESKTOP-STATE-PERSISTENCE.md`](../desktop/DESKTOP-STATE-PERSISTENCE.md) | shell_state pipeline, follower single-tab gate |
| `documentation/plans/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]* | Release Gate 0 row |

## Exit criteria (Phase A)

- [x] Living canon + INDEX entry
- [x] API death-spiral gate pack
- [x] FE companion / auth / shell locks
- [x] `docker/scripts/eliteew-death-spiral-gate.sh` executable
- Gate script green on command-center (operator / CI)
