# Модуль · `amka_service.py` (`AmkaService`)

## Расположение

`shared/api/services/marketing_cabinet/amka_service.py`

## Назначение

**Фасад** AMKA: единая точка для роутера и фоновых задач. Держит `db_pool`, **`AmkaMutationService`**, **`AmkaSourceResolver`**, делегирует фазы в `amka_phase_*` и store/lifecycle.

## Основные группы методов (по смыслу)

| Группа | Примеры методов |
|--------|------------------|
| Публичное API | `list_runs`, `get_run_detail`, `get_run_progress_snapshot`, `create_run`, `approve_run`, `resume_run`, `continue_step_run`, `cancel_run` |
| Фон | `_run_plan_background`, `_run_execute_background`, `_maybe_start_next_auto_amka_cycle` |
| Snapshot | `_build_run_snapshot`, `_fetch_project_extras` |
| Аудит / план | `_build_section_audits*`, `_build_master_plan`, `_normalize_plan_tasks`, `_llm_plan_json`, кандидаты и операции |
| Исполнение | `_execute_section_step`, `_run_imc_research_for_section`, `_run_project_generate_async_for_section`, `_run_marketing_tool_agent_for_section`, `_execute_client_interaction_step`, `_execute_final_assessment` |
| LLM | `_llm_json`, `_llm_text` (делегаты на `amka_llm_runtime`) |
| Рендер | `_render_*` (делегаты на `amka_markdown_render` и локальные сборки) |
| Store | `_get_run_checked`, `_list_steps`, `_insert_step`, `_update_step`, `_update_run`, `_replace_steps`, `_fetch_run_value`, `_reset_failed_or_running_steps` |
| Skip / merge approve | дубликаты/coerce из lifecycle для внутреннего use |

## Инварианты

Тяжёлые импорты (например execute_misc) подтягиваются **внутри** методов, где нужны.

## Документация

Архитектурный обзор: [AMKA-REFERENCE.md](../../AMKA-REFERENCE.md); детализация методов — файлы `module-amka-phase-*.md` и store/lifecycle.
