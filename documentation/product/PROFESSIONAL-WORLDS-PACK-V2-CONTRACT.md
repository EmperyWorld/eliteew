# Professional Worlds — vertical pack v2 (manifest contract)

Канон JSON-манифеста для **импорта/экспорта** вертикали (admin) и **снимков версий** (`professional_vertical_pack_versions`). Семантика применения: `shared/api/services/professional_worlds/pack_service.py`; HTTP: `shared/api/routers/professional_worlds_admin.py`.

## Корень

| Поле | Тип | Описание |
|------|-----|----------|
| `vertical` | object | Обязателен. Метаданные вертикали (см. ниже). |
| `module_catalog` | array? | Глобальный каталог модулей (upsert в `professional_modules`). |
| `modules` | array? | Назначения модулей вертикали (`professional_vertical_modules`). |
| `schemas` | array? | JSON-схемы (`professional_vertical_schemas`). |
| `ai_actions` | array? | Действия AI (`professional_ai_actions`). |
| `photo_presets` | array? | Фото-пресеты (`professional_photo_presets`). |
| `integrations` | array? | Привязки интеграций (`professional_integration_bindings`). |

Валидация структуры: `ProfessionalWorldsPackService.validate_manifest`. Расширенные предупреждения: `semantic_validation` (каталог, `depends_on`, пустые ключи UGS/интеграций).

## `vertical`

| Поле | Тип | Инвариант |
|------|-----|-----------|
| `slug` | string | Обязателен; при импорте с пути `/packs/{vertical_slug}/…` должен совпадать с маршрутом. |
| `name` | string? | Отображаемое имя (при полном upsert вертикали через admin — отдельные эндпойнты). |
| `description` | string? | |
| `icon_key` | string? | |
| `profile_schema` | object? | JSONB |
| `workspace_template` | object? | JSONB |

Экспорт (`GET …/verticals/{slug}/export`) включает актуальные поля из `profession_verticals`.

## Именование модулей пакета профессии

- **Core** (общие для любой вертикали): `profile`, `clients`, `objects`, `learning`, `public-presence`, `artifacts` — без префикса slug.
- **Пакет профессии** (инструменты вертикали): ключи **`{vertical_slug}_*`** (например `realtor_leads`, `realtor_pipeline`). Такие модули попадают в раздел **«Инструменты: {профессия}»** в Desktop, а не в generic «Клиенты».
- Не смешивать realtor-инструменты в core-модули без префикса — иначе UI и API выглядят как «приложение для риелторов», а не платформа профессий.

## `module_catalog[]`

Элементы передаются в `ProfessionalModuleCreate`: `module_key`, `name`, `description`, `category`, `icon_key`, `default_config`, `is_active`. В БД дополнительно: `depends_on` (jsonb), `capability_scopes` (jsonb) — см. миграцию `20260505_03_professional_worlds_next.sql`.

## `modules[]` (назначения)

`module_key`, `sort_order`, `is_enabled`, `config` → `ProfessionalVerticalModuleUpsert`.

## `schemas[]`

`schema_key`, `version`, `title`, `schema_json`, `ui_schema`, `is_active` → `ProfessionalVerticalSchemaCreate` (HTTP/OpenAPI field `schema_json`; Python attr `schema_body` to avoid Pydantic `BaseModel.schema_json` shadow).

## `ai_actions[]`

`vertical_slug` берётся из корня маршрута импорта; поля: `module_key`, `action_key`, `display_name`, `description`, `ugs_type_key`, `workflow_slug`, `prompt_template`, `input_schema`, `output_schema`, `safety_rules`, `artifact_kind`, `billing_hint`, `sort_order`, `is_active` → `ProfessionalAiActionCreate`.

**Runtime:** в пользовательском `GET …/me/runtime-config` поля `prompt_template` **не отдаются** (SQL без колонки).

## `photo_presets[]`

`preset_key`, `display_name`, `description`, `category`, `action_type`, `ugs_type_key`, `prompt_template`, `parameters`, `sort_order`, `is_active` → `ProfessionalPhotoPresetCreate`. Runtime — без `prompt_template`.

## `integrations[]`

`integration_key`, `display_name`, `config`, `is_enabled` → patch биндинга.

## Версии, релизы, rollout

- **Версия:** `professional_vertical_pack_versions` (`version_label`, `manifest`, `changelog_md`).
- **Релиз:** `professional_vertical_pack_releases` (`draft` → `approved` → `published` / `rolled_back`); при publish — `manifest_snapshot`, `snapshot_hash`.
- **Rollout:** `professional_vertical_rollouts` (`mode`, `percentage`, `is_paused`); allowlist — `professional_vertical_rollout_allowlist`.
- **Импорт:** `professional_pack_import_jobs` (`validation_messages`, `diff_summary`).

## Changelog

Текст в `changelog_md` при создании версии в БД; отдельного поля в корне манифеста нет.

## Related

- `product/PROFESSIONAL-WORLDS.md`
- `product/PROFESSIONAL-WORLDS-NEXT-BASELINE.md`
- `shared/api/migrations/applied/20260505_03_professional_worlds_next.sql`
