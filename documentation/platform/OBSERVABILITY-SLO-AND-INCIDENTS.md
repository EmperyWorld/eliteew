# EliteEW: наблюдаемость, минимальные SLO и инциденты

## Фактическая инфраструктура (без VictoriaLogs/stack3)

Центральной агрегации логов **нет**: только **вывод контейнеров** и **файлы на хосте**.

- API (prod-core): `podman logs stack0-eliteew-api-prod-baked`, файлы **`docker/logs/stack0/eliteew-api-prod-baked/…`** (локальный `.136` dev может ещё использовать `stack0-eliteew-api-prod`)
- Celery: соответствующие контейнеры stack0 (`*-prod-baked` на `.111`) и каталоги под **`docker/logs/stack0/`**
- Краткий указатель: **`platform/docker-re_doc/AGENT-LOGS-QUICKREF.md`**, обзор стеков: **`platform/DOCKER-STACKS-PROD-OVERVIEW.md`**
- Центральный **stack3 / VictoriaLogs** и LAN HTTPS **stack666** — не living; не требовать их в runbook инцидентов

Документы, ссылающиеся на «центральные логи» или stack3 как на обязательный контур, считаются устаревшими, если не содержат явной пометки «исторически / выключено».

## Минимальные SLI (измерять вручную или скриптами оператора)

| Сигнал | Как смотреть |
| --- | --- |
| Доступность API | `GET /health` — **200**, в контейнере `curl -sf http://127.0.0.1:8000/health` |
| Ошибки приложения | Хвост логов на `ERROR`, `Traceback` (см. release checklist) |
| Auth | Пики `401`/`403` в логах API при неизменном трафике; Keycloak/SSO — [docker-re_doc/KEYCLOAK-ELITEEW.md](docker-re_doc/KEYCLOAK-ELITEEW.md), [SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md](SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md) |
| Очереди / workers | Логи Celery; длина очередей RabbitMQ — по операторскому runbook при симптомах задержек |

Целевые SLO ( starter tier ): **доступность /health** в рабочем окне **99%+** при плановом деплое; релиз не помечаем «ok», если health не зелёный после рестарта.

## Контракты метрик remediation (S0→S3 + ops)

С 2026-05 remediation в API добавлены обязательные метрики для деградаций highload-контуров:

| Метрика | Смысл | Где эмитится |
| --- | --- | --- |
| `event_loop_lag_seconds` | Лаг event loop (просыпание позже ожидаемого интервала) | `DatabaseManager._health_monitor_loop` |
| `embedding_request_duration_seconds{operation,status}` | Латентность embed HTTP (`chat_memory_single`, `chat_memory_batch`) | `chat_memory_service.py` |
| `embedding_retry_outcomes_total{operation,outcome}` | Retry outcome (`retry`, `exhausted`, `non_retryable`) для эмбеддингов | `chat_memory_service.py` |
| `rerank_request_duration_seconds{status}` | Латентность HTTP `/v1/rerank` по статусу | `rerank_client.py` |
| `rerank_retry_outcomes_total{outcome}` | Retry outcome для реранка | `rerank_client.py` |
| `queue_duplicate_suppression_total{source,outcome}` | Срабатывания idempotency/dedup (`companion_turn_dedup`) | `turn_dedup.py` |
| `rabbitmq_queue_messages_ready{queue}` / `rabbitmq_queue_messages_unacked{queue}` | Глубина RabbitMQ по очередям | `rabbitmq_service.py` |
| `ewa_celery_beat_last_success_timestamp_seconds` | Последний успешный heartbeat EWA beat/maintenance в Redis, видимый API scrape | `monitoring/metrics.py`, `tasks/ewa_universal_orphan_reaper.py`, `ewa_platform/workers/celery_beat_guard.py` |
| `ewa_companion_reaper_last_reaped{domain}` | Последний снимок reaper sweep по доменам `music`, `image`, `presentation`, `generic`, `agentic_orphans_swept` | `tasks/ewa_universal_orphan_reaper.py` → Redis → API `/metrics` refresh |
| `ewa_companion_reaper_last_success_timestamp_seconds` | Unix timestamp последнего успешного universal orphan reaper sweep | `tasks/ewa_universal_orphan_reaper.py` |
| `ewa_companion_reaper_runs_total{domain,outcome}` | Счётчик запусков universal reaper по домену и исходу `ok`/`error` | `tasks/ewa_universal_orphan_reaper.py` |
| `ewa_companion_job_enqueue_total{outcome}` | Счётчик durable companion enqueue `enqueued`/`skipped`/`failed` | `ewa_platform/companion/jobs/enqueue.py` |
| `ewa_companion_job_execute_total{outcome,reason}` | Грубый счётчик исполнения durable companion job `ok`/`skipped`/`failed`; `reason` усечён до 40 символов | `ewa_platform/companion/jobs/executor.py` |
| `ops_alarm_state{alarm}` | Флаг операционного алерта (`queue_depth_sustained`, `queue_age_sustained`, `beat_on_workers_off`, `agentic_orphan_sessions`, `ewa_celery_beat_stale`, `ewa_companion_generic_orphans_sustained`, `ewa_media_orphans_sustained`) | `monitoring/metrics.py` + UGS snapshots / agentic + EWA reapers |

## Алерты и пороги (операторский baseline)

`ops_alarm_state` ставится в `1`, когда условие алерта активно:

- `queue_depth_sustained`: `total_queued >= UGS_QUEUE_DEPTH_ALARM_THRESHOLD` дольше `UGS_QUEUE_ALARM_SUSTAIN_SECONDS`.
- `queue_age_sustained`: `pending_oldest_age_seconds >= UGS_QUEUE_AGE_ALARM_THRESHOLD_SEC` дольше `UGS_QUEUE_ALARM_SUSTAIN_SECONDS`.
- `beat_on_workers_off`: включён stale reaper (`UGS_STALE_REAPER_ENABLED=1`), backlog > 0 и активных worker lease нет.
- `agentic_orphan_sessions`: `ewa_agentic_orphan_sessions >= 1` дольше `UGS_QUEUE_ALARM_SUSTAIN_SECONDS` (Gate G6; gauge обновляет orphan sweeper).
- `ewa_celery_beat_stale`: Redis heartbeat старше `EWA_CELERY_BEAT_STALE_SECONDS` (default `600`). Отсутствующий ключ на fresh deploy **не** активирует алерт по умолчанию; включить strict-режим можно `EWA_CELERY_BEAT_STALE_REQUIRE_HEARTBEAT=1`.
- `ewa_companion_generic_orphans_sustained`: последний Redis snapshot reaper показывает `generic >= 1` дольше `UGS_QUEUE_ALARM_SUSTAIN_SECONDS`.
- `ewa_media_orphans_sustained`: последний Redis snapshot reaper показывает `music + image + presentation >= 1` дольше `UGS_QUEUE_ALARM_SUSTAIN_SECONDS`.

`GET /metrics` (и `/api/metrics`) — публичный scrape path (OAuth middleware allowlist), чтобы Prometheus/операторский curl видели EWA alarms без Bearer.
Быстрый triage:

1. Проверить `GET /api/v1/ugs/admin/queue-ops` (`hints`, Redis lease, RabbitMQ backlog).
2. Проверить `podman logs stack0-eliteew-celery-beat-prod-baked` и `stack0-eliteew-api-worker-prod-baked` (plus Celery workers as needed — see [CELERY-BEAT-AND-QUEUES.md](CELERY-BEAT-AND-QUEUES.md)).
3. Проверить `GET /metrics` на `ewa_celery_beat_last_success_timestamp_seconds`, `ewa_companion_reaper_last_reaped{domain=...}` и EWA `ops_alarm_state`.
4. Если `beat_on_workers_off=1` и backlog растёт — восстановить worker-контур до ручных retry/cleanup.

## Инцидентный playbook (кратко)

1. **Зафиксировать** время, затронутый сервис, симптом (HTTP код, UX), последний деплой.
2. **Собрать доказательства**: 50–200 строк `podman logs`, при необходимости файл из `docker/logs/stack0/...`.
3. **Сузить**: API vs фронт vs Keycloak vs БД (health DB в **`DatabaseManager.get_health_summary()`** при необходимости).
4. **Mitigation**: откат образа / `podman compose` по **[ELITEEW-RELEASE-CHECKLIST.md](ELITEEW-RELEASE-CHECKLIST.md)** и Site Studio rollback notes in product canon (`SITE-STUDIO.md`).
5. **Постмортем** (при P1+): что сломалось, первопричина, действия, follow-up issue.

## См. также

- Desktop shell инциденты (UX): **`product/desktop/DESKTOP-WORKSPACE-SHELL-INCIDENTS.md`**
- Keycloak / SSO ops: **[docker-re_doc/KEYCLOAK-ELITEEW.md](docker-re_doc/KEYCLOAK-ELITEEW.md)** · **[SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md](SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md)**
