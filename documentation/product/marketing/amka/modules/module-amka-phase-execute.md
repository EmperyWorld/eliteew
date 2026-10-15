# Модуль · `amka_phase_execute.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_phase_execute.py`

## Назначение

**Фоновое исполнение** очереди шагов: поочерёдно `execute_section`, учёт **`per_step_execution`** (переход в `awaiting_step_approval`), после успешной цепочки — **`run_final_assessment`**, обновление run в `completed` / `failed`, **auto-cycle**.

## Ключевая функция

`run_execute_background(svc, run_id, user_id)` — цикл по шагам из store, вызов `_execute_section_step` / финал, обработка отмены и ошибок.

## Связь

Импортирует **`run_execute_section_step`**, **`run_final_assessment`**; использует `amka_service_support._spawn_background` / статусы.

## Логи

События с `phase=execute` (см. workflow-док).
