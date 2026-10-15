# RFC-001 · AMKA driver contract

Статус: черновик для реализации.

Этот RFC переводит вектор из `VISION-VECTORS.md` в первый инженерный контракт. Цель — сделать AMKA самостоятельным компонентом, не вынося её преждевременно в отдельный сервис и не смешивая ядро с маркетинговой моделью данных.

## 1. Решение

AMKA делится на три части:

| Слой | Роль |
|------|------|
| `AMKA Core` | Жизненный цикл run, policy gate, trace, artifacts, pulse. Не знает SQL-таблицы домена. |
| `Driver` | Доменный порт Read / Plan / Act / Observe / Policy. Прячет маркетинг, UGS, desktop, документы или другой сервис. |
| `Client facade` | HTTP/UI фасад конкретного клиента. Для первого клиента это существующий Marketing Cabinet AMKA API. |

Первый кодовый срез: `shared/api/services/amka_core/`.

## 2. Минимальный контракт драйвера

Драйвер обязан реализовать:

| Метод | Смысл | Побочные эффекты |
|-------|------|------------------|
| `read(subject)` | Снимок состояния, health, сущности и контекст для анализа. | Нет |
| `plan(subject, snapshot)` | Нормализованные задачи и операции с риском. | Нет |
| `policy(subject, snapshot, tasks)` | Решение auto / semi-auto / denied и причины. | Нет |
| `act(subject, task, decision)` | Исполнение или делегирование нормализованной задачи. | Да |
| `observe(subject)` | Статус долгих задач, версии артефактов, прогресс. | Нет |
| `pulse(subject, snapshot, tasks, traces)` | Человеческий итог: что изменено, сохранено, где сомнение. | Нет |

Интерфейс зафиксирован в `AmkaDriver` (`shared/api/services/amka_core/contracts.py`). Для доказательства независимости ядра есть `ReferenceMockAmkaDriver`, который проходит lifecycle без маркетинговых таблиц, RAG, IMC и UGS.

Волна 5 добавила второй маленький драйвер — `StaticReadOnlyAmkaDriver`. Он не является production-интеграцией, но проверяет важный архитектурный тезис: ядро AMKA умеет исполнять другой профиль (`read_only_audit`) без маркетингового DAG, сущностей кабинета и write-back сервисов.

Волна 7 добавила metadata-каталог driver/profile (`shared/api/services/amka_core/driver_catalog.py`). Он не создаёт драйверы и не импортирует тяжёлые adapters, а фиксирует известные входы: production `marketing_cabinet`, contract-test `reference_mock`, prototype `static_read_only`.

Волны 9–11 добавили core projection (`build_amka_core_run_projection`) и JSON-ready сериализацию каталога (`serialize_amka_driver_catalog`). Это даёт будущему neutral API/UI переносимую форму результата и список известных профилей без подключения marketing persistence.

Волны 12–14 добавили первый store boundary: `AmkaRunStore`, `AmkaStoredRun`, `InMemoryAmkaRunStore`. Это не миграция таблиц и не новый источник истины для production AMKA; это контракт, по которому будущий neutral store сможет сохранять core result/projection без знания маркетинговых таблиц.

Волны 15–17: (1) нейтральная сериализация trace (`trace_serialization.py`), поле `traces` в marketing core-alignment и читаемая секция в `export.md`; (2) `AmkaCoreEngine.run_once_and_persist` для явной записи в `AmkaRunStore`; (3) перенос pipeline timeline (`AmkaPipelineTimeline`, `amkaTimelineModel`) в `src/features/amka/` с re-export из `amkaViewUtils` + planned-каталог entry `ugs_admin` / `model_routing`.

## 3. Статусы и стадии ядра

Стадии ядра:

1. `snapshot`
2. `audit`
3. `plan`
4. `approval`
5. `execute`
6. `final`

Статусы ядра:

| Статус | Когда |
|--------|-------|
| `planning` | Будущий long-running режим планирования. |
| `awaiting_approval` | Есть задачи, но execution не запрошен или policy требует оператора. |
| `running` | Engine исполняет задачи через driver. |
| `completed` | Run завершён, включая валидный no-op. |
| `failed` | Непойманная ошибка конкретной волны выполнения. |
| `cancelled` | Остановка оператором или внешней политикой. |

Текущий Marketing Cabinet API сохраняет собственные статусы `planning`, `awaiting_step_approval`, `queued` и другие. RFC не ломает этот контракт: маркетинговый драйвер мапит их в core-смысл только на новой границе.

## 4. Риск и approval

Каждая операция имеет:

- `operation_key`;
- `kind`;
- `risk`: `read_only`, `low`, `medium`, `high`, `destructive`;
- `reversible`;
- `requires_approval`;
- `payload`.

Правило: destructive-операция не может скрыто пройти через prompt или tool-agent. Она должна попасть в `PolicyDecision.denied_operation_keys` или в явный операторский gate.

## 5. Маркетинг как первый драйвер

Первый production-драйвер — `MarketingCabinetAmkaDriver` (`shared/api/services/amka_core/marketing_driver.py`).

Он оставляет за маркетинговым доменом:

- section keys и DAG зависимостей;
- `build_run_snapshot`, project context, RAG;
- `AmkaMutationService`;
- IMC / UGS;
- async project generate;
- strategy graph reconcile;
- существующие таблицы `marketing_amka_runs` и `marketing_amka_run_steps`;
- маршруты `/api/v1/marketing-cabinet/amka/*`.

Важно: маркетинговый драйвер по-прежнему не встраивает полный execution pipeline (план/execute в фоне) в ядро. Граница расширена: HTTP `approve` / `resume` / `continue-step` / `cancel` делегируют в `MarketingCabinetAmkaDriver.act()`, который вызывает существующий `AmkaService`; фоновые execute-фазы остаются в текущих модулях.

## 6. Reference mock driver

Mock-драйвер нужен как «пустой» эталон:

- engine может завершить run без задач и вернуть no-op pulse;
- engine может остановиться на approval gate;
- engine может выполнить безопасную задачу;
- destructive operation блокируется policy.

Эти свойства закреплены в `shared/api/tests/test_amka_core.py`.

## 7. Trace и artifacts

Core trace — маленькие события:

- `stage`;
- `event`;
- `message`;
- `payload`.

Trace не заменяет structured logs `[AMKA]`, а создаёт переносимый слой для UI, export и будущих драйверов.

Artifacts делятся на:

- машинные: snapshot, plan, operation results, observations;
- операторские: markdown/export;
- переносимые: core/standalone projection для UI и будущего neutral API. Каноничное поле счётчиков статусов — `step_status_counts`; core projection временно также отдаёт `task_status_counts` как поясняющий alias;
- человеческие: `pulse`.

Store boundary сохраняет не доменные сущности, а результат core-run и переносимый projection. Долговременное хранилище для production должно появиться adapter-ом после второго реального driver/profile, а текущие `marketing_amka_runs` остаются каноном маркетингового входа.

## 8. Pulse как часть контракта

`pulse` — не декоративный текст. Это артефакт, который удерживает человеческий смысл run:

- `summary`;
- `changed`;
- `preserved`;
- `doubts`;
- `agreements`;
- `no_change_reason`;
- `next_safe_step`.

Фраза «сейчас лучше ничего не менять» является допустимым успешным исходом, если driver не предложил задач или policy считает действие хуже сохранения состояния.

## 9. Что не делаем в этом RFC

- Не создаём универсальную модель данных AMKA.
- Не переносим текущие таблицы в `amka_runs` одномоментно.
- Не выносим AMKA в отдельный сервис до второго реального драйвера.
- Не убираем Marketing Cabinet API и UI.

## 10. Следующие волны

### Нумерация 18–23 (продолжение реализации)

| Волна | Содержание | Ожидаемый статус |
|-------|-------------|-------------------|
| **18** | Второй **production**-профиль: `UgsAdminAmkaDriver` + DB `model_routes`, HTTP `/api/v1/ewa/ugs/model-routing/core-alignment`, права UGS admin | **Done** (read-only alignment; gate для волны 20 по смыслу RFC сохраняется для нейтрального SoT) |
| **19** | Постепенный перевод фаз marketing execution на методы `MarketingCabinetAmkaDriver` / ядро без ломки HTTP | **Done (v1 driver-boundary scheduling):** HTTP `approve` / `resume` / `continue-step` / `cancel` → `marketing_amka_driver_act_for_http` → `act()`; фоновые **plan** / **execute** / **auto-chain** → `schedule_marketing_amka_*` / `MarketingCabinetAmkaDriver.schedule_background_*` с ключами из [AMKA-BACKGROUND-TASK-KEYS.md](AMKA-BACKGROUND-TASK-KEYS.md); реестр задач — `amka_background_tasks.py`; `cancel_run` отменяет и префикс `amka-auto-chain:{run_id}:` |
| **20** | ADR: нейтральные таблицы `amka_runs` + adapter `AmkaRunStore` **или** явный defer (SoT остаётся `marketing_amka_runs` для маркетинга) | **Done (defer):** [ADR-002-amka-neutral-store-defer.md](ADR-002-amka-neutral-store-defer.md) |
| **21** | Client facade: префикс `/api/v1/ewa/*`, `subject_ref`, обновление [AMKA-ENTRYPOINTS.md](AMKA-ENTRYPOINTS.md) | **Done (v1 scope):** префикс `/api/v1/ewa` + `GET .../driver-catalog` + UGS alignment; маркетинговый основной API остаётся под `/marketing-cabinet/amka` |
| **22** | Дальнейший вынос UI из `AmkaView.tsx` в `src/features/amka/` + Vitest | **Done (v1 shell):** основной composition shell — `src/features/amka/AmkaView.tsx`; `pages/.../AmkaView.tsx` — re-export; мост кабинета — `marketingCabinetAmkaBridge.ts`; pulse после **failed/cancelled** — явное операторское обрамление в `AmkaRunQualityHints` / `AmkaPulsePanel` |
| **23** | Уточнение trace/artifact payload по полевым прогонам (без PII в export) | **Done (baseline code):** guidelines + `trace_serialization.py` + pytest; **полевые** прогоны и ручная проверка `export.md` — по мере данных (см. guidelines) |

### Исходный список (RFC §10 legacy)

1. Перевести отдельные production-фазы marketing execution на driver-методы постепенно.
2. Расширить нейтральные trace/artifact contracts по итогам реальных AMKA прогонов.
3. Вынести больше UI из `pages/MarketingCabinet/views/AmkaView.tsx` в `src/features/amka/`.
4. Спроектировать нейтральные таблицы только после настоящего второго production-драйвера.
