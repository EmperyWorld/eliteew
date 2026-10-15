# Stack1 PostgreSQL: тюнинг и UGS deadlocks

Полный отчёт major-upgrade окна (версии, rollback-набор, post-upgrade evidence):
[PROD-DB-CONTOUR-UPGRADE-2026-06-19.md](PROD-DB-CONTOUR-UPGRADE-2026-06-19.md).

## Память и соединения (п. 1)

Файл конфигурации монтируется в контейнер как postgresql.conf *[runtime under docker/data/stack1/postgresql/]* (см. `docker/stack/stack1.yml`). Рекомендуемые значения под лимит контейнера **24G RAM** (reservation **16G**) и комментарии в compose:

| Параметр | Было (типично) | Стало |
|----------|----------------|--------|
| `max_connections` | 100 / 200 | **300** (один инстанс: `ai_services` + `paperless` + др.; см. бюджет ниже) |
| `shared_buffers` | 128MB | **4GB** |
| `work_mem` | по умолчанию 4MB | **4MB** при `max_connections=300` (снижает риск пика `work_mem` × активных запросов); при **200** коннектах можно **8MB** |
| `maintenance_work_mem` | по умолчанию 64MB | **256MB** |
| `effective_cache_size` | закомментировано / 4GB | **12GB** (подсказка планировщику) |
| `random_page_cost` | 4.0 | **1.1** (SSD) |
| `effective_io_concurrency` | 1 | **200** |
| `log_lock_waits` | off | **on** |
| `max_wal_size` | 1GB | **8GB** через `docker/stack/stack1.yml` `command -c` и tuning-apply |
| `shared_preload_libraries` | empty | **`pg_stat_statements`** (restart required) |

Полный remediation 2026-07-11 (purge/vacuum/drop unused DBs): one-shot soft-retired → `trash/` (`STACK1-POSTGRES-REMEDIATION-2026-07-11.md`); living tuning is **this document** + [PROD-DB-CONTOUR-UPGRADE-2026-06-19.md](PROD-DB-CONTOUR-UPGRADE-2026-06-19.md).

### pg_stat_statements

`docker/scripts/stack1-postgres-tuning-apply.sh` sets `shared_preload_libraries = 'pg_stat_statements'`, `pg_stat_statements.max = 10000`, `pg_stat_statements.track = all`. After restart:

```bash
podman exec stack1-postgres bash -c \
  'psql -U "$POSTGRES_USER" -d ai_services -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"'
```

Then use [AI_SERVICES_PG_MEASURE.sql](AI_SERVICES_PG_MEASURE.sql).

## Бюджет соединений (RAG, воркеры, Paperless)

`max_connections` в Postgres — **на весь инстанс**, не на одну БД. Клиенты: несколько контейнеров EliteEW (каждый держит пул SQLAlchemy **и** отдельный пул **asyncpg** для RAG/vault и сырых запросов), Paperless, ручные `psql`, миграции.

Формула на один процесс API/воркера EliteEW:

`per_process_max = POSTGRES_POOL_SIZE + POSTGRES_MAX_OVERFLOW + ASYNCPG_POOL_MAX_SIZE`

Сумма по всем таким процессам + оценка для остальных сервисов должна укладываться примерно в **75–80%** от `max_connections`, иначе в csvlog появляется `FATAL 53300 sorry, too many clients already`.

Дефолты в коде (`unified_config`): **10 + 15 + 5 = 30** на процесс. Example/staging env часто уже уже: см. таблицу. На prod-core baked E0 split — **семь** процессов с пулами (api, api-worker, celery general / agentic / companion / discussion, celery-beat). При необходимости нагрузки поднимайте `max_connections` (скрипт ниже) **или** пулы точечно через Config Plane — **не оба** без пересчёта RAM; **не** bump пула как единственный ответ на CM scroll ERR.

### Бюджет-таблица (ориентир)

| Процесс (stack0) | Типичный `POOL+OVERFLOW+ASYNCPG` | Примечание |
|------------------|-----------------------------------|------------|
| `stack0-eliteew-api-prod-baked` | prod observed **6+6+3 = 15** | `API_WORKERS=1`; CM blob scroll бьёт SQLAlchemy |
| `stack0-eliteew-api-worker-prod-baked` | same env family | queue/RAG asyncpg |
| celery general / agentic / companion / discussion | same family | ×4 |
| celery-beat | same family | low steady |
| **Σ EliteEW (если все 15)** | **~105** | при max_connections=300 → запас под Paperless/psql |
| Paperless + ad-hoc | reserve | не ешь 100% max_connections |

Пересчёт перед любым env change:

```text
sum(per_process_max × processes) + non_EliteEW  ≤  0.75 … 0.80 × max_connections
```

### CM gallery / auth hold (не путать с storage quarantine)

`require_oauth2_user` → `Depends(get_postgres_session)` удерживает SQLAlchemy checkout на **весь** streaming `GET /api/v1/content/{id}/download|thumbnail`. Плотный скролл сетки → in-flight downloads × 1 checkout ≤ `POOL+OVERFLOW` (prod API: **12**) → `[ERR] Failed to set encryption.pii_key … QueuePool limit`.

| Сигнал | Класс |
|--------|--------|
| `[WRN] content_storage_quarantine` / download 404 | storage integrity (broken files SoT) |
| `[ERR] encryption.pii_key` + `QueuePool` | auth session pool saturation |

**Cause-first план** (канон/тесты → short auth hold → pii fail-closed → FE concurrency; capacity только после measure): `documentation/plans/platform/API-AUTH-SESSION-POOL-AND-CONTENT-BLOB-PERF-PLAN.md` *[operator-local process plan; gitignored — not living canon]*.

### Observability names (target counters)

| Name | Meaning |
|------|---------|
| `sqlalchemy_pool_checked_out` | текущий checkout count (process) |
| `sqlalchemy_pool_timeouts_total` | QueuePool acquire timeouts |
| `encryption_pii_key_set_fail_total` | fail to set key (должен ≈ timeout/fail-closed, не soft-skip) |
| `content_blob_sa_hold_seconds` | (после Wave 1 → 0 on retrieve path) auth SA hold duration on blob routes |

Реранк RAG идёт в **stack2 по HTTP** и к Postgres не добавляет коннекты; индексация desktop RAG читает `unified_content` через asyncpg и пишет в Qdrant.

Применение на хосте (нужны права на файл тома; на prod-core conf часто uid 999 — `podman unshare` или sudo):

```bash
cd /path/to/powered_by_emperyworld
sudo ./docker/scripts/stack1-postgres-tuning-apply.sh
# or: podman unshare env STACK1_POSTGRESQL_CONF=postgresql.conf *[runtime under docker/data/stack1/postgresql/]* \
#        bash docker/scripts/stack1-postgres-tuning-apply.sh
podman restart stack1-postgres
podman exec stack1-postgres bash -c \
  'psql -U "$POSTGRES_USER" -d ai_services -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"'
```

Проверка (на хосте `$POSTGRES_USER` часто **не** экспортирован — бери пользователя из env **контейнера**):

```bash
podman exec stack1-postgres bash -c 'psql -U "$POSTGRES_USER" -d postgres -c "SHOW shared_buffers; SHOW max_connections; SHOW work_mem; SHOW shared_preload_libraries;"'
```
Либо с хоста после `set -a && source docker/env_file/.env.stack1 && set +a` — тогда сработает `psql -U "$POSTGRES_USER"`.

**Роль `postgres`:** в этом кластере суперпользователь задаётся **`POSTGRES_USER`** (часто `ai_user`), отдельной роли `postgres` может не быть. Подключения вида `psql -U postgres` дают в CSV `FATAL: role "postgres" does not exist`. Всегда используйте **`docker exec stack1-postgres bash -c 'psql -U "$POSTGRES_USER" ...'`** или переменные из `docker/env_file/.env.stack1`.

## UGS очередь и deadlocks (п. 2)

В логах CSV мог не попасть текст `deadlock` (редкие события); счётчик `pg_stat_database.deadlocks` по `ai_services` накопительный.

Код: **`shared/api/services/ugs/queue_manager_service.py`**

- `get_next_requests`: `FOR UPDATE OF generation_queue SKIP LOCKED`, затем явная блокировка `generation_requests` в порядке **`ORDER BY id`**.
- `update_queue_status`: выбор строки очереди с **`FOR UPDATE`** до изменения/удаления.

Это унифицирует порядок блокировок с типичным сценарием «сначала очередь, затем запрос».

## Индексы и измерения (план perf)

- SQL для оператора: **`platform/docker-re_doc/AI_SERVICES_PG_MEASURE.sql`** — `pg_stat_statements`, индексы, мёртвые строки.
- Миграция индексов (после ревью планов): `shared/api/migrations/applied/20260404_ai_services_perf_indexes.sql` (`CREATE INDEX CONCURRENTLY`).

## VACUUM / bloat / autovacuum

Периодически смотреть для `generation_requests`, `unified_content`, `generation_queue`:

- `n_dead_tup`, `last_autovacuum`, `last_autoanalyze` — см. блок (3) в `AI_SERVICES_PG_MEASURE.sql`.
- При высоком `n_dead_tup` и редком autovacuum: одноразово в окно низкой нагрузки  
  `VACUUM (ANALYZE) public.generation_requests;` (и при необходимости соседние таблицы).
- Тонкая настройка: `ALTER TABLE ... SET (autovacuum_vacuum_scale_factor = 0.05)` только после метрик по конкретной таблице.

Суммарные клиенты приложения к Postgres не должны стабильно упираться в `max_connections` (см. env пула API в `STACK0` / `unified_config`).

## Desktop RAG, Qdrant и SeaweedFS (`unified-content`)

Индексация вложений Ассистент пишет векторы в **Qdrant** (коллекция `desktop_chat_rag`). Текст чанков берётся из Postgres — поле **`unified_content.extracted_text`** (заполняется при загрузке/обработке файла, часто с чтением объекта из **SeaweedFS**).

Если в логах **SeaweedFS filer** видны **404** на chunk при чтении путей вида `/buckets/unified-content/...`, объект мог быть потерян или рассинхронизирован с volume: тогда `extracted_text` может быть пустым, а RAG не проиндексируется или даст слабый контекст. Действия оператора: восстановить целостность хранилища; затем повторить индексацию (повторное добавление вложения с тем же `content_id` через API или внутренний вызов `index_unified_content_desktop_chat_rag`).

Удаление вложения из чата: **`DELETE /api/v1/desktop/ai-chat/chats/{chat_id}/attachments/{attachment_id}`** — удаляет строку вложения и точки Qdrant для пары `chat_id` + `content_id`.

**Реранк** (`RAG_RERANK_BASE_URL` → stack2 `llama-rerank`, HTTP) к Postgres не подключается.

## UGS / RabbitMQ: метрики и ориентиры для алертов

Экспорт Prometheus (API): `ugs_queue_*`, `ugs_queue_pending_oldest_age_seconds`, `rabbitmq_queue_messages_ready{queue=...}` (обновление глубины RabbitMQ — HTTP Management API, раз в `HEALTH_CHECK_INTERVAL_SEC` вместе с health).

Ориентиры (подстроить под продукт):

- `rabbitmq_queue_messages_ready` по основным очередям (`ai.generation.queue`, DLQ) стабильно **> N** (например 100) — разобрать consumer/воркеры.
- `ugs_queue_pending_oldest_age_seconds` **> 900** (15 мин) при ненулевой очереди — проверить UGS-провайдеры и блокировки БД.
- Рост `ugs_generation_failures_total` при стабильном трафике — логи API и провайдеров.

## LLM (stack2) под нагрузкой

Сервис: [`docker/stack/stack2.yml`](../../../docker/stack/stack2.yml), основной chat-контейнер обычно `stack2-llama-chat` (tool router/embedding/rerank — по профилям и роли). Долгие `POST /v1/chat/completions` при конкуренции запросов ожидаемы; при нехватке GPU/RAM снижайте `LLAMA_*` параметры (`ctx`, `ubatch`, `parallel`) и проверяйте одновременную нагрузку chat + embed/rerank sidecar-ов. Шум `init: embeddings required...` в логах llama.cpp при эмбеддингах сам по себе не означает падение HTTP.
