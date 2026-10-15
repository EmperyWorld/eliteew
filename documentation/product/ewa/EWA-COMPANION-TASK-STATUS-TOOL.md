# Companion task status tool

Product technical reference · source review dated 2026-10-11. The lookup reads principal-scoped companion task rows; it does not query a generator or prove that a result artifact is still available. Deployed behavior and complete chat acceptance have not been verified.

## Ownership and entry points

`check_task_status` is a server orchestration tool registered in [registry_core.py](../../../shared/api/ewa_platform/companion/orchestration/tools/registry_core.py). Its [handler](../../../shared/api/ewa_platform/companion/orchestration/tools/handlers_ops.py) uses [check_task_status.py](../../../shared/api/ewa_platform/companion/orchestration/check_task_status.py). The model does not make a separate authenticated HTTP request for this lookup.

The helper loads a run using both `run_id` and the current `principal_id`, then reads that run's steps. A missing or other-principal run produces the same account-scoped not-found answer. The helper performs no update, cancellation, reconciliation or enqueue. This bounded property does not make the enclosing chat turn or every task-run HTTP GET read-only.

[Active-task prompt/status](../../../shared/api/ewa_platform/companion/orchestration/active_task_runs_prompt.py) is a separate path: it supplies a capped set of in-flight rows and can summarize several operations. See [operations panel](EWA-COMPANION-OPERATIONS-PANEL.md) for its HTTP and UI boundaries.

## Selection and input

The handler accepts an argument mapping. Selection tries `task_id`, then `run_id`, then `id`; each value may contain an embedded UUID. Invalid values fall through to later keys, then to the first UUID in `args.user_line` or the context's user line. The regex accepts the hexadecimal 8-4-4-4-12 shape, case-insensitively, and returns lowercase; it does not constrain the UUID version.

The direct answer helper requires a nonempty status-intent line. It recognizes its own tool name, selected Russian/English status phrases and `run_id=` / `task_id=` forms. A bare UUID alone is not a status request. A router-bypass handler with a resolved UUID can synthesize `check_task_status run_id=…` when the line lacks that intent. An argument UUID without either intent or bypass can fall through.

Without a UUID, selection reads active rows first: the persistence query defaults to ten rows, then the active helper retains at most five with status exactly `pending`, `running` or `awaiting_confirmation`. Source ordering puts those statuses first, then uses descending update time and creation time. Music-related text prefers the first music run in that capped set; otherwise it chooses the first active run. The music predicate also matches Russian `генерац`, so generic generation wording can prefer music.

If no active run exists, selection reads eight recent rows and applies the same music preference or first-row fallback. A completed/failed/cancelled row may therefore be returned; the tool is not limited to currently running operations. The default helper does not use the HTTP list's `top_level_only` filter, so a child run can be selected.

## Result and error behavior

A found answer carries `reply`, empty `actions`, the raw persistence mapping with `steps`, branch `check_task_status` and a structured `check_task_status` snapshot. The registered handler exposes the snapshot as `ToolResult.data`, the mapping as `task_run`, and status `ok`.

- No candidate id: `task_run=null`, data `{"error":"no_runs"}`, and a localized empty-state reply.
- UUID absent from this principal's store: `task_run=null`, data includes `task_id` and `normalized_status="NOT_FOUND"`. This is a tool result, not HTTP 404.
- No orchestration pool: the handler returns `unavailable` with a localized storage-unavailable reply.
- No recognized intent: the answer helper and handler return `None` to fall through.
- Persistence errors are not converted to not-found by this helper; outer orchestration error handling is separate.

Known source statuses normalize as follows: `pending` → `PENDING`; `running`/`in_progress` → `RUNNING`; `awaiting_confirmation` → `AWAITING_CONFIRMATION`; `completed` → `COMPLETED`; `failed`/`error` → `FAILED`; `cancelled` → `CANCELLED`. Other nonempty values become uppercase; empty becomes `UNKNOWN`. This vocabulary is narrower than the frontend's alias normalization.

The snapshot always includes `task_id`, `normalized_status`, `raw_status`, `intent_kind`, `execution_mode`, `progress`, `created_at`, `updated_at` and `completed_at`. These timestamps come from the loaded mapping; this helper has no independent JSON schema/clock conversion.

Optional fields are `error_summary`, `theme_preview` and `has_result_payload=true`. Error summary prefers run error keys `message`, `detail`, `error`, `reason`, otherwise the last failed step's error/title, truncated to 400 characters. A nonempty result mapping only proves payload presence, not successful download or current content-catalog availability.

For music intents `music_generation_background` and `music_generation_xl_base_background`, progress has `kind=music_pipeline`, `current_stage`, `total_stages=4`, `stage_title` and `theme_preview`. This implementation copies the stage algorithm used by the active-task prompt; it does not call that helper. For other runs with a step list, progress has `kind=steps`, `completed_steps` and `total_steps`; otherwise progress is empty.

## Progress and presentation limits

The music algorithm takes the highest index among completed, failed, running, in-progress **and pending** steps and clamps it to 0–4. With stage 1 running and stages 2–4 merely pending, it reports stage 4 and the future stage's title. Do not interpret this number as completed stages or percent finished. [DOC-CODE-042](../../../docs/CODE_ISSUES.md#doc-code-042--future-pending-steps-advance-music-status-to-the-last-stage) records a pure reproduction in both helper implementations; actual production frequency is unverified.

For other step lists, `completed_steps` counts both completed and failed steps. A run with one successful and one failed step reports two steps done. The overall failed status is retained, but the field is not a success count. See [DOC-CODE-043](../../../docs/CODE_ISSUES.md#doc-code-043--task-status-completed-step-count-includes-failed-steps).

Reply language depends on whether the user line contains Cyrillic. Known intent/status/stage labels are humanized and the formatter does not deliberately include the selected UUID/tool name. Theme/title/error strings are still carried from stored payloads; this is not a general identifier-redaction guarantee. Confirmation replies point to the operations controls; a completed reply points to result details without independently verifying the artifact.

## HTTP relationship

Authenticated `GET /api/v1/ewa/companion-chat/task-runs/{run_id}?include_steps=true` reads the same underlying run store. It is a separate typed HTTP contract: it returns 404/503, performs content-availability sanitization and attaches `surface_blocks`. The raw tool mapping does not receive those transformations. It is therefore unsafe to promise identical tool/HTTP wire output. The list GET with `include_steps=true` additionally invokes workflow reconciliation; that behavior does not belong to this lookup helper.

## Verification

Existing [task-status tests](../../../shared/api/tests/test_companion_check_task_status.py) and [active-task tests](../../../shared/api/tests/test_ewa_companion_active_task_runs_prompt.py): **11 passed**, no live PG/HTTP. They cover parsing, selected labels and simple progress cases, but not the future-pending or failed-count cases above. Ephemeral probes executed the actual pure helpers and confirmed both mismatches; no source, test, provider, broker or storage state changed.

Related: [chat phases](EWA-COMPANION-CHAT-TURN-PHASES.md), [workflow registry](EWA-COMPANION-WORKFLOW-REGISTRY.md), [tool router](EWA-COMPANION-TOOL-ROUTER.md), [source HTTP reference](../../api/SOURCE-HTTP-REFERENCE.md).
