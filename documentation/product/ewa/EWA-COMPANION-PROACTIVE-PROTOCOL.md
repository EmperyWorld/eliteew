# EWA companion execution and proactive-review protocol

Source contract review: 2026-10-11. This protocol adds structured execution evidence and optional deterministic questions to companion responses. [Observer HTTP ticks](EWA-COMPANION-PROACTIVE-OBSERVER.md), [automation policy](EWA-COMPANION-PROACTIVE-AUTOMATION.md), orchestration/jobs and model-generated desktop actions have distinct boundaries. No suggestion independently authorizes or runs an action.

## Wire models

[Execution/suggestion models](../../../shared/api/ewa_platform/schemas/pydantic/companion_execution_report.py) are embedded by [CompanionChatMessageOut](../../../shared/api/ewa_platform/schemas/pydantic/companion_chat.py), not exposed through a dedicated protocol-only HTTP endpoint.

`CompanionExecutionReportV1`:

- `schema_version: 1`; required `scope` (`tool`, `step`, `branch`, `turn`, `run`, `persist`, `sse`) and `outcome` (`succeeded`, `failed`, `partial`, `not_started`, `skipped`, `unavailable`). There is no `unknown` outcome.
- Default-empty `reason_code`, Russian/English reason strings, `resume_conditions: string[]`, `refs` map, `attempted: map[]`, `ground_truth` map. These are extensible maps, not a universal artifact schema or proof attached to every report.

`ProactiveSuggestionV1`:

- `schema_version: 1`, suggestion id default empty, required `kind` (`gap`, `risk`, `next_step`, `run_complete_followup`) and `source` (`turn_counter`, `subtask_complete`, `subtask_failed`, `observation`, `turn_plan`, `active_run`, `context_gap`).
- Default-empty Russian/English questions and quick replies, confidence 0–1 default 0.5, refs map. The model does not validate that questions end in a question mark; current templates do.

Chat output fields include `execution_reports` (default empty), nullable `orchestration_outcome` (`handled`, `deferred_llm`, `fell_through`, `partial`) and nullable `proactive_suggestion`. Outgoing enrichment also constructs a compact successful `tool_trace`. These protocol fields do not replace the full chat/SSE request/auth/error contract.

## Ledger and outcome semantics

[Execution ledger](../../../shared/api/ewa_platform/companion/orchestration/execution_ledger.py) builds reports from explicitly wired tool/branch/step/persistence/SSE boundaries when its flag is on. It does not independently observe every external tool or guarantee a report for every unhandled exception.

Tool status mapping: `ok`, `accepted`, `memory_append` → succeeded; `needs_confirm`, `needs_open_editor` → partial; `error` → failed; `unavailable` → unavailable; `skipped` → skipped; missing result → not_started; unknown status → failed. `accepted` is successful **acceptance**, not completed asynchronous work. Step outcome uses skipped first, then `ok`, otherwise failed. Tool trace includes only successful tool reports and preserves the original attempted status.

Reports are deduplicated by scope + reason code + tool ref, preserving first occurrence; this can collapse different step/run refs with the same key. Turn outcome is `fell_through` for no orchestrated result, `deferred_llm` for `continue_main_llm`, `partial` for mixed succeeded and partial/not_started, otherwise `handled`. `handled` is routing/response handling, not evidence that every tool succeeded; even a failed report can accompany it.

[Protocol enrichment](../../../shared/api/ewa_platform/companion/turn/protocol_enrichment.py) combines caller and orchestrated reports, skips malformed embedded report rows, and attaches the outcome. No orchestrated result adds a fall-through report when reports are enabled. [Main final](../../../shared/api/ewa_platform/companion/turn/phases/main_llm_persist.py) and [terminal final](../../../shared/api/ewa_platform/companion/turn/phases/orchestration_terminal_persist.py) share this helper after their persistence phase. Its “never raises” source comment is not a complete guarantee for malformed proactive state: see the limitations below.

## Truth guards

[Registry](../../../shared/api/ewa_platform/companion/context/truth_guard_registry.py) and [visible reply processing](../../../shared/api/ewa_platform/companion/context/noise.py) apply string heuristics for deferred file-study music generation, async-ready claims while work is pending, next-step claims, app-open claims without actions and orchestration fall-through. They strip matching phrases/lines and append contextual correction tails.

Guards are not controlled by the report flag. `EWA_COMPANION_TRUTH_GUARD_STRICT` only adds an extra clarification tail when a guard triggers; ordinary guards can modify text while it is off. Regex/branch/action/status evidence is narrower than universal truth checking: unmatched paraphrases, task artifact validity and eventual client action execution remain outside this guarantee.

## Deterministic review engine and current integration

[Review engine](../../../shared/api/ewa_platform/companion/proactive/review_engine.py) does not call a model. It can construct candidates from the first queued turn-plan step, failed/completed runs, stale active runs (45 minutes), an open DocEditor title without excerpt, or the configured turn multiple. Completed music follow-up needs an artifact-like result field (`unified_content_id`, `content_id`, `image_url` or `track_id`); absent fields can produce a gap question. It does not fetch or validate those artifacts.

Priority: failed subtask, stale active run, completed subtask, turn plan, context gap, turn counter, observation; confidence breaks ties within a source. The best candidate is checked against dismissal and last-shown state. If that candidate is suppressed, the engine returns no suggestion rather than selecting the next candidate. The intended duplicate window is 15 minutes for the matching id. State key: `companion_proactive_state_v1`.

Actual chat enrichment supplies profile LP and shell context, but no active/completed run list or subtask event. Observation supplies profile and shell only, with trigger observation. Thus engine support for run events is not proof that these integrations deliver them.

Current integration defects:

- Counter is bumped only in a temporary profile; it is not persisted back into LP. Starting from absent state, repeated chat calls keep seeing temporary turn 1, so the default third-turn fallback never advances. Shown/dismissed helpers are not wired into current non-test callers; repeated plan hints can bypass intended dedupe: [DOC-CODE-021](../../../docs/CODE_ISSUES.md#doc-code-021--proactive-review-counter-and-suggestion-deduplication-are-not-persisted).
- A valid ISO timestamp without timezone can raise TypeError in shown/dismissed/run comparisons, rather than degrading safely: [DOC-CODE-022](../../../docs/CODE_ISSUES.md#doc-code-022--proactive-review-timestamp-parsing-permits-naive-comparison-errors). The profile JSON patch boundary does not validate each such namespace.

## Source defaults and UI

[Config](../../../shared/api/ewa_platform/companion/protocol/config.py), resolved through the [settings plane](EWA-PLATFORM-SETTINGS-DB.md):

| Key | Source default | Scope |
|---|---|---|
| `EWA_COMPANION_EXECUTION_REPORT_ENABLED` | 0 | Report construction/attachment and report logs. |
| `EWA_COMPANION_TRUTH_GUARD_STRICT` | 0 | Extra tail on a triggered guard, not the guards' master switch. |
| `EWA_COMPANION_PROACTIVE_REVIEW_ENABLED` | 0 | Deterministic review. |
| `EWA_COMPANION_PROACTIVE_REVIEW_EVERY_N_TURNS` | 3, clamp 2–10 | Engine threshold; current integration counter defect applies. |
| `EWA_COMPANION_PROACTIVE_REVIEW_ON_SUBTASK` | 1 | Candidate creation when callers actually supply subtask event/results. |

Defaults do not establish deployed state. All protocol flags are not collectively off: the dependent on-subtask flag defaults on, with review's master flag off.

[Report strip](../../../shared/web/frontend/src/features/ewa/CompanionExecutionReportStrip.tsx) displays failed/partial/not_started/unavailable (not succeeded/skipped); fall-through also yields a strip. It uses the first visible report and its optional resume conditions. [Suggestion strip](../../../shared/web/frontend/src/features/ewa/CompanionProactiveSuggestionStrip.tsx) selects locale text and displays up to four quick replies. Clicking sends an ordinary chat message through its callback.

[Protocol UI wrapper](../../../shared/web/frontend/src/features/ewa/companionUx/CompanionProtocolStrips.tsx) handles per-principal local dismiss/snooze. “Not today” stores the end of the browser's local day and best-effort PATCHes soft-initiative snooze using the current revision. This is not a server-side per-id dismissal API and does not populate review-engine last-shown state. Observer contemplation/soft-initiative ordering and budget exceptions are documented in its own reference.

## Logs and verification

Relevant `[STEP]` markers: `companion_execution_report`, `companion_false_completion_guard_triggered`, `companion_proactive_suggestion_emitted`, `companion_orchestration_fell_through`. A marker proves that a source logging branch ran, not complete execution/erasure/coverage.

[Protocol smoke script](../../../docker/scripts/ewa-companion-protocol-smoke.sh) checks an optional local log path and runs ledger/truth/review unit tests. Missing logs are skipped and absent markers warn; it does not itself send a chat turn or verify a production file-study workflow. The script was inspected, not executed as a deployment smoke.

Existing ledger/truth/review tests passed in the bounded prompt/observer suite. Overall result: 42 passed / 3 date-dependent soft-initiative failures; [observer reference](EWA-COMPANION-PROACTIVE-OBSERVER.md) records them. Five mocked frontend suites passed 14 tests. Pure enrichment/engine probes verified missing state persistence and naive timestamp errors. No real user, DB, model, worker or production SSE was exercised. The previous completed-DoD checklist is superseded by this scoped evidence.
