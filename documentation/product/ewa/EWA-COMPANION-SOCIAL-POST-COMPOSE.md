# EWA companion social-post composition

Reference · source contract reviewed 2026-10-11. social_post_compose drafts a post or long article in the current companion turn, optionally using an excerpt from the user's content catalog. The result is a copyable chat reply. This guide owns intent/input selection, document grounding, the single/constructor pipelines, settings and copy/follow-up boundaries; it does not certify generated facts, channel publishing or live provider behavior.

## Entry, inputs and result

[companion_social_post_compose.py](../../../shared/api/ewa_platform/companion/orchestration/companion_social_post_compose.py) owns intent detection, source lookup, single-shot composition and handle_social_post_compose. [handlers_llm_utils](../../../shared/api/ewa_platform/companion/orchestration/tools/handlers_llm_utils.py) delegates registry dispatch to this function; the public tool-registry facade is not its implementation owner. The descriptor exposes user_line, channel and brief. The handler uses args.user_line, then ctx.user_line; explicit brief overrides boilerplate-derived topic text.

The ordinary intent gate requires a line of at least ten characters matching the RU/EN verb/post/article/channel patterns. Recognized examples include “сделай пост про запуск продукта”, “напиши лонгрид для VK про турниры” and “write a LinkedIn post about hiring”. These examples demonstrate matching, not a complete natural-language parser. Explicit _tool_router_bypass_line_match accepts true or a truthy string; disabled feature state still returns None. A bypass with neither line nor brief also returns None. A brief-only bypass passes the handler gate but the actual composition function rejects an empty line: DOC-CODE-110 in [the issue log](../../../docs/CODE_ISSUES.md).

Without an explicit channel argument, detectors search the whole line in this order: Telegram, VK, Instagram, LinkedIn, Facebook, Twitter/X, Threads, Dzen, blog and newsletter; no match becomes generic. An explicit channel string is accepted without allowlist/case normalization, and unknown values receive generic prompt guidance. Whole-line detection can choose a channel mentioned in the topic instead of the requested target: “write a LinkedIn post about Telegram growth” resolves to Telegram (DOC-CODE-112). Brief extraction also strips channel/content/source boilerplate throughout the line; the full original line remains in the model prompt.

[Branch gating](../../../shared/api/ewa_platform/companion/orchestration/branch_line_gates.py) suppresses catalog_discuss for a recognized composition line, then probes social_post_compose if enabled. The current early loop places this tool between catalog_discuss and catalog_list. Earlier quick/workflow/compound/pre-tool phases can already handle a turn; consult [multi-intent orchestration](EWA-COMPANION-MULTI-TASK-ORCHESTRATION.md) for complete precedence. The FC router also knows the name. The socialPostCompose quick chip sends a normal phrase; no dedicated publication HTTP route is implemented by this module.

Disabled/inapplicable input returns None for fallthrough. A selected pipeline returning no usable post produces status=error with a localized retry/rephrase reply and channel data. Success returns status=ok, a localized post/long-form header, body between two horizontal-rule delimiters and a copy hint. Internal data carries channel, selected pipeline, source_file and orchestration_branch. Normal orchestration does not make every raw data field part of the public chat response. The handler creates no task_run, background job, editor action or output_surface; it waits in the current request. “Ready-to-publish” is header/prompt wording, not a validation result or an outbound send.

## Source document and memory

Document grounding requires a catalog identity and a source cue in the user line: a source-document pattern, recognized filename or deictic catalog-file reference. The reader prefers ctx.main_pool, otherwise resolves the main pool. Named/source cues call the existing catalog-discuss reader with principal, catalog owner and alternate OAuth owner; deictic file cues use profile file focus. [Catalog-discuss](EWA-COMPANION-CATALOG-DISCUSS.md) owns ACL, workspace/direct-id, storage, projection and after-read size limits.

The returned memory block must contain a bare fenced body; excerpts shorter than eight characters are rejected. File labels are capped at 200 characters and prompt source text at 48,000. This is a text excerpt, not guaranteed complete file/PDF extraction. Read exceptions caught inside the source reader, missing/unaccepted excerpts and absent source matches become no source; composition can still succeed without a user-visible grounding warning (DOC-CODE-107). Pool resolution occurs before that reader's try boundary; its exceptions can instead become a registry error.

Personal-workflow catalog/fallback exposes file_query as an optional source field and the sanitizer retains it, but this handler never reads it. A normal workflow trigger with only file_query does not open that file (DOC-CODE-111). Naming a source in the user line is the implemented path; metadata should not be treated as proof of support for a structured source slot.

If an EWA pool and principal are available, composition attempts to read four recent episodes for tone, taking up to 300 characters from each body. Read failure is logged and ignored. Profile seed_persona_id defaults to parent. Cyrillic anywhere in the line selects Russian; otherwise the pipeline selects English. This is a character heuristic, not locale negotiation. The full chat/HCM pipeline and its persistence limits remain in their own guides.

## Pipeline selection and single-shot mode

[uses_constructor_pipeline](../../../shared/api/ewa_platform/companion/orchestration/companion_social_post_constructor.py) selects single-shot for a short request or twitter, threads or instagram. Those exclusions are checked before explicit longread handling. For other channels an explicit long-form phrase selects constructor even when the configured pipeline is single; otherwise constructor/single follows the setting. An unrecognized pipeline setting becomes constructor. Long-form wording makes the short detector false, so “короткий лонгрид” is not a short request.

Single-shot builds a system prompt from the social-post identity/language/format/length blocks plus channel guidance. The user prompt contains the original request, a primary-topic anchor, optional brief, source excerpt and episode tone snippets. Model precedence is social-post override, companion chat model, orchestration model, unified default model, then mistral. Transport uses the unified llama URL and the OpenAI-compatible completion helper; provider/base configuration has a separate runtime owner.

The first call uses temperature .55 for short mode or .62 otherwise. When polish is enabled, the post is nonempty, the request is not short and quality heuristics match, a second call rewrites up to 16,000 draft characters at .48 and at most 16,000 prediction tokens. A nonempty rewrite replaces the draft only if at least 12 characters and at least one third of the original length. Quality heuristics skip text shorter than eighty characters, then look for two cliché matches, missing bold, missing bullet formatting above 1,200 characters or absent emoji above 2,500 in Telegram/VK/generic. They do not validate accuracy, complete source grounding or a platform's publication limits.

The final formatter normalizes newlines, reduces excessive blank lines, attempts sentence grouping when paragraph breaks are scarce and moves trailing hashtag groups to their own block. It is not a full Markdown parser. After formatting, fewer than twelve characters yields no result; accepted text is truncated to max_output_chars. Caught timeout/HTTP/OS/value/type/runtime errors return None. An error during optional polish currently discards a previously valid draft in both pipelines (DOC-CODE-106).

## Constructor pipeline and resource limits

[companion_social_post_constructor.py](../../../shared/api/ewa_platform/companion/orchestration/companion_social_post_constructor.py) runs outline, sequential section expansion, merge and optional polish in one HTTP client scope. It does not enqueue section jobs or stream intermediate drafts.

1. Outline requests HOOK, SECTION, CTA and HASHTAGS headings and a target section count. Parsed unrecognized headings can also become sections. Fewer than three parsed sections triggers a fallback outline with the channel target count; the fallback section/CTA/tag text is Russian even in an English turn.
2. Each parsed section is expanded independently. Prompt targets of 1,000–2,200 characters, bold headings, bullets and emoji are instructions. Parts shorter than forty trimmed characters are omitted; section lengths are not otherwise enforced.
3. Merge receives up to 88,000 joined section-draft characters and hook/CTA/tag ideas. A blank merge falls back to the expanded parts. Missing parsed tags are appended. The current parser doubles hashes in ordinary multi-tag output such as #one #two (DOC-CODE-108).
4. Optional polish reads up to 64,000 characters and replaces the draft only with a nonempty rewrite at least 200 characters and half its length. After formatting, final text shorter than 200 is rejected; accepted text is capped by max_output_chars.

Target defaults are VK=9, Dzen/blog=10, Telegram/Facebook/generic=8, LinkedIn=7 and newsletter=6; other channels use 7. A configured section value >=5 replaces the target, capped at 12. A value below 5 uses the channel defaults. This is a requested count: the actual parsed outline is not capped before iteration. An actual in-process constructor given target 5 and twenty parsed sections performed twenty expansions, twenty-two calls total with polish disabled (DOC-CODE-105). The old ten-call VK claim is incorrect. An accepted outline with N sections uses N+2 calls, or N+3 if polish runs.

Constructor timeout is an httpx.Timeout reused for each call, not a total multi-call deadline. There is no outer elapsed-budget check in this owner; source/episode lookup also precedes model work. Single-shot can similarly perform two calls using the same per-call timeout. The guide's old “total HTTP timeout budget per compose” wording did not describe this implementation. Shared transport, proxy and client limits remain separate; no live timing or provider throughput was measured.

## Settings: cache, seed metadata and caller defaults

[ewa_getenv accessors](../../../shared/api/ewa_platform/settings/access.py) read a present DB-cache key first, otherwise the process environment, otherwise the caller's supplied default. [Settings catalog](../../../shared/api/ewa_platform/settings/catalog_entries.py) contains seed defaults which differ from some pre-bootstrap caller defaults; [settings reference](EWA-PLATFORM-SETTINGS-DB.md) owns loading/cache/admin behavior. No deployed values were read.

All names below start with EWA_COMPANION_SOCIAL_POST_. The implementation/seed values are:

- COMPOSE_ENABLED and POLISH_RETRY: seed 1; empty caller state is enabled. Only 0/false/off/no disables these handlers.
- PIPELINE: seed/caller constructor, with single as the other supported setting. MODEL: empty seed, then the precedence described above.
- NUM_PREDICT: seed/caller 32,000, clamped 512–32,000. TIMEOUT_SEC: seed/caller 300, clamped 20–600 in single-shot. MAX_OUTPUT_CHARS: seed/caller 96,000, clamped 2,000–120,000; this caps the post body, not the surrounding chat header/hint.
- CONSTRUCTOR_SECTIONS: seed 4, caller 0, both select channel defaults because they are below 5. An explicit accepted target is 5–12. This value does not cap parsed output.
- OUTLINE_NUM_PREDICT: caller 4,096, clamp 1,024–8,192; seed 512 therefore becomes 1,024 after runtime clamping.
- SECTION_NUM_PREDICT: caller 8,192, clamp 2,048–16,384; seed 768 therefore becomes 2,048.
- MERGE_NUM_PREDICT: caller 16,384, clamp 4,096–32,000; seed 1,024 therefore becomes 4,096. Constructor polish uses the same control.
- CONSTRUCTOR_TIMEOUT_SEC: seed 600. An empty value falls back to TIMEOUT_SEC with caller fallback 600; invalid numeric text uses 600, then clamps 60–900. It applies to each constructor call.

Changing process environment is not a substitute for a populated settings cache. Named prompt blocks can override default prose; prompt targets do not become enforced limits merely because settings/catalog descriptions mention them. Do not copy a model/host/deployment inventory into this guide; current topology is [the canonical topology document](../../platform/PRODUCTION-TOPOLOGY-STATE.md#current-2026-07-30--living).

## Copy UI and subsequent tools

[CompanionTranscriptMessageRow](../../../shared/web/frontend/src/features/ewa/companionUx/CompanionTranscriptMessageRow.tsx) gives assistant rows a Copy control and uses [longread heuristics](../../../shared/web/frontend/src/features/ewa/companionLongreadReplyUi.ts) for compact typography. Detection depends on recognized headers/dividers, not length; not every English blog/newsletter header matches the longread heuristic. [Transcript display hook](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatTranscriptDisplay.ts) calls extractCompanionCopyText and navigator.clipboard.writeText, shows two-second copied feedback or reports clipboard failure. This copies plain text containing Markdown markers; rendering after paste depends on the destination.

Frontend copy chooses the first delimiter-bounded block, otherwise the full reply. [Backend deictic context](../../../shared/api/ewa_platform/companion/orchestration/companion_deictic_turn_context.py) prefers a similar block of at least 24 characters, otherwise strips recognized headers/copy-hint lines. A horizontal rule inside a generated body is indistinguishable from its wrapper: both helpers can omit the tail (DOC-CODE-109). No complete Markdown/copy-format parity is promised.

The shared deictic helper reads only profile desktop_friend_chat_v1 messages and chooses the last nonempty assistant reply. With a matching “this topic” hint and body of at least forty characters, it derives a short topic from the first usable line and returns up to 32,768 body characters. It does not identify a specific historical post or validate that the preceding assistant reply is relevant. The bounded [presentation resolver](../../../shared/api/ewa_platform/companion/orchestration/companion_presentation_generation.py) caps its returned topic at 2,000 and extra_context at 8,000; [music creative context](../../../shared/api/ewa_platform/companion/orchestration/companion_music_creative_context.py) takes up to 30,000 deictic source characters before its full 32,768 cap. Complete generation, storage and job semantics belong to their separate guides and remain pending here. Social-post composition itself does not universally inject the previous post into a new social-post request.

## Verification and remaining acceptance

Existing compose/constructor/deictic tests passed: 29 backend tests, with model/document mocks at their consumption sites. Frontend longread/copy helper suite passed four tests. Constructor tests primarily cover parsing and selection, not live multi-call throughput or total deadlines. Synthetic actual-function checks additionally reproduced excessive parsed sections, optional-polish draft loss, silent source-read fallback, doubled hashtags, backend/frontend copy truncation, brief-only bypass failure, ignored workflow source slot and channel selection from topic text. The clean repeat used fake HTTP clients, retrieval and completion functions and exited without external effects; the first probe's nonmatching source phrase was corrected before accepting that observation.

From repository root, run the existing isolated backend selection:

```bash
PYTHONPATH=shared .venv/bin/python -m pytest \
  shared/api/tests/test_ewa_companion_social_post_compose.py \
  shared/api/tests/test_ewa_companion_social_post_constructor.py \
  shared/api/tests/test_companion_deictic_turn_context.py \
  -q -o cache_dir=/tmp/eliteew-documentation-pytest
```

From shared/web/frontend:

```bash
node node_modules/vitest/vitest.mjs run src/features/ewa/__tests__/companionLongreadReplyUi.test.ts
```

No real model, database, catalog storage, clipboard/browser, provider publication or deployment was tested. Source/mock acceptance does not establish generated factual quality, target-channel formatting, cancellation behavior or production availability. The numbered defects remain open in [CODE_ISSUES](../../../docs/CODE_ISSUES.md); no application fix was made.

## Related documentation

- [Tool/surface extension](EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md), [catalog discussion](EWA-COMPANION-CATALOG-DISCUSS.md) and [quick intents](EWA-COMPANION-QUICK-INTENTS.md).
- [Chat turn](EWA-COMPANION-CHAT-TURN-PHASES.md), [personal workflows](EWA-COMPANION-USER-WORKFLOWS.md) and [music generation](EWA-COMPANION-MUSIC-GENERATION.md).
- [Prompt blocks](EWA-COMPANION-PROMPT-BLOCKS.md), [settings](EWA-PLATFORM-SETTINGS-DB.md) and [audit progress](../../../docs/DOCUMENTATION_PROGRESS.md).
