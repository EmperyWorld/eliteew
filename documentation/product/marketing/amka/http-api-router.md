# AMKA · HTTP-роутер (FastAPI)

## Файл

`shared/api/routers/marketing_cabinet/amka.py`

Префикс приложения: **`/api/v1/marketing-cabinet`** + **`/amka`** → полный базовый путь **`/api/v1/marketing-cabinet/amka`**.

## Зависимости авторизации

| Зависимость | Где используется |
|-------------|------------------|
| `get_marketing_db_pool` | Все эндпоинты |
| `get_marketing_user_id` | Чтение и мутации run/presets/SSE/export (кроме явных исключений) |
| `require_marketing_trusted_operator` | **`PUT /operator-config`** |
| `assert_marketing_amka_preset_editor` | Мутации пресетов (владелец проекта или trusted) |

## Эндпоинты (сводка)

См. полную таблицу в [AMKA-REFERENCE.md](../AMKA-REFERENCE.md) § HTTP API. Здесь — технические детали реализации:

- **`GET /operator-config`** → `load_operator_config_bundle` — triplet stored / effective / env_caps.
- **`PUT /operator-config`** → `upsert_operator_config` + повторная загрузка bundle.
- **Пресеты:** делегирование в `amka_preset_service` (create/update/delete/list/get/templates); ошибки `UniqueViolationError` → 409 на дубль slug.
- **`GET /project/{project_id}/runs`** → `AmkaService.list_runs` — `poll_after_ms`, дайджест.
- **`POST /runs`** → `create_run` — разбор `preset_id`, `auto_cycle_count` только при `run_mode=auto`.
- **`GET /runs/{run_id}`** → `get_run_detail`.
- **`GET /runs/{run_id}/export.md`** → `build_amka_run_export_markdown`, `Content-Disposition: attachment`.
- **`GET /runs/{run_id}/events`** → `StreamingResponse`, генератор с **`: ping`** и JSON-снимком прогресса каждые **2** с; выход в терминальных статусах `completed|failed|cancelled`.
- **`POST /approve`**, **`/resume`**, **`/continue-step`**, **`/cancel`** → методы `AmkaService`.

## SSE-заголовки ответа

`Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` — см. [AMKA-AUDIT-WORKFLOW.md](../AMKA-AUDIT-WORKFLOW.md) (деплой nginx).

## Связь с сервисом

Все операции с состоянием прогонов идут через **`AmkaService(db_pool)`** — единая точка оркестрации; тяжёлая логика в `amka_phase_*`, `amka_run_lifecycle`, store.
