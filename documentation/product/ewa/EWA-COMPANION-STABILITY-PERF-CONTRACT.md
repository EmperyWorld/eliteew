# Assistant — Stability & Performance Contract

**Status:** living canon (2026-07-28)
**Scope:** agentic Celery step/loop budgets, SoftTimeLimit recovery, generative `file_create` compose checkpoints, heavy-LLM admission, Operations UI SSE-first polling, **FE idle timer / render budget**.

Related: `documentation/plans/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]*, [EWA-COMPANION-FILE-CATALOG.md](./EWA-COMPANION-FILE-CATALOG.md), [DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md](../desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md).

## Symptom → cause (prod evidence)

On prod-core, `agentic_step_task` historically used Celery `soft_time_limit=55` while `file_create` multi-pass compose and `call_expert_chat` routinely need 35–82s+. SoftTimeLimit → blind Celery retry → orphan recovery → session `failed`. Worker CLI `--soft-time-limit=900` does **not** override the task decorator.

## Celery budget contract

| Task | Env soft | Env hard | Default soft/hard | Claim / lease |
|------|----------|----------|-------------------|---------------|
| `agentic_step_task` | `EWA_AGENTIC_STEP_SOFT_TIME_LIMIT_SEC` | `EWA_AGENTIC_STEP_TIME_LIMIT_SEC` | **180 / 240** | `EWA_AGENTIC_STEP_CLAIM_SECONDS` clamped ≤ soft (default = soft) |
| `agentic_loop_tick` | `EWA_AGENTIC_LOOP_SOFT_TIME_LIMIT_SEC` | `EWA_AGENTIC_LOOP_TIME_LIMIT_SEC` | ≥ think timeout + 30 (typ. **90 / 120**) | Session lease via `EWA_AGENTIC_LEASE_SECONDS`, wired through `agentic_lease_seconds()` |

**Invariant:** task soft ≥ claim; hard ≥ soft + 30. Config helpers live in `api/ewa_platform/agentic/config.py`.

## SoftTimeLimit policy

1. Classifier: `is_agentic_celery_soft_timeout(exc)` (name `SoftTimeLimitExceeded` + `__cause__` chain).
2. **No** blind Celery `self.retry` on soft timeout.
3. Structured recovery: clear claim → `retry_wait` (or terminal after `EWA_AGENTIC_SOFT_TIMEOUT_MAX_PER_NODE`, default 5) → enqueue step with `EWA_AGENTIC_STEP_RETRY_DELAY_SEC`.
4. Orphan recovery remains a safety net, not the primary path.

## Generative compose checkpoint

- WM key: `doc_create_draft_v1` (`body`, `pass_index`, fingerprint, targets).
- One Celery slice prefers **one** LLM pass; incomplete body → Act status `continue` → schedule same node without burning failure `retry_count`.
- Product length targets (`EWA_COMPANION_DOC_CREATE_TARGET_MIN_CHARS` default 24000) stay; execution is checkpointed, not shortened as a fake fix.

## Heavy-LLM admission

- Flag: `EWA_AGENTIC_LLM_ADMISSION_ENABLED` (default ON when substrate on).
- At most one concurrent heavy tool (`call_expert_chat`, generative `file_create`) per Redis lease `ewa_agentic_llm_heavy`.
- Contended step → `retry_wait` + `EWA_AGENTIC_LLM_ADMISSION_POLL_SEC` (default 8).

## Frontend Operations SSE-first

- Active runs + SSE connected: **no** dense periodic `GET …/task-runs` (safety ≥ 5 min only).
- GET reconcile: mount, focus/visibility, SSE reconnect/fail, terminal event, manual refresh, load-more.
- Idle (desktop window **active**): ≥ 120s or event-driven.
- Idle (desktop window **inactive**, no active runs): **stop** periodic GET; focus/visibility handlers reconcile on return.
- Admin task-runs tab (15s React Query) is out of scope.

## Frontend idle timer / render budget (2026-07-28)

Cause cluster for “EWA constantly rendering / system load” while companion is open but idle:

| Hotspot | Contract |
|---------|----------|
| Left-rail open-apps | `companionShellOpenAppsFingerprint` — `setState` only when non-minimized app set changes; poll **15s** + focus/visibility (no blind 8s tick). |
| Anticipation observation | `useEwaCompanionAnticipationTick` — skip tick side-effects while `document.hidden`; tick on visibility return. |
| Presence ambient CSS | `companion-presence-background` / `companion-presence-at-rest` pause sigil/aura loops (`companionPresence.css`). |
| Ops poll | See SSE-first above — no idle reschedule when window inactive. |
| Pending reload banner | `useCompanionPendingReloadDelay` — **one** `setTimeout` at threshold (no 500ms interval). |
| Doc draft age label | `useCompanionDocumentServerDraftSync` age tick **60s**. |
| Desktop FPS rAF | Gated via `frameSamplingEnabled` — see desktop canon Frame sampling gate. |

## Regression

```bash
bash docker/scripts/run-stack0-api-tests.sh tests/ -k 'agentic_g1_reliability or agentic_step_scheduler or doc_create_generative or agentic_llm_admission or agentic_step_budget' -q
cd shared/web/frontend && pnpm exec vitest run \
  src/features/ewa/companionOperations \
  src/features/ewa/companionUx/__tests__/companionShellOpenAppsFingerprint.test.ts \
  src/features/ewa/companionUx/__tests__/useCompanionPendingReloadDelay.test.ts \
  src/features/ewa/__tests__/useEwaCompanionAnticipationTick.test.ts \
  src/pages/Desktop/hooks/__tests__/usePerformanceOptimizer.test.ts
```

**Death-spiral Release Gate 0** (circuit / act-binding / companion probe+SSE / auth+shell storms):

```bash
bash docker/scripts/eliteew-death-spiral-gate.sh
```

Canon: [`EWA-DEATH-SPIRAL-REGRESSION-GATE.md`](EWA-DEATH-SPIRAL-REGRESSION-GATE.md).

## Failure / edge matrix

| Axis | Behavior |
|------|----------|
| Offline llama/embed | Tool error / retry_wait; UI honest failed |
| Dual-flag | Task decorator/env soft wins over worker CLI soft |
| Permission | WM draft scoped to session/principal |
| SoftTimeLimit storm | Structured recovery + compose resume; no blind retry |
| Offline FE (hidden tab) | Anticipation / ops visibility refresh skipped; resume on visible |
| Dual-flag FE | Settings Performance tab + floating widget: Settings open wins (widget sampling off while Settings open) |
| Permission FE | Ops poll follows `pollEnabled` + desktop-window active; default deny when poll disabled |
| Regression | Narrow vitest paths in §Regression |
