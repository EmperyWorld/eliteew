# Модуль · `amka_phase_plan.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_phase_plan.py`

## Назначение

**Фон планирования:** snapshot → аудит → **master plan** → merge пресета → **persist** шагов (`section_audit`, `master_plan`, `execute_section*`, `final_assessment`) → обновление run (`awaiting_approval` или auto → `queued` + spawn execute).

## Ключевые функции

- `run_plan_background` — главный orchestrator; лог **`ops.planning_done`** с подметриками.
- `build_master_plan` — LLM + эвристика + нормализация; возвращает `tasks`, `summary_text`, метаданные parse.

## Контекст после плана

Формируется **`plan_ctx_payload`** в `context_payload`: `section_audits`, `project_context_text`, `plan_llm_*`, `audit_llm_stats`.

## Инварианты

При **`run_mode=auto`** сразу выставляется `approved_at` и стартует **execute background** без пользовательского approve.
