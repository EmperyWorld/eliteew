# EWA companion server plans: decision and current contract

Explanation and reference for durable companion goals/tasks, their chat tools and five HTTP routes. The decision is to store the plan in EWA PostgreSQL and project it into the chat rail, desktop agenda and CalendarApp. This source review does not establish deployed flags, migration state, model quality or concurrent database behavior.

## Decision and ownership

The assistant plan is a bundle of `ewa_companion_plans`, `ewa_companion_plan_goals` and `ewa_companion_plan_tasks`. The parent references the companion profile principal; goals/tasks reference their plan with cascading deletion. Task `goal_id` references a goal with `ON DELETE SET NULL`. Schema owners are [migration 008](../../../shared/api/ewa_platform/migrations/applied/008_ewa_companion_plans.sql), [migration 036 for time/duration](../../../shared/api/ewa_platform/migrations/applied/036_ewa_companion_plan_task_due_time.sql) and [runtime schema/persistence](../../../shared/api/ewa_platform/persistence_pg/companion_plans_asyncpg.py).

Keep these distinct sources and lifecycles:

- **Assistant plan:** durable EWA goals/tasks. `plan_v1` creates/replaces content; task HTTP writes and `plan_task_complete_v1` change its steps. The plan does not automatically execute them.
- **Personal calendar:** `desktop_calendar_events` in the main application database. Calendar CRUD and `calendar_v1` have independent authorization/parsing/persistence; the plans flag does not gate them.
- **TurnPlan:** a profile learned-preferences queue, governed by [multi-task orchestration](EWA-COMPANION-MULTI-TASK-ORCHESTRATION.md).
- **Workflows/task runs:** the [registry](EWA-COMPANION-WORKFLOW-REGISTRY.md), [personal workflows](EWA-COMPANION-USER-WORKFLOWS.md), [DAG engine](EWA-COMPANION-WORKFLOW-ENGINE-V2.md) and [operations panel](EWA-COMPANION-OPERATIONS-PANEL.md) retain separate execution/confirmation contracts.

The client presents the saved bundle and edits existing calendar slots. There is no plan-creation HTTP endpoint or full roadmap constructor in this route set. The creation tool writes immediately without a confirmation action. Deployment hosts/endpoints/models belong to [current topology](../../platform/PRODUCTION-TOPOLOGY-STATE.md#current-2026-07-30--living).

## Chat routing and writes

Owners: [operations handlers](../../../shared/api/ewa_platform/companion/orchestration/tools/handlers_ops.py), [plan service](../../../shared/api/ewa_platform/companion/plans/service.py), [creation intent](../../../shared/api/ewa_platform/companion/plans/intent.py), [refinement](../../../shared/api/ewa_platform/companion/plans/refine_intent.py), [time](../../../shared/api/ewa_platform/companion/plans/time.py) and [completion matching](../../../shared/api/ewa_platform/companion/plans/task_complete_intent.py).

The [early tool loop](../../../shared/api/ewa_platform/companion/orchestration/routing_policy.py) probes task status, `plan_v1`, task completion and calendar in that order before its other tools. Earlier pending/agentic/output-surface/operation/workflow/compound/file-focus phases can consume the turn. Later router/planner dispatch and a plan-line fallback also exist in [task_orchestrator](../../../shared/api/ewa_platform/companion/orchestration/task_orchestrator.py); the fallback suppresses `doc_create` planner dispatch on recognized plan lines. This does not mean the intent planner never runs on planning requests.

With plans enabled, `plan_v1` loads the active bundle before testing the line:

1. A creation phrase builds a new plan and deactivates older active plans. Router bypass can synthesize a request from `plan_focus` and optional `horizon`.
2. With an active plan, a time-adjustment line without creation intent updates pending dated tasks, scoped to all dated tasks or server-local today. No parsed time/no eligible tasks returns clarification without replacing content.
3. Otherwise, refinement without creation intent regenerates the whole content under the same plan id. Persistence deletes old tasks/goals and inserts pending rows; ids, completion history and progress are not preserved.
4. Vague recognized creation normally asks for clarification if the extracted topic is shorter than twelve characters and has no schedule signal. Bypassed focus shorter than twelve characters also asks. This is not general refinement/model validation.

The refinement regex accepts ordinary acknowledgments such as “Да, хорошо”. Actual handler/service probes reached replacement and omitted the original task (**DOC-CODE-113**). Date parsing in pre-write intent checks can raise before the write-error catch (**114**). These are open defects, not requirements for callers to reinterpret unrelated chat.

No pool yields `unavailable` with partly Russian copy; exceptions inside the write try yield `error`; unmatched lines return `None`. A saved plan returns Markdown and `data.plan_id` without client actions. Clarification can also return `status=ok` without persistence. After receiving a plan id the handler attempts meta scheduling. Shared registry/turn persistence/reporting remain in their linked guides.

`plan_task_complete_v1` reads the active bundle and excludes completed/cancelled tasks before substring title matching. First match wins. Exactly one open task becomes the fallback even for an explicitly different title (**119**). No active plan/unmatched multiple tasks yields an error; no open tasks yields an already-done reply. Completion writes immediately and returns `data.task_id` and the full summary.

## Structure generation and dates

The service attempts optional LLM structure, then deterministic rules. Its completion uses the unified LLM base and model `EWA_COMPANION_PLAN_MODEL` → `EWA_COMPANION_CHAT_MODEL` → `default`: 60-second read/10-second connect timeout, temperature 0.1, `num_predict=1200`, JSON-object response format and disabled thinking. The Russian instruction includes at most 2,000 request characters.

This is not strict plan-schema validation. Only titled goal/task dictionaries are kept; a goal is required but an empty task list is accepted. There is no fixed model-output row cap or comprehensive sort-order/goal-reference/schedule validation. The first-object scanner mishandles quoted braces (**116**). Caught model/parse exceptions fall back to rules; accepted invalid values can fail at persistence without that fallback (**118**).

Rule paths:

- A daily date window generates one goal and one task per inclusive day, with research/conclusions titles where applicable. Maximum difference is 62 days, allowing 63 tasks.
- Document study accepts two to 31 documents and starts one step per server-local day from `date.today()`. This path generates Russian text.
- Up to six Markdown bullets each generate a goal/task. Otherwise both the topic and short-topic fallbacks produce two goals/three generic steps. Generic steps remain Russian even for English input.

[Schedule parsing](../../../shared/api/ewa_platform/companion/plans/schedule.py) recognizes Russian/English months and today using the reference year; it does not honor an explicit year. Missing start defaults to reference today, reversed bounds swap, and long spans return no recognized range. Invalid day/month combinations raise `ValueError` (**114**). Daily structure can apply one time/duration to every generated step.

Times are local wall-clock values without a timezone field. Current behavior supports explicit 24-hour `HH:MM`; recognized `pm`, `am` and “вечера” suffixes are ignored (**115**). A crossing/equal-midnight range adds 24 hours and clamps duration to 15–720 minutes; a single start defaults to 60. The persistence string parser drops seconds. Chat time adjustment does not clear dates/times.

LLM date normalization changes parseable years outside reference year ±1 to the reference year, with day-28 fallback for invalid replacement. Invalid ISO strings remain in the structure and fail the persistence parser (**118**). A schedule request with no dates in accepted model tasks attempts deterministic daily structure instead.

## Persistence and status semantics

[Persistence](../../../shared/api/ewa_platform/persistence_pg/companion_plans_asyncpg.py) generates text UUID ids and creates/deactivates/recomputes in a transaction. Replacement checks an owned active parent, shallow-merges metadata and rebuilds children in a transaction. Both fetch the bundle after commit: a response failure does not prove rollback. There is no revision/If-Match contract. The active-plan index is nonunique; deactivation alone is not demonstrated serialization of concurrent creation.

Goals have title/description/category/priority/order and linked-task progress. Tasks have title/description/status/priority/order, optional date/local time/duration and completion timestamp. A valid `goal_index` selects a new goal; otherwise explicit `goal_id` is passed to the database, then the first new goal is the fallback. The global goal foreign key is not a same-plan composite constraint; do not infer comprehensive relation validation. Internal duration parsing accepts positive integers capped at 720 and defaults to 60 when time exists; HTTP PATCH separately requires ≥15.

[FSM](../../../shared/api/ewa_platform/companion/plans/fsm.py) recounts all plan tasks:

| Plan status | Count condition |
|---|---|
| `wait` | Fewer than one goal **or** fewer than one task |
| `finish` | Goals/tasks exist and completed count is at least total tasks |
| `progress` | Goals/tasks exist and some tasks are not completed |

Plan progress is completed/all tasks ×100, rounded to one decimal. Goal progress counts only tasks linked to that goal in the same plan; no tasks means zero/active. Cancelled tasks still contribute to the denominator and are not completed, so hiding their calendar chips does not finish a plan.

`plan_get_active` selects the newest active parent, writes recalculated goal/plan status and `updated_at`, then fetches a separate bundle. **GET active is not a read-only database operation.** Bundles return every goal/task ordered by `sort_order, created_at`, including completed/cancelled rows. Parent ownership is checked and children are fetched by its id; the separate reads are not a demonstrated concurrent-edit snapshot.

Task PATCH/completion check parent principal but do not require an active parent or pending task. Repeated completion resets `completed_at` to now. Archive deactivates every active plan for the principal and retains history. Summary can read an owned archived plan.

Row decoding preserves metadata only when the driver supplies a dictionary; a JSONB string becomes `{}` (**121**). The pool opener installs no custom JSON codec. Metadata round-trip acceptance is therefore not established.

## HTTP contract

The [router](../../../shared/api/ewa_platform/gateways/routers/companion_plans.py) uses `require_oauth2_user`, principal `str(User.id)` and `app.state.ewa_orchestration_pool`. Prefix is `/api/v1/ewa`. All routes require plans enabled. Disabled returns 404 with `detail.code=companion_plans_disabled`; missing pool returns shared EWA 503. Database/serialization failures have no universal route-specific conversion into those errors.

| Method and path after the prefix | Successful response |
|---|---|
| `GET /companion-plans/active` | Full bundle; no active plan is 200 with `plan:null`, `goals:[]`, `tasks:[]` |
| `GET /companion-plans/{plan_id}/summary` | `plan_id`, `title`, `status`, `progress`, `summary_markdown`; always Russian, without locale argument |
| `POST /companion-plans/active/archive` | Empty bundle, including when no rows were active |
| `POST /companion-plans/tasks/{task_id}/complete` | Updated full bundle |
| `PATCH /companion-plans/tasks/{task_id}` | Typed light write, updated full bundle |

POST routes declare no body. Missing/foreign summary is 404 `plan_not_found`; missing/foreign task is 404 `task_not_found`. Ids are strings without UUID schema validation. Markdown includes every goal/task, dates/time suffixes and, in Russian, calendar/agenda and finished-plan archive suggestions; it is not a bounded digest.

[PATCH model](../../../shared/api/ewa_platform/schemas/pydantic/companion_plans.py) accepts optional/nullable `title` (1–200), `description` (≤4,000), typed ISO date/time, duration 15–720 and `all_day`. Empty effective body is 422 `empty_patch`; trimmed blank title yields 422 `title_required`. Unknown fields do not become assignments.

Nullable presence is lost through `payload.get(...)`: explicit null for date/time/duration/description behaves as omission and can return 200 unchanged (**117**). `description:""` clears notes; `all_day:true` clears time/duration but retains date. `all_day:false` alone is accepted without creating a timed slot. There is no general null-to-clear contract.

## Client rail, calendar and invalidation

[Typed client](../../../shared/web/frontend/src/services/ewa/ewaCompanionPlansApi.ts) uses common API client/Bearer options and relative `/ewa/companion-plans/*` paths. Normalization supplies absent arrays and maps absent plan to the empty bundle; it does not validate every row. PATCH exposes nullable slots subject to the server limitation above.

[Feature probe](../../../shared/web/frontend/src/services/ewa/companionPlansFeatureProbe.ts) keeps module-local `unknown/enabled/disabled` state for the SPA session. Success/legacy no-active responses enable it. Explicit disabled **and opaque 404s** disable it and return empty. Subsequent active reads skip HTTP, even with cache-bust, until reload or explicit internal state change. Hidden UI does not establish a disabled backend flag. Other failures are rethrown.

[Rail controller](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionLeftRailController.ts) fetches on eligible mount/probe change and visible focus events. A ref prevents callback-identity mount loops; a generation number discards stale refresh responses. A new plan id expands the section. Silent errors need not toast. This is not periodic polling or a generation guard around every mutation.

[Plan section](../../../shared/web/frontend/src/features/ewa/companionUx/CompanionLeftRailPlanSection.tsx) displays goals, progress, open/completed steps, completion checkboxes and archive for `finish`. [Strip helpers](../../../shared/web/frontend/src/features/ewa/companionPlanStripUi.ts) sort by order then title, clamp display percentages and derive task fallback progress. Only completed rows are classified as done; cancelled rows remain in the rail open partition. Overdue means an earlier browser-local day, not elapsed time today.

[Overlay hook](../../../shared/web/frontend/src/pages/Desktop/hooks/useCompanionPlanCalendarOverlay.ts) uses a 30-second stale interval and [invalidation subscription](../../../shared/web/frontend/src/services/ewa/companionActivePlanInvalidation.ts). [Projection](../../../shared/web/frontend/src/pages/Desktop/utils/companionPlanCalendarOverlay.ts) includes dated tasks except completed/cancelled, assigns `assistant-plan:<task_id>` synthetic ids and merges by id; equal titles remain separate. No date means no chip; no valid time means an all-day interval; timed duration is 15–720/default 60. Browser-local civil dates and server-local today can differ.

[CalendarApp](../../../shared/web/frontend/src/pages/Desktop/apps/CalendarApp.tsx) edits/drags assistant chips through task PATCH. All-day drafts send `all_day:true`; timed drafts send local date/time and clamped duration. Its assistant-chip delete callback completes the task. Duplicate follows personal-event creation. Overlay load/save errors have dedicated states, subject to opaque-404 normalization.

Rail refresh/completion and CalendarApp writes broadcast invalidation to refetch. Rail archive omits the broadcast (**122**); existing calendar/widget projections can stay stale until another refresh. Immediate universal cross-surface reconciliation is not established.

## Prompt, meta evolution and anticipation

[Prompt preparation](../../../shared/api/ewa_platform/companion/turn/phases/main_llm_prepare.py) injects `Active_user_plan` only with plans enabled: title/status and up to eight non-completed/non-cancelled task titles with due suffixes. Failure omits the block. `User_calendar` loads independently from the main pool, with an explicit unavailable block.

[Meta delta](../../../shared/api/ewa_platform/companion/plans/meta_tick.py) merges nested `learned_preferences.companion_meta_v1` using profile revision CAS. `goals_digest` actually contains up to five open **task titles**, plus `last_plan_id` and UTC `updated_at`. Conflict is audited without retry. No active plan yields no delta and does not clear older meta. Prompt injection reads stored meta independently of plans/master-meta flags, so it can lag the active bundle.

[Scheduler](../../../shared/api/ewa_platform/companion/plans/meta_schedule.py) uses a per-principal/per-plan key after `plan_v1`, without content revision; refining the same id reuses it. Scheduled keys add a UTC hour bucket. Keys truncate at 128 characters. Beat selects a bounded set of active principals in principal order and enqueues individually, without a rotation cursor. Queue/idempotency/worker limits remain in [evolution pipeline](../../../shared/api/ewa_platform/docs/COMPANION-EVOLUTION-PIPELINE.md).

[Anticipation](../../../shared/api/ewa_platform/companion/persona/anticipation.py) best-effort reads up to three pending/in-progress tasks, favors overdue titles and adds a Russian hint/completion chat prompt. It uses server-local today and no plan-specific model; it does not execute/complete a task itself.

## Source defaults and verification

[Config](../../../shared/api/ewa_platform/companion/plans/config.py) reads environment directly, accepting `1/true/yes/on` case-insensitively. Helper defaults are not deployed values or DB settings-catalog acceptance:

| Variable | Helper default / bound |
|---|---|
| `EWA_COMPANION_PLAN_ENABLED` | `0`; HTTP/plan tool gate |
| `EWA_COMPANION_PLAN_LLM_ENABLED` | `0`; optional structure model |
| `EWA_COMPANION_PLAN_MODEL` | Empty; chat model then `default` |
| `EWA_COMPANION_META_EVOLUTION_ENABLED` | `0`; meta scheduling master |
| `EWA_COMPANION_META_EVOLUTION_BEAT_ENABLED` | `1`; requires meta enabled |
| `EWA_COMPANION_META_EVOLUTION_BEAT_INTERVAL_MIN` | `60`, clamped 15–1,440 |
| `EWA_COMPANION_META_EVOLUTION_SWEEP_LIMIT` | `500`, clamped 1–5,000 in sweep |
| `EWA_COMPANION_WORKFLOW_<ID>_ENABLED` | `0`; separate workflow gate |

Enum entries `plan_month`/`file_focus` do not prove executable named dispatch: [chat matching](../../../shared/api/ewa_platform/companion/workflows/chat/registry.py) currently matches `reflect_week`. No `plan_from_scores_v1` implementation was found in reviewed companion sources. The former P0–P3 roadmap and global “no score API” assertion do not describe the current plan contract. Semantic augmentation retains separate detailed review.

Nine existing backend files: **53 passed, one failed**. Five frontend suites: **34 passed**. The daily-sprint test expects seven days without fixing the clock: local 2026-10-11 produced 48 after bound swapping; explicit 2026-08-19 produced seven (**120**). No repository test/config change.

Actual handler/service/parser/decoder probes with synthetic dependencies reproduced acknowledgment replacement, invalid dates, ignored suffixes, quoted-brace failure, null PATCH no-op, invalid ISO retention, unmatched single-task completion and metadata loss. Async ASGI used an async auth fake and real PATCH assignment logic with fake SQL. The actual TS controller transformed with existing esbuild made zero invalidations after archive and one after completion. These checks do not establish real database/provider/auth/broker/browser behavior. See [append-only findings](../../../docs/CODE_ISSUES.md) 113–122 and [audit progress](../../../docs/DOCUMENTATION_PROGRESS.md).

## Related documents

- [Profile](EWA-COMPANION-PROFILE-ADR.md), [evolution canon](EWA-COMPANION-EVOLUTION-CANON.md) and [prompt blocks](EWA-COMPANION-PROMPT-BLOCKS.md).
- [Chat turn phases](EWA-COMPANION-CHAT-TURN-PHASES.md) and [extension guide](EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md).
- [Desktop agenda/widgets](../desktop/DESKTOP-WIDGETS-AND-AGENDA.md) and [CalendarApp](../desktop/DESKTOP-CALENDAR-APP.md); complete standalone reviews remain separate work.
- [Proactive observer](EWA-COMPANION-PROACTIVE-OBSERVER.md) and [semantic search](EWA-COMPANION-SEMANTIC-SEARCH-P2.md).
