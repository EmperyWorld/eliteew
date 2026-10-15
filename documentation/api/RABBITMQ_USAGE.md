# Использование RabbitMQ в EliteEW

**Status:** living ops note for stack0/stack1 queues. Broker on prod-core (`stack1-rabbitmq`); code under `shared/api`. Topology: [PRODUCTION-TOPOLOGY-STATE.md](../platform/PRODUCTION-TOPOLOGY-STATE.md) §Current.

Очереди используются для разгрузки API и согласования UGS/воркеров, мессенджеров, Whisper и LLM/Comfy-провайдеров.

## Включение

- В `.env.stack0.backend`: `ENABLE_RABBITMQ=true` (уже включено).
- При старте API объявляются очереди из `DatabaseConfig.RABBITMQ_CONFIG["queues"]`.

## Очереди (имена в RabbitMQ)

| Ключ в коде | Имя очереди в RabbitMQ | Назначение |
|-------------|------------------------|------------|
| `ai_generation` | `ai.generation.queue` | Задачи UGS (генерации), длинные вызовы Llama/ComfyUI |
| `document_processing` | `documents.processing.queue` | Обработка документов: Whisper (транскрипция), конвертация, индексация |
| `notifications` | `notifications.queue` | Уведомления: Telegram, push, email |

## Публикация из API

```python
from api.services.rabbitmq_service import get_rabbitmq_service, QUEUE_AI_GENERATION, QUEUE_NOTIFICATIONS

svc = get_rabbitmq_service()

# Задача генерации (UGS) — исполняется queue worker-ом API
await svc.publish_ai_generation(request_id=str(uuid), type_key="image_banner", payload={"user_id": str(user_id)})

# Или произвольное тело в любую очередь
await svc.publish(QUEUE_AI_GENERATION, {"request_id": "...", "action": "start"})

# Обработка документа (Whisper, конвертация)
await svc.publish_document_processing("whisper_transcribe", content_id=str(content_id), payload={"lang": "ru"})

# Уведомление (Telegram, push)
await svc.publish_notification("telegram", user_id=str(user_id), payload={"text": "...", "chat_id": 123})
```

Методы возвращают `True` при успешной отправке, `False` при ошибке (логируется, исключение не бросается).

## Где публикация уже используется

1. **UGS** — `api/services/ugs/unified_generation_service.py` публикует `task_type=ugs_generation`, worker исполняет единый direct-provider path через `UnifiedGenerationService.process_queued_request()`. Актуальный runtime-контракт: `API -> RabbitMQ -> queue_worker -> ProviderManagerServiceV2`.
2. **EWRP** — `api/routers/ewrp.py` публикует `task_type=ewrp_generate`, worker запускает тот же pipeline, который раньше жил в `BackgroundTasks`.
3. **Business Intelligence** — `api/routers/business_intelligence.py` публикует `task_type=bi_generation`, worker берёт session/job lifecycle на себя.
4. **Unified Content** — `api/routers/unified_content.py` публикует `task_type=unified_content_process`, worker забирает файл из storage и прогоняет процессоры.
5. **Chat Session Documents** — `api/routers/chat/session_documents.py` публикует `task_type=chat_session_document_index`, worker обновляет knowledge-base indexing.
6. **Voice Transcription** — `api/routers/voice_gateway.py` публикует `task_type=voice_transcription`, статус хранится в `transcriptions`.
7. **External Notifications** — `NotificationService.enqueue_external_delivery()` публикует `task_type=notification_delivery`; worker отправляет в Telegram и пишет итог в `telegram_notifications`.

## Consumer’ы (кто обрабатывает очереди)

- **Отдельный worker API:** `python -m api.workers.queue_worker` читает три рабочие очереди и соответствующие `.dlq`.
- **Airflow (legacy):** снят с prod и не используется как execution backend UGS. Любой возврат Airflow-ветки требует явной реализации в `UnifiedGenerationService` и обновления канона.
- **Fallback path:** если публикация в RabbitMQ не удалась, API оставляет прежний inline/background behaviour, поэтому rollout можно включать доменно.

## Конфиг

Очереди и (при необходимости) exchange’ы заданы в `api/core/database_manager.py` → `DatabaseConfig.RABBITMQ_CONFIG["queues"]`. Пароль и хост — из env (`RABBITMQ_PASSWORD`, `RABBITMQ_HOST` и т.д., см. `.env.stack0.backend`).

Feature flags по доменам:

- `ENABLE_QUEUE_UGS`
- `ENABLE_QUEUE_DOCS`
- `ENABLE_QUEUE_NOTIFICATIONS`
- `ENABLE_QUEUE_EWRP`
- `ENABLE_QUEUE_BI`
- `ENABLE_QUEUE_VOICE`
- `ENABLE_QUEUE_SITE_STUDIO`

Примечание по UGS:

- `UGS_USE_AIRFLOW` следует считать legacy/deprecated до тех пор, пока в `UnifiedGenerationService` не появится явный branch под Airflow.
- Для диагностики текущего UGS ориентируйтесь на `request_metadata` (`stage`, `queue_status`, `execution_backend`, `last_heartbeat_at`, `idempotency_key`) и SSE-события `started/queued/progress/keep_alive/result/error/cancelled`.

## Проверка очередей

- Management UI: `http://<host>:30009` (логин/пароль из RABBITMQ_USER / RABBITMQ_PASSWORD).
- В UI видны очереди `ai.generation.queue`, `documents.processing.queue`, `notifications.queue` после первого вызова `ensure_queues()` при старте API.
