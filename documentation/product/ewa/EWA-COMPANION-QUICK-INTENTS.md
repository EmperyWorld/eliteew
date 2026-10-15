# Companion: quick intents and preset launchers

Source-backed routing/frontend contract · reviewed 2026-10-11. Quick intents are phrase recognition inside normal companion-chat orchestration, not a separate intent HTTP endpoint. Client-only builtin ids are distinct from persisted user quick-action preset ids.

## Registry and matching

[Backend registry](../../../shared/api/ewa_platform/companion/ux/quick_intents.py) contains **22 current builtin specs and 11 legacy-only specs**. Each has an intent id, frontend key, Russian phrase and route hint. The resolver trims, lowercases and collapses whitespace, then selects the longest matching normalized phrase prefix. Its last `startswith` condition does not require a word boundary; arbitrary suffix text can still match. This is deterministic phrase matching, not semantic multilingual intent classification.

Current key → route mapping:

| Frontend keys | Route hint |
| --- | --- |
| `documentList`, `documentOpen`, `documentCreate`, `documentRewrite` | `catalog_list`, `file_open`, `file_create`, `file_rewrite`, respectively |
| `catalogDiscuss`, `fileRename`, `fileDelete` | `catalog_discuss`, `file_rename`, `file_delete`, respectively |
| `imageGenerate`, `imageEdit` | `image_generation` |
| `imageAnalyze` | `chat_only` |
| `presentationCreate`, `presentationOnTopic` | `presentation_generation` |
| `socialPostCompose` | `social_post_compose` |
| `musicGenerate`, `musicOnTopic` | `music_generation` |
| `musicStudioOpen`, `xlBaseInteractive`, `musicAutonomous` | `music_studio_open`, `music_xl_base_interactive`, `music_generation_xl_base`, respectively |
| `operationsStatus`, `operationsCancel` | `operations_status`, `operation_cancel`, respectively |
| `planWeek`, `themeSet` | `plan_v1`, `theme_set`, respectively |

Legacy frontend keys are `briefSummary`, `focusToday`, `clearerWords`, `encourage`, `nextStep`, `breakIntoSteps`, `reflectWeek`, `openCatalog`, `listRecentDocs`, `deskSnapshot`, `openDocEditor`. They are matchable server phrases, not current builtin chips. `reflectWeek` maps to `workflow_reflect_week` / chat workflow `reflect_week`; `deskSnapshot` maps to `desk_context`. Other legacy routes are explicit in the source registry.

## Orchestrator boundary

[Task orchestrator](../../../shared/api/ewa_platform/companion/orchestration/task_orchestrator.py) recognizes the phrase and logs `companion_quick_intent_match`. Pre-tool resume/output-surface phases can handle the turn before a quick-intent probe. A match therefore does not promise its route runs first or at all.

- Registry hints are derived from all specs except workflow/chat-only hints; they probe the named tool with `_tool_router_bypass_line_match=true` and `quick_intent_id`, and log `bypass=registry`.
- `workflow_reflect_week` probes the chat workflow runner, logging `bypass=workflow`.
- `chat_only` and `desk_context` have no special quick probe. Normal orchestration and then main LLM can still handle the line.

A probe may decline/fall through. Terminal statuses include `ok`, `error`, `needs_confirm`, `unavailable`, `needs_open_editor`, `accepted`; acceptance is not completion. Bypassing phrase gates does not bypass tool authorization, prerequisites or confirmation. Related [tool](EWA-COMPANION-TOOL-ROUTER.md) and [workflow](EWA-COMPANION-WORKFLOW-REGISTRY.md) bodies require their own review.

## UI, saved presets and pins

[Preset builder](../../../shared/web/frontend/src/features/ewa/ewaCompanionQuickPresetsUi.ts) builds 22 chips from `ewaCompanion.quickPresetDefaults` translations, ids `__ewa_builtin__{key}`, without network access. It filters empty label/prompt. Server presets are sorted by `sort_order` and precede builtins; matching normalized server prompts suppress builtins, but duplicate server rows are not deduplicated by this helper. Only user-saved rows are deletable/renamable through [profile quick-actions CRUD](EWA-COMPANION-PROFILE-ADR.md); builtin ids and dynamic plan-complete ids must not enter CRUD.

Dynamic plan-complete chips use the first two supplied open tasks by default, truncate displayed title to 32 characters, retain the full title in the prompt and prepend `__ewa_builtin__planComplete:{taskId}` rows. These are not additional static registry specs.

[Catalog hook](../../../shared/web/frontend/src/features/ewa/companionTools/useCompanionToolsCatalog.ts) applies builtins by submitting their translated prompt immediately; applying a saved user preset replaces the draft and focuses it. Explicit catalog “insert” only fills the draft. OCR opens its local source UI; `xlBaseInteractive` opens the embedded music wizard when a callback exists. The catalog also contains EWA-specific tools beyond these 22 builtin presets; its total count is not the quick-intent count.

[Catalog data](../../../shared/web/frontend/src/features/ewa/companionTools/companionToolsCatalogUi.ts) groups/searches entries and supplies desktop/editor availability labels; these labels are UI metadata, not proof of runtime access. [Pin storage](../../../shared/web/frontend/src/features/ewa/companionTools/companionPinnedToolsStorage.ts) keeps at most three ids in browser `localStorage`, key `eliteew.companion.pinnedTools.v1:{principalId}`. Adding a fourth evicts the oldest. This helper checks nonempty strings, not membership in the current catalog; pins are local UI preference and do not change server routing.

## Current phrase drift and evidence

Russian frontend phrases for `musicGenerate` and `xlBaseInteractive` differ from registry phrases, so their current translated text does not match the special backend quick probe: [DOC-CODE-031](../../../docs/CODE_ISSUES.md#doc-code-031--two-russian-builtin-prompts-drift-from-the-quick-intent-registry). A direct wizard click can avoid the second text path; normal tool/planner fallback may still work.

English translations have all 22 keys but none of their prompt texts match the Russian-only registry: [DOC-CODE-032](../../../docs/CODE_ISSUES.md#doc-code-032--english-builtin-prompts-never-match-the-quick-intent-fast-path). This is a bounded routing gap, not proof every English action fails. Do not claim RU/EN phrase equivalence from key equality alone.

Existing quick-intent/route-contract suites: **72 passed, 2 failed** on the two Russian phrase-equality assertions. Two selected mocked orchestrator quick-probe tests passed (24 unrelated tests deselected). Ten frontend extraction/preloader/preset/catalog/pending/composer suites passed **33 tests**. No source, translations, tests or dependencies were changed to force success; no live tool/provider call was performed for the probes.

```bash
PYTHONPATH=shared .venv/bin/python -m pytest shared/api/tests/test_ewa_companion_quick_intents.py shared/api/tests/test_ewa_companion_quick_intent_routes.py -q -o cache_dir=/tmp/eliteew-documentation-pytest
```

This command currently exposes the two known failures. See [chat phases](EWA-COMPANION-CHAT-TURN-PHASES.md) for HTTP, output, conflict and replay behavior. Historical operator-local phase plans are not living contract evidence.
