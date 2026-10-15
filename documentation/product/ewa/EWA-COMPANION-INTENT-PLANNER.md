# EWA companion intent planner

Reference · source contract reviewed 2026-10-11. The internal planner parses JSON or Markdown KV into one normalized tool plan. It is distinct from [FC Tool Router](EWA-COMPANION-TOOL-ROUTER.md), the product plan/calendar tools, user workflows and agentic planning. It does not perform effects or expose a separate public planner HTTP route. [Turn phases](EWA-COMPANION-CHAT-TURN-PHASES.md) owns message/stream transport; [multi-intent routing](EWA-COMPANION-MULTI-TASK-ORCHESTRATION.md) owns complete precedence.

## Bootstrap and dispatch are different phases

[Common bootstrap](../../../shared/api/ewa_platform/companion/turn/phases/turn_bootstrap.py) fetches the optional plan before task orchestration, after other bootstrap/profile/trust/episode work. ESP display skips it. fetch_companion_intent_plan skips the create-plan regex; other refine/time plan predicates are handled later in the orchestrator. A pre-tool/quick/early branch can return without using an already fetched plan, so the late dispatch position does not eliminate the earlier inference cost.

Inside [orchestrator](../../../shared/api/ewa_platform/companion/orchestration/task_orchestrator.py), early tools and FC router get precedence over planner dispatch. A normalized non-chat plan must meet confidence and cannot become file_create/doc_create for a recognized create/refine/time-plan line. A resulting non-None reply is merged/tagged intent_planner_dispatch; otherwise plan-unavailable/memory/late-file/main-model paths remain. Registered handler presence or classification alone does not prove a saved file or running job.

## Enablement and source defaults

The helper enables the planner unless INTENT_PLANNER is one of 0/false/no/off (including a non-false empty string). Its fallback is 1; the settings catalog defaults it to 0. Enabled FC partial/full suppresses the planner unless INTENT_PLANNER_FORCE is 1/true/yes/on. FORCE only removes that suppression; it does not override planner-off, ESP or the plan regex. Shadow leaves planner enablement independent.

The catalog defaults FORCE to 0, confidence to .5, timeout to 30 and response tokens to 256. Helper fallback values are confidence .48, timeout 45 and tokens 1536. [Migration 019](../../../shared/api/ewa_platform/migrations/applied/019_ewa_platform_settings_prod_orchestrator_profile.sql) specifies FC full with planner/FORCE off, among many other settings. Its presence does not certify execution or effective deployment. See [settings cache/bootstrap](EWA-PLATFORM-SETTINGS-DB.md); there is no “no database configuration” claim merely because these Python contracts add no planner table.

Helper confidence clamps to 0–1. Response-token settings clamp MIN_NUM_PREDICT to 120–4096 (fallback 256), then apply it as a floor to NUM_PREDICT capped at 4096. TIMEOUT_SEC clamps to 10–120 for the completion; bootstrap creates a client timeout bounded 15–125 using the configured value plus five. This is one sidecar pass, not a complete turn time budget or quality guarantee.

## Schema and normalization

Canonical models are [shared/api/ewa_platform/schemas/pydantic/companion_intent.py](../../../shared/api/ewa_platform/schemas/pydantic/companion_intent.py), re-exported from companion.contracts:

- V1 uses intent plus six flat document/insert/rename/delete slots and summaries;
- V2 uses tool, confidence, arbitrary dict args and summaries;
- CompanionIntentPlan is the normalized runtime tool/args/confidence representation, with a legacy intent property for existing logging/episodic consumers.

The parser's accepted tools are chat_only, recall_memory, file_create, doc_insert, file_rename, file_delete and doc_edit_requires_open_editor. V1 doc_create maps to file_create; doc_insert_into_open_editor maps to doc_insert; the remaining names map directly. This is a narrow allowlist, not the whole registry or the FC allowlist.

from_blob prefers a nonempty tool branch, merges eleven known top-level slot names into args only when that key is absent there, validates V2 confidence/fields and checks the dispatch allowlist. Legacy intent uses V1 validation. Unknown/invalid parsed tools produce None. Nested args take precedence over top-level slot aliases. Direct from_v2/normalized model construction does not itself enforce the from_blob allowlist; those are internal callers with a separate input responsibility.

Pydantic confidence is bounded 0–1, while nested args are not validated against per-tool public argument schemas. Arbitrary internal fields are retained. The dispatch boundary merges args over its own user_line/bypass defaults, and registry passes them unchanged. A nested `_auto_accept_hitl=True` currently reaches immediate file creation without a separately evaluated agentic preference, and args.user_line can replace the handler's line (DOC-CODE-073). The surrounding execution/report call still receives its actual user_line parameter. Do not describe every planner argument as validated/confirm-gated.

## JSON and Markdown parsing

[Planner sidecar](../../../shared/api/ewa_platform/companion/sidecar/intent_planner.py) first considers a suffix starting at the last intent key line, otherwise last tool key line, then the complete response. Within each candidate, Markdown KV is tried before JSON. [KV helper](../../../shared/api/ewa_platform/companion/sidecar/llm_kv_markdown.py) strips bullet/key noise and scalar quote/backtick wrappers, records the last occurrence of each key, recognizes null-like slot values and supports comma decimal confidence.

Markdown tool/intent branches accept six canonical flat slots; they do not parse arbitrary nested args or multiline document content. Missing KV confidence defaults to .55 for executable tools and .35 for chat_only, which may cross the dispatch threshold. JSON defaults missing confidence to 0. This format difference must be considered when evaluating a model output.

JSON parsing tries a complete/fenced object, a quote-aware balanced first object and first/last-brace slice; if those fail on a response over 6144 characters, it repeats on the tail. Empty objects, arrays or objects without tool/intent are not usable plans. The first successful candidate is returned; this is best-effort recovery, not a guarantee that the final intended answer wins over every reasoning preamble. Invalid normalized schema returns None; failures degrade to the remaining turn path.

## Model request and runtime selection

The prompt is sidecar.intent_planner in the [prompt registry](EWA-COMPANION-PROMPT-BLOCKS.md), with user language substitution and a compact shell/open-editor hint. The runner supplies temperature .15, token cap, openai_sidecar_merge_reasoning, enable_thinking false and reasoning_format none to the [HTTP compatibility client](../../../shared/api/utils/llm_openai_compat_http.py). Reasoning can be used when visible content is empty. Native/backend protocol and optional-hint support depend on that adapter; the planner does not require FC tools or send a strict per-tool args schema.

With no explicit caller base, companion_intent_planner_http_runtime selects INTENT_PLANNER_URL plus the intent/chat model chain if that URL exists; intent-model-only selects shared router base plus that model; otherwise it selects shared router base/model. The shared resolution contract is in the FC guide. There is no default fallback to the main chat URL in that resolver.

The real bootstrap currently resolves base/model but passes only base into run_companion_intent_planner. A nonempty caller base is treated as explicit and recomputes the model from INTENT_MODEL → CHAT_MODEL → ORCH_LLM_MODEL → unified default → mistral. Thus the normal bootstrap can discard the resolved sidecar model and send the chat model instead; DOC-CODE-075 confirms the mismatch with synthetic transport. Direct runtime-resolver tests alone do not establish the bootstrap model contract.

The runner returns a parsed plan even below threshold; actual dispatch remains in orchestration. It logs classification and would_dispatch_if_reached, which checks only tool/confidence and does not prove earlier branches, catalog/shell/slot gates or execution. Parse failure logs response preview (up to 240 characters), finish reason and marker presence; other failures log a warning and return None. No planner-specific cooldown or retry is implemented here.

## Registry dispatch and local slot requirements

[Registry dispatcher](../../../shared/api/ewa_platform/companion/orchestration/intent_plan_registry_dispatch.py) handles chat_only as None and doc_edit_requires_open_editor as a shell blocker only when no document id resolves. When a document is already open, that pseudo-tool returns None; it performs no edit and is not a registered handler.

File create/insert/rename/delete require content_catalog_user_id. file_create aliases name/body when supplied and can proceed without a body for generative input. doc_insert and file_delete require a stripped query of at least two characters. Rename requires both nonempty old query and new name. recall_memory passes args onward. These are local presence checks, not exhaustive schema/authorization validation. All handlers retain their own dependencies/errors; None means fallthrough and a non-None error can terminate the branch.

File confirmation, auto-accept, overwrite, ownership/folder and stored-body limits are in [file catalog](EWA-COMPANION-FILE-CATALOG.md). Workflow/agentic cycles have independent routes and gates and cannot be assumed from this plan's atomic tool field. Main-model action truth guards and task status evidence are distinct from classification.

## Bounded verification

The six-file router/runtime/planner/schema/dispatch/KV selection passed 62 tests; separate branch-line guards passed five. Tests cover pure parsing/mapping, disabled/partial/shadow gates, mocked enqueue and false music routing, and timeout cooldown. Actual-function probes confirmed planner internal-flag propagation through registry/handler and bootstrap model loss with synthetic storage/completion. No real model, file write, database or queue call occurred.

From repository root: `PYTHONPATH=shared .venv/bin/python -m pytest -q shared/api/tests/test_companion_intent_planner.py shared/api/tests/test_ewa_companion_intent_plan_v2.py shared/api/tests/test_ewa_companion_intent_plan_registry_dispatch.py shared/api/tests/test_companion_llm_kv_markdown.py`. Live multilingual quality, calibrated confidence, backend protocol/model identity, all failure shapes and complete chat/task/confirmation delivery remain unaccepted. [Progress](../../../docs/DOCUMENTATION_PROGRESS.md), [inventory](../../reference/DOCUMENTATION-INVENTORY.json) and [append-only findings](../../../docs/CODE_ISSUES.md) record exact scope. Production placement belongs only to [topology §Current](../../platform/PRODUCTION-TOPOLOGY-STATE.md#current-2026-07-30--living).
