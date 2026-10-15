# EWA companion chat and workflow extension guide

Developer reference · source contract reviewed 2026-10-11. This guide explains where to extend server tools, personal workflow exposure, output-surface modes and companion chat controls. It also owns the companion's per-turn Web/KBSEW prefetch wiring. Individual tool implementations, provider administration, durable workers and editor persistence have separate owners; an extension is not complete just because a catalog entry or button exists.

## Source owners and execution boundaries

The [public tool-registry module](../../../shared/api/ewa_platform/companion/orchestration/tool_registry.py) is a compatibility facade. [registry_core.py](../../../shared/api/ewa_platform/companion/orchestration/tools/registry_core.py) owns REGISTRY, the merged handler map and dispatch; [registry_types.py](../../../shared/api/ewa_platform/companion/orchestration/tools/registry_types.py) owns ToolDescriptor, ToolContext and ToolResult. Put implementation in the appropriate handler/service module under [orchestration/tools](../../../shared/api/ewa_platform/companion/orchestration/tools/), rather than treating the facade as a monolithic handler file.

The frontend [EwaCompanionChatPanel](../../../shared/web/frontend/src/features/ewa/EwaCompanionChatPanel.tsx) is a view shell. [useEwaCompanionChatPanelOrchestration](../../../shared/web/frontend/src/features/ewa/companionUx/useEwaCompanionChatPanelOrchestration.tsx) composes base, operations, transcript, composer and overlays bundles in that dependency order. [useCompanionChatSurfaceBundle](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatSurfaceBundle.ts) owns output-surface state; [useCompanionChatComposerBundle](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatComposerBundle.tsx) assembles presets, draft, voice, OCR and desktop/mobile control props.

The shell renders a presence/header area, left desktop rail, main column and right operations rail, with overlays in the panel stack. The main column contains the mobile meta/non-chat operation entry, transcript/output surface, slim chat dock and composer section. The full composer appears only in chat mode. The compact dock appears in all eight non-chat modes and uses the same draft/send path, so opening an editor does not remove the ability to message the companion. Individual mode components remain responsible for their own domain behavior.

## Add a server tool

1. Implement an async handler(args, ctx) in the relevant domain module and expose it through that module's HANDLERS map. Import/merge a new map in registry_core only when introducing a new handler module. Preserve the handler's intent/feature/auth/ownership checks and side-effect boundary.
2. Add a matching ToolDescriptor to REGISTRY with an accurate summary, input_keys, result_keys and requires. known_tool_names() returns sorted descriptor names. Updating a descriptor alone does not create a callable handler; adding only a handler leaves descriptor-based discovery incomplete.
3. Update the consumers which should discover or execute the tool: [v2 catalog](../../../shared/api/ewa_platform/companion/orchestration/tool_catalog_v2.py), [FC router](EWA-COMPANION-TOOL-ROUTER.md), [intent planner](EWA-COMPANION-INTENT-PLANNER.md), deterministic orchestration branches and/or workflow bindings. Do not expose a private flag as ordinary user/router input. Catalog metadata is not an authorization implementation.
4. Verify inapplicable input, missing context, disabled features, ownership, confirmation, successful and failed effects, and returned envelope at the actual consumer. A name's presence in REGISTRY does not establish that it runs for every user phrase.

ToolContext carries principal/catalog identities, alternate owner, main/EWA pools, shell/intent context and optional bearer/auth/profile/image data. Do not substitute an EWA-only pool for a main content database pool. ToolResult is a TypedDict: tool, status and reply are declared required; actions, data, task_run and output_surface are optional. The declared statuses are ok, error, skipped, needs_confirm, needs_open_editor, unavailable, memory_append, accepted and continue. These are Python typing declarations, not runtime schema validation.

Dispatch looks up the handler map directly, awaits the handler and returns its result. A missing handler or an inapplicable handler returns None for caller fallthrough. An ordinary Exception becomes an error result with empty reply/actions, null task_run and exception name/message truncated to 300 characters. Cancellation is not converted by this Exception boundary. Descriptor requires/input_keys/result_keys do not enforce permission, reject undeclared arguments or validate output. A synthetic handler with a required but absent main pool still received an undeclared input key and ran successfully; enforce those properties in the relevant handler/caller. Avoid including secrets in exception messages.

Patch tests where a dependency is consumed. Assigning a replacement function on the facade does not replace an already imported binding in a handler or helper. The audit found existing tests with ineffective bindings; see [the issue log](../../../docs/CODE_ISSUES.md). Mock external storage, models, outbound delivery and job submission before running isolated tool checks.

## Expose a tool to personal workflows

[Personal workflows](EWA-COMPANION-USER-WORKFLOWS.md) owns CRUD, phrase matching and linear v1 execution. [DAG v2](EWA-COMPANION-WORKFLOW-ENGINE-V2.md) owns graph validation, bindings and durable execution. Keep these contracts separate when exposing a new tool.

For linear v1, update the relevant structures in [user_workflow_allowlist.py](../../../shared/api/ewa_platform/companion/workflows/user/user_workflow_allowlist.py): USER_WORKFLOW_ALLOWED_TOOLS, argument keys, required argument keys, async/confirmation classifications and USER_WORKFLOW_TOOL_CATALOG fields/titles/descriptions. The [validator](../../../shared/api/ewa_platform/companion/workflows/user/user_workflow_validation.py) and sanitizer consume these structures, but the execution handler still owns its actual readiness/permission/effect checks. The catalog HTTP route returns this metadata; it is not an execution endpoint.

Reconcile the [frontend fallback catalog](../../../shared/web/frontend/src/services/ewa/companionUserWorkflowToolCatalogFallback.ts) with the server names, field keys, control types and required/default semantics. The client uses the fallback when the catalog request fails or is empty. If adding a quick template, update [companionUserWorkflowUi](../../../shared/web/frontend/src/features/ewa/companionOutputSurface/companionUserWorkflowUi.ts). Field metadata and a display template do not prove runtime input acceptance.

The [generic starter](../../../shared/api/ewa_platform/companion/workflows/user/generic_workflow_starter.py) executes consecutive inline tools until it encounters a blocking/async condition; it is not limited to the first inline tool. Worker continuation and confirmation have the limitations recorded in the personal-workflow guide. Do not promise whole-result interpolation or propagation of every intermediate UI action.

For DAG tool-backed types, reconcile [dag_tool_bindings](../../../shared/api/ewa_platform/companion/workflows/dag/dag_tool_bindings.py), IO profiles, input validation, executor/adapter behavior and the visual node catalog/field forms. A new node type additionally needs the Pydantic model and graph/worker/client handling; API-call nodes instead select a registry tool. Node type and tool name can differ: vision_analyzer maps to vision_analyze, llm_summarizer to llm_summarize and llm_classifier to llm_classify. A new async type needs durable step/resume/queue/output behavior, not just an async catalog label. Confirmation metadata must be reconciled with actual graph/handler/public-confirmation behavior.

Current visual navigation uses workflowDagBuilderSurface(workflowId) for editing and workflowDagBuilderSurface(undefined, { duplicateFromId }) for duplication. Edit saves PATCH; a new/duplicate graph saves POST. Linear v1 rows remain visible/runnable but the list withholds edit/duplicate and the DAG loader rejects them. DAG save buttons are disabled during loading/saving; local validation happens when saving. Do not claim a universal required-field disabled state, duplicate-name 409 translation or that every save path uses the older linear error mapper.

## Add an output-surface mode

[types.ts](../../../shared/web/frontend/src/features/ewa/companionOutputSurface/types.ts) currently admits nine modes: chat, workflow_dag_builder, workflow_edit, file_list, document_editor, music_xl_base_wizard, roadmap, script and my_phrases. Server-response coercion normalizes the retired workflow_builder alias to workflow_dag_builder and rejects unknown modes. Only mapping-shaped payloads are retained.

The chat [Pydantic response](../../../shared/api/ewa_platform/schemas/pydantic/companion_chat.py) declares output_surface as dict[str, Any] or null. It does not contain a matching mode enum; its description lists only a subset. Update the producing handler, public documentation and every actual client consumer rather than assuming a schema description enforces the frontend discriminator. Output_surface is the workspace mode/payload; surface_blocks is a separate typed task/result block list.

An extension needs these changes together:

- Add the mode to the union and COMPANION_OUTPUT_SURFACE_MODES, then reconcile coercion and UI helper lists in [companionSurfaceUi](../../../shared/web/frontend/src/features/ewa/companionOutputSurface/companionSurfaceUi.ts). Its current composer list contains chat; its slim-dock list contains all eight non-chat modes; panel detection excludes chat.
- Add an explicit branch/component to [CompanionOutputSurface](../../../shared/web/frontend/src/features/ewa/companionOutputSurface/CompanionOutputSurface.tsx). Match its domain callbacks, back navigation, busy/errors and applicable operations/editor action host. The chat branch renders transcript content; workspace branches receive their own props and callbacks.
- For panel chrome, use [CompanionSurfacePanel](../../../shared/web/frontend/src/features/ewa/companionOutputSurface/CompanionSurfacePanel.tsx) where appropriate. It supplies a named region, visible h2 or a hidden-header accessible name, sticky header/footer and bounded scrolling/fill-body layout. Include translated titles and usable back/focus behavior.
- Wire server response entry through [useCompanionOutputSurfaceHandlers](../../../shared/web/frontend/src/features/ewa/companionOutputSurface/useCompanionOutputSurfaceHandlers.ts), or a local entry through handleOutputSurfaceChange. An absent/invalid server surface does not clear the existing mode. Document-draft prompting changes back to chat, updates the draft and focuses via a microtask.
- Decide which reload state is safe and sufficient. Add regression coverage for valid/unknown/legacy modes, absent payload, principal storage keys, back/send behavior and each actual entry point. The deep domain component remains subject to its own tests.

[Session persistence](../../../shared/web/frontend/src/features/ewa/companionOutputSurface/companionOutputSurfaceState.ts) uses eliteew.ewaCompanion.surface.v1::<trimmed principal>. Saving chat removes the key. Non-chat saves a sanitized payload: scalar strings/booleans/numbers and up to 40 file-list items with a unifiedContentId, selected metadata and snippets capped at 500 characters. Nested graph/draft/workflow objects are discarded. Scalar strings have no overall length cap in this helper. Storage exceptions are ignored and invalid/unrecognized stored state falls back to chat; persisted legacy aliases are not coerced as server responses are. This is session navigation recovery, not durable editor content or a complete graph snapshot. Keep a stable scalar id and reload domain state from its authoritative API where required.

## Add a chat control or content element

Use the view owner and its prop bundle rather than putting side effects into EwaCompanionChatPanel. The composer bundle assembles the quick strip callbacks, desktop footer, mobile toolbar/body, left-rail tools and overlay props. Desktop Web is wired through the left-rail composer-tools section; mobile Web is wired through CompanionMobileComposerToolbar. Voice, OCR, image input and tools catalog have dedicated hooks. New controls should share the current pending/disabled and focus conventions.

For presets, change [EwaCompanionQuickPresetsStrip](../../../shared/web/frontend/src/features/ewa/EwaCompanionQuickPresetsStrip.tsx) and the bundle callbacks, then verify desktop/mobile rendering. For left-rail content, use its current cluster/section owners. For operations, use the [operations transport/panel](EWA-COMPANION-OPERATIONS-PANEL.md). For transcript progress or task blocks, use the transcript bundle and the applicable operation/surface-block component; a task-run record and a local action-tray record have different persistence and dismissal rules.

[CompanionComposerTextarea](../../../shared/web/frontend/src/features/ewa/companionUx/CompanionComposerTextarea.tsx) uses two desktop or three mobile rows and disables native resize. Expand measures half of the closest data-ewa-composer-layout column, with a 160-pixel minimum; if the layout is absent it uses half the viewport height. ResizeObserver updates the measured layout where supported. The parent handleSend collapses the field before empty/pending checks and then submits trimmed text or an attachment. Voice-session callbacks can submit directly through the shared submit ref; do not assume every programmatic send calls this wrapper. Enter without Shift calls send; Shift+Enter remains a newline. Both main textarea and slim dock currently lack an IME composition guard: [DOC-CODE-104](../../../docs/CODE_ISSUES.md#doc-code-104--ime-confirmation-enter-submits-both-companion-composers).

Use existing DesktopAppButton/chrome tokens, companion mood variables, COMPANION_SURFACE_FIELD_CLASS/SECTION_CLASS and shared focus styles. New UI keys belong in the existing RU/EN marketing locales under ewaCompanion. User-facing labels should describe the action, not internal modules or feature flags.

## Per-turn Web and KBSEW grounding

The request model defaults use_web_search to false. [useCompanionChatSubmit](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatSubmit.ts) adds true only when the checkbox state is enabled, for both stream and sync sends. After sending and the subsequent profile/operation/plan refreshes succeed, it resets the flag to false. A failure before that reset can leave it enabled. Preset selection does not itself grant search permission; shared submission carries the currently selected flag.

Both [chat entrypoints](../../../shared/api/ewa_platform/companion/turn/chat_turn.py) load the profile and resolve the message, then call [prefetch_companion_grounding](../../../shared/api/ewa_platform/companion/turn/web_search_prefetch.py) before early-turn orchestration/dedup and the main LLM. SSE emits turn_stage with stage=web_search before prefetch when enabled. Grounding can therefore be repeated before an idempotent replay is detected; the stage is a progress hint, not proof of a completed provider call.

The Web branch uses stored desktop_friend_chat_v1 history plus the current line to resolve get_web_search_query. It skips trivial chit-chat, missing DB/catalog identity/query and still-ambiguous topics with explicit error codes. A usable request calls web_search_detailed with limit=5, surface=ewa, DB and catalog owner. The provider call is wrapped in asyncio.wait_for using EWA_COMPANION_WEB_SEARCH_BUDGET_SEC: default 15 seconds, clamped 3–45. Quota denial maps to quota; blocked maps to skipped; empty remains empty; provider/timeout errors map to error. Cancellation propagates.

The result payload has schema_version=1, a yandex provider label, query capped at 240 characters, status, result_count and up to five nonempty title/URL/snippet records. Titles are capped at 220, URLs at 800, snippets at 500 and error_code at 80 characters. Status is ok, empty, error, quota or skipped. A prompt block is added only for successful usable hits; failed prompt formatting produces empty. The shell prompt renderer instructs the LLM to use source titles/URLs/snippets, avoid claiming that search was unavailable and identify missing exact facts. Prompt instructions do not prove response accuracy, freshness or citation compliance.

Top-hit enrichment is best effort. EWA_COMPANION_WEB_SEARCH_FETCH_TOP defaults on; with at least three seconds remaining it calls the desktop run_fetch_url helper for the first HTTP(S) URL, empty allow/deny host lists, at most 48,000 bytes and a timeout up to six seconds. Up to 1,200 excerpt characters augment the first snippet; failure retains SERP text. Fetch/redirect/SSRF policy belongs to the fetch helper and has not received full acceptance in this iteration. This code does not authorize operator egress changes.

KBSEW defaults are loaded before starting asyncio.gather for Web and KBSEW. The [KBSEW prefetch](../../../shared/api/services/kbsew/kbsew_prefetch.py) respects its agent/barrel settings, searches up to four allowed barrels and caps prompt sections at 4,200 characters. Typed retrieval errors produce stale/unavailable notes. The companion uses the prompt-block wrapper, not the richer outcome summary. Web's 15-second setting is not a total turn/defaults/KBSEW deadline: [DOC-CODE-102](../../../docs/CODE_ISSUES.md#doc-code-102--companion-grounding-budget-does-not-bound-defaults-or-kbsew). Unexpected non-KBSEW exceptions can escape gather and abort public stream generation without final/done: [DOC-CODE-103](../../../docs/CODE_ISSUES.md#doc-code-103--unexpected-kbsew-failure-aborts-web-grounding-and-sse).

Fresh main-LLM and orchestrated payload builders copy web_search_result from the shell. The typed synchronous HTTP response currently drops this undeclared field, and SSE replay reconstructs a reduced final without it; see DOC-CODE-024–025 in [the issue log](../../../docs/CODE_ISSUES.md). On receiving a coerced result/status, the client adds a local web_search tray record: error/quota is failed, skipped/empty is blocked and ok is successful. The common tray is capped to three records. There is no universal promise that every enabled search produces a visible card across errors, sync fallback or replay.

Provider config, quota/secret management and deployment egress have separate owners: [Web search administration](../WEB-SEARCH-ADMIN-OPERATIONS.md) and [egress runbook](../../platform/docker-re_doc/PROD-CORE-PODMAN-EGRESS.md). Those documents retain their own review scopes. Current deployment state belongs to [production topology](../../platform/PRODUCTION-TOPOLOGY-STATE.md#current-2026-07-30--living). No live provider, firewall, container or model verification was performed here.

## Checks and extension acceptance

The audit ran existing web-status, surface-block and plan-registry tests: 22 passed with mocked dependencies. Ten frontend mode/panel/handler/import-chain/main-column/composer/slim-dock suites: 22 passed. The keyboard source test checks ordinary Enter wiring; it does not cover composition. Isolated actual-function probes confirmed metadata-only dispatch, unbounded defaults/KBSEW waits, unexpected retrieval failure through the public stream generator and IME callback submission. These checks used fake dependencies and JSX/hook scaffolding; they are not mounted browser, storage, auth, broker, provider or deployment acceptance.

Reproduce the safe backend selection from repository root using the existing environment:

```bash
PYTHONPATH=shared .venv/bin/python -m pytest \
  shared/api/tests/test_companion_web_search_status.py \
  shared/api/tests/test_companion_surface_blocks.py \
  shared/api/tests/test_ewa_companion_plan_tool_registry.py \
  -q -o cache_dir=/tmp/eliteew-documentation-pytest
```

From shared/web/frontend, the existing Vitest runner can run the surface coercion and handler suites directly:

```bash
node node_modules/vitest/vitest.mjs run \
  src/features/ewa/companionOutputSurface/__tests__/companionOutputSurface.test.ts \
  src/features/ewa/companionOutputSurface/__tests__/useCompanionOutputSurfaceHandlers.test.ts
```

For a new extension, add meaningful coverage at its exact handler/validation/wire/UI boundary, then run the relevant existing domain checks and package lint/typecheck gates where safe. A manual smoke requires authorized feature/deployment state and real dependencies; mock passes cannot replace that acceptance. Update the affected living guide and INDEX when ownership or navigation changes. Do not treat a local master plan as implemented functionality.

## Related documentation

- [Personal workflows](EWA-COMPANION-USER-WORKFLOWS.md) and [DAG engine/builder](EWA-COMPANION-WORKFLOW-ENGINE-V2.md).
- [Chat turn and wire contract](EWA-COMPANION-CHAT-TURN-PHASES.md), [multi-intent routing](EWA-COMPANION-MULTI-TASK-ORCHESTRATION.md) and [FC tool router](EWA-COMPANION-TOOL-ROUTER.md).
- [Workflow registry](EWA-COMPANION-WORKFLOW-REGISTRY.md), [operations panel](EWA-COMPANION-OPERATIONS-PANEL.md) and [frontend entry](../FRONTEND-DEVELOPER-ENTRY.md).
- [Audit progress](../../../docs/DOCUMENTATION_PROGRESS.md) and [append-only code issues](../../../docs/CODE_ISSUES.md).
