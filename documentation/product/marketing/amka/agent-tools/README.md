# AMKA · инструменты marketing tool-agent

Контур **исполняется**, когда шаг `execute_section` имеет `execution_mode: marketing_tool_agent` (и не `client_interaction`): см. `amka_phase_execute_section.py` → `_run_marketing_tool_agent_for_section` → `marketing_tool_agent_core.run_marketing_tool_agent_for_project`.

Исходный код whitelist и исполнителей: **`shared/api/routers/marketing_cabinet/marketing_agent_tools.py`** (роутер кабинета, не каталог `services`).

## Список инструментов (Llama `tools`)

| Файл | Имя function | Назначение |
|------|----------------|------------|
| [search-project-documents.md](search-project-documents.md) | `search_project_documents` | Семантический RAG по документам проекта (Qdrant) |
| [get-entity-counts.md](get-entity-counts.md) | `get_entity_counts` | Агрегированные COUNT по таблицам кабинета |
| [list-job-stories.md](list-job-stories.md) | `list_job_stories` | Выборка JTBD из PostgreSQL |
| [list-competitors.md](list-competitors.md) | `list_competitors` | Выборка конкурентов |

## Оркестрация

- [orchestration-and-limits.md](orchestration-and-limits.md) — `MARKETING_AGENT_TOOLS_LLAMA`, `parse_llama_tool_calls`, `execute_marketing_agent_tools`, лимиты, связь с `marketing_tool_agent_core`.

## Связь с UGS / Llama

Роутер вызывает Llama `/api/chat` с **`tool_choice: required`** и схемами из `MARKETING_AGENT_TOOLS_LLAMA`; затем **сервер** исполняет только имена из whitelist. Неизвестные `name` дают текст-предупреждение в трассе, не падая всем прогоном.
