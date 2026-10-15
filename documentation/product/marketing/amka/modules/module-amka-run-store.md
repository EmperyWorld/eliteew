# Модуль · `amka_run_store.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_run_store.py`

## Назначение

Низкоуровневый **SQL**-слой для `marketing_amka_runs` и `marketing_amka_run_steps`: вставка, обновление, выборки, whitelist-колонка `fetch_run_value`, сброс failed/running шагов.

## Ключевые операции

| Функция | Назначение |
|---------|------------|
| `insert_run` / обёртки | Создание прогона |
| `insert_step` | Новый шаг с JSONB полями |
| `update_step` | Статус, отчёт, payload, метрики |
| `update_run` | Статус, master_plan, context_payload, финальный markdown, `approved_at`, т.д. |
| `fetch_run_value` | Безопасное чтение одной колонки по whitelist (защита от SQL-инъекции в имени колонки) |
| `list_steps_for_run` / подобное | Упорядоченный список шагов |

## Инварианты

- JSON поля сериализуются через **`json.dumps`** при записи в `::jsonb`.
- Терминальные переходы статусов run согласованы с `amka_run_lifecycle` / `amka_phase_execute`.
