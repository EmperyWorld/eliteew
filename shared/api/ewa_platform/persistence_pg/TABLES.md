# EWA orchestration — таблицы Postgres

Целевая БД: отдельный инстанс, DSN **`EWA_DATABASE_URL`** (см. `docker/stack/stack-ewa-postgres.yml`).

Реализация в коде: `persistence_pg/orchestration_asyncpg.py` создаёт таблицы ниже (`init_ewa_orchestration_schema`), плюс `persistence_pg/companion_asyncpg.py` — строки профиля компаньона (`init_ewa_companion_schema`).

**Операторский SQL-трек:** каталог [`migrations/`](../migrations/README.md) — `applied/001_orchestration.sql`, при необходимости **`applied/002_rename_legacy_amka_orchestration_tables.sql`**, **`applied/003_ewa_companion_profile.sql`**, **`007_ewa_atoms.sql`**, и скрипт `apply_ewa_migrations.sh` (переменная **`EWA_DATABASE_URL`**). Миграции **не** смешиваются с основным контуром `shared/api/migrations/` без отдельного решения; DDL можно применить через Python (`init_ewa_orchestration_schema`) или через SQL.

## `ewa_orchestration_session`

| Поле | Тип | Смысл |
|------|-----|--------|
| `session_id` | text, PK | Строковый id сессии (как в портах) |
| `state` | jsonb | Снимок состояния сессии (`OrchestrationSessionRepository.save`) |
| `updated_at` | timestamptz | Аудит |

## `ewa_orchestration_event`

| Поле | Тип | Смысл |
|------|-----|--------|
| `id` | bigserial | Технический ключ |
| `session_id` | text, FK | Ссылка на сессию |
| `seq` | int | Порядок (монотонно на сессию; блокировка строки сессии при append) |
| `event` | jsonb | Событие целиком, включая поле `seq` для совместимости с in-memory логом |

## `ewa_companion_profile` и `ewa_companion_profile_audit`

Одна строка на **`principal_id`** (совпадает с `User.id` в Companion HTTP API). Поля: `schema_version`, `seed_persona_id`, JSON-блобы **`baseline`** / **`learned_preferences`** / **`style_parameters`**, **`companion_revision`**, `updated_at`; аудит: `principal_id`, `action`, `detail`, `created_at`. Канон: `migrations/applied/003_ewa_companion_profile.sql`; продукт: `product/ewa/EWA-COMPANION-PROFILE-ADR.md`. Оператор: **`docker/scripts/ewa-companion-user-admin.sh`** (`reset` / `set-trust` по username из основной БД; полный сброс данных EWA Postgres — **`EWA_ADMIN_CONFIRM_TRUNCATE=yes … truncate-all-ewa`**).

## `ewa_atom` и `ewa_atom_edge` (слой Atom)

Нормализованные узлы знаниевого графа (Star / Comet / Nebula) и направленные рёбра (`temporal`, `semantic`, `affective`). Канон: `migrations/applied/007_ewa_atoms.sql`, код: `persistence_pg/atoms_asyncpg.py`, продукт: `product/ewa/EWA-ATOM-LAYER.md`.

## Будущая нормализация (черновик)

Ниже — прежний набросок отдельных таблиц; текущий код хранит снимок сессии в jsonb и шаги в `ewa_orchestration_event`.

### `orchestration_session`

| Поле | Тип | Смысл |
|------|-----|--------|
| `id` | uuid, PK | Идентификатор сессии |
| `user_id` | text | Внешний principal |
| `phase` | text | Значение `OrchestrationPhase` |
| `goal_json` | jsonb | Цель пользователя |
| `created_at` / `updated_at` | timestamptz | Аудит |

### `orchestration_step`

| Поле | Тип | Смысл |
|------|-----|--------|
| `id` | bigserial | Шаг |
| `session_id` | uuid, FK | Ссылка на сессию |
| `seq` | int | Порядок |
| `kind` | text | observation / intent / llm |
| `payload` | jsonb | Полезная нагрузка |

### `orchestration_outbox`

Для at-least-once доставки intents на воркеры/адаптеры.
