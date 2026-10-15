# Модуль · `amka_markdown_render.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_markdown_render.py`

## Назначение

**Чистые функции** генерации markdown для отчётов AMKA: аудит секции, master plan, autofill, report-only шаги, operation trail, снапшоты операций (`describe_operation_snapshot`).

## Связь

Вызывается из **`AmkaService`** (`_render_*`) и из `amka_phase_execute_misc` (`render_report_only_execution`.

## Инварианты

Не дергать БД и LLM — только форматирование структур в памяти.
