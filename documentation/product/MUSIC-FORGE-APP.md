# MusicForge App

**Статус:** Reconstruction **platform-ready** (2026-07-20). Phase 0–2 Done; migrations `20260720_03`/`04` applied; admin smoke OK. **Active config revision label:** `platform` (2026-09-03; purged nested `draft-draft-…` / `e2e-*` junk; draft allocator no longer nests `draft-`). Prior admin e2e activate used `e2e-20260720022402`. **Stack0 baked release `prod-baked-20260817-1917`** / deploy_id **`1786958297019-dzeiudv7mi`** (git at bake **`c909a9c6`**; Admin Songs UI search/filters/accordion + admin runs list API). Prior: `prod-baked-20260817-1807` / deploy_id `1786954080932-4qezullq7f` (git **`c0366b86f`**; Song Studio W10–W15). Runtime prior: `prod-baked-20260817-1710` / deploy_id `1786950689347-5k3qntnfmf`. Предыдущий roadmap `musicforge_platform_roadmap_e9fac319` **superseded / bankrupt**. MVP slice originally 2026-06-28.
**Desktop app:** `app-music-forge` / `MusicForgeApp`.
**API:** `/api/v1/music-forge/*` (+ `/api/v1/music-forge/admin/*`).
**OpenAPI pilot:** `shared/web/frontend/openapi/pilot/music-forge.openapi.json` → `pnpm run openapi:pilot:music-forge` (regenerate from export via `openapi-extract-pilots.mjs` pathPrefixes `/api/v1/music-forge`).
**FE SSOT (Wave 1, 2026-08-06):** thin bridge [`musicForgeOpenApi.ts`](../../shared/web/frontend/src/services/musicForge/musicForgeOpenApi.ts) — hot-path clients [`musicForgeApi.ts`](../../shared/web/frontend/src/services/musicForge/musicForgeApi.ts) / [`musicForgeAdminApi.ts`](../../shared/web/frontend/src/pages/Admin/musicForge/musicForgeAdminApi.ts) alias OpenAPI `*Out`/`*In` (no parallel hand DTOs). Capabilities `languages` = named `MusicForgeLanguageOption` (`value`, `label_ru`), not open `dict[str,str]`. PATCH product returns `MusicForgeAdminProductOut`. Residual FE-only views: `MusicForgeModeRow` / `MusicForgeStageRow` over detail `modes`/`pipelines` dict bags. Canon: [FRONTEND-BACKEND-HTTP.md](../api/FRONTEND-BACKEND-HTTP.md) §Adoption.
**Scope:** отдельная backend-first студия песен на ACE Step SFT XL (default). Это не alias и не patch старого `MusicEvolution`.

## Цель

MusicForge заменяет подход «чинить Music Evolution» отдельным продуктовым контуром: пользователь вводит только идею, язык, стилевой намёк и ограничения, а вся музыкальная логика живёт на backend. Frontend остаётся thin client: создаёт run, показывает пошаговый backend workflow, проигрывает результат и отправляет like/dislike.

**Default lane (2026-07-18 q4; duration default 2026-08-16):** **SFT XL** — AceStepSFT `ace_sft_new.json` (`ugs_workflow=v4`, UNET `acestep_v1.5_xl_sft_bf16`), sampler `jkass_quality` / cfg **7**, LM `temperature≈0.85` / `cfg_scale≈2.1`. Opt-in: `base xl` → BASE; explicit `turbo`/`xl turbo` → TURBO. Genre words (house/DnB/edm) **не** форсят Turbo. Рендер через UGS **`music_generator_forge_audio`**. Liked corpus: **`music_forge_feedback` first**, then `music_evolution_feedback` + `unified_content` fill. Product `duration_default` **220** (Ideal TOP band; migration `20260816_01`).

**Ideal TOP song canon (quality contract):** [MUSIC-FORGE-IDEAL-TOP-SONG-CANON.md](MUSIC-FORGE-IDEAL-TOP-SONG-CANON.md) — caption/lyrics/SFT sampler shape for operator-approved TOP tracks.

**Residual improvement process plan (not SoT):** `documentation/plans/product/MUSIC-FORGE-IMPROVEMENT-PLAN.md` *[operator-local process plan; gitignored — not living canon]* — gaps G1–G11, waves W0–W7; this APP + Ideal TOP win on contracts.

## Инварианты

- **Единственное пользовательское desktop-приложение для создания песен (2026-06-28):** `app-music-forge` / «Студия песен». Legacy `MusicGenerator`, `MusicEvolutionApp` и их frontend-модули сняты с рабочего стола; старые ярлыки и уведомления перенаправляются на `MusicForgeApp`.
- Public create request не принимает workflow/model/sampler/LoRA flags. Backend выбирает **SFT XL (default)**, **BASE XL** или **TURBO XL**.
- Audio render: UGS **`music_generator_forge_audio`** (dedicated; migration `20260720_04`) + `ace_sft_new.json` (default) / `Musicv2_base.json` / `Musicv2.json`.
- Liked corpus: per-user hints — **primary** `music_forge_feedback` likes (any lane incl. SFT); **secondary** Evolution corpus / `music_evolution_feedback`. Dislike `reason_code` → prompt `dislike_hints`. При явном electronic/DnB style_hint pop-likes из corpus **не** подменяют жанр пользователя.
- **BPM:** numeric `style_capsule.bpm` и Comfy `input_data.bpm` берутся из явного `NNN BPM` в style caption или genre-heuristic (DnB ~174, fast ~140); не default 112 при конфликте с текстом tags.
- **Style key / keyscale (2026-07-18 q2):** `infer_music_forge_style_key` резолвит studio keys (`drum and bass`, `phonk`, `lofi_chill`, …), не coarse bucket `dance`; `keyscale` из жанровой карты, не «всегда A minor для RU».
- **Vocal/arrangement enrich (2026-07-18 q2–q4.1; caption sparse 2026-09-03):** перед Comfy lyrics проходят `(Voice:)` / `(Arrangement:)` enrich. Вокал: intent → style caption → genre default → blueprint → corpus. Lo-fi/indie/DnB/house — Forge-own profiles. Caption — TOP-shaped **sparse hierarchical** arc (≤**720** chars, `slim_ace_style_caption`; no stacked FX jargon). `(Voice:)` locked to intent via `lock_voice_enrich_lines_to_vocal`. **Section tags Title Case** (`[Intro]`/`[Verse]`) как в lyrics, не lowercase `[intro]` (q4.1). Duration default **220** s (max **240**; DB check 60–240); SFT LM/sampler defaults. **Long-form stitch** (`ACE_V4_SFT_LONG_FORM_ENABLED`) default **off** — one Comfy pass for total duration; opt-in `=1` restores multi-chunk ≤60s.
- **Lyrics gate (2026-08-17):** hard-fail `empty_lyrics` / `json_leak` / `missing_sections` / `stack_leak` / **`meta_music_jargon`** (ритм/пульс/бит as sung words) / **`empty_pop_cliche`** (single weak glue line) / **`weak_cliche_fill`** (≥2 clichés) / **`abstract_noun_chant`** (idea/hook repeated in verses); one LLM retry with rewrite notes + corpus `dislike_hints`. Style hint is arrangement-only — not lyric vocabulary. Step `output_payload` exposes `retried` / `retry_resolved`; Studio shows honest copy when auto-rewrite succeeded. Metrics: `lyrics_gate_retry`, `lyrics_gate_retry_ok`, `lyrics_gate_retry_fail`. Numbered ACE markers remain TOP-shaped, not `json_leak`.
- **BPM sync (2026-07-18):** `style_capsule.bpm`, caption/tags, Comfy `bpm`, and every `(Arrangement: … NNN BPM)` line use the **same** integer. MusicForge enrich locks soloist `bpm_clamp` to that value (grit must not rewrite 115→140). Pipeline also runs `coerce_enriched_arrangement_bpm_lines` before persist; Comfy path coerces again as a second gate.
- **XL tags:** Base path — section-tag sync как Evolution XL Base; SFT path maps `tags` → AceStepSFT `caption` в `studio_comfy_workflows.py`.
- Run progress берётся только из `music_forge_run_steps`; frontend не угадывает скрытые стадии. Empty Mode pipeline → **503** `music_forge_pipeline_empty` (no legacy STEP_DEFS fallback).
- GET polling и SSE endpoints исключены из Redis `ResponseCacheMiddleware` через `/api/v1/music-forge/`.
- **Mobile UGS Songs (W7 parity):** thin client на `/api/v1/music-forge/*` (`GET capabilities` + create + poll until terminal); **topic + genre** always visible; **language / vocal / mode** in disclosed «Настройки звучания»; honest **`taste_profile_like_count`** strip when authenticated count &gt; 0; Mode picker from `modes[]` / `default_mode_key`; история merge `music_forge` + legacy `music_generator`. **W8 mobile:** history row actions — **`POST …/rewrite-lyrics`** when content metadata carries `music_forge_run_id` (forge list uses `list_profile=full`). Vocal/es/fr — через `constraints` / `language=auto`. Legacy `MusicApi` `/music-generator/*` остаётся в DI для прочих callers, Songs path его не использует.

## Backend

Модули:

- `shared/api/routers/music_forge.py` — capabilities, create/get/events/cancel/feedback.
- `shared/api/routers/music_forge_admin.py` — operator stats, cross-user run inspection, config revisions, Pipeline Builder CRUD, Comfy probe (`require_admin_user`).
- `shared/api/services/music_forge/config/admin_ops_pipeline.py` — draft Mode/stage mutations (Wave C).
- `shared/api/schemas/music_forge.py` — Pydantic public contracts.
- `shared/api/schemas/music_forge_admin.py` — Pydantic admin contracts.
- `shared/api/services/music_forge/corpus.py` — liked-recipe corpus из prod feedback JSON.
- `shared/api/services/music_forge/algorithm/` — package (Ideal TOP ownership: style + audio + lyrics gate):
  - `constants.py` — version/type keys, section skeletons, style maps, forge arrangement/voice profiles
  - `lanes.py` — **SFT XL / BASE / TURBO** lane select + intent normalize
  - `style.py` — style_key, keyscale, BPM, caption capsule
  - `lyrics.py` — ACE enrich + validate/repair gate
  - `lyrics_craft.py` — sung-text craft: ban ритм/пульс/бит + empty-pop clichés + abstract-noun chant; RU/EN few-shot; dislike hints for retry
  - `prompts.py` — blueprint/lyrics/style LLM message builders
  - `audio.py` — UGS audio payload + content metadata
- `shared/api/services/music_forge/pipeline.py` — composition facade (`MusicForgePipelineService`): wiring only
- `shared/api/services/music_forge/billing_gate.py` — credit preflight (402) + run budget (429)
- `shared/api/services/music_forge/breaker.py` — Redis circuit breaker Comfy/UGS → **503** `music_forge_upstream_unavailable`
- `shared/api/services/music_forge/observability.py` — Redis multi-worker counters (`music_forge:metric:v1:*`) **+ Prometheus dual-write** `music_forge_metric_total{name,step}` via `api/monitoring/metrics.observe_music_forge_metric`
- `shared/api/services/music_forge/pipeline_repository.py` — `MusicForgeRunRepository` (SQL / step machine)
- `shared/api/services/music_forge/pipeline_steps_materialize.py` — Mode → durable `music_forge_run_steps` (+ `result_ready`)
- `shared/api/services/music_forge/pipeline_execute.py` — thin `MusicForgeRunExecutor` (claim / breakers / config → interpreter)
- `shared/api/services/music_forge/pipeline_interpreter.py` — Wave B walk of Mode stages
- `shared/api/services/music_forge/pipeline_stage_handlers.py` — closed `stage_type` handlers
- `shared/api/services/music_forge/pipeline_mode.py` — Mode + lane resolve from intent/config
- `shared/api/services/music_forge/pipeline_context.py` — shared run context for handlers
- `shared/api/services/music_forge/stale.py` — orphan idle-run detection (fetch_run path)
- `shared/api/services/music_forge/reconcile.py` — terminal failed isolated persist + `reconcile_orphan_runs` (Celery beat `music-forge-orphan-run-reconcile`)
- `shared/api/services/music_forge/config/` — **ConfigGateway** (Phase 1): `gateway.py` + `coordinator.py` (Redis key `music_forge:config:generation` + PG `music_forge_config_meta.generation`) + `validator.py` + `repository.py` + `seed.py` (`code_default_bundle` только seed/tests). Runtime fail-closed → **503**. Cache hit только при совпадении generation (не TTL-only).
- `shared/api/tasks/music_forge.py` — Celery: pipeline + orphan reconcile.
- Gate: `docker/scripts/music-forge-ownership-gate.sh` — LOC + dual-accept bans.
- `host/comfyui/music_forge_ace15_mvp.json` — legacy single-lane artifact; live default is AceStepSFT via `ace_sft_new.json` / UGS `v4`.

UGS type keys:

| type_key | Provider | Purpose |
| --- | --- | --- |
| `music_generator_forge_blueprint` | Llama/Ollama | Structured song blueprint JSON |
| `music_generator_forge_lyrics` | Llama/Ollama | Sung lyrics with ACE section markers |
| `music_generator_forge_style` | Llama/Ollama | English ACE style capsule |
| `music_generator_forge_audio` | ComfyUI | Dedicated Forge audio (SFT/BASE/TURBO via `ugs_workflow`); **не** shared Evolution key |

## Database

Migration:

- `shared/api/migrations/applied/20260628_01_music_forge_mvp.sql`
- `shared/api/migrations/applied/20260628_02_music_forge_catalog_access.sql`
- `shared/api/migrations/applied/20260628_03_music_forge_llm_provider_repair.sql`
- `shared/api/migrations/applied/20260720_01_music_forge_duration_240.sql`
- `shared/api/migrations/applied/20260720_02_music_forge_config.sql` — DB-backed config revisions
- `shared/api/migrations/applied/20260720_03_music_forge_config_generation.sql` — `music_forge_config_meta.generation` + run provenance (`config_revision_id`, `config_version`, `config_generation`)
- `shared/api/migrations/applied/20260720_04_music_forge_audio_type_key.sql` — `music_generator_forge_audio` + product_settings default
- `shared/api/migrations/applied/20260720_05_music_forge_pipeline_modes.sql` — **Pipeline Architect Wave A**: Modes + ordered pipeline stages (backfill from lanes)
- `shared/api/migrations/applied/20260720_06_music_forge_mode_display_labels.sql` — friendly user-facing Mode titles (when still technical)
- `shared/api/migrations/applied/20260816_01_music_forge_duration_default_220.sql` — Ideal TOP duration_default **220** + lyrics_gate fail_on/retry_once on stage instances
- `shared/api/migrations/applied/20260817_01_music_forge_lyrics_craft.sql` — lyrics_gate fail_on `meta_music_jargon` / `weak_cliche_fill` + lyrics prompt craft rules
- `shared/api/migrations/applied/20260817_02_music_forge_lyrics_craft_w2.sql` — lyrics_gate fail_on `empty_pop_cliche` / `abstract_noun_chant` (wave 2 craft)

Tables:

- `music_forge_runs` — durable run state, normalized input, blueprint, lyrics, style capsule, render/result payloads.
- `music_forge_run_steps` — ordered UI-visible backend workflow steps.
- `music_forge_feedback` — like/dislike feedback with recipe snapshot.
- `music_forge_config_revisions` — versioned config bundles (`draft` / `active` / `retired`; one active revision enforced by partial unique index). Canonical active label: **`platform`** (not nested `draft-draft-…` / leftover `e2e-*` smoke names).
- `music_forge_lanes` — SFT/BASE/TURBO lane registry per revision (workflow, markers, sampler defaults) — **render library** referenced by Modes.
- `music_forge_modes` — user-facing Modes per revision (`mode_key`, labels, `enabled`, `is_default`, bound `lane_key`).
- `music_forge_pipeline_stages` — ordered stage *instances* per Mode (`stage_type` ∈ closed code registry, `settings` JSONB).
- `music_forge_style_profiles` — genre keyscale, textures, arrangement/voice enrich maps per revision.
- `music_forge_prompt_templates` — LLM system prompts + rules (`blueprint` / `lyrics` / `style`).
- `music_forge_product_settings` — duration bounds, MVP lane label, audio type key, optional run quotas (1:1 with revision).
- `music_forge_config_meta` — singleton `generation` stamp (bump on activate; Redis mirror).
- `music_forge_runs.config_revision_id` / `config_version` / `config_generation` — provenance активного bundle на create.

### Pipeline Architect (Wave A — schema)

- **Stage type** (code): closed set in `config/stage_types.py` — `intent_normalize`, `llm_generate`, `lyrics_gate`, `style_build`, `lyrics_enrich`, `audio_comfy`, `content_persist`. New capabilities need a handler deploy; composing instances is Admin/DB.
- **Stage instance** (DB): rows in `music_forge_pipeline_stages` with structured `settings` (prompt_kind, ugs_type_key, lane_key, …).
- Seed: one Mode per existing lane (`sft_xl` / `base_xl` / `turbo_xl`) with today’s fixed stage sequence. Activate hard-gate requires ≥1 enabled default Mode, non-empty enabled stages, valid `stage_type`, and an `audio_comfy` stage.
- Bundle load carries `modes` + `pipelines` on the active config snapshot.

### Pipeline Architect (Wave B — interpreter)

- Runtime: `pipeline_execute.py` claims the run → breakers → active config → **`run_pipeline_interpreter`** (`pipeline_interpreter.py`).
- Interpreter resolves Mode (`pipeline_mode.py`: `intent.mode_key` → lane match → default), materializes durable steps from the Mode graph (`pipeline_steps_materialize.py` + trailing `result_ready`), then dispatches each `stage_type` via `pipeline_stage_handlers.STAGE_HANDLERS`.
- `create_run` seeds step rows via **`resolve_create_mode`** (Wave D: explicit `mode_key` or default); legacy `STEP_DEFS` only when pipeline empty. Seed graph has **8 stages + `result_ready`** → `progress_total` **9** (was fixed 8 before Wave B).
- `_refresh_progress` sets `progress_total` from durable step-row **COUNT** (not the legacy constant 8), so mid-run progress does not snap back after materialize.
- **Ops:** migration `20260720_05_music_forge_pipeline_modes` registered in `apply-eliteew-migrations.sh`; applied on prod-core **2026-07-20** before Wave B+ runtime. Without Modes/pipelines, active config / execute fail closed.

### Pipeline Architect (Wave C — Admin Builder)

- **GET** `/api/v1/music-forge/admin/config/revisions/{id}` returns `modes` + `pipelines` (wired; was schema-only before Wave C).
- **GET** `/config/stage-types` — closed catalog (`stage_types`, `llm_ugs_type_keys`, seed `defaults`).
- Draft-only mutations (`admin_ops_pipeline.py`):
  - `PATCH …/modes/{mode_key}` — labels, enabled, is_default, lane_key, …
  - `PATCH …/modes/{mode_key}/stages/{stage_key}` — title, sort_order, enabled, settings (JSONB replace)
  - `POST …/modes/{mode_key}/stages` — add instance; `stage_type` ∈ `ALLOWED_STAGE_TYPES` only
  - `DELETE …/modes/{mode_key}/stages/{stage_key}` — blocked if it removes the last enabled `audio_comfy`
- FE: Config editor opens on **Styles & steps** (`MusicForgePipelineBuilder.tsx`) — Mode list with **user-facing** `label_ru`/`label_en`, ordered stage list, advanced JSON behind disclosure.
- Display labels for seed Modes updated by `20260720_06_music_forge_mode_display_labels.sql` (only when still technical); Admin overrides win.
- Out of scope here: change `stage_type` in place (delete + add). Public Mode picker = Wave D (shipped). **W7 (2026-08-17):** draft-only **create/delete Mode** via Admin Pipeline Builder + `POST/DELETE …/config/revisions/{id}/modes`.

### Pipeline Architect (Wave D — public Mode picker)

- **GET** `/api/v1/music-forge/capabilities` → `modes[]` (`mode_key`, `label_ru`, `label_en`, `is_default`, `lane_key`) + `default_mode_key` from enabled active Modes.
- **POST** `/api/v1/music-forge/runs` accepts optional `mode_key`. Unknown/disabled → **422** `music_forge_mode_key_invalid:…` **before** run insert.
- `normalize_music_forge_input` passes `mode_key` into `normalized_input`; `create_run` seeds steps via `resolve_create_mode` (not always default Mode).
- Precedence (execute + create): explicit `mode_key` → lane markers in style/constraints → default Mode.
- FE: Song Studio form shows Mode select when `capabilities.modes` non-empty; submit includes `mode_key`.
- Mobile Songs: `GET /capabilities` → Mode chips; `POST /runs` includes optional `mode_key` (parity with desktop Wave D).

### Pipeline Architect (Wave E — Run Inspector + doc sync)

- **Not** a Stage Desk: no mid-run stage edits, no Comfy graph editor, no re-queue controls.
- Admin **Runs** tab: click row → `MusicForgeRunInspector` loads `GET /api/v1/music-forge/admin/runs/{run_id}`.
- **Admin Songs UI (2026-08-17):** tab label «Песни»; `MusicForgeAdminRunsPanel` — server-side `?status=` / `?q=` / `?mode_key=` / `?model_lane=` filters, pagination, status badges, drawer inspector with accordion sections (summary, result, lyrics, pipeline, meta, technical JSON). List columns: idea, track, style, genre hint, language, duration, progress.
- Inspector shows: status, `normalized_input.mode_key` / `model_lane`, config provenance (`config_version`, `config_generation`, `config_revision_id`), progress, run/step errors, ordered steps, optional JSON payloads.
- Run responses (`MusicForgeRunOut` / admin detail) expose `config_revision_id`, `config_version`, `config_generation` (DB columns already stamped at create).
- Admin list items include `mode_key` when present on `normalized_input`.
- OpenAPI pilot: slice from `documentation/api/eliteew-openapi-export.json` via `OPENAPI_PILOT_ONLY=music-forge.openapi.json node scripts/openapi-extract-pilots.mjs` then `pnpm run openapi:pilot:music-forge` (includes Wave C/D `mode_key`, Modes, stage-types, admin runs).

Desktop DB registration:

- `desktop_app_catalog.app_id = app-music-forge`
- `desktop_app_catalog.app_component = MusicForgeApp`
- Default desktop access group link is seeded by `20260628_02`; prod-core also has `Standart` group access.
- Prod-core application marker: `schema_migrations` includes `20260628_01`…`20260628_03`, `20260720_*`, and improvement-program **`20260816_01` / `20260817_01` / `20260817_02`** (applied prod-core **2026-08-17**).
- MusicForge LLM type keys must use provider `llama` in prod; `ollama` is not a live stack0 UGS provider.

## Frontend

New thin app files:

- `shared/web/frontend/src/pages/MusicForge/MusicForgeApp.tsx` — run lifecycle, split form vs monitor errors; delegates create intake to `MusicForgeCreatePanel`
- `shared/web/frontend/src/pages/MusicForge/MusicForgeCreatePanel.tsx` — **W6 premium IA:** hero, honest taste strip from capabilities, progressive disclosure (`details`) for mode/lang/duration/style/constraints; active-run read-only summary
- `shared/web/frontend/src/pages/MusicForge/MusicForgeGenrePicker.tsx` — **W10:** curated genre chips (`style_hint`) above advanced settings
- `shared/web/frontend/src/pages/MusicForge/MusicForgeVocalPicker.tsx` — **W10b:** lead vocal chips (male/female/duet); merged into `constraints` on submit via `musicForgeUiHelpers`
- `shared/web/frontend/src/pages/MusicForge/MusicForgeActiveRunProgress.tsx` — **W10b:** inline progress strip in create panel during active run
- `shared/web/frontend/src/pages/MusicForge/MusicForgeRunMetaChips.tsx` — **W11:** read-only recap chips (vocal, genre, language, duration) on active run + result card
- `shared/web/frontend/src/pages/MusicForge/MusicForgeLanguagePicker.tsx` — **W12:** language chips on main form (mobile parity)
- `shared/web/frontend/src/pages/MusicForge/MusicForgeCompletedHint.tsx` — **W12:** post-completion strip in create column + header **Новая песня**
- `shared/web/frontend/src/pages/MusicForge/MusicForgeTerminalHint.tsx` — **W13:** failed/cancelled strip in create column with retry
- `shared/web/frontend/src/pages/MusicForge/MusicForgeResultPlaybackHero.tsx` — **W13:** visual playback hero when handoff to desktop Music Player
- `shared/web/frontend/src/pages/MusicForge/MusicForgeFeedbackPanel.tsx` — **W14:** grouped feedback section with honest hint copy
- `shared/web/frontend/src/pages/MusicForge/MusicForgeIdeaStarters.tsx` — **W14:** curated idea starter chips when field empty
- `shared/web/frontend/src/pages/MusicForge/musicForgeStatusTone.ts` — **W14:** header status surface tones by run lifecycle
- `shared/web/frontend/src/pages/MusicForge/MusicForgeDurationPicker.tsx` — **W15:** duration preset chips + numeric input
- `shared/web/frontend/src/pages/MusicForge/MusicForgeSubmitRecap.tsx` — **W15:** pre-submit settings recap when idea ≥ 3 chars
- `shared/web/frontend/src/pages/MusicForge/MusicForgeStudioIdlePanel.tsx` — **W10:** idle journey panel (idea → craft → listen) before first run
- `shared/web/frontend/src/pages/MusicForge/MusicForgeWorkflow.tsx` — backend step timeline, terminal failed/cancelled banners, `error_payload` surfacing
- `shared/web/frontend/src/pages/MusicForge/MusicForgeResultCard.tsx` — playback, lyrics, like/dislike with reason chips, library CTA
- `shared/web/frontend/src/pages/MusicForge/musicForgeUiHelpers.ts` — user-safe error mapping and form helpers (`mapMusicForgeApiError` uses `APIError.statusCode` / `isNetworkError` / `isServerError`; fallback keys include `submitFailed` / `cancelFailed`)
- `shared/web/frontend/src/services/musicForge/musicForgeApi.ts`
- `shared/web/frontend/src/pages/Admin/musicForge/` — admin hub (`?section=musicForge`); Config envelope-only list; **Pipeline** tab (`MusicForgePipelineBuilder`); **Runs** → `MusicForgeRunInspector`
- Config editor shell `MusicForgeConfigEditor.tsx` (<800 LOC) + panels: `MusicForgeConfigLanePanel`, `Prompt/Style/Product/PreviewPanel`, shared `musicForgeConfigEditorShared.tsx`
- Admin Vitest: `pnpm exec vitest run src/pages/Admin/musicForge/__tests__/` (draft gate, draft/activate, Pipeline Builder happy path)

### Pages-layer UX (2026-06-30)

| Phase | Behavior |
| --- | --- |
| **Active run** | Form locked; workflow shows backend steps; indeterminate progress until `progress_total > 0`; cancel shows «Отменяем…» |
| **Failed / cancelled** | Terminal banner with sanitized `run.error_payload.message` (fallback i18n); actions **Повторить генерацию** / **Новая песня**; failed steps show `step.error_payload.message` |
| **Run monitor** | `monitorMusicForgeRun`: SSE (`GET …/events`) first; if SSE drops, GET poll with backoff **4s → 15s** (not a fixed 1.8s interval); pauses while the tab is `document.hidden`; stops on terminal. Stale orphans (`running`/`queued` with no `updated_at` for **20 minutes**) are failed on next `fetch_run`/SSE with `error_payload.stage=stale_run` so clients stop watching. |
| **Monitor errors** | Poll/SSE failures in workflow column (not form); offline copy when `navigator.onLine === false`; cleared on terminal snapshot |
| **Form** | **W6:** Hero + idea + primary CTA always visible; **W10:** genre chips; **W10b:** vocal chips; **W12:** language chips; **W14:** idea starters when idea empty; **W15:** duration presets in advanced + submit recap before CTA when idea ≥ 3 chars; extra constraints + mode/style in **«Настройки звучания»** disclosure. When authenticated and `capabilities.taste_profile_like_count > 0`, honest taste strip (no fake learning). Idea min-length hint (≥ 3 chars); duration clamped on blur/submit; **Вернуть в форму** restores fields (parses vocal from stored constraints); retry from terminal re-submits last payload |
| **Embedded shell** | **W15:** compact header (no subtitle, tighter padding) when `MusicForgeApp` `embedded` |
| **Header status** | **W14:** lifecycle-toned status chip (idle / active / completed / failed / cancelled / cancel pending) |
| **Workflow panel** | **W14:** run meta chips under section title while run snapshot visible |
| **Completed create column** | **W12:** `MusicForgeCompletedHint` replaces hero while result visible; header **Новая песня** clears run snapshot |
| **Terminal create column** | **W13:** `MusicForgeTerminalHint` for failed/cancelled with retry + **Новая песня** |
| **Active run (panel)** | **W10b:** read-only idea + status + percent progress bar (`queued`/`running` hints) |
| **Completed workflow** | **W10b:** compact header («N steps done»); step grid collapsed behind **«Показать шаги создания»** — result card stays primary |
| **Completed result** | **W11:** meta chips; primary **Слушать в плеере** CTA; **W13:** `MusicForgeResultPlaybackHero` + auto-open dislike reasons when reason missing; **W15:** copy lyrics button |
| **Completed** | Result card even without `download_url`; **auto-play** into desktop Now Playing when `content_id` exists (`requestPlayInMusicPlayer`, once per run/tab); CTA **Слушать в плеере** (`requestPlayAndOpenMusicPlayer`); library via `ContentManagerPro`; **no local `<audio>` when `content_id` is present** (exclusive transport — avoids dual-stream with widget/taskbar); download link when URL normalizes; dislike requires reason chip (`vocal`, `mix`, …) |
| **Feedback** | `POST …/feedback` into `music_forge_feedback`; on **like** also upserts track + adds Music Player **«Любимые»** (idempotent); rating persisted in `sessionStorage` for pressed UI; success/error copy inline |

Focused Vitest: `pnpm exec vitest run src/pages/MusicForge/__tests__/` and admin `src/pages/Admin/musicForge/__tests__/`

Desktop registration:

- default app: `app-music-forge`
- component: `MusicForgeApp`
- lazy mount: `desktopWindowAppContent.tsx`
- preload/icon/title/assistant-link registries include `MusicForgeApp`

## API Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/music-forge/capabilities` | Thin-client capabilities: duration bounds, `mvp_lane`, **`modes[]`**, `default_mode_key`, `config_version`; when authenticated also **`taste_profile_like_count`** / **`taste_profile_dislike_count`** (0 for anonymous — no fake taste copy) |
| `POST /api/v1/music-forge/runs` | Create durable run (`mode_key` optional), enqueue Celery, return `202`; invalid `mode_key` → **422** |
| `GET /api/v1/music-forge/runs/{run_id}` | Poll current run state and ordered steps; also fails stale orphans (`updated_at` idle ≥20 min) |
| `GET /api/v1/music-forge/runs/{run_id}/events` | SSE snapshots + keep-alive (~3s); same stale reconcile via `fetch_run` |
| `POST /api/v1/music-forge/runs/{run_id}/cancel` | Cancel durable run and best-effort cancel correlated UGS request |
| `POST /api/v1/music-forge/runs/{run_id}/feedback` | Save like/dislike feedback |
| `POST /api/v1/music-forge/runs/{run_id}/rewrite-lyrics` | From **completed** run: seed new run with same blueprint, skip `song_blueprint`, fresh lyrics + render (`202`) |

### Admin API (`require_admin_user`)

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/music-forge/admin/stats/overview?window_hours=24` | SQL aggregates (status / fail-by-stage / feedback) + Redis `in_process_counters` / breaker snapshot when available. |
| `GET /api/v1/music-forge/admin/runs?status=&limit=&offset=` | Cross-user run list (truncated idea, `mode_key`, `model_lane`) |
| `GET /api/v1/music-forge/admin/runs/{run_id}` | Full run + steps + config provenance for any user (Run Inspector) |
| `GET /api/v1/music-forge/admin/feedback/stats` | Global rating histogram + top dislike reason codes |
| `GET /api/v1/music-forge/admin/probe/comfy` | ComfyUI health via `ProviderHealthService.check_provider_status("comfyui")` |
| `GET /api/v1/music-forge/admin/config/revisions` | **Только envelope** `{ items, total }` (`MusicForgeAdminConfigRevisionListOut`). Bare array запрещён. |
| `POST /api/v1/music-forge/admin/config/revisions/draft` | Создать **draft** копией active bundle (lanes/styles/prompts/product). Без active → **503**. Не активирует. Default version: `draft-{canonical_base}-{8hex}` — **не** `draft-` поверх уже `draft-*` / `e2e-*` active label (`allocate_draft_version`). |
| `POST /api/v1/music-forge/admin/config/revisions/purge-retired` | Hard-delete всех `status=retired` (CASCADE child tables; `music_forge_runs.config_revision_id` → NULL). Active/draft не трогает. |
| `PATCH /api/v1/music-forge/admin/config/revisions/{revision_id}/version` | Rename label (`version`, optional `notes`). Conflict UNIQUE → **409**. If target is **active**, bumps `config_generation` + Redis publish + process cache clear (same as activate) so run provenance does not keep a stale label. |
| `GET /api/v1/music-forge/admin/config/revisions/{revision_id}` | Полный bundle `{ revision, lanes, styles, prompts, product, modes, pipelines }`; missing → **404**. |
| `GET /api/v1/music-forge/admin/config/stage-types` | Closed catalog: `stage_types`, `llm_ugs_type_keys`, seed `defaults` (Wave C). |
| `GET /api/v1/music-forge/admin/config/revisions/{revision_id}/diff` | Diff target vs active: `{ base_version, target_version, changes[] }` (incl. modes/pipelines); no active → **503**. |
| `PATCH /api/v1/music-forge/admin/config/revisions/{revision_id}/product` | Patch `product_settings` только для `status=draft`; иначе **422**. |
| `PATCH …/config/revisions/{revision_id}/lanes/{lane_key}` | Draft-only: `ugs_workflow` ∈ `{v4,v4_luna,v2,v2_base,v5}`, `workflow_file`, `sampler{cfg,steps,sampler_name,scheduler,…}`, `is_default` (нормализует peers), markers/billing/… |
| `PATCH …/modes/{mode_key}` | Draft-only Mode: labels, enabled, is_default, lane_key, … (Wave C). |
| `POST …/config/revisions/{revision_id}/modes` | Draft-only: create Mode + seed canonical pipeline for `lane_key` (**W7**). |
| `DELETE …/config/revisions/{revision_id}/modes/{mode_key}` | Draft-only delete Mode (blocked when last Mode on revision). |
| `PATCH/POST/DELETE …/modes/{mode_key}/stages[/{stage_key}]` | Draft-only stage instances; `stage_type` ∈ registry; delete of last enabled `audio_comfy` → **422**. |
| `PATCH …/config/revisions/{revision_id}/prompts/{kind}` | Draft-only; `kind` ∈ `blueprint\|lyrics\|style`; `system_prompt` / `rules` / `extras`. |
| `PATCH …/config/revisions/{revision_id}/styles/{style_key}` | Draft-only style profile patch (`keyscale`, `bpm_default`, textures, …). |
| `POST …/config/revisions/{revision_id}/preview-audio-payload` | Dry-run (без enqueue): `select_music_forge_model_lane` + `build_audio_input_data` → `{ lane_key, ugs_workflow, resolved_builder, input_data }`. Draft или active. |
| `POST /api/v1/music-forge/admin/config/revisions/{revision_id}/activate` | Hard-gate: lanes+`is_default`, valid `ugs_workflow` + non-empty `workflow_file`, styles, prompts `blueprint\|lyrics\|style`, product_settings, **Modes** (≥1 enabled + `is_default`, bound `lane_key`), **pipelines** (enabled stages, `stage_type` ∈ registry, `audio_comfy` present). Невалидный bundle → **422** `{ code, reasons }`; успех → active + invalidate cache + `config_generation` bump |

**Sampler → Comfy precedence** (`build_audio_input_data`): **lane.sampler > scope code defaults** for KSampler (`cfg`/`steps`/…) и ACE (`temperature`/`cfg_scale`/…). Style capsule **не** источник knobs (раньше `build_style_capsule` копировал sampler default/SFT lane и ломал Turbo при `sampler={}`). Scope defaults: Turbo `cfg=2`/`steps=8`, SFT/Base `cfg=7`/`steps=50`. Mode stamps `normalized_input.lane` / `version`. `music_forge_version` следует `model_scope`. `resolved_builder` из `ugs_workflow`: `v4`/`v4_luna`→`v4_sft`, `v2_base`→`v2_base`, `v2`→`v2`, `v5`→`v5_big_xl_sft`.

Admin FE (`pages/Admin/musicForge/`): строгий envelope parser (без dual-accept). Config tab: draft/activate + **структурный редактор** (`MusicForgeConfigEditor`) — Lanes / Prompts / Styles / Product / **Pipeline** / Preview. **Songs tab** (`runs`, label «Песни»): `MusicForgeAdminRunsPanel` — status filter chips, paginated list, drawer **Run Inspector** with lyrics/result/meta chips. Shell: `MusicForgeAdminSection` + panels `MusicForgeAdminPanels`; Pipeline Builder model helpers in `musicForgePipelineBuilderModel.ts`. Сырой Comfy graph JSON и админка `generation_types` — вне scope.

### Config fail-closed (Phase 0)

| Ситуация | Поведение |
| --- | --- |
| Нет `status=active` или bundle неполный | `get_active` → ошибка; `GET /capabilities` и `POST /runs` → **503** `music_forge_config_unavailable` |
| Activate incomplete draft | **422** `music_forge_config_activation_invalid` + `reasons[]`; транзакция не flip status |
| Exception в `execute_run` | Persist `failed` на сессии execute; при сбое — `persist_run_terminal_failed_isolated`; Celery beat reconcile orphans → `stage=reconcile_orphan` |

### Billing and quotas (create path)

- Before durable run insert, backend sums `cost_credits` for forge blueprint/lyrics/style type keys plus active `product_settings.audio_type_key` (default **`music_generator_forge_audio`**, constant `MUSIC_FORGE_AUDIO_TYPE_KEY`) and calls `BillingService.check_limits`. Insufficient credits → **402**.
- Optional `max_completed_runs_per_day` / `max_completed_runs_per_month` from active product settings count completed runs in rolling 24h / 30d windows. Exceeded → **429**. Users with role `admin` or `emperyworld_admin` bypass run budget (not credit preflight).

## Failure / Edge-Case Matrix

| Axis | Behavior |
| --- | --- |
| Offline-mode | Нет active config → **503**. Breaker open (Comfy/UGS) → **503** `music_forge_upstream_unavailable`. Celery enqueue fail → durable run `failed` + 503. Worker exception → terminal `failed` (+ isolated persist / orphan reconcile). Credit preflight → 402; run budget → 429. **Comfy SPOF:** единственный audio runtime — ComfyUI на gpu141 `.141:31003` (см. §Comfy SPOF ниже). |
| Dual-flag / conflict | Public FE cannot send workflow/model flags. Admin draft: несколько `is_default` → PATCH нормализует к одному; activate hard-gate. Sampler: lane.sampler > scope defaults (style не источник knobs). SSE and poll: poll is backoff fallback only. Run budget: product_settings non-null; null = unlimited. Admin bypass budget only, not credit preflight. Admin list: envelope only — bare array is client hard error. |
| Permission / access boundary | OAuth required. Run fetch/SSE/cancel/feedback scoped by `user_id`. Admin `/music-forge/admin/*` → `admin` / `emperyworld_admin`. Smoke admin без `MUSIC_FORGE_SMOKE_TOKEN` → fail (не skip). |
| Regression command | `bash docker/scripts/music-forge-ownership-gate.sh`; host pytest `-k music_forge` (incl. `test_music_forge_observability_prometheus`); FE `pnpm exec vitest run src/pages/Admin/musicForge/__tests__/ src/pages/MusicForge/__tests__/ src/services/musicForge/__tests__/musicForgeApi.test.ts`; Mobile `MusicForgeApiContractsTest` + `MusicForgeMobileSupportTest`; `pnpm run openapi:pilot:music-forge`; smoke `MUSIC_FORGE_SMOKE_TOKEN=… bash docker/scripts/music-forge-stack0-smoke.sh` (без token → exit 1); optional Playwright `DESKTOP_SHELL_E2E_RUN=1` `e2e/music-forge-desktop-smoke.spec.ts`. |

## Comfy SPOF (audio upstream)

**Fact:** MusicForge audio stage calls UGS → ComfyUI. Living Comfy is **only** on gpu141 **`.141:31003`** ([PRODUCTION-TOPOLOGY-STATE.md](../platform/PRODUCTION-TOPOLOGY-STATE.md) §Current; ops [LAN-WORKERS-141.md](../platform/docker-re_doc/LAN-WORKERS-141.md)). There is **no** second audio provider in product scope.

| Symptom | Likely cause | Operator action |
| --- | --- | --- |
| Admin probe fail / runs stuck on `audio_comfy` | Comfy down, OOM, wrong `COMFYUI_URL` | `curl -sf http://192.168.1.141:31003/system_stats`; fix env Config Plane; restart living Comfy on gpu141 |
| Create/execute **503** `music_forge_upstream_unavailable` | Redis circuit breaker open (Comfy/UGS) | Check breaker counters / API logs `[STEP]`; heal Comfy; wait cooldown or clear breaker per ops |
| User sees failed step on render | Worker timeout / CUDA OOM while SFT XL loads | `nvidia-smi` on `.141`; free VRAM (other heavy jobs); retry run |

User-visible honesty: FE maps 503 / failed terminal via `mapMusicForgeApiError` — do **not** fake a successful track.

## Operator Smoke

Stack0: `MUSIC_FORGE_SMOKE_TOKEN=<admin JWT> bash docker/scripts/music-forge-stack0-smoke.sh` — **токен обязателен** (Bearer на capabilities **с `modes[]` + `default_mode_key`** + admin config envelope + overview + probe; global auth middleware). Без токена → exit 1. Token via SPA SSO helper: `ELITEEW_TEST_USER_PASSWORD=… pnpm --dir shared/web/frontend exec node scripts/get-access-token-sso.mjs` (admin user).

1. Open desktop app `MusicForge`.
2. Enter a concrete short idea, for example `Курага во дворе без пафоса`.
3. Start generation and watch backend steps progress through blueprint, lyrics, style and render.
4. Cancel mid-run → cancelled banner + form unlocked.
5. After completion, play the result; expand lyrics; like/dislike with reason chip; confirm library CTA.
6. Simulate failure (staging) → failed step message + terminal banner + retry path.
7. Narrow desktop window (~360px) — primary actions reachable; `prefers-reduced-motion` — no essential info in pulse-only states.

MVP acceptance is not only green tests: one real generated song must be listened to and judged better than the bad baseline generations before calling this production-ready.

## Deployment Note 2026-06-28 / baked 2026-06-29

MusicForge MVP first landed on prod-core stack0 **dev-bind** with deploy id `1782602176773-2fetujiv2k`.

**Historical baked release (line A, 2026-06-29):** tag `prod-baked-20260629-0246`, deploy id `1782665161446-xdnhha2q9g`, `eeprodline status` → `state=baked`. At that release, Comfy was still on `.136:31003`; current living endpoint is `.141:31003`. Machine checks also covered `/music-forge`, the SPA chunk, and three `music_forge_*` tables.
Database migrations were applied on stack1 Postgres and verified:

- `app-music-forge|MusicForgeApp|is_factory=true|is_featured_new=true` (migration `20260628_06_music_studio_single_desktop_app`, 2026-06-28)
- `app-music-generator` / `app-music-evolution`: `is_factory=false` (legacy catalog ids; SPA redirects to MusicForge)
- access groups: `Default`, `Standart`
- UGS type keys `music_generator_forge_*` active; LLM type keys use provider `llama`, audio uses `comfyui`

Rollback evidence kit for the DB registration phase: `/home/owned/db-upgrade-backups/20260627T231538Z-music-forge-mvp`.

End-to-end prod smoke:

- run id: `1ea786d7-28be-4234-97ad-7b1f3ba3672d`
- UGS request id: `c11d003b-1e2a-42f1-94b7-7fdc1b6e0f48`
- content id: `bc5ba081-50ef-4804-897b-b1da7af2da98`
- result: all 8 backend steps completed; content row `audio/mpeg`, `2408812` bytes, private, `source_service=music_forge`.

Follow-up anti-wail smoke:

- Bad runs `dbfae4a5-f716-4daf-aecf-ea7ed0086700` and `08a59cfd-d89e-4394-bf95-5a2790d04d95` failed because `denoise=0.98` was invalid for the clean ACE SFT render graph.
- Fixed backend style capsule to emit `denoise=1.0` while keeping anti-wail `negative_prompt`, calmer LM temperature/top-k/min-p and neutral vocal hint.
- Verified post-fix run `b9ed68f2-68bb-4130-8041-630b4593be07`: all 8 steps completed, content `37330da1-9511-4d29-8ff1-73dc5345a7e8`, `audio/mpeg`, `2408433` bytes, `ffprobe duration=60.000000`.
