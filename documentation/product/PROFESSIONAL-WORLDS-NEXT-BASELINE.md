# Professional Worlds — Next expansion baseline (implementation checkpoint)

This note records the **code/doc baseline** for Professional Worlds and the **status matrix** after OpenAPI adoption (waves 2–24), post-adoption UX (waves 25–28), interface audit 20+ program (waves 0–8), realtor UX redesign (2026-07-02), and the **Fast-Track Multi-Vertical Refactor (2026-07-18)**. **Product canon:** [`PROFESSIONAL-WORLDS.md`](PROFESSIONAL-WORLDS.md). Vertical authoring: [`PROFESSIONAL-WORLDS-VERTICAL-TEMPLATE.md`](PROFESSIONAL-WORLDS-VERTICAL-TEMPLATE.md).

> Restored to living canon on 2026-07-18 (was soft-retired under `trash/`). Chronology: chat + `git log` — monthly worklog journals are retired (`documentation/worklog/README.md`).

## Baseline — primary paths

| Area | Paths |
|------|--------|
| Models | `shared/api/models/professional_worlds.py` |
| Schemas | `shared/api/schemas/professional_worlds.py` |
| User routers | `shared/api/routers/professional_worlds.py*.py` (split phase 1–5) |
| Admin router | `shared/api/routers/professional_worlds_admin.py` |
| Services | `shared/api/services/professional_worlds/` |
| Migrations | `shared/api/migrations/applied/20260505_01_professional_worlds.sql` … `20260529_02_pw_realtor_runtime_labels_ru.sql` (PW `202605*` inventory — § Data rollback in PROFESSIONAL-WORLDS.md) |
| Product doc | `documentation/product/PROFESSIONAL-WORLDS.md` |
| Smoke runbook | `documentation/product/PROFESSIONAL-WORLDS-SMOKE-STACK0.md` |
| Frontend desktop | `shared/web/frontend/src/features/professional-worlds/desktop/**` |
| Frontend admin | `shared/web/frontend/src/features/professional-worlds/admin/**` |

## Next slice — platform pack (earlier pass)

- **Pack service**: `pack_service.py` (validation, import jobs, releases, rollouts, epoch bump).
- **Runtime**: photo presets omit `prompt_template`; `playbooks`, `config_version_hash`, `runtime_epoch`, `active_release_id`; rollout-aware release resolution.
- **Admin**: **`require_emperyworld_admin`** for pack import confirm, publish, rollbacks, rollout mutations.
- **User APIs**: vertical activations, multi runtime-config, realtor leads; **Realtor Pro** extended REST — see `realtor_pro.py` and `/professional-worlds/realtor/*`.
- **Tests**: `shared/api/tests/test_professional_worlds_pack.py`, router split, snapshot, deal linkage.

## Fast-Track Multi-Vertical (2026-07-18) — surgical scope

Decisions: **1A** (four gods + immediate deps only) + **2A** (media facade over stable `/realtor/.../media` URLs; no schema/URL migration).

| Target | Status |
|--------|--------|
| `RealtorObjectsWorkspacePanel.tsx` → `realtorObjects/*` + hooks ≤500 LOC | **Done** (barrel 30 LOC) |
| `desktop/api.ts` → `desktop/api/*` barrel | **Done** (barrel 31 LOC) |
| `realtor_pro.py` → `realtor_pro_*.py` domain modules + barrel | **Done** (barrel 107 LOC) |
| `admin_service.py` → `admin_*` mixin modules + facade | **Done** (facade 43 LOC) |
| MediaWorkbench `targetId` + `contextType` + `media_target_adapter.py` | **Done** (HTTP routes unchanged; workbench UI shell still large — follow-up) |
| Consultant seed viability (`professionalVerticalTemplate` + mediaContext null) | **Done** |
| `professionalWorldsApiZod.ts` → thin barrel + `desktop/zod/*` domain modules | **Done (Wave 2 FE residual Cause, 2026-07-31)** — public import path unchanged; every domain module ≤800 LOC |
| `playbook_service.py` / `pack_service.py` | **Follow-up** — backend scope remains |
| HTTP `/realtor/properties/{id}/media…` rename | **Out of scope** — realtor path remains source of truth |

LOC gate (this sprint): each new primary module and the four entry gods after split **≤500 LOC**.

## Doc / product status matrix (2026-07-02; Fast-Track notes 2026-07-18)

| Theme | Status |
|-------|--------|
| Admin modules / schemas / AI / presets | **Implemented** |
| Object intake + media enhancement | **Implemented** — media facade (entity-agnostic FE) over realtor SoT routes |
| Router split (phase 1–5) | **Done** — aggregate `professional_worlds.py` ~47 lines |
| OpenAPI pilot + Zod adoption (waves 2–24) | **Done** — write paths via `desktop/api.ts` barrel → `desktop/api/*`; Zod schemas/parsers split into `desktop/zod/*` behind the stable `professionalWorldsApiZod.ts` barrel |
| CRM mesh + cross-panel deep-links | **Done** (2026-05-27) |
| Post-adoption UX (waves 25–28) | **Done** — write forms, edit/update, toasts, playbook Resume, deploy gate |
| Vitest desktop suite | **385 tests** (63 files, 2026-07-03+) — `pnpm exec vitest run src/features/professional-worlds/` |
| Vertical pack v2 (versions, jobs, releases, rollouts) | **Done** — backend + `PacksTab` / `RolloutsTab` admin UI |
| Realtor Pro (12 `realtor_*` panels) | **Mostly done** — backend split into `realtor_pro/*`; panels already under `realtorPro/*` |
| Desktop UI layout | **Done (2026-05-23)** — `desktop/layout/*` |
| Admin UI chrome | **Done (Wave 3, 2026-08-05)** — New World `pages/Admin/ui`; Old World `adminUiShared` trashed |
| Playbooks runner (SSE multi-step) | **Done (2026-05-27)** — `ProfessionalPlaybooksRuntimePanel`, Resume, `PlaybooksWorkspacePanel`, `PlaybooksRegistryPanel` |
| Evaluations dashboard | **Implemented** — `EvaluationsTab.tsx` (datasets, runs, human notes) |
| Media batch + brand kit | **Implemented** (batch + brand kit) + Fast-Track media facade |
| Cross-app draft lifecycle API | **Done** — waves 42–50; all destinations report via client; refresh polls EWRP/Site Studio |
| Consultant vertical (core seed) | **Seed + template viable** — see `PROFESSIONAL-WORLDS-VERTICAL-TEMPLATE.md`; listing/media realtor-only |
| **Interface audit 20+ program** | **Done (Wave 8, 2026-07-02)** — scorecard lived under product docs historically; re-audit after Fast-Track for arch |
| **Realtor UX redesign** | **Done (2026-07-02)** — user-language Objects/Photos path, grouped sidebar, advanced media disclosure |
| **Visible normal-state redesign** | **Done (2026-07-02)** — hero, progress rail, trust note on Overview |
| **Ops / quota admin (Wave 7)** | **Done** — `OpsTab`, `ops_metrics_service.py`, `quota_service.py` |

## Interface audit 20+ program (waves 0–8)

| Wave | Summary |
|------|---------|
| 0 | Interface perfection contract — terminal SSE, Stop waiting → Recent runs, honest history load |
| 1 | Journey state map — `ProfessionalWorldsStatePanel`, localized API errors |
| 2 | Admin/media shared tokens — New World `pages/Admin/ui`; media overlay tokens |
| 3 | Outcome + progressive nav — `deriveNavProgressStage()`, outcome cards |
| 4 | Visible normal-state redesign — hero, action cards, grouped sidebar |
| 5 | Realtor UX — simplified Objects/Photos, realtor desk IA |
| 6 | A11y / responsive / mobile embedded proof |
| 7 | Ops metrics + quota signals in admin |
| 8 | Scorecard doc, HTTP RBAC matrix (publish/rollout/module assign), data rollback notes, baseline sync |

Full dimension table and regression commands: product audit via `/eliteew-product-audit professional-worlds` (scorecard file may be soft-retired; living hub remains [`PROFESSIONAL-WORLDS.md`](PROFESSIONAL-WORLDS.md)).

## OpenAPI adoption (closed)

Waves 2–24 documented in [`PROFESSIONAL-WORLDS.md`](PROFESSIONAL-WORLDS.md) § OpenAPI pilot adoption. Key artifacts:

- `shared/web/frontend/openapi/pilot/professional-worlds.openapi.json`
- `openapi/pilot-professional-worlds-write-path-exceptions.json`
- `openapi/pilot-professional-worlds-crux-paths.json`
- Vitest: `professionalWorldsApi.adoption.test.ts`, `professionalWorldsPilot.contract.test.ts`, `professionalWorldsApi.zodBoundary.test.ts`

## Post-adoption UX (closed waves 25–28)

| Wave | Summary |
|------|---------|
| 25 | Build + Vitest 165/165 + deploy id verify |
| 26 | Write forms, `formatProfessionalWorldsApiError`, Resume API/UI, stack0 smoke script |
| 27 | `useProfessionalToasts`, document/campaign edit, PlaybooksRegistryPanel, Vitest 209/209 |
| 28 | Toast coverage (communications, objections, channels, deals, playbooks), Vitest 211/211 |

Session chronology: chat + `git log` (worklog journals retired — see `documentation/worklog/README.md`).

## Phase 1 — staged audit (admin service vs routes vs admin UI)

Работа по плану идёт **по фазам**; здесь зафиксирован снимок «фаза 1: аудит контрактов» без расширения кода.

### `ProfessionalWorldsAdminService` (registry CRUD)

Покрыто сервисом и обычно есть HTTP в `professional_worlds_admin.py`: verticals (CRUD/disable), modules (CRUD), vertical↔module assignment, schemas (create/update/activate), AI actions (CRUD + test), photo presets (CRUD + test), integrations (patch), audit list, **export vertical pack**.

**В сервисе нет** (и это нормально — другие модули/роуты): версии паков, import jobs, releases, rollouts, playbook CRUD, eval datasets/runs, operator notes, analytics/billing — см. `pack_service.py` и будущие админ-роуты.

### Admin frontend (`admin/api.ts`)

**Есть вызовы:** overview, verticals, modules, assignments, schemas, AI actions, photo presets, integrations, audit snapshot; отдельные мутации: create module, assign module, create AI action, test AI action, patch integration.

**Нет на клиенте (следующий этап UI):** pack versions, POST diff, import jobs dry-run/confirm, release approve/publish/rollback, rollouts list/create/patch/pause/resume, export download, расширенные фильтры audit (`risk_level`, actor из OpenAPI).

### Runtime facade и поля для фронта

`ProfessionalWorldsRuntimeService.get_config` делегирует в `ProfessionalWorldsService.get_runtime_config`: в ответе уже есть `playbooks` (публичные поля), `config_version_hash`, `runtime_epoch`, `active_release_id`; пресеты без `prompt_template`.

В **`desktop/api.ts`** сейчас запрашивается только `GET .../me/runtime-config?vertical_slug=realtor` (одна вертикаль). Типы в `desktop/types.ts` допускают опциональные `playbooks` / hash / epoch; **кэш по hash и мульти-вертикаль** — следующий этап фронта (`/me/runtime-configs` уже есть на бэке).

## Phase 1 — UGS, медиа, cross-app, OpenAPI pilot

Снимок для **долгих задач** и **интеграций**; менять поведение кода не требовалось.

### UGS / idempotency (дизайн long-running)

- Канон: `platform/docker-re_doc/UGS-IDEMPOTENCY.md` — HTTP-дубликаты (`Idempotency-Key` / `X-Idempotency-Key` или `idempotency_key` в теле на `ugs`), терминальные статусы при redelivery воркера.
- В Professional Worlds стримы, которые дергают UGS через `UnifiedGenerationService.start_generation_for_stream`, должны **прокидывать стабильный** `idempotency_key` (уже есть на части потоков: см. `_idempotency_key` / аргументы `start_generation_for_stream` в `professional_worlds.py`).
- Правило для новых эндпоинтов: тот же ключ на повторе → не плодить вторую `GenerationRequest` и не дублировать биллинг (семантика UGS).

### Image Studio / Unified Content (media enhancement)

- Вход: `content_id` Unified Content или upload → оригинал в UC.
- Обработка: общий контур **`creative_studio_utils.run_studio_ugs_generate`** (Image Studio / UGS); продуктовое описание цепочки — `PROFESSIONAL-WORLDS.md` (§ media enhancement).
- Исходящие артефакты: привязка к объекту и UC с `source_service=professional_worlds` (как в продуктовом доке).

### Cross-app drafts (EWRP, Site Studio, GAF, EWDesk)

- Сейчас: `POST /professional-worlds/realtor/properties/{property_id}/drafts/{draft_kind}` создаёт **только** `professional_artifacts` с `draft_only` / `auto_publish: false` / `auto_send: false`; виды: `ewrp`, `site-studio`, `gaf-chat`, `ewdesk`.
- **Нет** пока серверного «deep link» в целевое приложение — пользователь открывает EWRP / Site Studio / GAF / EWDesk отдельно.
- Следующие задачи: адаптеры payload, трекинг draft↔артефакт, refresh статуса.

### OpenAPI pilot (`professional-worlds`)

- Скрипт: `shared/web/frontend/scripts/openapi-extract-pilots.mjs` + `pnpm run openapi:pilot:professional-worlds`.
- **Важно:** файл `openapi/pilot/professional-worlds.openapi.json` отражает последний **`pnpm run openapi:export`** и extract; без реэкспорта пилот **устаревает**.

## Related

- [`PROFESSIONAL-WORLDS.md`](PROFESSIONAL-WORLDS.md) — runtime, Desktop layout, Admin UI, post-adoption UX.
- [`PROFESSIONAL-WORLDS-SMOKE-STACK0.md`](PROFESSIONAL-WORLDS-SMOKE-STACK0.md) — operator smoke.
- [`PROFESSIONAL-WORLDS-PACK-V2-CONTRACT.md`](PROFESSIONAL-WORLDS-PACK-V2-CONTRACT.md) — pack v2 manifest contract.
- [`PROFESSIONAL-WORLDS-VERTICAL-TEMPLATE.md`](PROFESSIONAL-WORLDS-VERTICAL-TEMPLATE.md) — second vertical authoring.
- [`../worklog/README.md`](../worklog/README.md) — worklog retired stub.
- `platform/docker-re_doc/UGS-IDEMPOTENCY.md` — long-running jobs.
