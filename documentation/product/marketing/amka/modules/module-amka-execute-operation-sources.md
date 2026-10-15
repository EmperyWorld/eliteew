# Модуль · `amka_execute_operation_sources.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_execute_operation_sources.py`

## Назначение

**Materialize** для операций плана перед `execute_operations`: например, разрешение `import_analysis_artifact` в конкретный `content_id`, проверка готовности строки ИМК, при необходимости вызов upsert в контент проекта.

## Связь

`AmkaService._materialize_operation_sources` делегирует сюда; используется **`imc_run_row_ready_for_project_rag_upsert`** из `marketing_project_rag_sources_service`.

## Инварианты

Без успешной материализации **destructive** операции с зависимым `source_ref` не должны доходить до мутаций — иначе отказ с понятным `message` в `operation_trail`.
