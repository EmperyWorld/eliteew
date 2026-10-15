# EWA Agentic Kernel Redesign — Decision / FSM / Scheduler

**Status:** Design (2026-07-26); **K0–K4 done** (`loop.py` ≤400 hard LOC target met).  
**Grounding:** Living substrate canon `documentation/plans/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]*; code already splits Think (`engine.py` / `decision_engine.py`), FSM (`state_machine.py` / `fsm_port.py`), tree claim (`tree_scheduler.py` + `jobs/step_executor.py`).  
**Problem:** `kernel/loop.py` was a god-orchestrator (~1.6k LOC); K3/K4 extract Act/Plan/HITL/Think-phase / tick support / think-output dispatch so the coordinator no longer owns inline tool dispatch when the step scheduler is ON.

## Goal

Сделать `loop.py` **тонким координатором событий**, а не местом бизнес-логики. Три слоя с **строгими портами** (сообщения/команды), без прямого импорта LLM/tool dispatch из FSM и без FSM-мутаций из Think.

```text
                    ┌─────────────────────────┐
                    │   Loop Coordinator      │
                    │   (loop.py — thin)      │
                    └───────────┬─────────────┘
           KernelEvent / KernelCommand (typed)
          ┌────────────┼────────────────┐
          ▼            ▼                ▼
   DecisionEngine  StateMachine    TaskScheduler
   (engine.py+)    (state_machine  (tree_scheduler +
                    + memory)       step_executor)
          │            │                │
          └────────────┴────────────────┘
                       │
                 Postgres SoT
            (sessions, tree, checkpoints, inbox)
```

## Target package layout

| Layer | Responsibility | Owner modules (evolve, do not invent parallel trees) |
|-------|----------------|------------------------------------------------------|
| **Decision Engine** | LLM Think only: context → structured `ThinkCommand` / `AgenticThinkOutput`; parse/repair; **no** DB transitions, **no** tool Act | `decision_engine.py` (K0 port), `engine.py`, `think_schema_v1.py`, `think_command_v1.py`, `prompt_builder.py`, `context_budget.py`, `session_status.py` |
| **State Machine** | Session status + working memory + HITL gate open/close; revision bump; checkpoint `kind=state_transition` / `gate` | `fsm_port.py` (K0/K1 command port), `state_machine.py` (lifecycle phases merged from retired `state_machine_v2`), gate helpers, memory tier sync **write API** |
| **Task Scheduler** | Claim/run one tree node; tool bridge; step success/fail; enqueue next step or handoff to Think | `tree_scheduler.py`, `jobs/step_executor.py`, `shared/api/ewa_platform/agentic/tools/bridge.py` |
| **Coordinator** | Rehydrate → emit commands → apply results → schedule next tick | `loop.py` (thin) + **`loop_bridge.py`** + **`loop_tick_support.py`** / **`think_output_dispatch.py`** + **`act_executor.py`** / **`plan_applier.py`** / **`hitl_from_think.py`** / **`think_phase.py`** (K3/K4) |

`legacy_adapter.py` remains until Release Gate 5 (master plan); no new call sites.

---

## Part A — Contracts (события и команды)

### A.1 Shared envelope

```text
KernelCommand {
  session_id: UUID
  principal_id: str
  expected_revision: int
  correlation_id: str   # tick_id / celery task id
  kind: enum
  payload: discriminated union
}

KernelEvent {
  session_id: UUID
  revision_after: int | null   # null if rejected
  correlation_id: str
  kind: enum
  payload: discriminated union
  error_code: str | null       # fail-closed codes, never silent
}
```

Все слои принимают/возвращают только эти типы (Python TypedDict / Pydantic в `kernel/types.py`). **Запрещено** передавать сырой `asyncpg.Record` через границы слоёв наружу координатора.

### A.2 Decision Engine

| Command | Payload | Event |
|---------|---------|-------|
| `ThinkRequest` | `AgenticContext` snapshot (immutable) + policy flags | `ThinkSucceeded` \| `ThinkParseFailed` \| `ThinkBudgetDenied` |
| — | — | `ThinkNeedsClarification` (structured gate draft, **not** applied) |

**Инварианты Decision:**

1. Не вызывает `apply_session_transition`.
2. Не вызывает `agentic_dispatch_tool` / bridge.
3. Не пишет tree nodes напрямую — только предлагает `PlanMutationProposal` в payload успеха.
4. Heuristic fallback (`EWA_AGENTIC_THINK_LLM_ENABLED=0`) — тот же выходной контракт.

### A.3 State Machine (+ HITL / Memory)

| Command | Payload | Event |
|---------|---------|-------|
| `ApplyTransition` | `event` (FSM event name) + optional reason | `TransitionApplied` \| `TransitionRejected` |
| `OpenHitlGate` | `gate_json`, `bound_node_id` | `GateOpened` (status → `awaiting_human`) |
| `ConsumeHitlResponse` | inbox message + confirm/cancel | `GateResolved` \| `GateStale` |
| `UpsertWorkingMemory` | tier patches (act summaries, instruction) | `MemoryUpdated` |

**Инварианты State Machine:**

1. Illegal transition → `TransitionRejected`, **zero** DB side effects (уже в `resolve_next_status`).
2. Каждый `TransitionApplied` → bump `session_revision` + checkpoint `state_transition`.
3. `OpenHitlGate` **обязан** сохранить `gate_json` на session **и** на bound node (`awaiting_human`); без `bound_node_id` для tool HITL — reject.
4. Chat freeform при `awaiting_human` **не** auto-confirm (master plan §HITL).
5. Working memory пишет только ссылки/сводки; полные tool payloads — по `checkpoint_id`.

### A.4 Task Scheduler

| Command | Payload | Event |
|---------|---------|-------|
| `ClaimNextStep` | session lease holder | `StepClaimed` \| `NoRunnable` \| `LeaseBusy` |
| `ExecuteStep` | `node_id` + tool binding | `StepSucceeded` \| `StepFailed` \| `StepNeedsHitl` |
| `FailEmptyPending` | structural cleanup | `PendingCleaned` |

**Инварианты Scheduler:**

1. Один claimed node на шаг; Act без runnable `node_id` для bind-required tools — **запрещён** (`act_binding_policy`).
2. `StepNeedsHitl` → **не** продолжает Act; эмитит событие → координатор шлёт `OpenHitlGate`.
3. В scheduler mode Think **не** владеет Act; после HITL confirm при runnable rows → `agentic_step_task`, не Think tick (master plan).
4. Circuit / death-spiral: превышение replan streak → `OpenHitlGate` с `Reasoning_Loop_Detected`, не бесконечный replan.

### A.5 Coordinator sequencing (один tick)

```text
1. Rehydrate → AgenticContext (read-only snapshot)
2. If status awaiting_human and no ConsumeHitl → return early (worker release)
3. If status planning|replanning → ThinkRequest → on PlanMutationProposal → persist via State Machine + tree write API owned by Coordinator (or PlanApplier port)
4. If status executing and step_scheduler_on → ClaimNextStep / ExecuteStep
5. Map StepNeedsHitl → OpenHitlGate
6. Map terminal / continue → ApplyTransition + enqueue next Celery task
7. Mirror sync once at tick boundary (existing sync_and_publish)
```

Координатор — единственный, кто знает Celery enqueue и Operations mirror.

### A.6 K2 — Execution Guard + Action Feedback (`loop_bridge`)

Bridge cycle (integration path; prod tick still has legacy Act branches until K3):

```text
Context → Think (Decision) → ApplyTransition → Act → Action Feedback → Next Think
```

| Rule | Behavior |
|------|----------|
| **Execution Guard** | Act только после `TransitionApplied` на authorizing event: `act_authorized` (continue/act), `plan_ready` / `plan_patch_applied` (optional first act). Иначе `execution_guard_blocked` / `transition_rejected` — **zero** tool dispatch. |
| **FSM event** | `continue`/`act` → `act_authorized` (`executing→executing` или `planning→planning`). |
| **Action Feedback** | Result Success/Error → checkpoint `kind=act` + `payload_json` + inbound `message_json.text` → новый `AgenticContext` → Next Think **только** через bridge (`run_think_transition_act_feedback_cycle`). |
| **Isolation** | Act (`shared/api/ewa_platform/agentic/tools/bridge.py`) не импортирует Decision; Decision не вызывает Act; замыкание цикла — только `loop_bridge`. |

API: `assert_execution_guard`, `build_context_with_act_feedback`, `run_think_transition_act_feedback_cycle`; loop facade `run_decision_to_action_bridge(..., with_action_feedback=True)`.

---

## Safety invariants (сводка — fail-closed)

| # | Rule |
|---|------|
| S1 | Нет Act side-effect при `status=awaiting_human` без успешного `ConsumeHitlResponse`. |
| S2 | Нет tool dispatch для HITL-required tools без открытого/разрешённого gate (или `auto_accept` policy flag + logged). |
| S3 | Нет Think→Act на loop path для `file_create`/`file_save_text` без tree `node_id`. |
| S4 | Postgres SoT; Redis/SSE notification only. |
| S5 | Lease: чужой `lease_holder` → no-op / 409; не «тихо продолжить». |
| S6 | Death-spiral: circuit open → HITL, не silent replan churn. |
| S7 | `loop.py` не импортирует `openai` / raw HTTP LLM client — только Decision port. |

---

## Migration plan (без big-bang)

| Phase | Work | Exit proof |
|-------|------|------------|
| K0 | **Done (2026-07-26):** `KernelCommand`/`KernelEvent`; `decision_engine`; `fsm_port` preview + mapping; `session_status` | `tests/test_agentic_kernel_k0_decision_isolation.py` |
| K1 | **Done (2026-07-26):** `loop_bridge` Decision→FSM→Act relay; loop Think via Decision Engine; Think-driven transitions via `fsm_port` | `tests/test_agentic_kernel_k1_bridge.py` |
| K2 | **Done (2026-07-26):** Execution Guard (`act_authorized` / TransitionApplied before Act); Action Feedback → next Think only via bridge; Act never calls Decision | `tests/test_agentic_kernel_k2_execution_feedback.py` |
| K3 | **Done (2026-07-26):** Scheduler-only Act when `EWA_AGENTIC_STEP_SCHEDULER_ENABLED` (default True via async jobs): Think `action=act` → `reason=scheduler_handoff` (no inline `agentic_dispatch_tool`); inline Act via `act_executor.execute_inline_act` when scheduler off | `tests/test_agentic_kernel_k3_scheduler_only_act.py` + `-k 'agentic_kernel_k or death_spiral or act_only or act_binding or step_scheduler or tree_scheduler or replanning_circuit'` |
| K4 | **Done (2026-07-26):** Soft wave extracts (`act_executor`, `plan_applier`, `hitl_from_think`, `think_phase`) + hard-target extracts **`loop_tick_support.py`** (pause/abort/busy/replanning/gate/INIT/leased body) and **`think_output_dispatch.py`** (clarify/plan/gate/act/complete); merged lifecycle into `state_machine.py` (trashed `state_machine_v2`); `loop.py` **1607 → ~349** (≤400 hard). Public API stable: `run_agentic_loop_tick`, `run_decision_to_action_bridge` | `wc -l …/kernel/loop.py` ≤400; same pytest `-k` as K3; `eliteew-god-file-loc-guard.sh` |

**Rollback:** feature flags already exist (`EWA_AGENTIC_STEP_SCHEDULER_ENABLED`, think LLM). Scheduler **off** keeps inline Act via `act_executor` (documented dual-flag path).

## Failure / Edge-Case Matrix (design)

| Axis | Behavior |
|------|----------|
| Offline-mode | Session + tree in PG; worker retry; UI SSE/poll; no in-memory Agent |
| Dual-flag | Substrate off → legacy companion; **scheduler ON (default)** → Think `act` handoff only, Act in `step_executor`; **scheduler OFF** → loop calls `act_executor` (inline Act preserved) |
| Permission | `principal_id` on all commands; tool allowlist unchanged via bridge |
| Regression | `test_agentic_kernel_k3_scheduler_only_act.py`, `test_ewa_agentic_chaos.py`, `test_agentic_brain_intelligence.py`, `ewa-agentic-smoke.sh`, death-spiral gate |

## Related

- `documentation/plans/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]*
- `.cursor/rules/ewa-agentic-substrate.mdc`
- Second-pass review for `agentic/kernel/**` (see [ENGINEERING-GOVERNANCE-MANIFESTO.md](../../platform/ENGINEERING-GOVERNANCE-MANIFESTO.md); former `eliteew-bus-factor.mdc` removed)
- Platform governance: [`../../platform/ENGINEERING-GOVERNANCE-MANIFESTO.md`](../../platform/ENGINEERING-GOVERNANCE-MANIFESTO.md)
