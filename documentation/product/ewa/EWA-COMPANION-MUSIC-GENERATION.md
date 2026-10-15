# EWA companion music generation

This guide covers companion song requests, the interactive XL Base surface, durable jobs, UGS repair and playback handoff. Source review: 2026-10-11; source defaults and isolated checks do not establish deployed flags, provider availability, audio quality or browser playback. Complete Music Generator HTTP, UGS/provider/storage and desktop player contracts remain separate documentation scopes.

## Source owners

- [Media handlers](../../../shared/api/ewa_platform/companion/orchestration/tools/handlers_media.py): ordinary music intent, slots, input reuse, background job and terminal events.
- [XL Base](../../../shared/api/ewa_platform/companion/orchestration/companion_music_xl_base.py) and [interactive tool](../../../shared/api/ewa_platform/companion/orchestration/companion_music_xl_base_interactive.py): autonomous/structured launch and wizard surface.
- [Creative context](../../../shared/api/ewa_platform/companion/orchestration/companion_music_creative_context.py), [lyrics craft](../../../shared/api/ewa_platform/companion/orchestration/companion_music_lyrics_craft.py) and [mood resolution](../../../shared/api/services/music_song_mood.py): brief, prompt hints and heuristic checks.
- [Service pipeline](../../../shared/api/services/companion_music_pipeline.py), [Music Generator facade](../../../shared/api/routers/music_generator.py) and [lyrics route](../../../shared/api/routers/music_generator_lyrics_routes.py): lyrics → production suggestions → tags → audio.
- [Step adapter](../../../shared/api/ewa_platform/companion/jobs/step_handlers.py), [enqueue](../../../shared/api/ewa_platform/companion/jobs/enqueue.py), [music reconciler](../../../shared/api/ewa_platform/companion/jobs/music_run_reconcile.py) and [progress events](../../../shared/api/ewa_platform/companion/jobs/music_pipeline_progress.py): durable inputs, terminal repair and notification.
- [Wizard](../../../shared/web/frontend/src/features/ewa/companionOutputSurface/CompanionMusicXlBaseWizardMode.tsx), [music card](../../../shared/web/frontend/src/features/ewa/companionOperations/CompanionOperationMusicCard.tsx) and [playback dispatch](../../../shared/web/frontend/src/features/ewa/companionActionDispatch.ts): client controls.

## Requests and routing

`music_generation` ordinarily creates a `music_generation_background` run with one `music_generation_pipeline_v2` step. Default audio workflow: `v2`, `billing_mode=wizard`. Internal `ugs_workflow`/`ace_workflow` slots can select `v2_base` or `v2_sft`; the tool name alone does not force Turbo.

`music_generation_xl_base` creates `music_generation_xl_base_background` and `music_generation_pipeline_xl_base`, fixing `v2_base`, `billing_mode=companion_xl_base` and `ksampler_use_comfy_template=true`. Final generation selects `music_generator_generate_ace_v2_base_companion` for that billing mode. The [applied migration](../../../shared/api/migrations/applied/20260523_music_generator_ace_v2_base_companion_generation_type.sql) declares its separate generation type; source presence does not prove a database applied it. Ordinary wizard billing selects `music_generator_generate_ace_v2` for the supported v2 family.

[Routing policy](../../../shared/api/ewa_platform/companion/orchestration/routing_policy.py) lists interactive Base before autonomous Base before ordinary music. The ordinary predicate also excludes recognized autonomous Base requests. Earlier compound, saved-workflow, image, resume and other orchestration paths can act first. Router partial/full mode is not a universal prerequisite: deterministic and explicit registry dispatch exist.

Ordinary intent examples include “generate a song about rain”, “another song” and retry requests. Base recognizes “write lyrics yourself” and selected Russian autonomous/mood variants. Predicates exclude selected file-focus/study and feedback contexts. Both generation handlers require a nonempty line and reject ordinary non-executing questions unless an internal line-match bypass exists; bypass does not remove flag/auth/pool/capacity gates. These heuristics are not a complete natural-language acceptance specification.

## Flags, identity and launch lifecycle

`EWA_COMPANION_BACKEND_MUSIC_GENERATION` defaults false. The helper uses loaded settings cache, otherwise truthy environment values (1/true/yes/on). It gates both generation tools and the interactive tool. Wizard opening does not validate a Bearer or reserve generation capacity.

Generation requires a nonempty Bearer, `ctx.auth_user` and a companion pool. Public chat supplies a separately resolved main-catalog user id. Missing auth returns unavailable; missing pool returns error. Ordinary music with neither lyrics nor a resolvable theme returns error; Base instead constructs fallback theme/context.

[Async flags](../../../shared/api/ewa_platform/companion/jobs/config.py) require both `EWA_COMPANION_ASYNC_JOBS_ENABLED` and `EWA_COMPANION_ASYNC_MUSIC_ENABLED`, each false by default. Enabled: capacity check → create running run/step → enqueue → accepted response. Capacity counts active async ordinary/Base runs and the music full-cycle pilot; default catalog cap is one per principal. Count and creation are separate operations, not an atomic reservation.

Disabled: launch a retained `asyncio.create_task`, return ok and store `execution_mode=sync`. That label does not mean chat waits for audio. Process shutdown can lose this task; the stale reaper selects async rows only. Run/step creation are separate writes, without an encompassing transaction. A returned enqueue failure marks records failed but returns the earlier run snapshot; other persistence/enqueue exceptions are not all converted by these handlers.

**Owner loss (DOC-CODE-139):** both handlers put `catalog_user_id` in their original queue payload but omit it from durable step input. Enqueue strips domain fields, so the worker falls back to principal id. In-process calls omit catalog id too. If the ids differ, the pipeline receives the wrong main-catalog/billing identity; this is not claimed for every user.

Queue transport carries addressing, selected correlation metadata and an opaque worker auth token instead of reusable Bearer. Token resolution can reject invalid/expired tokens. The executor reconstructs domain fields from durable step input. Legacy base URL/headers remain in payloads/helpers, but the current music job ignores them: ordinary and Base pipelines call services directly, without HTTP self-calls.

## Slots, retries and creative context

Ordinary defaults: pop style, female vocal, ru for a Cyrillic request otherwise en, balanced voice diversity. Vocal accepts male/female/duet; Luna mode accepts classic/experimental. BPM overrides clamp to 10–300; duration to 30–300. Companion limits: lyrics 8,000 characters, theme 160, context 32,768. Name, explicit tags, supplied lyrics and skip-lyrics-validation are internal slots, not new public companion-message fields.

“Another one” selects the latest completed run of the same intent, then a failed one; retry selects a failed run. Only selected prior plan fields are reused: style, voice diversity, Luna mode and a theme preview under length/request heuristics. It does not reload the complete production request, lyrics, context, vocal or duration. New args win where the resolver explicitly supports them.

The shared creative builder uses the current request, resolved previous assistant reply for deictic follow-ups, selected brief/mood/summary slots and persona id. With deictic material, router dialog/conversation/extra-context slots are omitted. Source body is normalized and capped at 30,000 before the final context cap. Short theme combines headline and a heuristic subject hint. Priority/tone/style instructions are prompt guidance, not proof of provider obedience.

The shared builder excludes `companion_chat_condensed_v1`. **Base differs (DOC-CODE-140):** its additional builder includes up to 800 characters of that block. The handler usually prepends this XL brief to shared context unless shared text already contains “xl base”. Old topics can therefore reach Base prompts despite the shared exclusion; exclusion is not universal.

Base deterministic slots recognize selected Russian theme/style/vocal/fast-tempo phrases (fastest hint → 220 BPM). Structured wizard slots override inferred line slots; supplied tool args override both. Unknown normalized style/language values are not guaranteed provider-supported by that parser.

## Service pipeline and quality boundaries

The pipeline opens a main PostgreSQL session, builds UGS and constructs a local User from catalog id. It directly invokes exported handlers:

1. Use supplied lyrics or generate them with theme/style/vocal/language/voice/sliders/context and applicable workflow target.
2. Suggest production fields. Suggested BPM is clamped and adjusted by selected genre guards; explicit BPM wins afterward. Suggested duration defaults 195 and clamps 30–300; explicit duration wins. Suggested language/key/time signature feed generation with fallbacks; this can replace requested language. Suggested vocal does not replace selected vocal.
3. Generate style/tags, then use explicit tags if provided. Explicit tags do not skip this style request.
4. Generate ACE Step audio with title generation, workflow/billing, lyrics/tags, production fields and run/step/principal correlation. A nonempty content id is required. The local request has no Idempotency-Key header; correlation alone does not guarantee generation/billing idempotency.

Lyrics/style sliders are 0.85/2.0/0.9; suggestion applies its own bounds. Generation receives the companion-capped lyrics; style/suggestion builders reduce their lyric prompt view to 4,000 characters. Context is capped separately. Final v2_base generation enforces substance checking and can raise 422/`xl_base_lyrics_invalid`.

Nonempty context plus a Russian request/theme selects companion vocal prompt instructions: short conversational lines, simple headers, production in tags. Non-Base paths skip automatic enrichment and can make one extra lyrics request for retryable heuristic errors. Base retains its enrichment/substance-assessment path and one substance retry. Its prompt still contains companion simple-markup instructions, distinct from later enrichment.

The 4–8-word target is a prompt instruction; the heuristic flags more than 10 words, selected bureaucratic terms/clauses and certain missing-ё patterns. It is not linguistic/audio-quality validation. After retry, /lyrics returns remaining diagnostics with nonempty lyrics; the pipeline consumes lyrics without rejecting those diagnostics. Supplied lyrics skip generation/retry. Final provider checks are separate.

Known defects: production-line detection passes re.M as compiled-pattern search position rather than enabling multiline matching (DOC-CODE-141); valid plural “Все птицы…” is flagged as missing ё (DOC-CODE-142). [Comfy preparation](../../../shared/api/services/studio_comfy_workflows.py) still strips recognized Arrangement/Voice and selected production parentheticals for v2 companion audio; this does not repair the diagnostic predicate. Base uses separate strict preparation.

Mood prefers explicit mood, then keywords in theme plus up to 8,000 context characters, then weighted choice. Recognized sadness negation can select uplift; random choices exclude melancholic/dark variants. Tone/BPM/style hints do not enforce intent or measurable quality. Model identity and placement belong to the [living topology](../../platform/PRODUCTION-TOPOLOGY-STATE.md#current-2026-07-30--living).

## Progress, completion and playback

The job initializes shared HTTP clients before its main error boundary, then emits four SSE sub-stages: lyrics, production parameters, style, audio. These are not four additional PG rows. Redis delivery is best effort; persistence/polling remain separate.

Success requests guarded run completion, then completes the durable step and stores content id, track name, bilingual descriptions, style, BPM, duration and autoplay_requested. A rejected terminal update stops subsequent work. It calls agentic reconciliation, publishes completion, then tries DAG and specialized music workflow continuation. Individual HTTP errors become pipeline errors with stage/status/body prefix; other exceptions use the background-exception path. Initial client setup/error-handler failures have separate limits. Content id does not certify permissions, decoded audio or playback.

**Standalone autoplay mismatch (DOC-CODE-146):** ordinary/Base results keep autoplay_requested without setting background_play. The client [projection](../../../shared/web/frontend/src/features/ewa/companionOperations/progressUi/musicPipelineProgress.ts) requires background_play for an automatic action. The request is not a guaranteed playback command. The specialized music_full_cycle_v1 path can add that field; manual Play is separate.

The completed [ready-track projection](../../../shared/web/frontend/src/features/ewa/companionOperations/progressUi/readyArtifacts.ts) requires a recognized music intent/workflow, usable id and no explicit missing-content marker. The card builds music_play_track. Dispatch rejects empty ids and blocked/failed outcomes, emits desktop-music-play-track, then schedules library refresh. [MusicLibraryContext](../../../shared/web/frontend/src/pages/Desktop/context/MusicLibraryContext.tsx) upserts the event track in capture phase and refreshes on the library signal; [MusicPlaybackDomainContext](../../../shared/web/frontend/src/pages/Desktop/context/MusicPlaybackDomainContext.tsx) receives the global event. Dispatch success differs from authorized audio fetch, browser autoplay permission and audible output.

## Interactive XL Base surface

music_xl_base_interactive returns output_surface.mode=music_xl_base_wizard without generation/task run. Payload defaults: pop/female, ru/en inferred from request; options: seven styles, three vocals, five languages. Client supplies fallback choices when payload options are absent/invalid.

Textarea permits 500 characters. Generate requires trimmed theme length ≥4 and submitting=false; Draft requires nonempty theme. Both form a chat prompt containing #ewa_xl_base_interactive_start and labeled theme/style/vocal/language lines. The browser calls draft/submit callbacks, not Music Generator. Backend caps final theme at 160; parser reads labeled single lines, without preserving multiline theme as one value. Request text can also appear in extended context.

Marker selects final Base generation; opening text without it selects the surface. Labels follow frontend locale; default language comes from payload. Form state initializes on mount; payload changes do not themselves reset fields. Final submission still requires feature/auth/owner/capacity checks.

## Reconcile, cancel and the workflow pilot

Reconcile selects the latest nondeleted UGS request correlated by run id in input or request metadata. Completed repair accepts direct content_id, nested result.content_id or the first result.audio item id. The [direct persistence owner](../../../shared/api/services/ugs/direct_generation_execute.py) stores a result wrapper; arbitrary bare audio lists are not accepted. Terminal companion rows, including failed, are skipped; repair is not universal retry/resurrection.

[Celery reaper](../../../shared/api/tasks/companion_music_stale_run_reaper.py) is scheduled every three minutes in source beat configuration. It selects async ordinary/Base pending/running rows older than the stale horizon by updated_at. Default horizon: 1,200 seconds, minimum 300. Batch uses first positive media/universal reaper limit, clamped 1–200, otherwise 50. Missing configured DB/pool prerequisites have specified no-op branches; arbitrary SQL/provider exceptions are not all suppressed.

UGS completed/cancelled/failed can terminalize eligible runs. Forced stale handling can fail even while UGS is processing; stage events do not refresh the run timestamp. It does not cancel UGS, and normal completion later declines an already failed run (DOC-CODE-145). This is conditional consistency loss, not proof every production song reaches the horizon.

User cancel attempts linked nonterminal UGS cancellation, then guarded companion cancellation. Already terminal is idempotent. UGS cancel hook attempts music reconciliation when EWA DSN is configured, logging failures. Task-run HTTP/auth/limits belong to the [operations guide](EWA-COMPANION-OPERATIONS-PANEL.md); no new music-only companion endpoint is introduced.

Music terminalizer checks accepted run update before steps/events. It nevertheless uses failed-event helper for cancellation, sending status=failed and ordinary music intent even for Base (DOC-CODE-143). Successful repair omits normal workflow/agentic resume (DOC-CODE-144); parent progression can remain pending until another mechanism acts.

The separate [action starter](../../../shared/api/ewa_platform/companion/workflows/action/starter.py) for music_full_cycle_v1 requires async music and creates generation/playback-gate steps. Queue payload contains brief/settings, but durable generation input contains only step/tool identity and theme preview. Transport stripping loses style/vocal/context during worker reconstruction (DOC-CODE-147). Its launch reply promises confirmation while its current plan sets autoplay; that reply is not the authoritative gate contract. General registry/public-confirm/DAG limits remain separately documented.

## Verification and troubleshooting

Selected backend suites completed with **35 passes and one outdated persona-wording assertion failure**; three frontend wizard/card/dispatch suites passed **six tests**. Temporary actual-function probes with synthetic owners/fake persistence/auth/queue/UGS/events verified owner loss, Base condensed context, lyric predicates, cancellation events, parent-resume omission, forced stale behavior, pilot payload loss and standalone autoplay projection. The initial probe reached an unmocked Redis token lookup and failed DNS; only the corrected repeat is accepted. See [progress iteration 29](../../../docs/DOCUMENTATION_PROGRESS.md#iteration-29--companion-music-pipeline-wizard-and-recovery) and [append-only issues](../../../docs/CODE_ISSUES.md).

Inspect durable run/step status, intent, execution mode, guarded-update outcome and correlated UGS separately. Log families: companion_tool_music_*, companion_music_v2_*_service, companion_music_generation_background_*, companion_music_run_reconciled and COMPANION_MUSIC_STALE_REAPER. They are diagnostics, not acceptance. Host addresses, baked/bind commands and placement belong to operational owners. No deployment, restart, real generation, billing, content write, DB or browser acceptance was performed.

## Related documentation

- [Tool router](EWA-COMPANION-TOOL-ROUTER.md), [workflow registry](EWA-COMPANION-WORKFLOW-REGISTRY.md), [DAG engine](EWA-COMPANION-WORKFLOW-ENGINE-V2.md), [queue token flow](../../platform/EWA-COMPANION-QUEUE-AUTH-TOKEN-FLOW.md).
- [Music Generator reference](../MUSIC-GENERATOR-REFERENCE.md) and [XL Base quality rubric](../MUSIC-GENERATOR-XL-BASE-QUALITY-RUBRIC.md): independently pending API/quality acceptance.
- [Operations panel](EWA-COMPANION-OPERATIONS-PANEL.md), [social/deictic composition](EWA-COMPANION-SOCIAL-POST-COMPOSE.md) and [module map](../../reference/SOURCE-MODULE-MAP.md).
