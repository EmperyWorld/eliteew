# Модуль · `amka_plan_candidates.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_plan_candidates.py`

## Назначение

**Эвристическое** построение кандидатов задач и операций master plan без LLM: нормализация `plan_tasks`, `operation_payloads`, `source_refs`, дедуп **`reindex_marketing_rag_content`** по `content_id`, правила валидации структуры для `imc` и прочих секций.

## Связь

Используется в **`build_master_plan`**, когда LLM отключён, пуст или не прошёл нормализацию (**`plan_source=heuristic`**, **`heuristic_fallback`**).

## Ключевые симптомы логов

- **`plan.reindex_deduped`** — схлопывание повторных reindex на один `content_id`.
