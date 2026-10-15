# Модуль · `amka_phase_execute_section.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_phase_execute_section.py`

## Назначение

**Один** шаг `execute_section`: разбор `plan_payload`, извлечение аудита секции из `context_payload.section_audits`, ветвление по **`section_key`** и **`execution_mode`**:

1. **`imc`** → `_run_imc_research_for_section` (+ опционально `execute_operations`).
2. **`marketing_tool_agent`** (не client_interaction) → tool-agent + опционально мутации.
3. Ненулевые **`operations`** → materialize + `execute_operations`.
4. **`client_interaction`** → `_execute_client_interaction_step`.
5. Секция без автозаполнения → report-only markdown.
6. **`write_policy == report_only`** → report-only.
7. Иначе **`_run_project_generate_async_for_section`**.

Дополнительно для **`section_key == value`**: пост-метрики связей VP↔JTBD (`snapshot_value_prop_ids_with_jtbd_links`).

## Связь

Дефолт режима: **`default_execution_mode_for_section`**.

## Инварианты

ИМК в этой ветке **не** перекрывается произвольными operations до запуска исследования — порядок зафиксирован в коде (сначала ИМК, потом мутации из плана).
