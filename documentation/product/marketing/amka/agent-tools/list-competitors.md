# Инструмент · `list_competitors`

## Назначение

Краткий список **конкурентов** проекта: имя, описание, тип, рыночная позиция — для вопросов о рынке, сравнении и позиционировании.

## Исходный код

- Схема Llama: опциональный **`limit`** (1–12, по умолчанию 8).
- Исполнитель: **`_tool_list_competitors`** в `marketing_agent_tools.py`.

## Параметры

Симметрично `list_job_stories`: **`limit`** с клампом 1–12, fallback 8.

## SQL

```text
SELECT name, description, competitor_type, market_position
FROM competitors
WHERE project_id = $1 AND deleted_at IS NULL
ORDER BY updated_at DESC NULLS LAST, created_at DESC
LIMIT $2
```

## Форматирование

- Префикс: **`Конкуренты (кратко):`**
- `description` усечение до **400** символов.
- В заголовок карточки добавляется `(competitor_type, market_position)` через запятую, если не пусто.

## Пустой результат

*«В проекте пока нет записей о конкурентах.»*

## Связь с аудитом AMKA

Раздел **`analysis`** в AMKA включает конкурентов; tool-agent не пишет в БД, только читает для обогащения ответа на шаге с `marketing_tool_agent`.
