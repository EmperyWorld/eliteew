# UGS queue operations runbook

**Дата:** 2026-05-27
**Область:** операторский troubleshooting UGS через RabbitMQ, Redis lease, Celery stale reaper.

Связанные документы: [UGS-QUEUE-OPERATOR-ENV.md](./UGS-QUEUE-OPERATOR-ENV.md), [UGS-IDEMPOTENCY.md](./UGS-IDEMPOTENCY.md), [UGS-FLOW-AND-CONFIG.md](../../product/UGS-FLOW-AND-CONFIG.md).

---

## 1. Быстрый снимок

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://app.eliteew.ru/api/v1/ugs/admin/queue-ops" \
  | jq '{status, hints, postgres: .postgres.stale_candidates, rabbitmq: .rabbitmq.queues}'
```

| Поле | Смысл |
|------|--------|
| `status` | `healthy` / `degraded` |
| `operator_slo` | Derived cues: `level`, `pending_oldest_age_seconds`, `failed_share`, `stale_total`, `dlq_finalized_failed_24h` (no Prometheus) |
| `hints[]` | Коды алертов с текстом |
| `postgres.stale_candidates` | Сколько строк попадут под stale-cleanup (`pending_orphan`, `pending_in_queue`, `processing`, `total`; legacy aliases остаются для backward-compat) |
| `redis.ugs_worker_leases.active_leases` | Активные Redis lease воркеров |
| `postgres.dlq_finalized_failed_24h` | UGS failed через DLQ за 24 ч |

---

## 2. Alarm-коды и действия

### `beat_on_workers_off`

Backlog > 0, stale reaper включён, **0** активных Redis lease.

1. Контейнер queue worker: `docker ps --filter name=queue-worker`
2. `ENABLE_QUEUE_UGS=1`
3. RabbitMQ consumer (`QUEUE_WORKER_CONNECTION_NAME` в UI)
4. Логи: `podman logs stack0-eliteew-api-worker-prod-baked 2>&1 | tail -100`

### `redis_lease_unavailable`

Redis недоступен — воркер использует **Postgres advisory lock** на DB-сессии. Восстановить Redis; мониторить DLQ.

### `queue_depth_sustained` / `queue_age_sustained`

Проверить prefetch, GPU/ComfyUI, stale reaper beat. См. [UGS-QUEUE-OPERATOR-ENV.md](./UGS-QUEUE-OPERATOR-ENV.md).

### `dlq_messages_ready`

Ready messages in any `*.dlq` queue (RabbitMQ Management snapshot).

**Documents path (`documents.processing.queue.dlq`):** not UGS generation. Typical poison after `QUEUE_WORKER_MAX_ATTEMPTS`:

| Symptom in payload `last_error` | Cause | Fix in product |
|---------------------------------|-------|----------------|
| `string is too long for tsvector` | Huge `extracted_text` hits expression GIN `to_tsvector` on `unified_content` | Clamp in `ContentProcessor.update_content` (`clamp_extracted_text_for_fts`) |
| `cannot identify image` / HEIC | Pillow without HEIF opener | Honest `unsupported_image_format:…`; processor `failed` **acks** (no raise → no DLQ retry storm) |

1. Peek DLQ (management API `ack_requeue_true`) — `task_type`, `content_id`, `last_error`.
2. Confirm `unified_content.processing_status` already `failed`.
3. After cause-fix is deployed, **purge** remaining poison (`ack_requeue_false` / purge) so queue-ops returns `healthy`.
4. Do **not** confuse with `ai.generation.queue.dlq` / `postgres.dlq_finalized_failed_24h` (UGS).

### `dlq_failures_recent`

`postgres.dlq_finalized_failed_24h > 0`: за последние сутки были финализации через DLQ.

1. Проверить `request_metadata.queue_worker_source_queue` у последних failed задач.
2. Сверить `QUEUE_WORKER_MAX_ATTEMPTS`, `QUEUE_WORKER_RETRY_BACKOFF*`.
3. Проверить логи воркера на `Queue handler exhausted retries -> DLQ`.

---

## 3. Зависшие `processing`

| Причина | Механизм |
|---------|----------|
| Detached SSE crash | `finalize_detached_generation_failure` → `detached_execution_crash` |
| Worker dead | Celery stale reaper (default 12 h processing) |
| Pending orphan | 30 min stale reaper |

```bash
docker logs stack0-eliteew-api-prod 2>&1 | rg 'Detached direct generation failed|finalize_detached_generation_failure'
```

---

## 4. Smoke после деплоя

Автоматизированный CLI (command-center или prod-core с доступом к `:29000`):

```bash
# Базовый снимок (без auth — providers/status и queue-ops пропускаются при 401)
bash docker/scripts/ugs-stack0-smoke.sh

# Полный operator snapshot (OAuth access token UGS admin)
TOKEN='<access_token>' bash docker/scripts/ugs-stack0-smoke.sh

# Path proof: short SSE generate→result (billing may apply; default type_key=text_chat)
TOKEN='<access_token>' UGS_SMOKE_SSE=1 bash docker/scripts/ugs-stack0-smoke.sh

# Переопределение базы / ComfyUI
API_BASE=http://127.0.0.1:29000 COMFY_BASE=http://192.168.1.141:31003 bash docker/scripts/ugs-stack0-smoke.sh
```

| Env | Default | Назначение |
|-----|---------|------------|
| `API_BASE` | `http://127.0.0.1:29000` | Stack0 API root |
| `TOKEN` / `UGS_ADMIN_TOKEN` | — | Bearer для `providers/status` и `admin/queue-ops` |
| `COMFY_BASE` | `http://192.168.1.141:31003` | ComfyUI `GET /system_stats` (non-fatal) |

Проверки скрипта:

1. `GET /api/health`
2. `GET /api/v1/ugs/health` — `status` + `providers`
3. `GET /api/v1/ugs/providers/status` — `summary.total`, массив `providers` (при `TOKEN`)
4. `GET /api/v1/ugs/admin/queue-ops` — `status` + `operator_slo` (при `TOKEN`)
5. ComfyUI `GET /system_stats` на gpu141 (warn-only)
6. Optional (`UGS_SMOKE_SSE=1` + `TOKEN`): `POST /api/v1/ugs/generate/stream` → terminal `event: result` (default `type_key=text_chat`; override via `UGS_SMOKE_TYPE_KEY` / `UGS_SMOKE_PROMPT`)

Ручной чеклист (UI):

1. Hub: короткая SSE-генерация → `completed`
2. UGS Hub (admin): «Воркфлоу» → strip снимка очереди; клик → UGS Admin. «Обзор» **без** полного queue-ops panel
3. `GET /api/v1/ugs/tasks/tray-summary` — `recent_transitions` обновляется

---

## 5. UGS Hub operator UI (2026-07)

| Элемент | Назначение |
|---------|------------|
| `UgsHubQueueOpsStrip` | Компактный статус на «Воркфлоу» (admin) → клик на UGS Admin |
| `UgsHubQueueOpsPanel` | Полный снимок очереди — isolation / Admin surfaces; **не** на Overview |
| `UgsHubShellHeader` provider alert | При деградации каналов показывает count + tooltip с проблемными провайдерами и shortcut в `UGS Admin` |
| Scroll sentinel + «Загрузить ещё» | Infinite tasks (`useUgsTasksInfinite`) |
| Backlog prefetch | Admin: до 3 страниц задач при `total_queued ≥ 20` или warning hints |
| Coalesced fetch | Scroll + prefetch не дублируют параллельный `fetchNextPage` |

## 6. Hot polling cost controls (2026-05)

- `GET /api/v1/ugs/tasks` и `GET /api/v1/ugs/tasks/tray-summary` используют throttled stale cleanup через `maybe_cleanup_stale_request_states`.
- `GET /api/v1/ugs/metrics` и `GET /api/v1/ugs/stats` также используют throttled stale cleanup; полный stale reconciliation остаётся за beat/reaper и force/debug paths.
- `GET /api/v1/ugs/providers/status` имеет короткий in-process TTL для provider probes, чтобы dashboard refresh не создавал burst outbound checks к каждому провайдеру.
- Cache/probe guardrails закреплены тестами `api/tests/test_ugs_health_metrics.py` (fresh-cache hit + stale miss rebuild + failed probe normalization).
- Direct provider execution fails empty/falsy provider payloads instead of marking them completed; regression coverage: `api/tests/test_ugs_stream_and_queue_execution.py`.
- UGS Hub infinite task cache ограничивает активные страницы и защищает compact poll от затирания heavy fields (`input_data`, `result`, `metadata`).
- Queue-ops stale hints считают canonical `stale_candidates.total`, а не сумму canonical+legacy alias keys; regression coverage: `api/tests/test_ugs_queue_ops_snapshot.py`.

E2E (optional): `pnpm run test:e2e:desktop` — см. [DESKTOP-SHELL-E2E-CI.md](../../product/desktop/DESKTOP-SHELL-E2E-CI.md).
