# Модуль · `amka_llm_plan.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_llm_plan.py`

## Назначение

Построение **промпта** для master plan LLM и разбор/нормализация ответа (строка → структура задач), совместно с `amka_phase_plan.build_master_plan` и `amka_service._normalize_plan_tasks`.

## Содержание (концептуально)

- Подмешивание **реестра режимов** (`amka_analysis_registry.AMKA_ANALYSIS_REGISTRY_MARKDOWN`) и **каталога типов ИМК** из snapshot.
- Сжатый срез сущностей, аудиров, кандидатов, DAG зависимостей, `strategy_integrity_issues` — см. [AMKA-AUDIT-WORKFLOW.md](../../AMKA-AUDIT-WORKFLOW.md).
- Вызов LLM через фасад **`AmkaService._llm_plan_json`** (делегат на `httpx`/Llama с особыми опциями плана).
- Адаптивное восстановление парсинга в `run_mode=auto`: один retry с усиленной JSON-инструкцией + один repair-pass (если первичный ответ не прошёл parse/shape).

## Связь

- **Вход:** `snapshot`, `audit_steps`, кандидаты из `amka_plan_candidates`.
- **Выход:** структура с полями вроде `tasks`, `plan_summary`, метаданные parse/repair для логов `plan.*`.

## Инварианты

Фактическая нормализация и валидация уникальности `imc_type_key` выполняются **после** этого модуля в `amka_phase_plan` / `amka_service_support`.

В `run_mode=auto` module-level recovery не меняет контракт результата: на выходе всё равно `dict` с `tasks` + `plan_llm_status`, а fallback в эвристику остаётся последней линией защиты, если retry/repair не восстановили валидную структуру.
