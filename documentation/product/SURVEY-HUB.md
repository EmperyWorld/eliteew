# Survey Hub (Опросы)

Product canon for interactive surveys on the EliteEW desktop: admin authoring, explicit audience targeting, automatic completion rewards, GAF announcements, and results analytics.

## Scope

| Surface | Path / id |
|---------|-----------|
| Desktop app | `SurveyHubApp` · catalog `app-survey-hub` |
| User API | `/api/v1/product-desktop/surveys/*` |
| Admin API | `/api/v1/product-desktop/admin/surveys/*` |
| Unified Admin | `?section=surveys` → `SurveysAdminSection` |
| Migration | `shared/api/migrations/applied/20260703_02_survey_hub.sql` |

## Product rules

- **One completion per user per survey** — `UNIQUE (survey_id, user_id)` on `survey_responses`.
- **Rewards on first successful submit only** — configured on the survey (`reward_json`: `ugs_credits`, `ew_balance`, `web_search_coins`); idempotent via `reward_granted_json`.
- **Audience is explicit** — admin assigns access groups and/or users; publish blocked when both lists are empty (not “all users” by default).
- **Audience modes:** `groups_only`, `users_only`, `groups_or_users`, `groups_and_users`.

Unlike [Feedback Hub](FEEDBACK-HUB.md), rewards are **automatic on submit**, not manually granted when an admin closes a ticket.

## Backend layout

| Module | Role |
|--------|------|
| `api/models/surveys.py` | ORM |
| `api/services/surveys/survey_audience_service.py` | Eligibility |
| `api/services/surveys/survey_validation.py` | Answer validation |
| `api/services/surveys/survey_reward_service.py` | UGS / EW / coins grant |
| `api/services/surveys/survey_analytics_service.py` | Admin aggregates |
| `api/services/surveys/survey_api_schemas.py` | Pydantic request/response models |
| `api/services/surveys/survey_router_helpers.py` | Load/serialize/persist helpers |
| `api/routers/product_desktop_surveys.py` | Facade router (composes user + admin) |
| `api/routers/product_desktop_surveys_user.py` | User HTTP routes |
| `api/routers/product_desktop_surveys_admin.py` | Admin HTTP routes |
| `api/tasks/survey_gaf_notify.py` | Celery GAF batch on publish |

## GAF on publish

After `POST …/publish`, Celery task `survey_gaf_notify_for_survey` sends a system-account message to each eligible user without a row in `survey_gaf_deliveries`.

Metadata:

```json
{
  "kind": "survey_announcement",
  "survey_id": "<uuid>",
  "title": "<survey title>",
  "open_app_component": "SurveyHubApp",
  "deep_link": { "surveyId": "<uuid>" }
}
```

Desktop GAF bubble: `GafChatSurveyAnnouncementBlock` → `requestOpenDesktopApp({ appComponent: 'SurveyHubApp', initialPayload: { surveyId } })`.

## Frontend layout

| Path | Role |
|------|------|
| `features/surveys/desktop/SurveyHubDesktopApp.tsx` | User shell + runner |
| `features/surveys/desktop/surveyHubUserUtils.ts` | Sort/filter helpers (deadline, completed_at) |
| `features/surveys/desktop/surveyHubHistorySession.ts` | Session prefs (history search + sort) |
| `features/surveys/desktop/surveyHubLayoutTokens.ts` | Premium layout tokens (hero, cards, KPI) |
| `pages/Admin/surveys/SurveyAdminPublishedToolbar.tsx` | Published deadline + GAF + archive |
| `pages/Admin/SurveysAdminSection.tsx` | Admin orchestrator (catalog/editor/audience/results tabs; **≤800L**) |
| `pages/Admin/surveys/SurveyAdminCatalogPanel.tsx` | Admin catalog tab (list, KPI, create/duplicate) |
| `pages/Desktop/services/productDesktopSurveysApi.ts` | HTTP client |
| `pages/Desktop/services/productDesktopSurveysOpenApi.ts` | OpenAPI SSOT bridge (Wave 3) |
| `pages/Desktop/services/productDesktopAssistantOpenApi.ts` | Assistant REST OpenAPI bridge (SSE stays hand in `assistant.ts`) |
| `i18n/locales/*/surveys.json` | Copy |

### User UX (premium desktop)

- **Hero + KPI strip:** available / completed counts and earned rewards summary from `GET /surveys/summary`.
- **Next action:** `DesktopProductNextAction` highlights the first available survey (single primary CTA).
- **Runner:** step counter, accessible progress bar, review cards, success celebration; scale/NPS bounds match server defaults (scale 1–5, NPS 0–10).
- **Client validation:** `surveyRunnerValidation.ts` mirrors `survey_validation.py` (yes/no `false` is valid, text `max_length`, full review submit guard via `validateAllSurveyAnswers`).
- **States:** skeleton loading, `DesktopAppEmptyState` with hints, `DesktopAppErrorState` + retry on list/detail failures.

### Admin editor (wave 2)

- Client validation before save: non-empty title/prompt, unique keys, choices for choice types.
- `scale` / `nps` questions persist `options_json` bounds (1–5 / 0–10) matching `survey_validation.py`.
- Inline error highlight on invalid question cards.

### GAF announcement (wave 2)

- `GafChatSurveyAnnouncementBlock`: accent card, survey title from metadata, primary CTA to open `SurveyHubApp`.

### Deep link + results (wave 3)

- GAF / `initialPayload.surveyId` opens runner; if survey already completed, loads `responses/me` and shows read-only answers.
- `SurveysAdminResultsPanel`: skeleton loading, retry on error, chart cards per question.

### Admin wave 4

- `SurveyAdminSortableQuestionsEditor`: dnd-kit reorder; `sort_order` follows list order on save.
- `SurveyAdminPublishChecklist`: title, questions, audience, preview, rewards on Audience + publish bar.
- CSV export: client-side paginated fetch from `GET …/results/responses` → download `{title}-responses.csv`.

### Admin wave 5

- Results toolbar: **Charts** / **Responses** toggle; paginated `SurveyAdminResponsesTable` with readable answers.
- CSV columns include `username` and `email` via admin user lookup.
- Published surveys: `POST …/gaf-notify?mode=undelivered|incomplete` — retry missed announcements or remind non-completers (Celery).

### Admin wave 6

- **GAF template editor** (draft): `gaf_notify_body_template` textarea in editor; empty → default Celery body on publish/resend.
- **Results KPI hero:** `SurveyAdminResultsKpiHero` — eligible users, completed count, completion rate from summary API.
- **Date filter:** `GET …/results/responses?submitted_from=&submitted_to=` (ISO dates); UI on Responses tab; CSV export respects active filter.

### Admin wave 7

- **GAF preview:** `SurveyAdminGafNotifyPreview` in draft editor — live preview of custom vs default Celery body (`surveyAdminGafNotify.ts` mirrors server default).
- **Responses sort:** `submitted_sort=asc|desc` on `GET …/results/responses`; toggle in table toolbar; CSV export uses active sort.

### Admin AI create

- Tab **AI create** / catalog button **Create with AI**.
- `POST /admin/surveys/ai/draft` — `mode=create|refine`; stack2 LLM via `unified_settings.llama_url` (`response_format: json_object`).
- Env override: `SURVEY_AI_LLM_MODEL` (default `default_ai_model`).
- Flow: brief → AI draft → manual edit + GAF preview → optional refine → audience → **Create survey draft** (existing CRUD).

### UX wave 8 (user + admin polish)

- **User:** next-action card shows duration + rewards; list cards show `~N min`; runner reward preview strip; «all caught up» when no available surveys; history load error + retry.
- **Admin:** rich catalog cards (`question_count`, audience size, responses); workflow strip (editor → audience → results); empty catalog CTA to AI create; `question_count` on admin list API.

### UX wave 9 (discovery + runner journey)

- **User runner:** step dots, Enter-to-continue, tap review card → jump to question; keyboard/a11y labels.
- **User list:** history search; `closes_at` / `completed_at` badges on cards.
- **Admin catalog:** KPI strip, title search, status chips, search-empty state.
- **Admin audience:** searchable group/user picker (shared with AI create); «Continue to audience» from editor; published response hint on workflow strip.

### UX wave 10 (draft publish journey)

- **Admin sticky bar:** draft editor/audience tabs show sticky publish bar with readiness chip (`N/5`), blocked reason, **Preview as user**, and **Publish**.
- **User preview:** modal runs `SurveyRunner` in `previewMode` from unsaved editor state (no API submit).
- **Workflow strip:** draft meta shows question count, publish-check progress, eligible preview count, and `0%` completion once audience preview is known; published surveys show completion rate.

### UX wave 11 (deadline + duplicate draft)

- **Editor:** optional `closes_at` datetime-local field; clear on save sends `null` (PATCH uses `model_fields_set`).
- **Catalog:** per-card **Duplicate as draft** (copies questions, audience, rewards, GAF template, deadline); **Open** action; deadline shown on card meta.
- **API:** `admin_patch_survey` clears `closes_at` when client explicitly sends `null`.

### UX wave 12 (published lifecycle + user deadline)

- **API:** published surveys accept PATCH with `closes_at` only (extend/clear deadline); archived surveys reject edits.
- **User runner:** deadline badge in survey header (`SurveyUserDeadlineBadge`).
- **Admin:** `SurveyAdminPublishedToolbar` — save/clear deadline, GAF queue, archive (see wave 14 for GAF merge).

### UX wave 14 (published toolbar merge + deadline sort)

- **Admin:** GAF undelivered/remind actions merged into `SurveyAdminPublishedToolbar`; toolbar visible on any tab when a published survey is selected.
- **User:** available surveys and hero «next» pick sorted by soonest active deadline (`sortAvailableSurveysByDeadline`).
- **API lock:** `published_survey_patch_allowed` in `survey_api_schemas.py`; pytest `test_survey_admin_patch_published.py`.

### UX wave 15 (history sort + published PATCH HTTP)

- **User:** history list sorted by `completed_at` newest first (`sortCompletedSurveysByDate`); API `filter=completed` applies `sort_completed_survey_items`.
- **API lock:** HTTP contract tests in `test_survey_admin_patch_http.py` (200 closes_at, 409 title, 409 archived).

### UX wave 16 (history sort toggle)

- **User:** history toolbar toggle newest/oldest (`historyNewestFirst` + `sortCompletedSurveysByDate`); matches Feedback Hub sort control pattern.

### UX wave 17 (history sort session persistence)

- **User:** `surveyHubHistorySession.ts` persists `newestFirst` in `sessionStorage` for the browser tab session; invalid JSON falls back to newest-first.

### UX wave 18 (history search session persistence)

- **User:** same session module persists `searchQuery`; partial writes merge so sort and search prefs do not overwrite each other.

### UX wave 19 (history filters reset)

- **User:** reset control when search or non-default sort is active; `clearSurveyHubHistoryPrefs()` restores defaults and clears session key.

### Measure wave 20 (program closeout)

- **Lock:** `surveyHubUxContracts.test.ts` — source contracts for deadline sort, history session/reset, published toolbar GAF.
- **Audit snapshot (post waves 9–19, cause-first):** ux-user ~19, ux-admin ~19, tests ~17, arch ~17 (router split done), overall ~18. Further arch gains need admin FE shell split if `SurveysAdminSection.tsx` grows past cap.

### Arch wave 21 (admin shell split)

- **Cause:** `SurveysAdminSection.tsx` exceeded 800L cap (934L) with inline catalog list.
- **Extract:** `surveys/SurveyAdminCatalogPanel.tsx` — catalog tab KPI, toolbar, list cards, create/duplicate actions.
- **Result:** `SurveysAdminSection.tsx` **792L** (orchestrator + editor/audience/results tabs).
- **Lock:** `surveyHubUxContracts.test.ts` — `SurveyAdminCatalogPanel` import + section ≤800 lines.
- **Regression bundle (narrow):**

```bash
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest \
  tests/test_survey_admin_publish.py \
  tests/test_survey_admin_patch_published.py \
  tests/test_survey_user_list_sort.py \
  tests/test_survey_validation.py -q --tb=short
bash docker/scripts/run-stack0-api-tests.sh tests/test_survey_admin_patch_http.py -q --tb=short
cd shared/web/frontend && pnpm exec vitest run \
  src/features/surveys/desktop/__tests__ \
  src/pages/Desktop/utils/__tests__/desktopSurveyHubRegistry.test.ts
```

### UX wave 22 (premium survey runner)

- **Cause:** Runner question/review surfaces used flat progress strip and inline action rows — weak hero context and no single primary CTA above the fold.
- **Change:** `SurveyRunnerHero.tsx` (progress, reward chip, trust note, keyboard hint in `<details>`); `surveyHubLayoutTokens.ts` runner tokens; `SurveyRunner.tsx` sticky `SH_RUNNER_ACTION_BAR_CLASS`; `SurveyQuestionStep.tsx` premium choices/scale/text.
- **Lock:** `surveyHubUxContracts.test.ts` — wave 22 premium runner contracts.
- **Regression (narrow):**

```bash
cd shared/web/frontend && pnpm exec biome check --write \
  src/features/surveys/desktop/SurveyRunner.tsx \
  src/features/surveys/desktop/SurveyRunnerHero.tsx \
  src/features/surveys/desktop/SurveyQuestionStep.tsx \
  src/features/surveys/desktop/surveyHubLayoutTokens.ts
cd shared/web/frontend && pnpm exec vitest run \
  src/features/surveys/desktop/__tests__/surveyHubUxContracts.test.ts
```

### UX wave 23 (runner interaction polish)

- **Cause:** Runner allowed «Далее» before valid required answers; scale/NPS only had slider; choices lacked selected affordance; hero trust note cluttered every step.
- **Change:** `canProceedCurrent` gates primary CTA; scale quick-pick chips + checkmarks on choices; char counter; step badge; review-only trust note; scroll-to-top on step change; reward chips on success.
- **Lock:** `surveyHubUxContracts.test.ts` wave 23 contracts.

### UX wave 24 (trust + navigation polish)

- **Cause:** Accidental cancel lost partial answers silently; step dots too small; read-only/history view flat; list did not signal urgent deadlines.
- **Change:** `SurveyRunnerExitConfirm` portaled dialog; numbered step pills (≤12); `primaryHintRequired`; hero `answeredCount`; auto-focus on step; premium read-only cards; urgent list card border; named success copy.
- **Lock:** `surveyHubUxContracts.test.ts` wave 24 contracts.

### UX wave 25 (session resume)

- **Cause:** F5/tab close lost partial answers; exit confirm only guarded explicit cancel.
- **Change:** `surveyRunnerSession.ts` (`sessionStorage` per surveyId); resume banner in runner; exit confirm notes tab-local retention; clear on submit/confirmed exit.
- **Lock:** `surveyRunnerSession.test.ts` + UX contracts wave 25.

### UX wave 26 (keyboard + a11y)

- **Cause:** Enter-only shortcut; no number-pick for choices; step changes not announced.
- **Change:** `SurveyQuestionStep` number keys 1–9/0; arrow keys on scale/NPS when focused; `aria-live` region in runner; `aria-disabled` on future step dots.
- **Lock:** `surveyQuestionStepKeyboard.test.tsx` + UX contracts wave 26.

### UX wave 27 (review hardening)

- **Cause:** Review did not surface incomplete answers before submit.
- **Change:** `SurveyRunnerReviewPanel.tsx` with `collectSurveyReviewIssues`, warning borders, incomplete summary.
- **Lock:** UX contracts wave 27 + validation test for `collectSurveyReviewIssues`.

### UX wave 28 (welcome intro)

- **Cause:** Runner jumped straight to Q1; workspace header duplicated context.
- **Change:** `SurveyRunnerIntro.tsx` with single Start CTA; skip intro on session resume; `SurveyHubDesktopApp` runner header title-only.
- **Lock:** UX contracts wave 28.

### UX wave 29 (runner arch split)

- **Cause:** `SurveyRunner.tsx` orchestrator growth toward 800L cap.
- **Extract:** `SurveyRunnerActionBar`, `SurveyRunnerSuccessPanel`, `SurveyRunnerReadOnlyPanel`, `SurveyRunnerReviewPanel`; orchestrator ≤400L.
- **Lock:** UX contracts wave 29 line-count guard.

### UX wave 30 (question-type depth)

- **Cause:** Generic NPS/scale/text controls without semantic affordances.
- **Change:** NPS detractor/passive/promoter labels; `DesktopAppInput` for `text_short`; optional `min_label`/`max_label` on scale from `options_json`.
- **Lock:** `surveyRunnerValidation.test.ts` NPS/endpoint helpers + UX contracts wave 30.

### Arch wave 13 (router split)

- Split god-router into `survey_api_schemas.py`, `survey_router_helpers.py`, `product_desktop_surveys_user.py`, `product_desktop_surveys_admin.py`; facade `product_desktop_surveys.py` composes both routers (import path unchanged for `product_desktop.py`).

## Failure / edge cases

| Axis | Behavior |
|------|----------|
| Offline submit | UI stays incomplete; retry POST |
| Double submit | 409 from API; no second reward |
| Empty audience at publish | 422 |
| GAF partial failure | Per-user ledger + Celery retry; skipped on duplicate row |
| Permission | User routes require desktop user; admin routes `require_admin_user` |

## Verification

Prefer the **narrow bundle** in Measure wave 20. Broad `-k survey` on host venv may collect unrelated broken modules.

```bash
cd shared/web/frontend && pnpm exec vitest run src/features/surveys src/pages/Desktop/utils/__tests__/desktopSurveyHubRegistry.test.ts src/pages/Desktop/components/GAFChat/__tests__/gafChatSurveyAnnouncementMeta.test.ts
```

## Related

- [DESKTOP-API-AND-APPS.md](desktop/DESKTOP-API-AND-APPS.md) — app matrix
- [FEEDBACK-HUB.md](FEEDBACK-HUB.md) — peer product (manual reward on close)
