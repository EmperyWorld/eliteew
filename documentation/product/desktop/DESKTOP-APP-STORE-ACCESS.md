# Desktop App Store: модель доступа, миграции и API

## Модель доступа

- **Системные приложения** (`desktop_app_catalog.is_system = true`): видимы и устанавливаемы только пользователям с ролью `admin` или `emperyworld_admin`.
- **Остальные приложения**: видимость и установка по группе допуска. У пользователя одна группа (`users.app_access_group_id`). Если у пользователя `app_access_group_id = null`, считается группа по умолчанию (UUID `a0000000-0000-4000-8000-000000000001`). Приложение видно, если у него нет `access_group_id` или его `access_group_id` совпадает с эффективной группой пользователя.
- Администратор может назначать пользователю группу допуска через админ-API.

## Миграции (применять в stack1-postgres)

Порядок применения:

1. `006_app_access_groups.sql` — таблица `app_access_groups`, seed группы «По умолчанию».
2. `007_desktop_catalog_access.sql` — в `desktop_app_catalog` поля `is_system`, `access_group_id`.
3. `008_users_app_access_group.sql` — в `users` поле `app_access_group_id`.
4. `009_desktop_app_store_indexes.sql` — индексы.
5. `010_desktop_app_store_seed.sql` — seed: для `category = 'system'` выставить `is_system = true`; для остальных при необходимости привязать к группе по умолчанию.

Запуск (из окружения, где доступен stack1-postgres и задан `DATABASE_URL`):

```bash
python migrations/run_migration.py 006_app_access_groups.sql
python migrations/run_migration.py 007_desktop_catalog_access.sql
python migrations/run_migration.py 008_users_app_access_group.sql
python migrations/run_migration.py 009_desktop_app_store_indexes.sql
python migrations/run_migration.py 010_desktop_app_store_seed.sql
```

## Эндпоинты

### Store (пользовательские)

- `GET /api/v1/desktop/store` — каталог приложений с учётом доступа (системные только для админа, остальные по группе пользователя). В ответе: `apps[]` с полями `app_id`, `name`, `description`, `category`, `installed`, `is_system`, `access_group_id`, `access_group_name`.
- `GET /api/v1/desktop/store/{app_id}` — детали одного приложения с проверкой доступа; 404 при отсутствии или нет доступа.
- `POST /api/v1/desktop/installed` — установка приложения (body: `{ "app_id": "..." }`). 403 при отсутствии доступа.
- `DELETE /api/v1/desktop/installed/{app_id}` — удаление приложения.

### Admin (требуется роль admin или emperyworld_admin)

Базовый префикс: `/api/v1/desktop/admin`.

- **Каталог**: `GET /catalog`, `POST /catalog`, `GET /catalog/{app_id}`, `PATCH /catalog/{app_id}`, `DELETE /catalog/{app_id}`.
- **Группы допуска**: `GET /access-groups`, `POST /access-groups`, `GET /access-groups/{group_id}`, `PATCH /access-groups/{group_id}`, `DELETE /access-groups/{group_id}`. Удаление группы возвращает 409, если на неё ссылаются пользователи или приложения каталога.
- **Пользователи**: `GET /users` — список с `app_access_group_id` и `app_access_group_name`; `PATCH /users/{user_id}` — тело `{ "app_access_group_id": "uuid" | null }` для назначения группы допуска.
