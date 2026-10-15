# Companion image generation and editing through UGS

The companion image tool starts a personal generation/edit operation, records a companion task run/step and executes the request through Unified Generation Service (UGS). The operations panel projects the companion run; UGS history has a separate generation-request record. Source presence and an accepted task do not establish a ready image or provider health.

Source review: 2026-10-11. This guide replaces dated host/provider/admin-count and restart instructions. [Production topology §Current](../../platform/PRODUCTION-TOPOLOGY-STATE.md#current-2026-07-30--living) owns deployed placement. This review covers the companion adapter and bounded dependencies; the complete UGS, content storage, provider, job/worker and native/browser contracts retain independent scopes.

## Source owners and execution path

- [Image domain](../../../shared/api/ewa_platform/companion/orchestration/companion_image_generation.py): settings, intent/source/prompt parsing, source storage/loading, UGS job, terminal results and stalled-run kick.
- [Media handler](../../../shared/api/ewa_platform/companion/orchestration/tools/handlers_media.py): `image_generation` and `image_tool` share `_handle_image_generation` and return a ToolResult named `image_generation`.
- [Step adapter](../../../shared/api/ewa_platform/companion/jobs/step_handlers.py), [enqueue](../../../shared/api/ewa_platform/companion/jobs/enqueue.py) and [executor](../../../shared/api/ewa_platform/companion/jobs/executor.py): durable `image_generation_pipeline` dispatch and worker input reconstruction.
- [Image reconciler](../../../shared/api/ewa_platform/companion/jobs/image_run_reconcile.py) and [task wrapper](../../../shared/api/tasks/companion_image_stale_run_reaper.py): UGS/status/stale repair.
- [Ready-image projection](../../../shared/web/frontend/src/features/ewa/companionOperations/progressUi/readyArtifacts.ts), [preview](../../../shared/web/frontend/src/features/ewa/companionOperations/CompanionOperationImagePreview.tsx), [actions](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionOperationImageActions.ts) and bounded run-card sections: result display/download/drafts.

The handler records `image_generation_background` or `image_edit_background` in EWA PostgreSQL. The actual generation uses the main application's `UnifiedGenerationService` and catalog user id; the companion does not call ComfyUI directly. UGS selects its configured type/provider. The companion's `ewa_companion_run_id` in UGS input supports later lookup; it is correlation, rather than an idempotency key supplied by this job.

There is no separate companion image HTTP route in this adapter. Ordinary chat/tool/workflow paths dispatch the registry tool; task-run APIs transport status/result. See [chat phases](EWA-COMPANION-CHAT-TURN-PHASES.md), [operations](EWA-COMPANION-OPERATIONS-PANEL.md) and [workflows](EWA-COMPANION-USER-WORKFLOWS.md) for those owning contracts.

## Settings and gates

| Setting | Consumer default | Role |
|---|---|---|
| `EWA_COMPANION_IMAGE_GENERATION_ENABLED` | `0` | Handler master gate |
| `EWA_COMPANION_IMAGE_GENERATION_TYPE_KEY` | `desktop_ai_chat_image_01_top` | Generate UGS type |
| `EWA_COMPANION_IMAGE_GENERATION_WORKFLOW_SLUG` | `01_top` | Generate workflow input |
| `EWA_COMPANION_IMAGE_EDIT_TYPE_KEY` | `image_studio_image_edit` | Edit UGS type; absent from inspected settings catalog |
| `EWA_COMPANION_ASYNC_JOBS_ENABLED` | off without a truthy value | Celery versus detached in-process execution |

These consumers use `os.getenv`; the first three image values are cataloged and seeded by [migration 014](../../../shared/api/ewa_platform/migrations/applied/014_ewa_companion_image_generation_settings.sql). Their runtime lookup also depends on the bootstrap getenv/cache shim described by [settings ownership](EWA-PLATFORM-SETTINGS-DB.md). Before bootstrap, environment/default behavior is separate; a catalog entry is not deployment proof. Migration conflict handling updates setting metadata/default descriptions while preserving existing operator `value_text`. The edit-type key is a process-environment consumer without an inspected admin catalog entry.

A disabled tool, blank user line, recognized analysis phrase, ordinary nonexecuting question without bypass, suppressed side-effect context or unmatched request returns no handler result. Explicit prompt alone does not bypass all line gates. Missing catalog owner returns unavailable; missing companion pool, unusable prompt/source or failed source persistence returns error. Tool metadata/slots do not constitute validation of every extra argument.

The Celery path checks active image capacity before creation, using descriptor `max_concurrent_per_principal` (currently one for both names). The in-process path does not run that capacity check. Count-then-create is not an atomic concurrency reservation. Neither path introduces a Confirm action here.

## Intent, mode, prompt and source

Recognized generate examples include `нарисуй закат над морем`, `сгенерируй картинку …`, `generate an image: …` and `draw me a picture …`. Analysis phrases such as `опиши картинку` are excluded. Edit commands include `измени/отредактируй/убери/замени/добавь …`, explicit image terms or a source reference. These are regex gates, rather than a general language/date parser.

An explicit valid `image_tool_mode`/`operation_mode` wins mode selection. Otherwise a source id, recognized image edit or an edit verb with an attachment selects edit. Source aliases include `source_unified_content_id`, `source_content_id`, camel-case variants, `unified_content_id`, `content_id` and `image_content_id`; only UUID-shaped strings are accepted. Text supports labeled references such as `uc=<uuid>` or `content_id=<uuid>`, rather than arbitrary bare UUID selection.

Prompt arguments take precedence when at least three trimmed characters are present. Generate extracts/strips known imperatives; edit also strips the source reference and edit/image terms. Prompt is capped at 2,000 characters; plan/result previews at 240. Handler `aspect_ratio` defaults to `1:1` and is not validated against the preset map before run creation. Theme/style metadata is not separately added to the job's UGS input by this handler. It persists `negative_prompt: ""`; the lower-level job/step can accept a negative prompt, but the ordinary handler does not copy that argument.

For edit without an id, the direct handler can persist its attachment as private Unified Content (`ewa_companion_image_source`), keeping only a source id in durable payloads. Its decoder allows JPEG/PNG/WebP prefixes, raw/data-URL base64 and a **10 MiB** source bound, independently of the chat-analysis gate. Public chat schema/client/vision resolution impose their separate **4 MiB** attachment bound.

The public attached-turn path currently skips ordinary tool orchestration, including this edit handler, in both sync/SSE bootstrap. A direct handler with an attachment supports edit, while public chat `убери фон` plus an attachment follows analysis instead (`DOC-CODE-133`). Text-only `uc=<id>` editing does not meet that attachment skip condition. Do not present attachment-backed public editing as accepted end-to-end behavior.

The edit job reads stored source bytes through `read_file_bytes_for_owner`, which requires matching Unified Content ownership and a nondeleted row. It checks nonempty bytes, the 10 MiB bound, allowed magic and image-MIME consistency after retrieval. Prefix/size checks are not full image decoding or pre-retrieval memory bounds. Unused source uploads are not cleaned up by this handler if a later capacity/pool/run failure occurs; lifecycle/cleanup policy remains a separate storage review.

## Run, queue and UGS input

The handler creates a running run and one running step. Plan records mode, preview, aspect and optional source ids; step input records catalog owner, full prompt, mode/aspect, empty negative prompt and optional source id. Creation is two calls, rather than one claimed atomic handler transaction.

With async jobs enabled it enqueues step one. A missing queue id marks run/step failed and returns error. Success returns **accepted** with `background: true`, run id/mode/preview/source and the original running run. Without Celery it spawns a detached asyncio job and returns **ok**, also with a running run. That stored `execution_mode: sync` label does not mean generation blocks the chat response. Detached completion exceptions are consumed by its done callback; process loss is not durable execution.

Enqueue intentionally strips domain/body payloads and retains correlation/worker-auth references. Executor reconstructs input from the durable step, overlaid with the allowed queue payload. The image adapter passes prompt/preview fallback, catalog owner, mode, aspect, source and negative prompt to the job. Complete generic worker/lease/retry coverage is separate.

Generate dimensions are `1:1` → 1024×1024, `16:9` → 1344×768, `9:16` → 768×1344, `4:3` → 1024×768 and `3:4` → 768×1024. Unknown aspect text falls back to 1024×1024 while its original label can remain in the result. Generate input contains prompt, dimensions, a positive random seed below 2³¹, workflow template and companion run correlation.

Edit uses the shared Image Studio input builder: prompt, freshly loaded source base64, negative prompt, random seed and companion/source correlation/MIME. It does not add generate dimensions/workflow to that edit input. Source base64 is supplied to UGS; saying it is absent from companion run/step/history does not establish absence from UGS storage or transport.

The job calls `generate_and_wait` with catalog owner, type/input, **180-second wait** and one-second polling. The inspected submit wrapper calls `generate` before entering the result wait; the 180-second parameter is not a bound on source loading or the entire generation/chat lifecycle. No explicit idempotency key or provider auth token is supplied by this companion call.

## Results, cancellation and recovery limits

A noncompleted UGS status fails the companion operation. Timeout and named database/OS/runtime/value failures are caught at defined boundaries with `source_prepare`, `ugs_wait`, `ugs_call` or `ugs_status` error stages. Other exceptions and failures in persistence/events/child reconciliation are not uniformly converted by this function into a failed run.

Completed UGS results use direct/nested content ids and selected URL fields; nested `result.images` uses its first image only. MIME is optional. Result contains mode, prompt preview, type, optional content id aliases/URL/MIME, and generate aspect/workflow or edit source aliases. URL absence is valid when a usable content id exists. Conversely the normal job currently accepts completed status even without either id or URL (`DOC-CODE-135`); an operations card then has no ready image.

The main job fetches the run and uses the common terminal lifecycle/revision guard before updating its step and publishing task completion/failure. Cancellation/terminal status can therefore cause a no-op. Underlying PostgreSQL additionally refuses overwrite of completed/cancelled states except the same status. Successful normal completion advances a workflow child and reconciles an awaiting agentic parent; failure invokes failure reconciliation. These are multiple operations with separate failure boundaries, not one atomic outcome.

The stale image task is scheduled every three minutes in checked-in beat config, with task soft/hard limits of 120/150 seconds. Reaper threshold defaults to 1,800 seconds with minimum 300; positive media/universal batch settings clamp to 1–200, otherwise 50. It selects old async pending/running/failed image runs, finds the latest nondeleted correlated UGS request and can repair completed UGS output or terminalize stale/failing/cancelled UGS states. It is not proof a live beat/worker is running.

Reconciler limitations are recorded separately:

- Its unwrapping rejects a normal nested `result.images[].content_id` shape that the ordinary job accepts (`DOC-CODE-134`); flat content-id control works.
- It ignores a guarded run-update miss and can publish completion/report success when persistence did not accept the update (`136`). This does not prove a cancelled row was overwritten; SQL retains its status guard.
- Its repair terminalizer does not invoke the workflow/agentic child-resume helpers used by the normal job (`138`); another independent sweep may later act, but this function alone does not advance the parent.

The principal stalled-run kick scans up to 16 listed runs, expects datetime age fields, selects an active step without output and defaults to age 45 seconds. The real list serializer emits ISO strings, so the current helper skips those rows (`DOC-CODE-051`). If a compatible datetime row reaches its in-process fallback, it prefers the 240-character plan preview over a stored full prompt (`137`). Celery enqueue strips that transient prompt, so the durable-input worker path has different behavior. Do not claim reliable restart recovery or universal full-prompt retries from this helper.

## Operations UI and content access

Ready-image projection requires a completed image intent, no explicit missing-content tombstone and a usable preview URL/id projection. It preserves mode/source/preview, uses optional MIME and produces a `.png` download filename. The filename is not a verified encoder result. Deleted-content tombstones get a separate unavailable projection.

Content-backed preview/enlarge uses an authenticated download helper, an object URL and cleanup; concurrent preview downloads share a promise. A `404` is remembered for that session until the shared guard clears. URL-only output is not equivalent to a content-backed preview/enlarge/share capability. Download prefers content API; without an id it fetches the projected URL. GAF handoff and analysis attachment require a content id.

GAF opens its composer with attachment metadata; it does not publish/send automatically. Analysis reads content metadata, checks MIME, downloads a blob, applies the 4 MiB attachment reader and prepares a question/pending preview. It does not submit the chat automatically. Edit-again and variant buttons prepare translated drafts containing the result id or prompt preview; the user still submits/finishes the instruction. General GAF/editor/provider behavior is independently pending.

UGS history belongs to the UGS task-list API and its owner/type filters. The separate companion record and correlation do not guarantee immediate UI visibility in both views. This adapter review does not accept the complete `/api/v1/ugs/tasks` contract or live history reconciliation.

## Verification and limits

Existing intent/reconcile/media-lifecycle suites and two image registry tests: **24 passed**. Four frontend projection/run-card/action/coercion suites: **57 passed**. The original executor image test stalled and was interrupted; its fixture leaves step progress/event collaborators unmocked. A separately reported repeat with temporary external mocks at those two boundaries passed **one test**. No repository test was changed; that repeat is bounded dispatch evidence rather than full worker/broker acceptance.

Actual synthetic job/reconcile/bootstrap/handler/kick probes confirmed six new findings: attached-edit routing bypass, reaper result-shape loss, completed status without artifact, completion event after guarded update miss, conditional in-process prompt truncation and missing parent-resume calls. The job used fake UGS/session/PG/events; bootstrap used fake sidecars/planner; direct handler used fake source storage/queue. No live image provider, content write, DB, broker, real OAuth or browser was used. Full provider output/quality, resource cleanup, deployment and restart tests remain outstanding.

## Related documentation

- [Attachment OCR and multimodal analysis](EWA-COMPANION-VISION-MULTIMODAL.md)
- [Task-run transport and operations](EWA-COMPANION-OPERATIONS-PANEL.md)
- [Settings catalog/cache](EWA-PLATFORM-SETTINGS-DB.md)
- [Personal workflows](EWA-COMPANION-USER-WORKFLOWS.md) and [DAG engine](EWA-COMPANION-WORKFLOW-ENGINE-V2.md)
- [UGS desktop entry](../desktop/UGS-DESKTOP-SHELL.md)
- [Append-only issues](../../../docs/CODE_ISSUES.md) and [audit progress](../../../docs/DOCUMENTATION_PROGRESS.md)
