# Модуль · `amka_analysis_registry.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_analysis_registry.py`

## Назначение

Константы **допустимых `execution_mode`** для задач master plan и **готовый markdown-блок** с объяснением режимов для промпта LLM.

## Константы

### `AMKA_PLAN_EXECUTION_MODES`

`frozenset`: `mutation_service`, `project_generate_async`, `imc_research`, `marketing_tool_agent`.

Любое другое значение из модели при нормализации отбрасывается или заменяется дефолтом секции (`amka_section_mapping.default_execution_mode_for_section`).

### `AMKA_ANALYSIS_REGISTRY_MARKDOWN`

Краткие описания режимов на русском для вставки в system/user промпт плана: когда брать мутации, когда async generate, когда ИМК, когда tool-agent (+ напоминание про комбинацию с `operations`).

## Использование

Импортируется **`amka_llm_plan`**, **`amka_plan_candidates`**, **`amka_preset_merge`** (валидация пресетов).

## Инварианты

- Изменение набора строк режима требует согласованного обновления **нормализации плана** и **исполнителя** `amka_phase_execute_section`.
