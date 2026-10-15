# Инструмент · `get_entity_counts`

## Назначение

Быстрая **сводка заполненности** маркетингового кабинета по ключевым сущностям: один round-trip к PostgreSQL с подзапросами `COUNT(*)`, без тяжёлого вывода строк.

## Исходный код

- Схема Llama: объект function без параметров (`properties: {}`, `required: []`).
- Исполнитель: **`_tool_get_entity_counts`** в `marketing_agent_tools.py`.
- Диспетчер: **`execute_marketing_agent_tools`** — ветка `get_entity_counts` (аргументы агента не используются).

## SQL-агрегат

Одна строка résultat с полями (все `COUNT` по `project_id`, с `deleted_at IS NULL` где применимо):

| Ключ JSON | Таблица / смысл |
|-----------|------------------|
| `jtbd` | `job_stories` |
| `value_propositions` | `value_propositions` |
| `swot` | `swot_analyses` |
| `competitors` | `competitors` |
| `researches` | `research_projects` |
| `content` | `unified_content` |
| `segments` | `marketing_segments` |
| `campaigns` | `marketing_campaigns` |
| `funnels` | `marketing_funnels` |
| `tasks` | `marketing_tasks` |
| `alerts` | `marketing_alerts` |

## Выход

- Строка: **`json.dumps(..., ensure_ascii=False, indent=2)`** — человекочитаемый JSON с целыми счётчиками.
- При `row is None` возвращается `"{}"`.

## Использование моделью

Роутер Llama часто вызывает инструмент первым, чтобы оценить «пустой/наполовину заполненный» проект перед `search_project_documents` или списками сущностей.

## Инварианты

- Нет фильтрации по `user_id` внутри SQL: доступ уже проверен снаружи (`get_accessible_project` / мутационный контур AMKA).
