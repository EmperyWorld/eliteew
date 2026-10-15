# Assistant — админка (operator UI)

**Статус:** Канон
**Обновлено:** 2026-07-23 (Prompts + Users admin; prompt blocks PG)
**Программа админки:** **5 из 5 — завершена** (roadmap ниже)

**Связано:** `documentation/plans/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]* §7, [EWA-COMPANION-ADMIN-WRITE-GATING.md](EWA-COMPANION-ADMIN-WRITE-GATING.md) (этап 1), [EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md](EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md) (этап 2), [EWA-COMPANION-ADMIN-SETTINGS-NAVIGATION.md](EWA-COMPANION-ADMIN-SETTINGS-NAVIGATION.md) (этап 3), [EWA-COMPANION-ADMIN-SMOKE-STACK0.md](EWA-COMPANION-ADMIN-SMOKE-STACK0.md) (этап 4), [EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md](EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md) (этап 5)

## Где открыть

1. Войти под пользователем с ролью **`admin`** или **`emperyworld_admin`**.
2. Админка продукта → боковое меню → **«EWA — спутник»** (`ewaCompanion` в `UnifiedAdminPage`).
3. **Семь вкладок:** **Tools**, **Action workflows**, **Chat workflows**, **Task runs (debug)**, **Prompts**, **Users**, **Настройки / Settings** (`tools` | `actionWorkflows` | `chatWorkflows` | `taskRuns` | `prompts` | `users` | `settings` в `EwaCompanionAdminPanel.tsx`).

**Код UI:** `shared/web/frontend/src/features/ewa/admin/EwaCompanionAdminPanel.tsx`, `EwaCompanionActionWorkflowsTab.tsx`, `EwaCompanionToolsTab.tsx`, `EwaCompanionTaskRunsTab.tsx`, `EwaCompanionPromptsTab.tsx`, `EwaCompanionUsersTab.tsx`, `EwaCompanionSettingsTab.tsx`, `ewaCompanionAdminMeta.ts`, `ewaCompanionAdminWriteGate.ts`, `ewaCompanionWorkflowTemplate.ts`, `ewaCompanionWorkflowEditorState.ts`
**HTTP-клиент:** `ewaCompanionAdminApi.ts`
**i18n:** namespace `desktopUi.ewaCompanionAdmin` в `src/i18n/locales/{ru,en}/desktopUi.json`

## Почему вкладки могут быть «пустыми»

До 2026-05-22 Action/Chat вкладки при ошибке API показывали **пустую таблицу без текста** (ошибка была только на Tools). Сейчас все три вкладки показывают баннер с причиной.

| Симптом | Вероятная причина | Что сделать |
|---------|-------------------|-------------|
| Красный баннер «включите EWA_COMPANION_ADMIN_ENABLED» | Флаг `0` в PG | Вкладка **Настройки** → `EWA_COMPANION_ADMIN_ENABLED=1` (source of truth — БД, не compose env); при необходимости restart baked API на prod-core |
| «Нужна роль admin» | JWT без admin-роли | Войти под операторским аккаунтом |
| Tools пустой при 200 | Редко — сбой `export_tool_catalog` | Логи API, pytest `test_ewa_companion_admin_api.py` |
| Action workflows пустой при 200 | Нет builtins (ошибка деплоя) | Ожидаются минимум `music_full_cycle_v1`, `doc_package_v1` |
| Chat workflows пустой при 200 | Ошибка роутера | Ожидаются 3 строки: `reflect_week`, `plan_month`, `file_focus` |
| Жёлтый баннер про write/PG | Write выключен | `EWA_COMPANION_ADMIN_WRITE=1`, `EWA_COMPANION_WF_PG_CATALOG=1` в **БД EWA** (вкладка Настройки) |

Write gating UI (Monaco read-only, disabled Save/Enable/Disable): [EWA-COMPANION-ADMIN-WRITE-GATING.md](EWA-COMPANION-ADMIN-WRITE-GATING.md).

Проверка в DevTools → Network:

- `GET /api/v1/ewa/admin/companion/status` — флаги без каталога
- `GET …/tools`, `…/workflows`, `…/chat-workflows` — должны быть **200** с JSON-массивами

## API (read)

Префикс: **`/api/v1/ewa/admin/companion/`**

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/status` | `admin_enabled`, `admin_write_enabled`, `pg_catalog_enabled` |
| GET | `/tools` | Реестр tools (`ToolDescriptorV2`) |
| GET | `/workflows` | Action workflows (builtin + PG merge) |
| GET | `/workflows/{id}` | JSON definition |
| GET | `/chat-workflows` | Ассистент chat LLM workflow id (read-only) |
| GET | `/task-runs` | Debug: последние task runs (query: `limit`, `principal_id`, `status`, `intent_kind`, `include_steps`) |
| GET | `/task-runs/{run_id}` | Один run + steps |
| GET | `/settings` | Platform settings (Postgres); query `category` optional; ответ включает `db_total`, `settings_total`, `catalog_total`, `schema_version: ewa_platform_settings_v3` |
| GET | `/settings/audit` | Audit trail (`setting_key` optional, `limit`) |
| PUT | `/settings/{setting_key}` | Обновить одну настройку (`value_text`); требует write |
| GET | `/prompt-blocks` | Платформенные prompt blocks (canon ∪ DB) |
| PUT | `/prompt-blocks/{block_key}` | Обновить body; write gate |
| GET | `/prompt-blocks/audit` | Audit trail prompt blocks |
| GET | `/users` | Список `ewa_companion_profile` (+ run_count) |
| GET | `/users/{principal_id}` | Summary namespaces / progress |
| GET | `/users/{principal_id}/timeline` | Audit + task runs |
| GET | `/users/{principal_id}/transcript` | Tail `desktop_friend_chat_v1` |
| PATCH | `/users/{principal_id}` | Admin corrections (seed, note, allowlisted JSON); write gate |
| POST | `/users/{principal_id}/audit-note` | Operator note only (audit trail; profile blob unchanged) |
| POST | `/users/{principal_id}/clear-namespace` | Soft clear one allowlisted learned namespace (PG only; body `{ namespace, confirm_namespace, expected_revision? }`); write gate |
| POST | `/users/{principal_id}/wipe` | Hard first-meet wipe (profile CASCADE + user_workflows + Qdrant); body `{ "confirm_principal_id": "<same>" }`; write gate; 503 if Qdrant unavailable before PG delete |

Write (WF-6): `POST /workflows/validate`, `POST /workflows`, `PUT …/enable|disable` — см. master plan §7.2.
Prompt blocks: [EWA-COMPANION-PROMPT-BLOCKS.md](EWA-COMPANION-PROMPT-BLOCKS.md).

### Users — soft clear vs wipe

| Действие | Endpoint / UI | Что трогает | Qdrant |
|----------|---------------|-------------|--------|
| **Soft clear namespace** | Users → Clear namespace… / `POST …/clear-namespace` | Один allowlisted `learned_preferences.*` → empty sentinel | **нет** |
| **Hard wipe** | Users → Стереть память / `POST …/wipe` | profile CASCADE + user_workflows | **да** (fail-closed probe) |
| **Audit-note** | Users → «Только audit-note» / `POST …/audit-note` | только audit row | нет |

Deep-link: Users → **Task runs этого principal** открывает вкладку Task runs с фильтром `principal_id`.

### Users — wipe memory (first-meet)

На вкладке **Users**, в карточке выбранного principal — danger zone **«Стереть память»**:

1. Нужны `EWA_COMPANION_ADMIN_ENABLED` + `EWA_COMPANION_ADMIN_WRITE` (без write кнопка disabled + подсказка).
2. Оператор копирует/вводит **точный** `principal_id` (chip + Copy id; Enter подтверждает при совпадении).
3. Backend: probe Qdrant → audit → delete workflows → delete profile (CASCADE) → purge Qdrant episodic points.
4. UI feedback: зелёный success / красный error с человекочитаемыми кодами (`qdrant_unavailable` → PG не трогали; `qdrant_purge_failed` → PG уже удалён) + reminder про SPA `localStorage`.
5. Следующий вход пользователя в companion = `POST …/initialize` (FirstMeet).

Массовый wipe всех пользователей — только ops: `EWA_ADMIN_CONFIRM_RESET_ALL=yes …/ewa-companion-user-admin.sh reset-all` (не в UI).

## Настройки (EWA_* в БД)

С 2026-05-22 операционные **`EWA_*`** (кроме bootstrap **`EWA_DATABASE_URL`**) хранятся в **`ewa_platform_setting`**. Редактирование — вкладка **Настройки**.

Operator-facing описания для **каждого** ключа каталога (**282** в `GENERATED_CATALOG`):

- Текст `description_ru/en` виден **сразу под ключом** (не только в tooltip).
- «Подробнее» — allowed values, affects, default.
- Категории слева — hints (Спутник, Оркестрация, Персоны, …).
- Метаданные: `operator_help*.py` → `generate_ewa_platform_settings_catalog.py` → `catalog_entries.py`; seed при restart API обновляет descriptions **без** перезаписи `value_text`.

Канон: [EWA-PLATFORM-SETTINGS-DB.md](EWA-PLATFORM-SETTINGS-DB.md).

## UI (расширения 2026-05-22)

- **Tools:** группировка по capability (Планы, Каталог, Музыка, Desktop); колонка **Описание** (RU через i18n, EN — summary API); **Max concurrent / principal** (`max_concurrent_per_principal`, WF-4); раскрываемый **контракт** (requires, input/result keys); фильтр по capability и поиск.
- **Настройки:** категории; bootstrap-note; **история изменений (audit)**; focus по ключу из env_gate ([этап 3](EWA-COMPANION-ADMIN-SETTINGS-NAVIGATION.md)); **refetchOnMount: always** (2026-05-24); hint при `db_total !== settings_total`.
- **Action workflows:** `env_gate` в списке (клик → Настройки); validate → warnings; read-only Monaco + disabled Save/Enable при write off (этап 1); **«Новый workflow»** из шаблона + **Validate перед Save/Enable** (этап 2, [EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md](EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md)); optional `steps[].retry` в JSON (WF-4).
- **Task runs (debug):** фильтры status / principal / intent; клик по строке → plan/result/error JSON + steps.
- Кнопка **Обновить** — перезагрузка всех admin queries.

## Конфигурация (источник правды)

| Параметр | Где задаётся |
|----------|----------------|
| `EWA_COMPANION_ADMIN_ENABLED` | **БД** `ewa_platform_setting` (вкладка Настройки) |
| `EWA_COMPANION_ADMIN_WRITE` | **БД** |
| `EWA_COMPANION_WF_PG_CATALOG` | **БД** |
| `EWA_DATABASE_URL` | **env** stack0 (bootstrap только) |

См. [EWA-PLATFORM-SETTINGS-DB.md](EWA-PLATFORM-SETTINGS-DB.md) — не дублировать `EWA_*` в `docker/env_file/.env.stack0.backend`.

**Companion image generation (migration 014 + catalog):** `EWA_COMPANION_IMAGE_GENERATION_ENABLED`, `EWA_COMPANION_IMAGE_GENERATION_TYPE_KEY`, `EWA_COMPANION_IMAGE_GENERATION_WORKFLOW_SLUG` — см. [EWA-COMPANION-IMAGE-GENERATION.md](EWA-COMPANION-IMAGE-GENERATION.md). Verify: `bash docker/scripts/ewa-platform-migrations-verify.sh`; UI «Все» ≈ **`catalog_total=282`**.

## Локализация

- UI-строки панели — **`desktopUi.ewaCompanionAdmin.*`** (ru/en), включая `settingsCategories.*`, `toolCapabilities.*`, `toolDescriptions.*`.
- Названия chat workflows в таблице берутся из API (`title_ru` / `title_en`) по текущей локали приложения.
- Технические имена tools (`music_generation`, …) и JSON workflow — без перевода (контракт).

## Roadmap (5 этапов — завершено)

| # | Этап | Канон |
|---|------|-------|
| 1 | Write gating UI | [EWA-COMPANION-ADMIN-WRITE-GATING.md](EWA-COMPANION-ADMIN-WRITE-GATING.md) |
| 2 | Workflow editor + validate-before-save | [EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md](EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md) |
| 3 | Settings audit + env_gate → Settings | [EWA-COMPANION-ADMIN-SETTINGS-NAVIGATION.md](EWA-COMPANION-ADMIN-SETTINGS-NAVIGATION.md) |
| 4 | Operator smoke §12 master-plan | [EWA-COMPANION-ADMIN-SMOKE-STACK0.md](EWA-COMPANION-ADMIN-SMOKE-STACK0.md) |
| 5 | WF-4 capacity/retry + Vitest admin | [EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md](EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md) |

Master-plan phases **WF-5** (admin read) и **WF-6** (admin write) закрыты этой программой — см. `documentation/plans/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]* §9.

---

## Автотесты

| Слой | Команда / путь |
|------|----------------|
| **pytest (stack0)** | `./docker/scripts/ewa-companion-admin-smoke.sh` — health, EWA_* flags, prompt_blocks seed, admin API + prompt_blocks + users allowlist + WF-4 |
| **Vitest (pure helpers)** | `cd shared/web/frontend && pnpm exec vitest run src/features/ewa/admin/__tests__` |

Каталог Vitest (`admin/__tests__/`): write-gate, workflow editor/template, settings nav/meta/subgroups, task-runs API, **`ewaCompanionAdminPromptsUsersTabs`** — детали WF-4 в [EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md](EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md) §4.2.

---

## Smoke (оператор)

Краткий UI-smoke (вкладки админки): ниже. Полный **§12 master-plan** (music full cycle + disable fall-through): [EWA-COMPANION-ADMIN-SMOKE-STACK0.md](EWA-COMPANION-ADMIN-SMOKE-STACK0.md) и `./docker/scripts/ewa-companion-admin-smoke.sh`. **WF-4** (capacity/retry): [EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md](EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md) §5.

1. Админка → EWA — спутник → **Tools**: ≥10 tools, есть `music_generation`; **Max concurrent** для music = 1.
2. **Action workflows**: ≥2 builtin, выбор слева → Monaco JSON.
3. **Chat workflows**: 3 строки с русскими названиями при локали `ru`.
4. **Task runs (debug)**: таблица последних операций спутника; клик → детали.
5. **Prompts:** список блоков по category; Monaco body; Save при write on; audit.
6. **Users:** поиск `principal_id` → detail → soft clear namespace / wipe / audit-note / Task runs deep-link.
7. **Настройки:** список `EWA_*` из БД; изменить `EWA_COMPANION_VOICE_ENABLED` → сохранить → значение в API cache без restart; audit показывает запись.
8. При `EWA_COMPANION_ADMIN_ENABLED=0` — явный баннер, не «пустая таблица».
