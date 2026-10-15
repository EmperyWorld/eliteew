# Модуль · `amka_run_lifecycle.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_run_lifecycle.py`

## Назначение

Публичные операции жизненного цикла: **список/деталь**, **create** (частично через сервис), **approve/resume/cancel**, **skip** секций и операций, **apply_plan_and_start_execute**, коэрции `skip_*`, **auto-cycle** следующего прогона.

## Ключевые функции

| Функция | Назначение |
|---------|------------|
| `coerce_amka_skip_section_keys` / `skip_operation_keys` / `skip_step_ids` | Нормализация тел approve/resume |
| `filter_plan_tasks_operations` / `apply_skip_operation_keys` | Вычёркивание операций с заданным `operation_key` из master_plan и pending `plan_payload` |
| `skip_execute_section_steps` | Пометка шагов `skipped` до исполнения |
| `apply_plan_and_start_execute` | После approve: обновить run → `queued`, сбросить skip, **spawn** `_run_execute_background` |
| `maybe_start_next_auto_amka_cycle` | Создание следующего run в группе auto-cycle |

## Инварианты

Мутации run проходят через **`_get_run_checked(..., for_mutation=True)`** и проверку доступа к проекту.
