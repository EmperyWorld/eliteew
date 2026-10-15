# Модуль · `amka_phase_execute_misc.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_phase_execute_misc.py`

## Назначение

Вспомогательные пути исполнения вне «толстого» раздела:

- **`execute_client_interaction_step`** — LLM JSON → upsert **`marketing_customer_facing_summary`** (если записи ещё нет).
- **`run_marketing_tool_agent_for_section`** — обёртка: rate-limit backoff, вызов **`run_marketing_tool_agent_for_project`**, упаковка `report_payload` для шага AMKA.

## Инварианты

Импортируется из **`AmkaService` лениво** (внутри методов), чтобы не тянуть тяжёлые цепочки при простом импорте сервиса.

## См. также

[agent-tools/README.md](../agent-tools/README.md)
