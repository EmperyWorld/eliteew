# Модуль · `amka_execute_async_helpers.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_execute_async_helpers.py`

## Назначение

Ожидание **дочерних** задач и длинных цепочек:

- **`reconcile_child_ai_run_until_terminal`** — poll `marketing_ai_runs` до терминала с таймаутом и бэкофом.
- **`run_project_generate_async_for_section`** — постановка async generate по таргетам секции, привязка `amka_run_id`/`amka_step_id`, ожидание детей.
- **`run_imc_research_for_section`** / **`poll_imc_research_row`** — ИМК + логи `execute.imc.*`, `rag_upsert`.
- Хелперы auto IMC: **`_amka_prior_resolved_imc_type_keys`**, **`_amka_recent_completed_imc_type_keys_for_project`**, **`build_imc_auto_cabinet_haystack`** (импорты из support).
- **`_dedupe_markdown_h2_blocks`** — чистка markdown отчёта ИМК.

## Конфигурация

`AMKA_PROJECT_GENERATE_STEP_MAX_WAIT_SEC`, operator **`execute.max_wait_seconds`**, лимиты rate-limit кабинета.

## Связь

Делегаты вызываются с **`AmkaService`** как `svc._run_project_generate_async_for_section` и т.д.
