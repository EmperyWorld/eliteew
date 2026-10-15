# Music Evolution App

> **Desktop UI superseded (2026-06-28):** пользовательское приложение на столе — **`MusicForgeApp`** / «Студия песен» ([`MUSIC-FORGE-APP.md`](MUSIC-FORGE-APP.md)). Этот документ описывает **legacy API** `/api/v1/music-evolution/*` и backend pipeline (солисты, corpus, golden lanes), который остаётся для совместимости и operator/debug. Frontend `MusicEvolutionApp` снят с рабочего стола; уведомления и `open_app` с `MusicEvolutionApp` перенаправляются на MusicForge в SPA.

**Статус:** first implementation + corpus/soloists + UI polish + Atya vocal-trance preset + lyrics quality gate, 2026-06-03.
**One-shot reports** (implementation full summary / audio+music UI handoff / dated worklog session dumps) soft-retired → `trash/` — living SoT is **this document** + [`MUSIC-FORGE-APP.md`](MUSIC-FORGE-APP.md).  
**Desktop app (legacy catalog id):** `app-music-evolution` / `MusicEvolutionApp` — **не** factory default с 2026-06-28.  
**API:** `/api/v1/music-evolution/*`.  
**Scope:** backend-first pipeline генерации песен на **ACE Step 1.5 golden workflow lanes** (Base/SFT/v4/v5/Turbo по солисту). Пользовательский стол — только через MusicForge.

## Цель

Music Evolution даёт пользователю простую творческую форму: **солист** (фиксирует вокал, язык, жанр, lane mood и ACE workflow на backend) и **тема песни**, плюс опциональное уточнение/запрет. Настроение и смысловые чипы больше не выбираются в UI — для golden-солистов backend берёт mood из пресета солиста, а смысл выводит из темы. Вся тяжёлая работа идёт на backend: нормализация intent, подбор опыта из liked/disliked recipes, творческий бриф, lyrics (с strip Gemma `<|channel>thought`), style tags, golden ACE payload, UGS audio render, сохранение в `unified_content` и feedback loop.

Пользователь видит не raw UGS controls, а читаемый pipeline из шагов. Первый релиз намеренно не содержит выбора Turbo/V3/DiffRhythm, sampler controls или ручной вкладки tags/lyrics.

## Инварианты

- **Пользовательский desktop (2026-06-28):** единая «Студия песен» — `app-music-forge` / `MusicForgeApp`. Music Evolution UI и MusicGenerator UI сняты с factory defaults; API и pipeline ниже остаются для compat/operator.
- Audio generation сохраняет один UGS type key `music_generator_evolution_xl_base` и `billing_mode=evolution_xl_base`, но `ugs_workflow`/`ace_workflow` выбираются по golden soloist lane (`v2_base`, `v2_sft`, `v4`, `v5`, `v2`).
- UGS audio type key имеет префикс `music_generator_` (`music_generator_evolution_xl_base`), чтобы сохранить skip-cache invariant для музыкальных генераций.
- Runtime workers that execute Music Evolution audio through UGS must mount `host/comfyui` at `/app/comfyui`; workflow files resolve from that path (`Musicv2_base.json`, `Musicv2_sft.json`, `ace_sft_new.json`, `v4_luna_ace_sft_xl.json`, `BIG_XL_SFT.json`, `Musicv2.json`).
- Текстовые шаги (`music_generator_evolution_brief|_lyrics|_style`) зарегистрированы в `generation_types` **и** в Llama chat-completion allowlist `provider_manager_service_v2.py` (тот же путь, что `music_generator_lyrics`).
- Corpus retrieval по умолчанию scoped per user: чужие private recipes не попадают в prompt/context.
- Result metadata сохраняет совместимые `music_generator_*` ключи и новые provenance keys `music_evolution_*`.

## Backend

Новые модули:

- `shared/api/routers/music_evolution.py` — REST contract, SSE events, cancel, feedback.
- `shared/api/schemas/music_evolution.py` — Pydantic v2 contracts for public slots and responses.
- `shared/api/services/music_evolution_pipeline.py` — durable run pipeline, XL Base payload, content persistence, feedback snapshots.
- `shared/api/services/music_evolution_corpus.py` — per-user liked/disliked recipe retrieval and materialized sources.
- `shared/api/services/music_evolution_recipe_features.py` — XL Base metadata filter, sung-line features, corpus quality summary.
- `shared/api/services/music_evolution_lyrics_craft.py` — Evolution lyrics gates, RU morphology craft, post-LLM polish.
- `shared/api/services/music_evolution_soloists.py` — curated soloist presets (vocal/language/genre lock).
- `shared/api/services/music_evolution_prompts.py` — prompt contracts for brief/lyrics/tags.
- `shared/api/tasks/music_evolution.py` — Celery execution wrapper and stale/orphan run reaper.

### Backend hardening (2026-06-02)

- `POST /runs` creates durable state and enqueues `api.tasks.music_evolution.run_music_evolution_pipeline` via Celery. Idempotency reuse returns the existing run status and **does not enqueue** another pipeline task.
- Pipeline execution claims only `queued` runs, checks durable status between long steps, and never overwrites terminal `completed` / `failed` / `cancelled` after a late worker resumes.
- `POST /runs/{run_id}/cancel` marks non-terminal runs as `cancelled`, cancels incomplete steps, and best-effort cancels the correlated UGS request through `UnifiedGenerationService.cancel_generation(...)`.
- Audio generation writes `music_evolution_run_id` into UGS `input_data`; backend persists `music_evolution_runs.ugs_request_id` from the UGS response or by lookup in `generation_requests`.
- Celery beat runs `api.tasks.music_evolution.reap_stale_music_evolution_runs` every `MUSIC_EVOLUTION_STALE_REAPER_INTERVAL_MINUTES` (default 3). The reaper reconciles `queued` / `running` runs older than `MUSIC_EVOLUTION_STALE_REAP_AFTER_SECONDS` (default 7200, clamped 300–86400) with UGS terminal state or fails stale orphans.
- Runtime fix (2026-06-02; Host-1 path `host/comfyui`): `stack0-eliteew-celery-worker-prod` and `stack0-eliteew-celery-worker-lan141` mount `host/comfyui:/app/comfyui:ro,z`. This keeps the UGS provider path (`provider_manager_service_v2` -> `build_ace_music_workflow`) aligned with API/queue-worker and prevents `Music workflow v2 file is not configured on the server`.

### Soloist presets (2026-05-31)

UI больше не показывает отдельные селекты **вокал / жанр / язык**. Вместо них — блок **«Солист»**:

| id | UI label | vocal | backend genre | ACE lane |
| --- | --- | --- | --- | --- |
| `pulse` | Пульс | female | `techno` | `Musicv2_base.json` (`v2_base`) |
| `haze` | Туман | male | `lofi_chill` | `Musicv2_base.json` (`v2_base`) |
| `grit` | Грит | male | `phonk` | `Musicv2_base.json` (`v2_base`) |
| `ray` | Рэй | female | `pop` | `Musicv2_base.json` (`v2_base`) |
| `velvet` | Vельвет | female | `jazz` | `Musicv2_sft.json` (`v2_sft`) |
| `nova` | Nova | female | `electronic` | `ace_sft_new.json` (`v4`) |
| `nebula` | Туманность | female | `luna` | `v4_luna_ace_sft_xl.json` (`v4`, ACE15XL `studio-lofi` slider) |
| `ascent` | Взлёт | female | `trance` | `Musicv2.json` (`v2` Turbo) |
| `ritm` | Ритм | female | `house` | `BIG_XL_SFT.json` (`v5`, ACE15XL `danceability` slider) |
| `tempest` | Шторм | duet | `drum_and_bass` | `Musicv2_base.json` (`v2_base`) |

- `POST /runs` принимает `soloist`; `normalize_music_evolution_input` перезаписывает legacy `vocal`/`genre`/`language` из каталога (`vocal_locked=true`) и добавляет `ugs_workflow`, `ace_workflow`, `model_scope`, `workflow_file`.
- `music_generator_evolution_xl_base` остаётся единым UGS type key для billing/debug/cancel/reaper; `ProviderManagerServiceV2` внутри этого branch маршрутизирует `v4` и `v5` payloads в соответствующие SFT builders.
- Каждый солист получает **свой anchor tag block**, sampler corridor и golden workflow lane (`soloist_production_overrides` / `finalize_soloist_evolution_tags` / `soloist_workflow_overrides`) — ACE не должен схлопываться в один Base timbre.
- Legacy ids (`lula`, `atya`, `rook`, `mira`, `sage`, `vera`, `nika`, `yana`, `aurora`, `shadow`) нормализуются в новый golden catalog.
- `vocal_locked=true` отключает mood-based randomization для `auto` vocal в pipeline.

API endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/music-evolution/capabilities` | Soloists, moods, meaning chips, limits, golden workflow lanes (legacy vocals/genres/languages kept for API compat) |
| `POST /api/v1/music-evolution/runs` | Create durable run, enqueue Celery pipeline if newly created, return `202` with `run_id` |
| `GET /api/v1/music-evolution/runs/{run_id}` | Poll run state, steps, progress and result |
| `GET /api/v1/music-evolution/runs/{run_id}/events` | SSE snapshots + keep-alive |
| `POST /api/v1/music-evolution/runs/{run_id}/cancel` | Cancel non-terminal run state and best-effort cancel correlated UGS audio request |
| `POST /api/v1/music-evolution/runs/{run_id}/feedback` | Save like/dislike, recipe snapshot and materialized source |

## Database

Migrations added and applied in the local stack:

- `shared/api/migrations/applied/20260531_01_music_evolution_generation_types.sql`
- `shared/api/migrations/applied/20260531_02_music_evolution_runs.sql`
- `shared/api/migrations/applied/20260531_03_music_evolution_run_steps.sql`
- `shared/api/migrations/applied/20260531_04_music_evolution_feedback.sql`
- `shared/api/migrations/applied/20260531_05_music_evolution_recipe_sources.sql`
- `shared/api/migrations/applied/20260531_06_desktop_app_catalog_music_evolution.sql`

Main tables:

- `music_evolution_runs` — durable run state and result pointer.
- `music_evolution_run_steps` — ordered UI-visible pipeline steps.
- `music_evolution_feedback` — per-user like/dislike with recipe snapshot.
- `music_evolution_recipe_sources` — materialized recipe corpus for future retrieval.

## Frontend

New isolated app files:

- `src/pages/MusicEvolution/MusicEvolutionApp.tsx`
- `src/pages/MusicEvolution/MusicEvolutionPipeline.tsx`
- `src/pages/MusicEvolution/MusicEvolutionResultCard.tsx`
- `src/pages/MusicEvolution/musicEvolutionUi.ts` — localized statuses, run summary, dislike reason chips
- `src/services/musicEvolution/musicEvolutionApi.ts`

Desktop registration:

- backend allowlist: `MusicEvolutionApp`
- frontend lazy mount: `desktopWindowAppContent.tsx` with `embedded` + deep-link `musicEvolutionRunId`
- catalog/default metadata: `app-music-evolution`
- visual motif: fuchsia/amber/emerald wave, `SparklesIcon`

### UI wave 4 — single column + header launch + avatars (2026-05-31)

(Session dump soft-retired → `trash/`.)

- **Layout:** одна колонка на всю ширину окна (форма → result hero → pipeline); убран двухколоночный grid, который обрезал прокрутку до поля «Тема песни».
- **Header:** короткий заголовок «Студия песен» + «10 солистов · тема, настроение и смысл»; **launch panel** (`variant="header"`) в правой части пузыря шапки — intake preview + CTA; XL Base — только amber-диод (`title` tooltip), без текста.
- **Launch:** во время `generating` header launch скрыт; после `completed` — «Сгенерировать ещё» в шапке (без duplicate intake); «Новая песня» только в result card.
- **Avatars:** `public/music-evolution/soloists/{id}.webp` (ComfyUI **`.141:31003`**, workflow `01_top.json`); `MusicEvolutionSoloistAvatar` + fallback на gradient initials; regen script `host/comfyui/generate_music_evolution_soloist_avatars.py`.

### Cancel and terminal transport UX (2026-06-02)

(Session dump soft-retired → `trash/`.)

- **Cancel:** кнопка отмены во время активной генерации становится disabled + `aria-busy` на время `POST /cancel`, а label честно показывает «Отмена запрошена…», чтобы не слать повторные cancel-запросы.
- **Terminal state:** `completed` / `failed` / `cancelled` считаются сильнее поздних SSE/polling ошибок; transport error больше не перебивает терминальный UI.
- **Fallback:** если SSE закрылась без terminal snapshot, UI уходит в polling fallback и останавливает polling после первого terminal snapshot.

### UI wave 3 — premium polish (2026-05-31)

(Session dump soft-retired → `trash/`.)

- **Shell:** ambient drifting orbs (`.me-shell-ambient`), glass header shimmer (`.me-glass-header`), unified glass panels (`.me-glass-panel`).
- **CTA:** `.me-cta-premium` breathe glow (replaces harsh pulse); `.me-generating-live` on status banner.
- **Tokens:** `ME_BADGE_PRO`, `ME_FORM_OVERLAY`, soloist card/filter tab classes, `ME_QUOTE_BLOCK`, `ME_AUDIO_WELL` in `musicEvolutionStyles.ts`.
- **Phase strip:** checkmarks on completed steps; `.me-phase-pill-active`.
- **Pipeline:** chevron on compact `<details>`; premium empty state; shimmer progress while `running`.
- **Result:** success gradient bar + «Готово» badge; repeat launch panel omits duplicate intake (`showIntakeSummary={false}`).

### UI wave 2 (2026-05-31)

> Полный контекст программы: living SoT is **this document** + [`MUSIC-FORGE-APP.md`](MUSIC-FORGE-APP.md) (dated full-summary → `trash/`).

- **Phase strip:** `MusicEvolutionPhaseStrip` in header — три шага (настройка → генерация → итог) с `aria-current="step"`.
- **Launch panel:** `MusicEvolutionLaunchPanel` — единый sticky CTA для «Создать песню» и «Сгенерировать ещё» (без дублирования разметки).
- **Style tokens:** `musicEvolutionStyles.ts` — chips, launch panel, CTA glow.
- **Pipeline:** shimmer на progress bar во время `running` (`.me-progress-running`), нумерация pending-шагов, `aria-current` на активном шаге.
- **Result hero:** enter animation + sparkle на бейдже «Последняя генерация» (`.me-result-hero`, `motion-reduce` safe).

### Latest generation hero + launch layout (2026-05-31, waves 0925–0933)

> **Superseded by wave 4:** launch CTA перенесён в шапку; body — одна колонка. Ниже — исторический контекст wave 2–3.

После `completed` правая колонка: hero **«Последняя генерация»** → compact pipeline (`<details>`) → **«Сгенерировать ещё»**. Во время `generating` launch/intake panel скрыт. Детали и smoke: [DESKTOP-MUSIC-PLAYER.md](desktop/DESKTOP-MUSIC-PLAYER.md) (dated audio UI full-summary → `trash/`).

### UI wave (2026-05-31)

- Desktop shell integration: `DesktopAppContentWrapper`, `DesktopNativeSelect`, `DesktopAppPanel`, `DesktopProductStatusBanner`.
- **Soloist UX (2026-06-03):** `MusicEvolutionSoloistPicker` — 10 пресетов с фильтрами (Все/RU/EN/Дуэт/Свободно), scrollable grid, бейдж «Новый» для Atya/Vera/Nika/Yana/Aurora, phase strip в шапке; launch panel подсвечивается цветом выбранного солиста; форма soloist-first.
- **Intake summary:** `MusicEvolutionIntakeSummary` — превью заявки (тема + чипы) перед submit.
- **Mood chips** вместо native select; счётчик символов темы; лёгкий overlay формы во время генерации.
- **Pipeline:** текущий шаг крупнее; счётчик «N/M шагов»; строка «Сейчас: …».
- **Result card:** градиент + чипы солиста/настроения/смыслов на готовом треке.
- Run lifecycle: intake → generating → terminal; duplicate submit blocked while queued/running; `Новая песня` / `Повторить` after failed/cancelled/completed flows.
- Pipeline UX: localized statuses, `role="progressbar"` + `aria-valuenow`, failed/cancelled recovery banners, `motion-reduce` on pulse animations.
- Active/failed generation UX (2026-06-02): the pipeline is compact and lives inside the top status banner (`Идёт генерация`, failed, cancelled). The old large `Процесс создания / Эволюция трека` card is not rendered below the intake form for active/failed/cancelled runs.
- Freeform **Тень** guard (2026-06-02): after XL Base tag cleanup, backend deterministically re-applies the concrete `female vocal` / `male vocal` / duet marker selected by `vocal_effective` before style validation. This prevents `style_tags_missing_vocal` when the style LLM returns generic `clear vocal` / `close-mic lead`.
- Progress transport: SSE `GET .../runs/{id}/events` with polling fallback (`musicEvolutionApi.consumeMusicEvolutionRunSse`).
- **GET run polling must bypass generic Redis response cache** (`ResponseCacheMiddleware` excludes `/api/v1/music-evolution/`; router sets `Cache-Control: no-store`). Without this, `X-Cache-Status: HIT` can freeze UI progress (e.g. stuck at ~18%) while the run is already completed in Postgres.
- Creative brief JSON from Llama may contain unescaped inner `"` quotes; backend uses relaxed field extraction (`parse_brief_text`) instead of dropping to generic fallback.
- **Song recipe prompting (2026-05-31):** `creative_brief` теперь хранит валидированный `song_recipe` с совместимыми `lyrics_plan`, `vocal_plan` и `style_plan`. Рецепт связывает солиста, mood, meaning tags, хук, BPM/keyscale/instruments и negative tags; malformed JSON уходит в deterministic fallback без потери user slots. Финальные `input_data`/metadata получают `music_evolution_song_recipe` как provenance для UGS/feedback.
- **Creative guardrails (2026-05-31):** short/colloquial themes must not inflate into generic epic; lyrics forbid production jargon in sung text and require theme words in `[Chorus]`; style tags never contain UI token `auto` (`normalize_evolution_style_tags_raw` maps to resolved vocal); genre tag must match user genre; **`resolve_evolution_render_duration_seconds`** picks Comfy length from user baseline, lyric estimate, and corpus median — for **golden soloist lanes** baseline is a **hard cap** (no inflate to ~247s from long lyrics).
- **Recipe quality gates (2026-05-31):** lyrics gate rejects JSON/markdown leaks and retries once when `[Chorus]` misses required hook/theme terms from `song_recipe`. XL Base finalization validates style tags for concrete vocal, final BPM, `[verse]`/`[chorus]`, primary soloist/style anchor and forbidden tag conflicts before dispatch to Comfy.
- **Audio artifact guardrails (2026-05-31):** Evolution uses calmer XL Base sampler defaults (`temperature` ~0.78–0.82, `cfg_scale` ~1.85–1.95); harsh tag tokens (`distorted`, `gritty mix`) are softened before Comfy unless genre is aggressive; disliked Evolution tracks are excluded from corpus hints; style/brief prompts prefer natural vocal over grind/metallic mix.
- **Atya storm hardening (2026-06-03):** `vocal_trance` is treated as an aggressive/power genre for tag softening, so DnB/Reese/distorted-bass energy is preserved. Atya recipes are clamped to 168–176 BPM and force `Storm Russian vocal trance drum and bass Atya`, rolling DnB drums, Reese bass, hurricane build and mandatory background children choir. Atya lyrics craft adds Russian morphology/stress guidance plus a required `(Children choir: ...)` call-response line in chorus/bridge.
- **Atya lyrics quality gate (2026-06-03):** after the completed `Ветер` run proved the sound/choir path but exposed broken Russian lyrics, `validate_music_evolution_lyrics_substance(..., soloist_id="atya")` rejects retryable craft failures before XL Base dispatch: malformed agreement/control (`всё внутри меня так не хотел`, `пустую страх`, `и нам не будет`), random off-style objects (`повозка`), weak fillers/cliches (`вот так, вот так`, `пыль и прах`, `небесный покров`, `фундамент дал`) and abstract/weak children choir lines without storm anchors. The retry prompt now tells the text model to rewrite the full lyrics in living Russian while preserving the background choir.
- **Atya hook/choir anti-repeat (2026-06-06):** run `ea07ff57…` (`Песо дурачёк…`) showed the LLM injecting Chekhova-style «Нас больше не будет» into every chorus and the audio choir echoing the adult hook. Fix: `_sanitize_atya_recipe_hooks` strips the reference phrase from `hook_idea`/`chorus_must_include` unless the user theme contains it; creative rules and ACE tags use `distant children choir swell` / short storm phrase only (never `answers last words`); lyrics gate adds `lyrics_atya_forced_reference_hook`, `lyrics_atya_hook_overrepeat`, `lyrics_atya_choir_duplicates_hook`, `lyrics_atya_duplicate_section_block`, `lyrics_atya_json_leak`; Atya lyrics temperature lowered to **0.72** for tighter Russian.
- **Lula psychedelic melancholy anchor (2026-06-06):** anchor tags restored `psychedelic melancholy`, detuned analog synth haze, chorus/flanger wash, lo-fi tape saturation; removed sterile `clean mix`; negatives expanded (`bright radio pop`, `sterile polished mix`, `cheerful uplifting pop`). Sampler corridor nudged to `temperature=0.78`, `cfg_scale=1.88`.
- **Lula identity + lyrics meaning gate (2026-06-06):** `validate_song_recipe` force-normalizes Lula to Russian indie-pop / dream-pop / synth-pop / trip-hop with 90s nostalgic soulful pop + psychedelic melancholy, C# minor and close-mic half-whisper; lyrics temperature lowered to **0.76**. `evolution_lyrics_system_craft_block(..., soloist_id="lula")` requires concrete nocturnal scene details and forbids abstract slogans/reference-copy; `validate_music_evolution_lyrics_substance(..., soloist_id="lula")` is retryable on weak clichés, missing scene, overrepeat and copied real-reference lines. Tags and lyrics keep the existing `(Arrangement:)` / `(Voice:)` + section mirror contract.
- **XL Base KSampler quality (2026-06-06):** `Musicv2_base.json` now uses **50** KSampler steps (was 15) with cfg 2 / euler / simple. The 15-step template could complete technically while producing underdeveloped audio (mostly melody / weak vocal); Evolution keeps `ksampler_use_comfy_template=true`, so the template is the source of truth.
- **Debug JSON dumps (2026-06-06):** parity with Music Generator studio — each UGS step writes `ugs_input_data` under `host/generated_files/music_evolution_debug_json/ugs_input/{run_id}/{step}/`; Comfy `POST /prompt` body (`version` + `prompt` workflow + `ugs_input_data`) under `…/comfy_prompt/{run_id}/`. Env: `MUSIC_EVOLUTION_DEBUG_JSON_DIR` (default `/app/generated_files/music_evolution_debug_json` in stack0); disable: `MUSIC_EVOLUTION_DEBUG_JSON_DISABLE=1`. Celery workers mount `generated_files` so pipeline runs persist to host.
- **Anchor soloist XL Base lyrics parity (2026-06-06):** LLM often emits bare section lines (`Verse 1`, `Chorus`) without `[…]` — ACE enrich skipped `(Arrangement:)` / `(Voice:)`. Fix: `brace_bare_section_headers_for_ace` in `sanitize_lyrics_ai_output` + `enrich_evolution_lyrics_with_voice_lines`; shared `prepare_anchor_evolution_lyrics_common`; second enrich pass after `prepare_xl_base_lyrics_for_comfy` (`structure_prepare=False`) fills injected empty `[Intro]` with English `(Arrangement:)` / `(Voice:)` (regression Lula `b4d19c6f…`). Style tags: `capitalize_ace_section_tags_in_style` in pipeline **and** in `studio_comfy_workflows._build_ace_music_workflow_from_path` after второго `prepare_xl_base_tags_for_comfy` (иначе `final_clean_ace_tags_for_comfy` снова даёт `[intro]` в node 94 Comfy dump).
- **Tags ↔ lyrics section mirror (2026-06-06):** после `Style: …` каждая секция в tags должна повторять **точные** метки и порядок из lyrics (`[Verse 1]`, `[Pre-Chorus]`, повторный `[Chorus]` — не generic `[Verse]` и не пропуск pre-chorus). Серверный rebuild: `sync_evolution_tags_sections_to_lyrics` в pipeline и в Comfy workflow build; подсказки из enriched lyrics / soloist arrangement profiles; `build_style_messages` передаёт exact section list в style LLM. Тест: `test_music_evolution_tags_sync.py`.
- **Vocal diversity + Luna (2026-05-31):** internal genre **`luna`** (soloist **Lula**): indie/dream/synth-pop + trip-hop, **C# minor**, chord loop C#m–A–F#m–G#, nostalgic analog synths + light electronic beat + enveloping sub-bass + 90s melancholy; empty `[Intro]` and `[Chorus 2/3]` stripped before Comfy (fixes intro howl / ~1:06 section reset); stack leaks stripped from lyrics. Male vocal on Lula runs was a UI mismatch (separate vocal select + genre luna) — fixed by soloist lock.
- **Corpus-driven lyrics (2026-05-31):** per-user corpus **XL Base only** (`ugs_workflow=v2_base`, `billing_mode=evolution_xl_base`, or `music_evolution_run_id`); structured hints (median sung lines, vocal/style match, dislike reasons) in brief **and** lyrics prompts — full lyrics never copied. Operator audit: `api/scripts/music_evolution_xl_base_corpus_audit.py` → `documentation/worklog/`.
- **Lyrics quality bar (Evolution):** min **10** sung lines / **8** Cyrillic (stricter than studio XL Base 6/4); Russian morphology/cliche blocks from studio canon; post-LLM gender scrub + **one retry** on `lyrics_skeleton_only` / `lyrics_insufficient_russian_content` and Atya-specific craft failures. All anchor soloists (incl. Vera/Nika/Yana/Aurora duet) get `(Voice:)` / `(Arrangement:)` enrichment before Comfy.
- Result preview uses `AuthenticatedAudioPreview` with explicit `audio.load()` on blob URL; «Открыть в Music Player» starts global playback and opens the `MusicPlayer` desktop window.
- After XL Base render, backend probes MP3 duration via `ffprobe` and writes it to `run.duration_seconds`, `result_payload.duration_seconds`, and content metadata (replacing fixed 90s default when the file differs).
- Result card: missing-content recovery state, dislike reason chips (`vocal`, `mix`, `lyrics`, …), audio `sourceSurface=music-evolution`.
- Backend fix: `_set_run_status` split SQL for nullable `error_payload` (`AmbiguousParameterError` from prod logs); transaction-safe failure persist with rollback before `_fail_step`.

First-release visibility is catalog-driven: the app is a non-system default/catalog app and appears for installed users rather than becoming a forced pinned system app.

## Verification

Semantic trace for this implementation:

`POST /runs` -> `normalize_music_evolution_input` -> `music_evolution_runs` + `music_evolution_run_steps` -> per-user corpus retrieval -> validated `song_recipe` -> UGS lyrics/style text steps -> XL Base lyrics/style gates -> UGS audio `music_generator_evolution_xl_base` -> `unified_content` metadata -> `POST /feedback` -> `music_evolution_feedback` + `music_evolution_recipe_sources` + optional liked recipe JSON.

Guards:

- `shared/api/tests/test_music_evolution_soloists.py` checks soloist catalog and vocal/genre/language lock.
- `shared/api/tests/test_music_evolution_recipe_features.py` — XL Base metadata filter and corpus quality summary.
- `shared/api/tests/test_music_evolution_lyrics_craft.py` — Evolution lyrics gates, morphology craft block, gender polish.
- `shared/api/tests/test_music_evolution_corpus.py` — corpus scoring prefers rich XL Base hints.
- `shared/api/tests/test_music_evolution_pipeline.py` checks normalization, song recipe fallback/validation, prompt slot propagation, golden workflow payload, idempotency no-duplicate enqueue, cooperative cancel/terminal guards, UGS request correlation persistence/lookup, stale reaper terminalization, `_set_run_status` SQL split, failure persistence, lyrics/style recipe gates, tag `auto` sanitization, and lyric-based duration estimate.
- `src/pages/MusicEvolution/__tests__/MusicEvolutionApp.test.tsx` checks validation, active-run guard, pipeline a11y/failure banners, SSE helper parsing, feedback with dislike reasons and missing-content recovery.

Operator smoke:

1. Open Desktop -> App Store / catalog -> install or open `Эволюционная студия песен`.
2. Submit a short theme, choose **soloist** (e.g. Nebula/Рэй/Ритм), and optionally add extra context.
3. Expect `202` run creation, localized pipeline progress (SSE or polling), then result preview.
4. Press `Нравится` or choose a dislike reason chip; expect feedback to persist and future corpus to include the signal.
5. After terminal state use `Новая песня`; on failure use `Повторить`.

### Golden intake simplification (2026-06-28)

- UI: только **солист + тема + опциональный extra_context**; mood/meaning chips убраны.
- Backend: `apply_soloist_to_run_create` задаёт `SOLOIST_DEFAULT_MOOD` и `meaning_tags=[]` для golden soloists.
- LLM outputs: `_plain_text_from_ugs_llm_result` strips Gemma `<|channel>thought` перед lyrics/tags/brief.
- Corpus RAG: score boost/penalty по `soloist` + genre match; legacy metadata `soloist=lula` нормализуется в `nebula` при scoring и в `recipe_features_from_metadata`.
- Nebula tag anchor: «Lula» → «Nebula» в `luna_reference_tag_block`.
- **Golden workflow routing:** голосовая одинаковость была вызвана тем, что все golden-солисты исполнялись через один `v2_base` graph. Теперь `soloist_workflow_overrides` выбирает тот ACE lane, где солист валидировался: Base/SFT/v4 Luna LoRA/v5 LoRA/Turbo.
- **Duration cap (soloist lanes):** при `vocal_locked` или golden anchor `resolve_evolution_render_duration_seconds` **не расширяет** Comfy render выше user baseline (типично 195s). Раньше `max(baseline, estimated, corpus_median)` давало ~247s и «кашу» на длинных Base renders.
- **Compact lyrics plan:** для `duration_seconds ≤ 195` fallback recipe и lyrics prompt целят ~14 sung lines и короткий `section_plan` без лишнего Bridge; однословная тема получает правило «буквальный образ в [Chorus]», не абстрактный эпос.
- **Nebula intro vocal:** Luna `(Voice:)` для `[Intro]` — half-whisper с пением, не instrumental-only.
