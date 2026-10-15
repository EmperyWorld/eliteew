# UGS: идемпотентность и пути создания `GenerationRequest`

## Где создаётся запись

SQLAlchemy-модель **`GenerationRequest`** добавляется в сессию только в **`UnifiedGenerationService`** (`shared/api/services/ugs/unified_generation_service.py`): ветки **`generate`** и **`start_generation_for_stream`** (два места с `GenerationRequest(...)`).

Вне этого модуля отдельных `GenerationRequest(...)` в API нет.

## Публичный HTTP-контракт

Роутер **`api.routers.ugs`** (пакет `shared/api/routers/ugs/`):

- поле тела **`idempotency_key`**;
- либо заголовки **`Idempotency-Key`** / **`X-Idempotency-Key`** (см. `_idempotency_key_from_body_or_headers`).

Ключ передаётся в **`generate`** / **`start_generation_for_stream`**. Повтор с тем же ключом и пользователем возвращает существующий **`request_id`** в допустимых статусах (см. `IDEMPOTENT_REUSABLE_STATUSES` и `_find_latest_idempotent_request` в сервисе).

Индекс **`idx_generation_requests_idempotency_lookup`** (миграция `shared/api/migrations/applied/20260519_generation_requests_idempotency_lookup.sql`) ускоряет поиск по `(user_id, type_id, request_metadata->>idempotency_key)`.

## Внутренние вызовы (без HTTP-заголовка)

Сервисы вызывают **`UnifiedGenerationService.generate`** или **`start_generation_for_stream`** без ключа, если идемпотентность на уровне продукта не нужна:

- **`run_studio_ugs_generate`** (`creative_studio_utils.py`) — опциональный аргумент **`idempotency_key`** (проброс в `generate`), если студия передаст ключ из своего роутера;
- **`POST /api/v1/image-studio/*/stream`** (`routers/image_studio_stream.py`) — SSE через UGS queue; JSON `idempotency_key` и/или заголовки **`Idempotency-Key`** / **`X-Idempotency-Key`** (multipart: form field + headers); **`find_studio_ugs_idempotent_reuse`** перед `start_generation_for_stream`; in-progress → **409** `image_studio_in_progress`. Legacy sync **`POST /api/v1/image-studio/*`** без `/stream` — **410** `image_studio_sync_retired`; канон — **`documentation/product/IMAGE-STUDIO.md`**;
- **`POST /api/v1/music-generator/generate`** — поле **`idempotency_key`** (UUID) в JSON и/или заголовки **`Idempotency-Key`** / **`X-Idempotency-Key`**; до вызова UGS выполняется **`find_studio_ugs_idempotent_reuse`**, повтор с тем же ключом не вызывает **`run_studio_ugs_generate`** повторно; in-progress → **409** `music_generate_in_progress`;
- **`imperorg_service`**, **`doc_editor_service`**, **`elite_orchestrator`** и др. — по необходимости можно добавить ключ при появлении сценария retry.

## RabbitMQ worker

Имя клиента в **management UI** (список соединений) задаётся **`QUEUE_WORKER_CONNECTION_NAME`**: в URL добавляется query-параметр **`name=`** (см. `api/workers/queue_worker_retry.queue_worker_rabbitmq_connection_tuning`).

**`channel.set_qos(prefetch_count=…)`** задаётся через **`QUEUE_WORKER_PREFETCH_COUNT`** (по умолчанию **1**): несколько низкоуровневых доставок без ack; для GPU/UGS рекомендуется оставить 1, иначе растёт риск параллельной нагрузки на провайдер.

Между повторными попытками обработки сообщения (см. `api/workers/queue_worker.py`; лимит запусков handler — **`QUEUE_WORKER_MAX_ATTEMPTS`**, по умолчанию 3) применяется **экспоненциальный backoff** перед повторной публикацией в ту же очередь (расчёт в `api/workers/queue_worker_retry.py`): база `min(2**attempt, cap)` секунд + джиттер, `cap` из **`QUEUE_WORKER_RETRY_BACKOFF_CAP_SEC`** (по умолчанию 120, макс. 600). Отключение: **`QUEUE_WORKER_RETRY_BACKOFF=0`**.

**`handle_ugs_generation`** (`workers/queue_handlers.py`) вызывает **`process_queued_request(request_id)`**.

**`process_queued_request`** при статусах **`completed` / `failed` / `cancelled`** сразу возвращает результат без повторного списания и без повторной тяжёлой работы — это базовая идемпотентность при redelivery сообщения.

## Очередь: lease в Redis + Postgres fallback

Перед тяжёлой работой воркер пытается взять **lease** (`SET` с `NX` в Redis, ключ `eliteew:ugs:worker_lease:{request_id}`, TTL по умолчанию из **`UGS_WORKER_LEASE_SECONDS`**, default 7200 с). Если lease уже удерживается другим consumer’om, текущая доставка считается дубликатом: провайдер **не** вызывается (сообщение ack’ится).

**Если Redis недоступен**, воркер пробует **`pg_try_advisory_lock(k1, k2)`** на **той же** AsyncSession, что выполняет генерацию. Токен lease: `pg:{k1}:{k2}`; release — `pg_advisory_unlock` в `finally`.

Для **долгих** Redis-lease TTL продлевается из callbacks прогресса (`UGS_WORKER_LEASE_TOUCH_INTERVAL_SEC`, default 120 с). Postgres advisory lock touch не требует.

Реализация: `api/services/ugs/queue_worker_resilience.py`, вызов с `db=service.db` из `queue_worker_execution.py`.

## Вложенный generate() в queue worker

`ugs_execution_context.py` хранит активный worker `request_id`. Вложенный `generate()` / stream без `skip_queue` автоматически переводится в direct path (EWRP / nested UGS).

## Периодическая подчистка (Celery)

Помимо вызовов из UGS HTTP (листинг, health), **`cleanup_stale_request_states`** может запускаться по расписанию: задача **`api.tasks.ugs_stale_request_reaper.run_ugs_stale_request_cleanup_task`** (beat интервал из **`UGS_STALE_REAPER_INTERVAL_MINUTES`**, по умолчанию **15** мин, см. `api/tasks/celery_app.py`). Отключение: **`UGS_STALE_REAPER_ENABLED=0`**. Конкретные **пороги** «зависших» `pending` / `processing` (по умолчанию 30 мин / 6 ч / 12 ч, переопределение **`UGS_STALE_*`**) описаны в **`UGS-QUEUE-OPERATOR-ENV.md`** (секция stale-reaper).

## DLQ и Postgres

Тело сообщения в DLQ (JSON) для наблюдаемости содержит **`source_queue`** (имя основной очереди RabbitMQ); см. **`UGS-QUEUE-OPERATOR-ENV.md`**.

После исчерпания ретраев RabbitMQ сообщение уходит в **DLQ**. Для **`task_type=ugs_generation`** вызывается **`maybe_mark_ugs_request_failed_from_dlq`**: если `generation_requests` ещё не в финальном статусе, строка помечается **`failed`**, в **`request_metadata`** добавляются поля `queue_worker_dlq`, `queue_worker_failed_attempts`, `queue_last_error` и при наличии в теле DLQ — **`queue_worker_source_queue`** (имя основной RabbitMQ-очереди); выравнивается статус очереди и метрика завершения. Ошибки записи в БД не рвут consumer (best-effort).

Если у запроса уже было ненулевое **`credits_used`** (редкий сценарий / будущие пути списания до финала), выполняется **best-effort возврат** через **`BillingService.refund_credits`** (отключение: **`UGS_DLQ_REFUND_CREDITS=0`**).

## Сводка env для оператора

Таблица переменных окружения (очередь, Redis lease, backoff, Celery, DLQ refund): **`UGS-QUEUE-OPERATOR-ENV.md`**.
