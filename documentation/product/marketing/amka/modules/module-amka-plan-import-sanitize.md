# Модуль · `amka_plan_import_sanitize.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_plan_import_sanitize.py`

## Назначение

**Префлайт** задач плана перед персистом: удаление операций `import_analysis_artifact`, если `imc_run` не готов к импорту (порог текста **`imc_run_row_ready_for_project_rag_upsert`** / `MIN_EXTRACTED_TEXT_CHARS`).

## Логирование

События вида **`plan.import_op_pruned`** (см. workflow-док).

## Связь

Вызывается из фазы плана перед записью шагов или при нормализации (см. `amka_phase_plan` / `amka_run_lifecycle` по коду).
