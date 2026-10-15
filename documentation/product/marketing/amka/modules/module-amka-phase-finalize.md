# Модуль · `amka_phase_finalize.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_phase_finalize.py`

## Назначение

Шаг **`final_assessment`**: повторный **`build_project_health`** «после», компактный промпт через **`amka_final_prompt_compact`**, вызов LLM или fallback markdown; reconcile графа стратегии **`reconcile_marketing_strategy_graph_for_project`**; запись **`final_assessment`**, **`final_summary_markdown`**, метрик в run.

## Особенности markdown

Функции снятия эхо/дубликатов заголовков ответа модели (`_strip_final_model_part_echoes` и др.) — см. [AMKA-AUDIT-WORKFLOW.md](../../AMKA-AUDIT-WORKFLOW.md) § Autofill / финал.

## Ошибки / лимиты

Если промпт > **`AMKA_FINAL_PROMPT_MAX_CHARS`**, LLM пропускается — лог `amka.final_assessment.prompt_too_large`.
