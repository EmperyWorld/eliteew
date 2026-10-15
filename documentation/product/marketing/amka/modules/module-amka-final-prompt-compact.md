# Модуль · `amka_final_prompt_compact.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_final_prompt_compact.py`

## Назначение

Сжатие **гигантских** структур health и истории шагов до компактного текста для **финального** LLM AMKA:

- `compact_project_health_for_amka_final_llm`
- `build_compact_execute_steps_for_final_prompt` — без полных snapshot’ов и сырья ИМК

## Константа

**`AMKA_FINAL_PROMPT_MAX_CHARS`** — потолок длины итогового промпта; при превышении LLM не вызывается.

## Инварианты

Полный health остаётся в БД и в `metrics_after` run — усечение **только** для промпта.
