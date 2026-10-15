# Модуль · `amka_preset_merge.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_preset_merge.py`

## Назначение

**Вставка** задач из пресета в массив `master_plan.tasks` после сборки плана: якорь `insert_after_section_key`, валидация `section_key` / `execution_mode` через тот же код, что и сохранение пресета.

## Связь

Вызывается из **`amka_phase_plan.run_plan_background`** после `build_master_plan`, если для run загружен `preset_config`.

## Инварианты

- Пресет **не** заменяет аудит и не меняет baseline; только дополняет **tasks**.
