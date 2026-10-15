# Модуль · `amka_source_resolver.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_source_resolver.py`

## Назначение

Класс **`AmkaSourceResolver`**: построить **единый каталог источников** для проекта — материалы RAG, записи `imc_research_runs`, `unified_content` — в структуру для промпта плана и для review оператором.

## Метод

`resolve_for_project(project_id, user_id) -> dict` — включает агрегаты вроде `pending_imports`, карты `rag_by_imc_run_id`, списки сырья для LLM.

## Зависимости

- **`list_project_rag_sources`**, **`upsert_imc_run_as_project_rag_content`**, **`imc_run_row_ready_for_project_rag_upsert`**.

## Использование

В **`build_run_snapshot`** snapshot["source_catalog"]; далее в master plan prompt и при отображении pending операций в UI.
