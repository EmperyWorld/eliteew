# EWA companion Tool Router

Reference · source contract reviewed 2026-10-11. The router is an internal classification sidecar; registry handlers carry out effects. This guide owns FC parsing, mode/slot/line gates and runtime resolution. [Intent planner](EWA-COMPANION-INTENT-PLANNER.md) uses a different JSON/KV contract. [Multi-intent routing](EWA-COMPANION-MULTI-TASK-ORCHESTRATION.md) owns complete branch precedence; [turn phases](EWA-COMPANION-CHAT-TURN-PHASES.md) owns HTTP/SSE and prepasses. Source presence does not establish production placement, latency, model quality or successful queue/provider work.

## Position in the turn

The router dispatch is reached after pending/pre-tool/quick/defer and early tool probes, before normalized planner dispatch and later memory/file fallbacks. Earlier branches can return first. Planner classification, when enabled, is fetched in common bootstrap before orchestration; its later dispatch position is not its inference position. Use the routing guide's actual two-pass wiring rather than the old incomplete regex list.

[Dispatcher](../../../shared/api/ewa_platform/companion/orchestration/tool_router_dispatch.py) verifies enabled/base, optionally reads a recent music theme only for retry/another-one lines, and calls the sidecar. The theme lookup is best effort and accepts a Mapping plan_payload; it does not decode arbitrary raw JSONB strings itself. The hint is capped to 200 characters in the router prompt. Full shell_state is not included; the hint reports an open DocEditor id when resolvable, a generic shell-present marker, or no snapshot.

[Router runner](../../../shared/api/ewa_platform/companion/sidecar/tool_router.py) skips empty/trivial chit-chat, disabled mode and temporary cooldown. Prompt text comes from sidecar.tool_router in the [prompt-block registry](EWA-COMPANION-PROMPT-BLOCKS.md), with a language placeholder/substitution. This is not a universal small-talk/intent recognizer.

## Modes and executable allowlists

The helper recognizes only shadow, partial and full, plus an ENABLED value of 1/true/yes/on. Invalid mode disables execution. Helper fallback is disabled/shadow; the settings catalog defines enabled=1/mode=partial, while migration 019 specifies enabled=1/full and planner off. None of these proves a running process's effective settings. Settings bootstrap/cache/environment precedence is documented in [settings](EWA-PLATFORM-SETTINGS-DB.md).

- shadow calls the classifier when eligible and logs its decision, then returns None without dispatch;
- partial allows music_generation, music_xl_base_interactive, music_generation_xl_base, theme_set and app_open;
- full allows the schema's executable tools: plan_v1, plan_task_complete_v1, calendar_v1, check_task_status, file_rewrite, music_generation, music_xl_base_interactive, music_generation_xl_base, operations_status, operation_cancel, image_generation, presentation_generation, social_post_compose, music_studio_open, theme_set, app_open, catalog_list, catalog_discuss, file_open, file_create, file_rename, file_delete, doc_insert and paperless_import.

chat_only is never dispatched. This FC list omits other registry tools, including workflow cycles, recall_memory, file_save_text and doc_append_block. Registry presence does not expand this list. The canonical model/allowlists are [shared/api/ewa_platform/schemas/pydantic/companion_tool_router.py](../../../shared/api/ewa_platform/schemas/pydantic/companion_tool_router.py).

Confidence is self-reported, not calibrated probability. Dispatcher checks the configured threshold (helper/catalog default .62), mode allowlist, music feedback/praise for three specified tools, and the file-focus suppression predicate. The suppression predicate causes the entire router decision to fall through, not just a checked subset of tool names. Shadow's current would_dispatch value always resolves false because it uses the shadow-forbidden execution predicate; DOC-CODE-071 records this telemetry defect. Do not use that flag as a valid partial/full rollout counterfactual.

## FC request and parse contract

The synthetic tool is companion_route_turn, whose parameters require intent and confidence and advertise optional slots. The HTTP adapter is [compatibility client](../../../shared/api/utils/llm_openai_compat_http.py): OpenAI-compatible backends use chat completions, while native backend detection can choose its native chat path. extra_params/tools/tool_choice and chat_template_kwargs are not forwarded on the native branch. A configured URL/model does not certify FC support or a specific server API.

The runner supplies temperature .05, max response tokens and visible-content-only reasoning policy; extra params request the synthetic tool, required tool_choice and reasoning_format none, with enable_thinking false. Backend support determines whether those hints are honored. The parser uses the first tool_calls entry's function arguments (dict or JSON string), otherwise a whole/fenced JSON response. It does not validate the returned function name or inspect later calls. It returns at most one plan and performs no side effect.

Payload intent takes precedence over tool, defaults to chat_only if absent, and is normalized against CompanionRouterTool. Invalid enum returns None. Confidence is float-coerced/clamped; strings and malformed values are not treated uniformly with direct Pydantic validation. NaN currently becomes 1.0 under the clamp (DOC-CODE-074). Optional strings are stripped/stringified without per-slot length limits; summaries are not capped to 240 by this model. num_slides is integer-coerced/clamped to 1–30; autoplay accepts bool or recognized truthy strings.

The typed result includes tool/confidence, summaries, theme/style/autoplay/app_component, image prompt/aspect/edit/source fields, document name/body/insert/rename/delete/query/id fields, presentation fields, run_id and task_id. The mapper copies nonempty supported slots, omits summaries from args, and the dispatcher overwrites user_line with the actual line. The FC schema advertises paperless_id, but the model/parser/mapper drop it; paperless_import then reaches its missing-id error (DOC-CODE-072). Do not promise complete schema/handler parity.

## Handler dispatch and confirmation boundary

The mapper sets `_tool_router_bypass_line_match=False` for music_generation, music_generation_xl_base, music_xl_base_interactive, music_studio_open, image_generation, presentation_generation and calendar_v1. Their handler predicates remain relevant; FC confidence alone does not start work. Other FC tools get True for paraphrase coverage, including file tools. “Costly” is a routing policy set, not a universal risk/permission classification.

The dispatcher calls the supplied reporting run_tool_branch, which routes through [registry core](../../../shared/api/ewa_platform/companion/orchestration/tools/registry_core.py). None causes fallthrough; a non-None response, including an error/denial/unavailable reply, is considered handled and tagged tool_router_<branch>. The dispatcher log writes status=ok on that non-None path regardless of the handler's actual status, so use the tool result/task state as evidence of an effect.

Handler-local validation, authorization and confirmation differ by operation. File create/rename/delete/insert, immediate rewrite/append and agentic auto-accept have separate contracts in [file catalog](EWA-COMPANION-FILE-CATALOG.md). Media jobs/provider acceptance have separate pending guides. The router does not universally add confirmation, validate every slot or ensure a Celery run. Truth guards reduce misleading replies but do not constitute complete effect verification.

## Settings, URL and model resolution

Runtime helper defaults differ from catalog defaults: TIMEOUT_SEC is 12 seconds in the helper and 35 in the catalog, with 3–45 clamp; MAX_TOKENS defaults to 384 and clamps to 64–1024. Dispatcher client timeout is helper timeout plus two seconds, while the actual call gets the helper timeout. Confidence is .62 with 0–1 clamp. FAILURE_COOLDOWN_SEC defaults to 60 and clamps to 0–600.

Cooldown is process-local and opens only for httpx TimeoutException/ConnectError; parse/schema/other failures return None without opening it. It is not shared across API workers or scoped by endpoint. Active partial/full mode still suppresses the legacy planner during cooldown unless FORCE is enabled; later regex/main-model fallback remains possible. There is no automatic second classification retry or verified recovery.

[Shared URL helper](../../../shared/api/utils/tool_router_sidecar_runtime.py) prefers the domain-specific URL, then EWA, desktop and explicit LLAMA_TOOL_ROUTER_URL, with configured host/port or the code's default sidecar name. An explicitly selected URL containing the Docker sidecar hostname is rewritten to an explicit router URL or LAN helper; substring matching is used, not a DNS reachability probe. No explicit candidates returns the Docker default under a different branch. LLAMA_URL is not this resolver's default, although an explicit override can point at the chat service.

Model resolution prefers the domain-specific model, then EWA/desktop/marketing models and LLAMA_TOOL_ROUTER_FILE, finally the source's Qwen GGUF fallback. That is a string selection, not verification of installed weights. Deployment service/model/CPU/GPU/address inventories belong only to [topology §Current](../../platform/PRODUCTION-TOPOLOGY-STATE.md#current-2026-07-30--living). [Stack operator](EWA-COMPANION-STACK2-OPERATOR.md) and [inference contract](../../platform/STACK2-LLM-CONTRACT.md) retain independent audit scope. Do not copy a dated endpoint trial or a blanket recreate command into the routing contract.

## Observability and validation

Decision/skip/shadow/dispatch_miss logs identify classification and handler fallthrough; failed/unparseable/invalid-payload logs may include endpoint/error text or a 240-character response/payload preview. Avoid asserting that no user text or slots are logged. Logs do not establish provider execution, accepted queue work or successful UI delivery.

GET /api/v1/ewa/admin/companion/tools requires admin authorization and the admin feature gate; its response includes tool_router_runtime (enabled, normalized mode, base_url, model, uses_gpu141) and validated tool metadata. The host field is a URL substring heuristic, not a health/GPU probe; invalid mode is normalized to shadow in that projection. [Admin workflow editor](EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md) owns the route/models/errors and catalog serialization limits.

Existing router/runtime/planner/KV selection: 62 tests passed; five separate branch-gate tests passed. These use pure parsing and mock classifiers/queues, not a live model or broker. Actual dispatcher/parser/handler probes confirmed shadow telemetry, Paperless slot loss and nonfinite confidence. Fixture parsing found 133 unique-id rows, tool/locality distribution recorded in progress; this is fixture validation, not accuracy evaluation. Historical 2026-05-22 metrics based on 124 rows have no current live result artifact in this scope and are not retained as acceptance evidence. Running a pytest file as a script is not a live golden evaluator.

From repository root, the bounded tests are `PYTHONPATH=shared .venv/bin/python -m pytest -q shared/api/tests/test_companion_tool_router.py shared/api/tests/test_tool_router_sidecar_runtime.py shared/api/tests/test_companion_branch_line_gates.py`. Full model quality, multilingual routing, endpoint capability, latency/contention, authorized deployment and actual handler/provider/queue/confirmation behavior remain unaccepted. Defects are in [CODE_ISSUES](../../../docs/CODE_ISSUES.md); overall status is in [progress](../../../docs/DOCUMENTATION_PROGRESS.md).
