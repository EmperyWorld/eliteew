# Модуль · `amka_run_export_markdown.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_run_export_markdown.py`

## Назначение

**Серверная** сборка markdown-отчётов AMKA для **`GET .../runs/{id}/export.md`**:

- пользовательский markdown (без технических JSON/трасс),
- технический markdown (полный), который сохраняется в `generated_files`.

## API

`build_amka_run_export_markdown(run: dict, steps: list[dict], *, technical_details: bool = True) -> str`

`save_amka_run_reports_to_generated_files(run_id, user_markdown, technical_markdown, generated_files_base=None) -> dict[str, str]`

## Структура выхода

1. Заголовок и метаданные run (id, project_id, company_id, статусы, даты).
2. Опционально **`master_plan_summary`**.
3. Для `technical_details=True`: блок **`final_assessment`** как JSON, projection/core alignment и JSON-трассы операций.
4. Для `technical_details=False`: компактный блок **«Ключевые метрики»** вместо raw JSON и без JSON-трасс.
5. Секция **«Этапы»**: ordinal, `stage_kind`, `section_key`, статус, даты, `report_markdown`.
6. Завершение **`final_summary_markdown`**.

## Вспомогательное

- `_json_block` — безопасный `json.dumps` с fallback в `str(value)`.
- `_render_final_assessment_user_block` — компактные KPI для пользовательского отчёта.
