# AMKA · фоновые задачи asyncio (`_spawn_background`)

Статус: операторская и инженерная справка после унификации волны 19 (plan / execute / auto-chain через `MarketingCabinetAmkaDriver`).

Связано: `shared/api/services/marketing_cabinet/amka_background_tasks.py` (`AMKA_BACKGROUND_TASKS`, `_spawn_background`), `shared/api/services/marketing_cabinet/amka_background_task_keys.py`, `shared/api/services/marketing_cabinet/amka_run_lifecycle.py` (`cancel_run`).

## Ключи задач

| Префикс / формат | Когда ставится | Отмена при `cancel_run` |
|------------------|----------------|-------------------------|
| `amka-plan:{run_id}` | Старт/повтор фонового плана | Да |
| `amka-exec:{run_id}` | Фоновое исполнение шагов | Да |
| `amka-auto-chain:{run_id}:{uuid}` | После успешного завершения execute — попытка следующего прогона в `auto_cycle` | Да (все ключи с префиксом `amka-auto-chain:{run_id}:`) |

`run_id` — UUID прогона в строковом виде, как в строке БД.

## Инvariants

1. Постановка плана и execute из lifecycle и из `amka_phase_plan` идёт через **`schedule_marketing_amka_plan_background`** / **`schedule_marketing_amka_execute_background`** (`shared/api/services/marketing_cabinet/amka_driver_background_schedule.py`) → методы драйвера (`shared/api/services/amka_core/marketing_driver.py`).
2. Цепочка auto-cycle ставится только через **`schedule_marketing_amka_auto_chain_background`** (тот же драйвер), вызывается из `shared/api/services/marketing_cabinet/amka_phase_execute.py` после перевода прогона в `completed`.
3. Уникальный суффикс в `amka-auto-chain` нужен, чтобы не блокировать повторную постановку той же цепочки из-за проверки «задача уже running» в `_spawn_background` (`amka_background_tasks.py`).

## Что не является фоновой задачей AMKA

Дочерние корутины, не регистрируемые в `AMKA_BACKGROUND_TASKS`, здесь не перечисляются (IMC wait, rate limits и т.д.).
