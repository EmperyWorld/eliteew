# Checklist: проверка работы сервисов (podman-first)

Краткий чеклист, чтобы убедиться, что Stack1, storage/vector и API доступны. Prod topology: [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md). Канон: **`documentation/`** (container runtime — `docker-re_doc/STACK-CONTAINER-CONTROL.md`, API — `docker-re_doc/STACK0-API-STARTUP.md`, stack0 health layers — `docker-re_doc/STACK0-HEALTHCHECK-LAYERS.md`).

## 1. Контейнеры

Из корня репозитория:

```bash
podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Должны быть в состоянии Up (healthy при наличии healthcheck):

- **stack1-postgres** — порт 5432 (проброс 30000 на хост)
- **stack1-redis** — порт 6379
- **stack1-rabbitmq** — порт 5672 (опционально 15672 management)
- **stack1-qdrant** — vector primary (`UNIFIED_VECTOR_READ_BACKEND=qdrant`)
- **stack1-seaweedfs** — blob storage (S3 API для unified content)
- **stack1-elasticsearch** — full-text / hybrid search
- **stack-ewa-postgres** — Assistant DB (port 30433 on host when published)
- **prod-core `.111`:** `stack0-eliteew-api-prod-baked` (+ workers/beat `*-prod-baked`) — порт 8000 внутри, обычно **29000** на хост
- **локальный `.136` (dev/fallback):** `stack0-eliteew-api-prod` — не путать с baked prod

Если контейнеров нет на **command-center (локальный контур)**:

```bash
podman compose -f docker/stack/stack1.yml --env-file docker/env_file/.env.stack1 up -d
# profile name historical («punisher» = local command-center workers, не prod-core):
podman compose -f docker/stack/stack0_b.yml --env-file docker/env_file/.env.stack0.backend \
  --profile punisher-local-workers up -d
```

**Prod-core:** не `compose up` с build на `.111` — release с `.136`:
`bash docker/scripts/eliteew-deploy.sh release stack0 --all` (см. [ELITEEW-RELEASE-CHECKLIST.md](ELITEEW-RELEASE-CHECKLIST.md)).

## 2. Связность API -> Stack1

Проверка TCP-доступности из контейнера API:

```bash
# prod-core: stack0-eliteew-api-prod-baked; local .136: stack0-eliteew-api-prod
API_CTR=${API_CTR:-stack0-eliteew-api-prod-baked}
podman exec "$API_CTR" python3 -c "
import socket
targets=[('stack1-postgres',5432),('stack1-redis',6379),('stack1-rabbitmq',5672)]
for host,port in targets:
    s=socket.socket(); s.settimeout(2)
    try:
        s.connect((host,port)); print(f'OK {host}:{port}')
    except Exception:
        print(f'FAIL {host}:{port}')
    finally:
        s.close()
"
```

Если есть `FAIL`, проверьте podman/compose-сети и что API подключен к тем же сетям, что Stack1 (см. `docker-re_doc/SEGMENTATION.md`).

## 3. Подключение API к PostgreSQL

Из контейнера API можно проверить инициализацию DatabaseManager:

```bash
API_CTR=${API_CTR:-stack0-eliteew-api-prod-baked}
podman exec "$API_CTR" python3 -c "
import asyncio
from api.core.database_manager import get_database_manager
async def check():
    m = await get_database_manager()
    await m.initialize()
    print('DB OK')
asyncio.run(check())
"
```

При ошибке проверяйте `DATABASE_URL` внутри API-контейнера (хост `stack1-postgres`, порт 5432, БД `ai_services`, валидные креды из runtime env на prod-core).

## 4. Эндпоинты API

- `GET /health` — liveness API.
- `GET /api/health` — aggregated health (DatabaseManager + ecosystem).
- `GET /api/v1/health` — versioned alias `/api/health`.
- `GET /api/version` — версия/build metadata для SPA **`versionCheck`** (read-only LS sync; **не** auto-reload). Deploy reload — **`staleBundleReload`** + `/app-build-version.txt` ([FRONTEND_BROWSER_CACHE_MODEL.md](../product/FRONTEND_BROWSER_CACHE_MODEL.md) §2.7).
- `GET /api/version/domains` — operational introspection (исторически может отставать от фактического состава в `api/main.py`).

## 5. Troubleshooting 503 (`/api/v1/desktop/config` и др.)

Если стабильно возвращается **503**:

1. **Контейнеры** — `stack1-postgres` и `stack0-eliteew-api-prod-baked` должны быть Up.
2. **Связность** — прогоните проверку из раздела 2 (минимум postgres/redis/rabbitmq).
3. **DATABASE_URL** — в API должен указывать на `stack1-postgres:5432`.
4. **Сети** — API и Postgres должны быть в общей compose-сети (см. `docker-re_doc/SEGMENTATION.md`).
5. **DatabaseManager** — выполните проверку из раздела 3.

На фронте 503 обычно отображается как «Сервер временно недоступен»; возможен `reason: "database"` в ответе API.

## 6. Smoke-проверка профиля и desktop (по желанию)

После правок в профиле/desktop:

- `GET /api/v1/profile/me`
- `GET /api/v1/profile/preferences`
- `GET /api/v1/profile/activity`
- `GET /api/v1/profile/export/history`
- при наличии БД: `PATCH` или `PUT` к `/api/v1/desktop/config`

Ожидание: 200 (или контрактный 404 для отдельных profile-эндпоинтов при отсутствии пользователя в БД), без 500.

## 7. Workers smoke (default prod)

```bash
podman ps --format '{{.Names}}' | grep -E 'api-worker-prod-baked|celery-worker-prod-baked|celery-agentic-worker-prod-baked|celery-companion-worker-prod-baked|celery-discussion-worker-prod-baked'
podman exec stack1-rabbitmq rabbitmqctl list_queues name consumers 2>/dev/null | head -20
```

Ожидание: workers Up на **prod-core** (`*-prod-baked`); embed/rerank/tool-router на **gpu141** — см. [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md). Не требовать `dewa.eliteew.ru` / DEWA units.

## 8. Immutable API tests (optional gate)

```bash
bash docker/scripts/run-stack0-api-tests.sh tests/test_api_health_smoke.py -q
```

См. [TESTING-STRATEGY.md](TESTING-STRATEGY.md).
