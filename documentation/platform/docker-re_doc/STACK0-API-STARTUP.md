# Запуск API (stack0): `start_all.sh` и FastAPI

Краткая карта для оператора и разработчика.

**LLM и переменные `LLAMA_*`:** не смешивать с обязательным демоном Llama; канон описан в **`STACK0-LLM-OVERVIEW.md`**.

## Цепочка

1. **Образ** `docker/builders/stack0-api/Dockerfile` — multi-target backend (`api`, `queue-worker` / `api-worker`, `celery-worker`, `celery-beat`, `site-studio-worker`). В runtime-копию образа кладётся **`docker/builders/stack0-api/scripts/start_all.sh`** (Dockerfile `COPY docker/builders/stack0-api/scripts/start_all.sh` from that build context + `chmod 755`), чтобы API-контейнер мог стартовать и без bind-mount скрипта.
2. **Compose** `docker/stack/stack0_b.yml` → сервис **`eliteew-api-prod`**:
   - монтирует **свежий** `docker/builders/stack0-api/scripts/start_all.sh` → `/app/docker/docker/builders/stack0-api/scripts/start_all.sh` (перекрывает копию из образа);
   - монтирует **`docker/builders/stack0-api/scripts/lib/`** → `/app/docker/scripts/lib` (**парно** с `start_all.sh` — preflight helpers; без lib entrypoint падает в restart loop);
   - монтирует **`shared/api`** → `/app/api` (код API);
   - **`env_file`:** `.env.stack0.shared` + `.env.stack0.api` (workers/celery: `shared` + `.env.stack0.jobs`). SSOT / compose `--env-file` остаётся `.env.stack0.backend`; после правок SSOT: `bash docker/scripts/stack0-env-materialize-roles.sh`.
   - **Prod-baked / dev-bind overrides** (`stack0_b.prod-baked.override.yml`, `stack0_b.dev-bind.override.yml`) сохраняют **оба** bind (`start_all.sh` + `lib/`). Deploy-tree sync (`sync-prod-core-deploy-tree.sh`) доставляет оба пути на `.111`.
3. **`start_all.sh`** — подготовка окружения (`HOME`, dot-cache, optional legacy ML dirs), вызов **`docker/builders/stack0-api/scripts/lib/stack0_preflight.py`** (imports, TCP/HTTP, guards; `STACK0_PREFLIGHT_FAIL_ON`), optional Redis FLUSHALL; Site Studio worker heartbeat **не** в shell — только **`lifespan`** FastAPI; затем `exec uvicorn`.
   `exec … uvicorn api.main:app --workers 1` (Socket.IO не совместим с несколькими воркерами).

### Preflight (Python)

| Модуль | Роль |
|--------|------|
| `docker/builders/stack0-api/scripts/lib/stack0_preflight_lib.py` | Чистая логика: import checklist, TCP (`socket`), HTTP (`urllib`), EWA DSN, Redis forbidden host, ffmpeg/playwright guards. |
| `docker/builders/stack0-api/scripts/lib/stack0_preflight.py` | CLI entrypoint; `--json` для machine-readable отчёта. |
| `docker/builders/stack0-api/scripts/lib/parse_ewa_database_url.py` | Тонкий CLI для host/port/db (использует lib; backward compat для selftest). |

**Не в preflight:** Site Studio worker heartbeat, поднятие пулов Postgres/Redis — это **`lifespan`** + `ELITEEW_REQUIRE_*`.

### Operator one-shot (compose profile)

Сервис **`eliteew-api-preflight`** в `docker/stack/stack0_b.yml` (profile **`stack0-api-preflight`**) запускает тот же `stack0_preflight.py`. Не входит в обычный `up`.

```bash
bash docker/scripts/stack0-api-preflight-run.sh
bash docker/scripts/stack0-api-preflight-run.sh --json
bash docker/scripts/stack0-api-preflight-run.sh --baked   # + stack0_b.prod-baked.override.yml
```

**Authoritative fail-closed gate** остаётся в **`start_all.sh`** перед uvicorn.

**Почему нет `depends_on: service_completed_successfully`:** на **podman-compose 1.5** условие мапится на `podman wait --condition=stopped`. При ненулевом exit preflight `wait` даёт non-zero → `check_dep_conditions` уходит в бесконечный retry, и старт API **зависает**, а не чисто падает. Не использовать этот механизм как gate.

## Код приложения

| Файл | Роль |
|------|------|
| `shared/api/main.py` | Создание `FastAPI`, middleware (OAuth2, CORS, rate limit, …), регистрация доменных роутеров, `lifespan`. |
| `shared/api/core/startup.py` | Функции, вызываемые из `lifespan` (кеш, unified audio, HTTP clients, RabbitMQ queues). |
| `shared/api/core/logging_config.py` | Structlog / файловый лог при `ELITEEW_LOG_FILE`. |

## Полезные команды

- Health (из хоста, порты из `.env.stack0.backend`): `curl -sf http://127.0.0.1:<API_PORT>/health`
- Логи: `docker logs stack0-eliteew-api-prod` или eliteew-api.log *[runtime under docker/logs/stack0/eliteew-api-prod/]*
- Preflight one-shot (без рестарта API): `bash docker/scripts/stack0-api-preflight-run.sh`

## Заметки

- **`start_all.sh`**: bootstrap fail-closed (`${VAR:?…}`) для runtime/uvicorn. **Явные `:=` исключения в shell:** `STACK0_ENABLE_LEGACY_ML_CACHE_DIRS`, `STACK0_PREFLIGHT_VERBOSE`. `PYTHONPYCACHEPREFIX` при отсутствии → `${STACK0_RUNTIME_HOME}/python_pycache`. **Preflight env** (`STACK0_PACKAGE_IMPORT_CHECKLIST`, `STACK0_PREFLIGHT_FAIL_ON`, TCP/HTTP suffixes, …) валидируются в **`stack0_preflight.py`**. Regression: **`test_stack0_preflight.py`**, **`test_stack0_start_all_contract.py`** + **`start_all_selftest.sh`**.
- **Скрипт поднимает только API** (`uvicorn`). Celery / queue-worker / Site Studio — другие сервисы `stack0_b.yml`.
- **TCP/HTTP preflight (Python):** Postgres, Redis, MinIO, Elasticsearch, EWA PG (если DSN), RabbitMQ (если `RABBITMQ_HOST`/`PORT` заданы), LLM/Tika HTTP. Fail-closed keys — `STACK0_PREFLIGHT_FAIL_ON` (default `postgres,redis,ewa_postgres`; `rabbitmq`/`minio`/`elasticsearch`/`llama`/`tika` — opt-in). Shell **не** использует `/dev/tcp` или `curl`.
- **`uvicorn --workers 1`:** обязательно. `api/main.py` оборачивает FastAPI в `socketio.ASGIApp` в одном процессе; несколько workers разорвут in-memory Socket.IO state.
- **ffmpeg:** нужен в API-образе (STT convert, unified content video/audio, music promo) — не «только stack9».
- **EWA:** `parse_ewa_database_url.py` / `stack0_preflight_lib.parse_ewa_database_url` → TCP в Python preflight. DDL — lifespan.


## `start_all.sh` и префикс `STACK0_*`

Скрипт читает **только** переменные из окружения; ориентир по именам и значениям — блок **`docker/env_file/.env.stack0.backend.example`**. После добавления параметров нужно сохранять их и в вашем секретном **`docker/env_file/.env.stack0.backend`**, если он уже существовал.

Compose перечисляет те же ключи в **`eliteew-api-prod` → `environment`**, интерполируя их из переданного при `docker compose up --env-file` файла (`${VAR}`, без литералов в YAML).

Связанные ключи входа **`eliteew-api-prod`** (тоже обязательные для старта uvicorn через этот же entrypoint):

| Переменная | Назначение |
|------------|------------|
| `STACK0_RUNTIME_HOME`, `STACK0_CACHE_DIR` | `HOME` и writable dot-cache перед uvicorn (`HOME=${STACK0_RUNTIME_HOME}` в compose). От bytecode: **`PYTHONPYCACHEPREFIX`** задаётся в **`start_all.sh`** как writable **`${STACK0_RUNTIME_HOME}/python_pycache`**, если переменная не пришла из compose — нужно при **`../../shared/api:/app/api:ro`**. |
| `STACK0_ONNX_HOME`, `STACK0_HF_HOME` | **Legacy optional:** только при **`STACK0_ENABLE_LEGACY_ML_CACHE_DIRS=1`** (CPU-only API по умолчанию не экспортирует `ONNX_HOME`/`HF_HOME`). |
| `STACK0_ENABLE_LEGACY_ML_CACHE_DIRS` | `0` (default) — не создавать ONNX/HF cache dirs; `1` — legacy local ML cache layout. |
| `STACK0_PREFLIGHT_VERBOSE` | `0` (default) — TCP/HTTP preflight логирует только fail; `1` — SUCCESS на каждый probe. |
| `STACK0_PYTHON_VENV` | Интерпретатор из образа |
| `STACK0_DOC_*` | Опциональные подсказки в ошибках preflight (`ENV_FILE_HINT`, `REDIS_HOST_HINT`, `DOCFILE_REL` — defaults в **`stack0_preflight_lib.py`** / compose). |
| `STACK0_PACKAGE_IMPORT_CHECKLIST` | `pip-name:python_module`, через запятую; отсутствие любого модуля → **`exit 1`** (fail-closed, Python preflight). |
| `STACK0_PREFLIGHT_FAIL_ON` | CSV fail-closed TCP/HTTP keys: `postgres`, `redis`, `ewa_postgres`, `minio`, `elasticsearch`, `rabbitmq`, `llama`, `tika`. Default в Python: **`postgres,redis,ewa_postgres`**. |
| `STACK0_TCP_PROBE_TIMEOUT_SEC` | Таймаут TCP socket probe (Python preflight) |
| `STACK0_LL_HTTP_HEALTH_SUFFIX`, `STACK0_TIKA_HTTP_HEALTH_SUFFIX` | Хвост URL для HTTP-preflight к LLM. **llama-server (stack2, OpenAI-compat):** `/health`. **Нативный Llama:** `/api/tags`. В preflight при `LLAMA_USE_OPENAI_API=true` и суффиксе `/api/tags` проба идёт на `/health`. |
| `STACK0_FFMPEG_BIN` | Путь к ffmpeg, если нужен явно |
| `STACK0_REDIS_FORBIDDEN_HOSTS` | CSV; при попадании `REDIS_HOST` — `exit 1` |
| `STACK0_UVICORN_TIMEOUT_KEEP_ALIVE`, `STACK0_UVICORN_TIMEOUT_GRACEFUL_SHUTDOWN` | Аргументы `--timeout-*` uvicorn |
| `STACK0_REMOVE_PYC_ON_START` | `1` — при **`PYTHONDONTWRITEBYTECODE≠1`** (baked line): пересоздать **`PYTHONPYCACHEPREFIX`** и при **`/app/api` :rw** удалить `__pycache__`/`*.pyc`. На **dev-bind** (`PYTHONDONTWRITEBYTECODE=1`, export purge on sync) блок **не выполняется**. Дефолт **`1`** в compose. |
| `STACK0_REDIS_FLUSHALL_ON_START` | `1` — после TCP-preflight выполнить **Redis FLUSHALL** на паре `REDIS_HOST`/`REDIS_PORT` (полная очистка текущей инстанции). По умолчанию **`0`** в compose и примере env (для прода держать **`0`**). |
| `ELITEEW_REQUIRE_SITE_STUDIO_WORKER_AT_STARTUP` | `true` — hard gate в **`lifespan`** FastAPI: при `ENABLE_QUEUE_SITE_STUDIO=true` и `ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK=false` API не завершит startup, пока в `site_studio_worker_heartbeats` нет свежего heartbeat `queue_name='site_studio'`. |
| `STACK0_SITE_STUDIO_STARTUP_WAIT_SECONDS`, `STACK0_SITE_STUDIO_STARTUP_POLL_SECONDS` | Таймаут и интервал polling для hard gate Site Studio worker в **`api/services/site_studio_lifecycle_jobs.py`** / **`lifespan`** (compose default: `90` / `5`). **Не** в `start_all.sh`. |
| `GENERATED_FILES_BASE` | Базовый каталог для ветки `generated_files/` |
| `PLAYWRIGHT_BROWSERS_PATH` | Только **queue-worker** (Chromium в sidecar). В **api** venv playwright отсутствует — EWRP PDF через `BROWSER_RENDER_SERVICE_URL` |
| `BROWSER_RENDER_SERVICE_URL` | Base URL sidecar на queue-worker (пример: `http://stack0-eliteew-api-worker-prod:8095`) |
| `SCIENCE_STACK_SERVICE_URL` | Science sidecar на queue-worker (пример: `http://stack0-eliteew-api-worker-prod:8096`) — scipy/sklearn/WAV merge |
| `API_HOST`, `API_PORT`, `API_WORKERS`, `LOG_LEVEL` | Прослушивание uvicorn без fallback внутри скрипта |

## Переменные окружения (приложение / compose, сводка)

| Переменная | Назначение |
|------------|------------|
| `HOST_IP` | Хост для «внешних» URL в `ServiceConfig.external_url` и дефолт `PORTAINER_URL`, если полный URL не задан. |
| `CORS_ORIGINS` | Список origin через запятую для `CORSMiddleware`. **Всегда** дополняется origins нативного Tauri desktop-client (`https://tauri.localhost`, `http://tauri.localhost`, `tauri://localhost`, `http://localhost:1420`) **и** FoFline L3 local SPA (`fofline-spa://localhost`, `http(s)://fofline-spa.localhost`) в `api.core.cors_origins.resolve_cors_origins` — иначе OPTIONS с WebView Origin → `400 Disallowed CORS origin`. |
| `CORS_USE_DEFAULT_ORIGINS` | Если `true` (по умолчанию) и `CORS_ORIGINS` пуст — встроенный список прод-доменов; `false` — без дефолтов (нужен явный `CORS_ORIGINS`). Desktop-client WebView origins всё равно мержатся. |
| `ELITEEW_REQUIRE_DB_AT_STARTUP` | `true` — упасть при старте, если пул Postgres не поднялся. |
| `ELITEEW_REQUIRE_REDIS_AT_STARTUP` | `true` — то же для Redis. |
| `SITE_STUDIO_WORKER_READY_WINDOW_SECONDS` | Окно свежести heartbeat для Site Studio worker readiness (`180` по умолчанию). Используется action guard, startup hard gate и диагностика health. |
| `ELITEEW_SOCKETIO_CORS_ALLOW_ALL` | `true` — добавить `*` в `cors_allowed_origins` Socket.IO (только для отладки). |

При старте в лог пишутся минимальные версии пакетов по политике (floors из `docker/builders/stack0-api/requirements/base.in`).

Socket.IO (`api/routers/socketio_handler.py`) использует тот же `resolve_cors_origins()` (env + desktop-client WebView merge), иначе дефолтный список + `http://<HOST_IP>:29001` + те же Tauri origins.

## Related

- Preflight one-shot / profile: `docker/scripts/stack0-api-preflight-run.sh`, compose profile `stack0-api-preflight`
- Env role materialize: `docker/scripts/stack0-env-materialize-roles.sh` — [PROD-CORE-CONFIG-PLANE.md](../PROD-CORE-CONFIG-PLANE.md)
- Deploy Line A/B (когда меняется `start_all` / image): [PROD-CORE-DEV-BIND-LINE.md](../PROD-CORE-DEV-BIND-LINE.md), [`docker/scripts/README.md`](../../../docker/scripts/README.md)
- Health layers: [STACK0-HEALTHCHECK-LAYERS.md](STACK0-HEALTHCHECK-LAYERS.md)
