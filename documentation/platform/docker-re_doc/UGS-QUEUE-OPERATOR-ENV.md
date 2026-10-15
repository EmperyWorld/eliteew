# UGS / RabbitMQ queue: переменные окружения (оператор)

Краткий каталог **env**, влияющих на устойчивость UGS при работе через **RabbitMQ**, **Redis**, **Celery** и финализацию **DLQ**. Детали контрактов — в **`UGS-IDEMPOTENCY.md`**.

| Переменная | Где читается | По умолчанию | Смысл |
|------------|----------------|----------------|--------|
| **`UGS_WORKER_LEASE_SECONDS`** | `queue_worker_resilience.py` | `7200` | TTL Redis-ключа `eliteew:ugs:worker_lease:{request_id}` (single-flight воркера); диапазон 60–86400 с. |
| **`UGS_WORKER_LEASE_TOUCH_INTERVAL_SEC`** | `queue_worker_resilience.py` | `120` | Минимальный интервал продления TTL lease из callback прогресса провайдера; 30–3600 с. |
| **`QUEUE_WORKER_CONNECTION_NAME`** | `queue_worker_retry.py` | `eliteew-queue-worker` | Имя клиента в RabbitMQ (**management UI** / connection list): добавляется в AMQP URL как query `name=` (до **128** символов). Если в `RABBITMQ_URL` уже есть `name=`, параметр не дублируется. |
| **`QUEUE_WORKER_RETRY_BACKOFF`** | `queue_worker_retry.py` | `1` (вкл.) | `0` / `false` / `no` — без задержки перед повторной публикацией после ошибки handler. |
| **`QUEUE_WORKER_RETRY_BACKOFF_CAP_SEC`** | `queue_worker_retry.py` | `120` | Верхняя граница базы backoff (сек); максимум 600. |
| **`QUEUE_WORKER_MAX_ATTEMPTS`** | `queue_worker_retry.py` | `3` | Сколько раз может выполниться **handler** для одного сообщения (поле `attempt` 0…N−1), затем **DLQ**; **1–20**. |
| **`QUEUE_WORKER_PREFETCH_COUNT`** | `queue_worker_retry.py` | `1` | **QoS prefetch** канала RabbitMQ (сколько сообщений без ack может висеть у consumer). Для тяжёлого UGS/GPU обычно **1**; **1–32**. |
| **`QUEUE_WORKER_ALLOWED_QUEUE_KEYS`** | `queue_worker.py` | *(пусто)* | Список **ключей** очередей из `DatabaseConfig.RABBITMQ_CONFIG["queues"]`; если задан — consumer слушает только их. |
| **`QUEUE_WORKER_LOG_UGS_HANDLER`** | `queue_handlers.py` | *(выкл.)* | `1` / `true` / `yes` / `on` — одна строка **`INFO`** при входе в `handle_ugs_generation` (`request_id`, `attempt`) для трассировки без поднятия общего уровня логов. |
| **`UGS_STALE_REAPER_ENABLED`** | `tasks/ugs_stale_request_reaper.py` | `1` | `0` — не вызывать периодический `cleanup_stale_request_states` из Celery beat. |
| **`UGS_STALE_REAPER_INTERVAL_MINUTES`** | `ugs_stale_horizons.py` → `celery_app.py` (beat) | `15` | Периодичность beat-задачи stale reaper (`run_ugs_stale_request_cleanup_task`); **не** возраст строк в БД; **1–1440** мин. |
| **`UGS_STALE_PENDING_ORPHAN_MINUTES`** | `ugs_stale_horizons.py` | `30` | Сколько минут **`pending`** без строки в `generation_queue` может висеть до stale; диапазон **1–10080** (7 суток). |
| **`UGS_STALE_PENDING_IN_QUEUE_HOURS`** | `ugs_stale_horizons.py` | `6` | Часов для **`pending`** при живой очереди; **1–720** (30 суток). |
| **`UGS_STALE_PROCESSING_HOURS`** | `ugs_stale_horizons.py` | `12` | Часов для **`processing`** до stale (глобальный минимум); диапазон **1–720**. |
| **`UGS_STALE_PROCESSING_HOURS_MUSIC`** | `ugs_stale_horizons.py` | `24` | Category override для music / `music_generator_*`; effective = `GREATEST(default, music, estimated×mult)`. |
| **`UGS_STALE_PROCESSING_HOURS_IMAGE`** | `ugs_stale_horizons.py` | `18` | Category override для image. |
| **`UGS_STALE_PROCESSING_ESTIMATED_MULTIPLIER`** | `ugs_stale_horizons.py` | `3` | Множитель `generation_types.estimated_time` (сек) для per-type processing stale. |
| **`UGS_LIST_STALE_CLEANUP_INTERVAL_SEC`** | `ugs_stale_horizons.py` → `task_listing.py` | `60` | Минимальный интервал между `cleanup_stale_request_states` при **GET /tasks** / tray (0 = каждый запрос; Celery reaper не затрагивается). |
| **`UGS_DLQ_REFUND_CREDITS`** | `queue_worker_resilience.py` | `1` | `0` — не делать best-effort **refund** при финализации из DLQ, если `credits_used` > 0. |
| **`UGS_QUEUE_ALARM_SUSTAIN_SECONDS`** | `monitoring/metrics.py` | `300` | Окно «сохраняется долго» для алертов `queue_depth_sustained` / `queue_age_sustained`. |
| **`UGS_QUEUE_DEPTH_ALARM_THRESHOLD`** | `monitoring/metrics.py` | `200` | Порог `total_queued` для алерта `queue_depth_sustained`. |
| **`UGS_QUEUE_AGE_ALARM_THRESHOLD_SEC`** | `monitoring/metrics.py` | `1800` | Порог возраста oldest pending (сек) для алерта `queue_age_sustained`. |
| **`RABBITMQ_MANAGEMENT_INTERNAL_PORT`** | `database_manager.py` → `fetch_rabbitmq_queues_snapshot` | `15672` | Порт **Management API** внутри stack1 (`stack1-rabbitmq`). Host map — **`RABBITMQ_MANAGEMENT_PORT`** (обычно `30009`). Queue-ops snapshot ходит только на internal port; неверный порт даёт `degraded` при пустой очереди. |
| **`RABBITMQ_HEARTBEAT`** | `infra_client_timeouts` → `aio_pika.connect_robust` (API + `queue_worker`) | `60` | AMQP heartbeat (сек); **10–600**. |
| **`RABBITMQ_BLOCKED_CONNECTION_TIMEOUT`** | `infra_client_timeouts` → `connect_robust` | `300` | Таймаут blocked connection (сек); **30–3600**. |
| **`ELASTICSEARCH_REQUEST_TIMEOUT`** | `infra_client_timeouts` → AsyncElasticsearch / document aiohttp | `60` | Общий request timeout ES (сек). Soft-reconnect: `ELASTICSEARCH_SOFT_RECONNECT_INTERVAL_SEC` (default `60`). См. `STACK1_DATABASES_AUDIT_REPORT.md` §8. |

### Семантика порогов stale-reaper

Задача Celery **`ugs_stale_request_reaper`** вызывает `QueueManagerService.cleanup_stale_request_states` (публичный facade в `queue_manager_service.py`; SQL/throttle — mixin `QueueStaleReconciliationMixin` в `queue_stale_reconciliation.py`). Числа в колонке «порог» — **дефолты** env выше; в БД причина фиксируется так:

| Условие | Порог (по умолчанию) | Поле / причина в метаданных |
|--------|------------------------|----------------------------|
| `pending`, нет живой строки в `generation_queue` | **30 мин** после `queued_at` / `created_at` | `stale_cleanup_reason=stale_pending_orphaned` |
| `pending`, запись в очереди есть | **6 ч** | `stale_pending_queue_timeout` |
| `processing` | **12 h** default; **24 h** music; **18 h** image; также `max(estimated_time × mult)` | `stale_processing_timeout` |

Для `processing` cutoff в SQL: `COALESCE(started_at, …) + GREATEST(horizons) <= :now` (эквивалент `started <= now - horizon`); bind-параметры horizon — **`timedelta`** для asyncpg, не строки `'12 hours'`.

Связанные сервисы: **Redis** (lease, touch), **Postgres** (`generation_requests`, очередь), **RabbitMQ** (основная очередь + `*.dlq`), **Celery beat** (stale reaper — интервал **`UGS_STALE_REAPER_INTERVAL_MINUTES`**, по умолчанию 15 мин; см. `api/tasks/celery_app.py`).

### Сообщения DLQ

Во всех путях в DLQ в JSON добавляется **`source_queue`** — имя **основной** RabbitMQ-очереди (routing key), откуда сообщение попало в DLQ (`*.dlq`). Удобно при агрегировании dead-letter и при расследовании без логов воркера.

При финализации **`ugs_generation`** из DLQ в Postgres в **`request_metadata`** дополнительно может попасть **`queue_worker_source_queue`** (если в JSON DLQ было поле **`source_queue`**).

### Быстрый troubleshooting

| Симптом | Что проверить |
|--------|----------------|
| Запросы «вечно» **processing** | Воркер RabbitMQ, Redis **lease** или **Postgres advisory lock**; логи `UGS worker lease not acquired`; **`QUEUE_WORKER_PREFETCH_COUNT`** не увеличивать без нужды. |
| Redis недоступен | PG advisory lock на worker DB session; runbook **`UGS-QUEUE-OPERATIONS-RUNBOOK.md`**. |
| Рост очереди **`.dlq`** | Тело сообщения: `source_queue`, `task_type`, `last_error`; для UGS после финализации — **`queue_worker_*`** в **`request_metadata`**. |
| **Pending** не уходит в failed сами | **Celery beat** (контейнер с scheduler), **`UGS_STALE_REAPER_ENABLED`**, **`UGS_STALE_REAPER_INTERVAL_MINUTES`**, пороги **`UGS_STALE_PENDING_*` / `UGS_STALE_PROCESSING_*`**. |
| Нужно имя в RabbitMQ UI | **`QUEUE_WORKER_CONNECTION_NAME`** (параметр **`name=`** в AMQP URL). |

Задача beat **`run_ugs_stale_request_cleanup_task`** имеет **per-task** лимиты **soft 120s / hard 150s** (см. `api/tasks/ugs_stale_request_reaper.py`) — **уже**, чем глобальные лимиты в `celery_app.py`.

### Логи воркера

- Опционально: **`QUEUE_WORKER_LOG_UGS_HANDLER`** — одна запись **`INFO`** на сообщение при входе в `handle_ugs_generation` (до `process_queued_request`).
- Невалидный JSON: строка `Invalid queue JSON` + `delivery_tag` + **укороченный** `body_preview` (до ~512 символов).
- Исчерпаны ретраи: **`Queue handler exhausted retries -> DLQ`** с `request_id`, `failed_attempts` и **`max_attempts`** из `QUEUE_WORKER_MAX_ATTEMPTS` (полный traceback остаётся в предшествующем `exception` на последней ошибке handler).

### Снимок очереди без Prometheus

**`GET /api/v1/ugs/admin/queue-ops`** (роль UGS admin) — JSON-снимок для оператора. В **UGS Hub** (вкладка «Воркфлоу», только для UGS admin) компактный статус — `UgsHubQueueOpsStrip` (клик → UGS Admin); полный `UgsHubQueueOpsPanel` на Overview не монтируется. Автообновление снимка — через shared hook раз в 60 с.

- Postgres: `get_queue_stats`, счётчики статусов `generation_requests`, кандидаты на stale-cleanup, `dlq_finalized_failed_24h`;
- RabbitMQ: глубины очередей через **Management API** (`messages_ready`, `messages_unacknowledged`), включая `*.dlq`;
- Redis: число активных ключей `eliteew:ugs:worker_lease:*`;
- `worker_tuning`: текущие env-пороги (lease, prefetch, stale reaper);
- `hints`: короткие подсказки (backlog, DLQ, старый pending, Redis down);
- `hints`: короткие подсказки (backlog, DLQ, старый pending, Redis down, `beat_on_workers_off`);
- `log_grep`: строки для `docker logs` / grep.

Пример (с Bearer-токеном админа):

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://app.eliteew.ru/api/v1/ugs/admin/queue-ops" | jq '.status, .hints, .postgres.stale_candidates, .rabbitmq.queues'
```

Код: `api/services/ugs/queue_ops_snapshot.py`, роут — `api/routers/ugs_admin.py`.

### Alarm-коды и Prometheus

В runtime выставляется `ops_alarm_state{alarm}`:

- `queue_depth_sustained`
- `queue_age_sustained`
- `beat_on_workers_off`

`beat_on_workers_off` также дублируется как hint в `queue-ops`, если backlog > 0 и нет активных Redis lease у воркеров при включённом stale reaper.
