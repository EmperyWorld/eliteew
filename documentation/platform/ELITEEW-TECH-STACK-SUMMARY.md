# EliteEW — Project Tech Stack Summary

> **Audit date:** 2026-09-15 (SPA resolved versions; API lock pins unchanged)

> **Область:** продукт **EliteEW** в монорепозитории `powered_by_emperyworld/`
> **Источники:** `shared/api/*`, `shared/web/frontend/*`, `docker/builders/stack0-api/*`, канон `documentation/platform/`

---

## 1. Tech Stack Overview

### 1.1 Сводная таблица

| Слой | Технология | Версия (канон / lock) | Где зафиксировано |
|------|------------|------------------------|-------------------|
| **Python (backend)** | CPython **3.14.x** | `requires-python >=3.14`; prod lock: `--python-version 3.14` | `shared/api/pyproject.toml`, `docker/builders/stack0-api/requirements/locks/*.lock` |
| **Backend framework** | **FastAPI** | `0.136.1` (lock) / диапазон `>=0.135,<0.137` | `api.lock`, `requirements/base.in` |
| **Validation / settings** | **Pydantic v2** | `2.13.3` (lock) / `>=2.12.5,<3` | `api.lock`, `requirements/base.in` |
| **ASGI server** | **Uvicorn** | `>=0.42,<0.47` | `api.in` |
| **React (SPA)** | **React 19** | **`19.3.0`** (resolved) | `shared/web/frontend/package.json`, `pnpm-lock.yaml` |
| **React DOM** | | **`19.3.0`** | same |
| **TypeScript** | | `^7.0.2` → **`7.0.2`** (IDE: native **tsgo**) | `package.json`; `.vscode/settings.json` `useTsgo` |
| **Bundler / dev server** | **Vite** | **`8.3.0`** (resolved; pin `8.3.0`) | `package.json` |
| **Node.js** | | `>=22.22.0` | `package.json` `engines` |
| **Frontend package manager** | **pnpm** | **`12.4.1`** (`packageManager`) | `package.json` |
| **Python package manager** | **uv** (+ pip в образе) | `uv 0.11.8` в Docker builder | `docker/builders/stack0-api/Dockerfile` |
| **Lint / format (FE)** | **Biome** | **`^2.5.14`** | `package.json` |
| **Lint / format (API)** | **Ruff** | via `shared/api/ruff.toml` | `pyproject.toml`; agent workflow: skill `eliteew-backend-lint-fix` (`/eliteew-backend-lint-fix`) |
| **Tests (FE)** | **Vitest** + Playwright | Vitest **`^5.0.0`** | `package.json` |
| **Tests (API)** | **pytest** | `>=9` | `pyproject.toml` |

### 1.2 Python 3.14.7 — фактическая картина

| Ожидание | Факт в репозитории |
|----------|-------------------|
| Точный пин **3.14.7** | **Не найден** в манифестах (`rg 3\.14\.7` по репо). |
| Минимальная версия | **`>=3.14`** — `shared/api/pyproject.toml`, `docker/builders/stack0-api/requirements/`. |
| Runtime gate | `main.py`: `EXPECTED_PYTHON_MAJOR=3`, `EXPECTED_PYTHON_MINOR=14` → `check_critical_versions()` при старте. |
| Prod image | **Fedora 44** + системный `python3` в `docker/builders/stack0-api/Dockerfile` (не отдельный `python:3.14.7` slim-образ). |
| Lock-файлы | `uv pip compile … --python-version 3.14` в `docker/builders/stack0-api/requirements/locks/`. |
| Канон | `documentation/platform/PYTHON-3.14-BASELINE.md` — baseline **3.14+**, не микропатч. |

**Вывод:** проект целится в **ветку Python 3.14**; микроверсия **3.14.7** в коде не закреплена — фактическая patch-версия определяется ОС образа (Fedora 44) на момент сборки.

### 1.3 React 19.3 — confirmed

| Field | Value |
|------|----------|
| `package.json` | `"react": "^19.3.0"`, `"react-dom": "^19.3.0"` |
| Resolved (`pnpm list`, 2026-09-15) | **`react@19.3.0`**, **`react-dom@19.3.0`** |
| Router | `react-router ^8.4.0` (v8 removed `react-router-dom`; import from `react-router`) |
| State / data | Zustand `^5.0.15`, TanStack Query `^5.103.2` |

Expectation **React 19** — **met** (patch **19.3.0** as of 2026-09-15). `@react-three/fiber@9.7.0` still publishes peer `react`/`react-dom` `>=19 <19.3`; no newer fiber on registry.

### 1.4 Менеджеры пакетов и сборка

| Контур | Инструмент | Примечание |
|--------|------------|------------|
| EliteEW API (host) | **uv** → venv `.venv` | `UV_PROJECT_ENVIRONMENT=../../.venv` из `shared/api` |
| EliteEW API (Docker) | **uv pip** + lock-файлы | `docker/builders/stack0-api/requirements/locks/api.lock` |
| EliteEW Frontend | **pnpm** | `shared/web/frontend/`; overrides в `pnpm-workspace.yaml` |
| Poetry | **не используется** | — |
| npm / yarn (EliteEW FE) | **запрещены** политикой проекта | только `pnpm` |
| Сборка SPA | **Vite 8** | `pnpm run build` / `build:react-compiler` |
| Сборка API image | **Podman/Docker** multi-stage | `docker/builders/stack0-api/Dockerfile` |

---

## 2. WebSockets и real-time

### 2.1 Архитектура обмена (несколько каналов)

```text
Браузер / SPA
  ├─ Socket.IO (основной realtime) ──► python-socketio ASGI ──► FastAPI app (wrapped)
  ├─ Native WebSocket (Yjs collab)   ──► FastAPI @router.websocket
  ├─ Native WebSocket (Live Voice)   ──► отдельный voice gateway URL
  └─ SSE (долгие операции)           ──► FastAPI StreamingResponse
```

### 2.2 Backend

| Механизм | Библиотека / API | Точка входа |
|----------|------------------|-------------|
| **Основной realtime (чат, уведомления, presence)** | **`python-socketio`** `>=5.16.4,<6` (lock: **5.16.4**; JS Socket.IO 3.x/4.x — **нет** python-socketio 6 / socket.io-client 5) | `api/routers/socketio_handler.py` — `socketio.AsyncServer` |
| **Транспорт Socket.IO** | `python-engineio` `>=4.13.5,<5` (lock: **4.13.5**) | через socketio |
| **Масштабирование emit** | `AsyncRedisManager` | Redis pub/sub для доставки из Celery workers |
| **Интеграция с FastAPI** | `socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="socket.io")` | `shared/api/main.py` (~L980+) |
| **Нативный WebSocket (Yjs)** | FastAPI `WebSocket` | `api/routers/doc_editor.py` — `yjs_collaboration_websocket` |
| **Доп. websockets lib** | `websockets>=14.1,<17` | вспомогательные клиенты/прокси |

**Нативные WebSockets FastAPI используются точечно** (collab Yjs); **массовый продуктовый realtime — через Socket.IO**, не «голый» WS на всё приложение.

### 2.3 Frontend

| Сценарий | Библиотека | Ключевые файлы |
|----------|------------|----------------|
| **Основной Socket.IO** | **`socket.io-client`** `^4.8.3` | `hooks/useSocketConnection.tsx`, `services/communication/EmperyworldSocketService.ts` |
| **react-use-websocket** | **не используется** | — |
| **Нативный `WebSocket`** | браузерный API | `components/LiveVoiceWidget/hooks/useLiveVoiceWebSocket.ts` (Live Voice); raw `WebSocketService.ts` soft-retired 2026-07-28 |
| **Yjs collaboration** | `socket.io-client` + Yjs | `components/UltimateDocEditor/hooks/useCollaboration.ts`, `y-websocket`, `yjs` |
| **Auth на сокете** | JWT в `auth.token` / query | `services/auth/authenticatedSocketAuth.ts` |

### 2.4 Поведенческие инварианты (кратко)

- Uvicorn поднимает **ASGI-обёртку Socket.IO**, не «голый» FastAPI.
- На **desktop** один лидер Socket.IO (`Services.socket` / GAF); на admin — `useSocketConnection`.
- Celery-воркеры эмитят через Redis manager — иначе live-события не доходят до браузера.

---

## 3. Архитектура и структура

### 3.1 Монорепозиторий (контекст)

```text
powered_by_emperyworld/
├── EliteEW/              ← основной продукт
│   ├── api/              ← FastAPI backend (Python 3.14+)
│   └── web/frontend/     ← React 19 SPA (Vite)
├── docker/               ← Podman stacks, builders, ops CLI
├── documentation/        ← каноническая документация
├── pack-cloud/mobile/        ← Kotlin client
└── trash/                ← soft-retired trees (DEWA, EWGen, …) — не воссоздавать без запроса оператора
```

**Исторически (не living):** деревья `DEWA/` (operator command plane), `EWGen/`, `EWPower/`, `EWC/` и др. soft-retired → `trash/` (см. `.cursorrules` §Retired). Ops-скрипты с префиксом `dewa-ops-*` в `docker/scripts/` — исторические имена helpers EliteEW deploy, не живое дерево DEWA.

### 3.2 EliteEW — ключевые каталоги

| Путь | Назначение |
|------|------------|
| `shared/api/` | FastAPI: `main.py`, `routers/`, `services/`, `ewa_platform/`, `tests/` |
| `shared/api/core/` | `database_manager.py`, `unified_config` |
| `shared/api/migrations/` | Alembic (PostgreSQL) |
| `shared/web/frontend/src/` | React SPA: `features/`, `pages/`, `services/`, `components/` |
| `shared/web/frontend/src/generated/` | OpenAPI-generated TS |
| `.venv/` | Host Python venv (IDE/pytest) |
| `docker/stack/stack0*` | API + SPA + workers |
| `docker/stack/stack1*` | PG, Redis, RabbitMQ, Qdrant, ES, SeaweedFS |

### 3.3 Данные и ORM

| Технология | Роль | Версия / статус |
|------------|------|-----------------|
| **PostgreSQL** | Основная OLTP | stack1; `asyncpg`, `psycopg2-binary` |
| **SQLAlchemy 2.x** | ORM / async | lock **`2.0.49`** |
| **Alembic** | миграции | `>=1.13.3,<2` |
| **Redis** | кэш, Socket.IO, limits | `redis>=8,<9` |
| **RabbitMQ** | Celery / aio-pika | stack1 |
| **Qdrant** | vector backend (канон) | Chroma legacy отключён в stack0-api |
| **Elasticsearch** | search contour | `elasticsearch>=9.4,<10` |
| **SeaweedFS** | object storage | via `DatabaseManager` |
| **Prisma / Tortoise / Mongo** | **не основной стек EliteEW API** | — |

Центральная точка инфраструктуры: **`shared/api/core/database_manager.py`**.

### 3.4 Фоновые задачи и auth

| Компонент | Стек |
|-----------|------|
| Task queue | **Celery** + RabbitMQ |
| Workers | `api/workers/` |
| Auth | **Keycloak OIDC**; SPA — `oauth4webapi` + PKCE |

---

## 4. Prod runtime (кратко)

| Host | Роль |
|------|------|
| command-center `.136` | builds |
| prod-core `.111` | stack0 `:29000/:29001` |
| gpu141 `.141` | inference services |

Канон: `documentation/platform/PRODUCTION-TOPOLOGY-STATE.md`.

---

## 5. Команды быстрой проверки

```bash
# Полный cross-layer integrity probe (rg + pytest + pnpm list)
bash scripts/eliteew/realtime-contract-integrity-probe.sh

# Узкие проверки
cd shared/web/frontend && pnpm list react react-dom socket.io-client vite --depth 0
rg '^fastapi==|^pydantic==|^sqlalchemy==|^python-socketio==' docker/builders/stack0-api/requirements/locks/api.lock
cd shared/api && ../../.venv/bin/python -c 'import sys; print(sys.version)'
bash docker/scripts/run-stack0-api-tests.sh tests/test_realtime_cross_layer_auth_contract.py -q
cd shared/web/frontend && pnpm exec vitest run src/services/__tests__/realtimeAuthSourceContract.test.ts
```

---

## Связанные документы

- `documentation/platform/PYTHON-3.14-BASELINE.md`
- `documentation/platform/API-INFRASTRUCTURE.md`
- `documentation/platform/PRODUCTION-TOPOLOGY-STATE.md`
- `documentation/product/FRONTEND-AUTH.md`

---

## 7. Аудит современных паттернов (React 19.2 + Python 3.14) — Real-time контур

> **Дата:** 2026-07-06 · **Фокус:** Socket.IO гибрид + native WebSocket (Yjs, Live Voice)

### 7.1 Фронтенд (React 19.2 + TypeScript)

#### useEffectEvent (изоляция socket.on от React state)

| | |
|---|---|
| **Статус** | **Не используется** |
| **Где искать** | `shared/web/frontend/src/hooks/useSocketConnection.tsx` (L77–86, L353–357, L429); `src/components/UltimateDocEditor/hooks/useCollaboration.ts` (L65–77, L394–405) |
| **Анализ «Почему НЕТ»** | Вместо `useEffectEvent` применён **классический ref-bridge**: `onConnectionChangeRef.current = onConnectionChange`, `onMessageRef.current = onMessage` — колбэки читаются из ref внутри `socket.on`, что **снижает** stale closures для *внешних* обработчиков. В `useCollaboration` — `bindTrackedHandlers` + `socket.off(event, handler)` при unbind (L65–77). **Но:** обработчики в `join()` пересоздаются на каждый join и замыкают `docId`, `borrowed` — для session callbacks используются `onSessionEndedRef` / `onKickedRef` (L112–115). `connect` в `useSocketConnection` — `useCallback(..., [yieldLeadership])` (L429); смена `yieldLeadership` пересоздаёт `connect` → effect L490–502 может вызвать disconnect/reconnect. `useEffectEvent` в React 19 всё ещё **experimental** (`React.useEffectEvent`) — команда сознательно использует стабильный ref-паттерн, проверенный тестами `test:socket-self-heal`. |
| **Рекомендация** | Точечно внедрить `useEffectEvent` для `onMessage` / transport-recovery в `useSocketConnection` **после** стабилизации API в React 19 stable (или через `experimental_useEffectEvent` за feature flag). Пример: `const onMessageStable = useEffectEvent((event, data) => onMessage?.(event, data))` + один `socket.onAny` без переподключения при смене props. |

#### Компонент `<Activity />` (freeze вместо unmount)

| | |
|---|---|
| **Статус** | **Не используется** |
| **Где искать** | Поиск `import { Activity } from 'react'` — **0 совпадений**. Есть одноимённые **бизнес-компоненты** `ActivityLog` (не React 19 Activity). Переключение desktop/вкладок — обычный mount/unmount (`GAFChatProvider`, `UltimateDocEditor`). |
| **Анализ «Почему НЕТ»** | Архитектура desktop: **один leader-tab** держит `Services.socket` (`GAFChatProvider.tsx`); doc editor при уходе вызывает `leave()` / `socket.off` (useCollaboration L457+). `<Activity mode="hidden">` дал бы «заморозку» без размонтирования — полезно для тяжёлых панелей, но **не внедрено**: приоритет был single-socket + явный teardown, а не React 19 freeze API (ещё новый, мало peer-документации в кодовой базе). |
| **Рекомендация** | Пилот на **Ultimate Doc Editor** при переключении desktop apps: обернуть редактор в `<Activity mode={isVisible ? 'visible' : 'hidden'}>` чтобы сохранять Yjs/Socket state при сворачивании окна **без** второго `io()`. Сначала — Vitest + manual smoke на reconnect count. |

#### Singleton `EmperyworldSocketService` и утечки listeners

| | |
|---|---|
| **Статус** | **Частично** (singleton да, teardown в целом корректен; edge-case при повторном handshake) |
| **Где искать** | `src/services/communication/EmperyworldSocketService.ts` — singleton L1693–1704; `teardownSocketInstance` L1658–1664 (`removeAllListeners` + `disconnect`); `launchSocketIoHandshake` L364–389; `src/services/index.ts` L126 `socket: emperyworldSocket`; `useSocketConnection.tsx` L497–501 cleanup `disconnect()`; `useCollaboration.ts` L394–405 `bindTrackedHandlers` + unmount L457+ |
| **Анализ «Почему НЕТ (полной гарантии)** | **Один инстанс** на приложение — да (`export default emperyworldSocket`). Desktop GAF использует **тот же** singleton через `Services.socket.getClientSocket()` (useCollaboration L51–57). Admin/non-desktop — **отдельный** `io()` в `useSocketConnection` (намеренно, leader-tab mutex). Teardown: `removeAllListeners()` при disconnect/teardown — **есть**. Strict Mode: `useSocketConnection` effect cleanup вызывает `disconnect()` (L497–501); `useCollaboration` — `sessionUnbindRef` + deferred RAF disconnect (L457+). **Риск:** `launchSocketIoHandshake` создаёт `this.socket = io(...)` **без** предварительного `teardownSocketInstance`, если старый socket «висит» disconnected (редкий race при forceNew); `connect()` guard `isConnected()` / `connectPromise` смягчает, но не 100% при параллельных вызовах. |
| **Рекомендация** | В `launchSocketIoHandshake` первой строкой: `this.teardownSocketInstance()` если `this.socket != null`. Добавить Vitest: double `connect()` / Strict Mode double-mount не увеличивает счётчик listeners (можно mock `socket.on`). |

---

### 7.2 Бэкенд (FastAPI + Python 3.14)

#### Free-threaded Python (PEP 779) и потокобезопасность `socketio_handler`

| | |
|---|---|
| **Статус** | **Не готов** к free-threaded / multi-threaded доступу; **достаточен** для текущей asyncio-модели |
| **Где искать** | `api/routers/socketio_handler.py` — module-level mutable: `socket_presence_uid_by_sid` (L133), `doc_editor_room_owners` (L135), `doc_editor_sessions` (L903), `collaboration_sessions` (L1143); `api/routers/doc_editor.py` — `_yjs_document_connections` (L4060). Docker: `PYTHON_JIT=1` (`docker/builders/stack0-api/Dockerfile` L80), **без** `Py_GIL_DISABLED` / free-threaded build. |
| **Анализ «Почему НЕТ» | Обработчики `@sio.event` — **async**, мутации dict идут в **одном event loop** uvicorn worker. `AsyncRedisManager` выносит cross-process emit в Redis — не shared memory между threads. **Нет** `asyncio.Lock` / `threading.Lock` — осознанно: не multi-thread in-process. При переходе на **free-threaded CPython 3.14+t** и thread-pool внутри socketio/engineio те же dict без синхронизации → **data race**. Сейчас prod — **GIL-enabled** Fedora system Python, не nogil. |
| **Рекомендация** | До free-threaded cutover: (1) зафиксировать в runbook «stack0-api = asyncio, 1 loop per worker, no nogil»; (2) при эксперименте с nogil — обернуть session maps в `asyncio.Lock` или вынести в Redis/Postgres session registry. Краткосрочно — **не блокер**. |

#### PEP 758 (`except A, B` без скобок)

| | |
|---|---|
| **Статус** | **Частично** (в проекте есть, в realtime-роутерах — нет) |
| **Где искать** | **Есть:** `api/services/music_forge/pipeline.py` L104 `except TypeError, ValueError:`; `api/routers/mobile_app.py` L148; др. **Нет:** `socketio_handler.py` — только `except Exception:` / `except ValueError:` (L687); `doc_editor.py` Yjs WS L4167 `except WebSocketDisconnect:`; `live_voice_websocket.py` L408 `except WebSocketDisconnect:` |
| **Анализ «Почему НЕТ» в socket path** | PEP 758 adoption идёт **волнами по доменам**, не централизованно. Socket handlers historically писались с `except Exception` + structured log — не приоритет стиля. **Не архитектурное ограничение** — косметический/техдолг в realtime файлах. |
| **Рекомендация** | При следующем касании `socketio_handler` / `live_voice_websocket`: `except WebSocketDisconnect, ConnectionError:` вместо отдельных блоков; Ruff уже на 3.14 — проверить правило на multi-except. |

#### Pydantic v2 `model_validate_json` в socket/WebSocket handlers

| | |
|---|---|
| **Статус** | **Не используется** в realtime handlers |
| **Где искать** | `socketio_handler.py` — inbound via `socketio_event_schemas` / `parse_socket_event`. Legacy `websocket_handler.py` soft-retired 2026-07-28. `live_voice_websocket.py` still uses `json.loads` post-auth. |
| **Анализ «Почему НЕТ»** | Socket.IO payloads приходят уже как Python objects (msgpack/json decode в engineio) — **`json.loads` на WS text** только в native WS. Для Socket.IO исторически выбран **TypedDict + guard clauses**, не Pydantic models per event — меньше overhead на hot path, но слабее контракт. FastAPI REST слой активно на Pydantic v2; **realtime — отдельный стиль**. Упущение **умеренное**: стоит типизировать top-10 emit/handler payload через `BaseModel` + `TypeAdapter`. |
| **Рекомендация** | Для новых событий: `class JoinDocumentPayload(BaseModel): ...` + `JoinDocumentPayload.model_validate(data)` в `@sio.on("join_document")`. Для binary Yjs — Pydantic не нужен. |

#### pathlib `Path.copy()` / `Path.move()` (Python 3.14)

| | |
|---|---|
| **Статус** | **Не используется** |
| **Где искать** | `rg 'Path\(.*\)\.(copy|move)' shared/api` — **0** в realtime; `shutil.copytree` в `site_studio_runtime_service.py` L969 |
| **Анализ «Почему НЕТ»** | Real-time контур **не занимается** файловым I/O на hot path (кроме Yjs binary over WS). Логирование — structlog/stderr. Замена `shutil` на `Path.copy/move` — **общий техдолг**, не связанный с sockets. |
| **Рекомендация** | **Не приоритет** для real-time. При рефакторе file services — adopt `Path.copy` где уместно. |

---

### 7.3 Сводная матрица

| Проверка | Статус | Приоритет улучшения |
|----------|--------|---------------------|
| useEffectEvent для socket handlers | Не используется | Средний (после stable API) |
| `<Activity />` freeze | Не используется | Средний (desktop doc editor pilot) |
| Socket singleton + listener cleanup | Частично | Низкий–средний (`teardown` before `io()`) |
| Free-threaded / PEP 779 safety | Не готов (не требуется сейчас) | Низкий до nogil deploy |
| PEP 758 в socket handlers | Частично (вне realtime) | Низкий (стиль) |
| Pydantic `model_validate` на socket events | Не используется | Средний (контракты событий) |
| pathlib copy/move | Не используется | Низкий (вне scope realtime) |

---

## 8. Cross-Layer Contract Verification (Engineering Audit)

> **Дата:** 2026-07-06 · **Режим:** активная проверка (не passive observation)
> **Probe:** `bash scripts/eliteew/realtime-contract-integrity-probe.sh`
> **Тесты:** `shared/api/tests/test_realtime_cross_layer_auth_contract.py` (5/5), `shared/web/frontend/src/services/__tests__/realtimeAuthSourceContract.test.ts` (5/5)

### 8.1 Выполненные команды (evidence)

```text
$ .venv/bin/python --version
Python 3.14.6

$ pnpm list react react-dom socket.io-client --depth 0
react@19.2.8  react-dom@19.2.8  socket.io-client@4.8.3

$ rg '^fastapi==|^pydantic==|^python-socketio==' docker/builders/stack0-api/requirements/locks/api.lock
fastapi==0.136.1
pydantic==2.13.3
python-socketio==5.16.4

$ bash docker/scripts/run-stack0-api-tests.sh tests/test_realtime_cross_layer_auth_contract.py -q
5 passed in 3.35s  (container Python 3.14.6, pytest-9.1.1)

$ pnpm exec vitest run src/services/__tests__/realtimeAuthSourceContract.test.ts
5 passed
```

**Замечание по версии Python:** в доке и операторских материалах фигурирует «3.14.7»; на command-center host venv и immutable test-runner — **3.14.6** (Fedora 44 system Python). Пин в `api.lock` соответствует образу stack0-api, не patch-level хоста.

### 8.2 JWT / Auth — единый контракт?

| Транспорт | FE: источник токена | BE: валидатор | session_id |
|-----------|---------------------|---------------|------------|
| **Socket.IO** | `getToken()` → `buildSocketAuthPayload` (`auth.token`) | `validate_websocket_token` в `connect` | Engine.IO `sid` (socket.id) |
| **Yjs native WS** | `getToken()` → query `?token=` (`useYjsCollaboration.ts` L142–147) | `validate_websocket_token` (`doc_editor.py` L4088) | Отдельный WS connection id |
| **Live Voice WS** | `getToken()` → first message `{type:"auth",token}` | `validate_websocket_token` (`live_voice_websocket.py` L428) | Отдельный WS session |
| **SSE (orch / companion)** | `getAuthHeader()` / `apiFetchWithAuth` → `Authorization: Bearer` | FastAPI `Depends` OAuth2 (HTTP) | HTTP orchestration `session_id` (другая сущность) |

**Вывод (Cause-layer):** **JWT идентичен по источнику** — единый фасад `authSession` / `getToken()` / `getAuthHeader()` (канон `services/authSession.ts`). **Backend auth parity** — prod realtime entrypoints сходятся в `api/core/websocket_auth.validate_websocket_token` (подтверждено `rg` + pytest).

**Split-brain risk (не auth, а identity):** `session_id` **не унифицирован** между транспортами — это **by design**. Socket.IO `sid` ≠ Yjs room connection ≠ SSE session UUID. Рассинхрон возможен на уровне **presence/collaboration**, не на уровне JWT. SSO registry (`enforce_current_session`) применяется на connect для Socket.IO / Yjs / Live Voice; SSE идёт через HTTP middleware с тем же Bearer.

**Auth mismatch simulation (pytest):** `test_auth_token_mismatch_valid_vs_stale_rejected_same_entrypoint` — `fresh-access-token` → `User`, `stale-access-token` → `auth:token_expired`. Доказывает: один валидатор, разный исход при stale token (типичный split при refresh только на HTTP, не на socket).

### 8.3 Socket reconnect ↔ client state (Zustand?)

**Факт:** dedicated **Zustand store для socket нет**. Состояние распределено:

| Слой | Механизм | Reconnect behavior |
|------|----------|-------------------|
| `EmperyworldSocketService` | private `connectionState`, `userContext.session_id` | `connect` handler L1287–1318: обновляет `session_id`, emit `connection-restored` |
| `GAFChatProvider` | React `useState(socketConnected)` | `connection-restored` → `syncConnected()`; `connection-lost` → `false` + retry |
| `maintenanceState.ts` | module singleton + listeners (не Zustand) | `system.maintenance` через socket → `publishMaintenanceStatus` |
| Doc editor | Zustand `editorStore` | **не** подписан на socket singleton; collab через `useCollaboration` / Yjs отдельно |

**Contract note:** reconnect **не атомарно** обновляет все UI-слои — `socketConnected` (React) и `maintenanceState` (module) живут отдельно. `bindSocketAuthRefresh` (`authenticatedSocketAuth.ts`) при OIDC refresh делает **только** `patchSocketAuth` (без `disconnect/connect` — иначе newest-wins `presence:takeover` на каждый access-token TTL). Re-handshake — через `recoverSocketAuthConnection` / connect_error auth path.

**Рекомендация:** единый `subscribeConnectionState` на `EmperyworldSocketService` или thin Zustand slice `realtimeTransport` для `connected`, `socketSid`, `lastAuthRefreshAt`.

### 8.4 Pydantic v2 на inbound Socket.IO events

**Статус:** **Покрыто (P1+P2, 2026-07-06)** — `api/routers/socketio_event_schemas.py` + `parse_socket_event` на всех state-changing inbound handlers.

| P1 (ранее) | P2 (этот этап) |
|------------|----------------|
| `join_document`, `get_collaborators`, `kick_document_user`, `cursor_move`, `join_collaboration_session`, `subscribe`, `unsubscribe` | `chat-message`, `collaboration_change`, `ping`, `message`, `emperyworld-heartbeat`, `leave_document`, `leave_collaboration_session` |

**Остаётся без inbound validation:** `test_event` (debug), исходящие GAF `TypedDict` emits; `live_voice_websocket.py` post-auth `json.loads`.

**Regression:** `bash docker/scripts/run-stack0-api-tests.sh tests/test_socketio_inbound_event_validation.py tests/test_socketio_inbound_event_validation_p2.py -q` → **11 passed** (P1 5 + P2 6).

### 8.5 Free-threading / threading в socket path

`rg threading|Thread|run_in_executor socketio_handler.py` → **no matches**. Мутации module-level dict (`socket_presence_uid_by_sid`, `doc_editor_sessions`, …) — в async handlers одного event loop. **nogil risk** остаётся при будущем free-threaded cutover (см. §7.2).

### 8.6 Contract Breaches (итог)

| ID | Severity | Breach | Evidence |
|----|----------|--------|----------|
| **CB-01** | High | ~~Inbound Socket.IO без Pydantic~~ → **Fixed P1+P2:** `socketio_event_schemas.py` | `test_socketio_inbound_event_validation*.py` (11 tests) |
| **CB-02** | Medium | `session_id` не единый across transports — документировать в продуктовом каноне | Architecture table §8.2 |
| **CB-03** | Medium | Reconnect state не атомарен (React context + module maintenance vs service private fields) | `GAFChatProvider` L626–687; no Zustand bridge |
| **CB-04** | Medium | ~~`launchSocketIoHandshake` без teardown~~ → **Fixed 2026-07-06:** destroy-before-create + `emperyworldSocketService.listenerLeak.test.ts` | Vitest 1/1 |
| **CB-05** | Low | ~~Legacy `websocket_handler.py` `/ws` no JWT~~ → **soft-retired 2026-07-28**; nginx catch-all `/ws/` removed | `test_legacy_websocket_handler_soft_retired`; nginx.prod.conf guard |
| **CB-06** | Low | `live_voice` post-auth frames: `json.loads` без Pydantic | `live_voice_websocket.py` L416, L514 |

### 8.7 Files requiring immediate refactoring

| Priority | File | Action |
|----------|------|--------|
| P1 | `api/routers/socketio_handler.py` | ~~Pydantic inbound top events~~ Done (P1) |
| P1 | `services/communication/EmperyworldSocketService.ts` | ~~`teardownSocketInstance()` before `io()`~~ Done |
| P2 | `api/routers/socketio_event_schemas.py` | ~~`chat-message`, `collaboration_change`, `ping`, heartbeat~~ Done |
| P2 | `pages/Desktop/context/GAFChatProvider.tsx` | Subscribe `connection-restored` with `session_id` telemetry; optional unified transport store |
| P2 | `services/auth/authenticatedSocketAuth.ts` | After refresh, emit single `realtime-auth-synced` for all transports (socket + live voice) |
| P3 | ~~`api/routers/websocket_handler.py`~~ | Soft-retired 2026-07-28 (trash); do not remount |
| P3 | `api/routers/live_voice_websocket.py` | Typed message models after auth phase |

### 8.8 Failure / Edge-Case Matrix (audit closeout)

| Axis | Finding |
|------|---------|
| **Offline-mode** | Socket.IO: reconnect + `recoverSocketAuthConnection`; Live Voice stops on 1008 until token refresh |
| **Dual-flag / conflict** | `sso_replace_confirm` in socket auth mirrors HTTP `X-SSO-Replace-Confirm` |
| **Permission boundary** | All prod realtime paths → `validate_websocket_token` + SSO registry |
| **Regression command** | `bash docker/scripts/run-stack0-api-tests.sh tests/test_socketio_inbound_event_validation.py tests/test_socketio_inbound_event_validation_p2.py -q` |

## 9. Architectural Integrity Sentinel (AIS)

**Статус:** **Внедрён (2026-07-06)** — отдельный контур `shared/api/tests/architecture/` для drift-инвариантов (Contract, Observability, Performance).

| Компонент | Путь | Правило |
|-----------|------|---------|
| Static guard | `tests/architecture/static_guard.py` | AIS-SIO-01/02: `parse_socket_event` обязателен; `data.get()` / `data[...]` запрещены в inbound handlers |
| Identity trace | `api/core/realtime_trace_context.py` | AIS-ID-01/02: единый `correlation_id` из auth/query/headers; пустой id → CRITICAL FAILURE |
| Perf SLA | `tests/architecture/test_ais_cursor_move_benchmark.py` | AIS-PERF-01: baseline `baseline/cursor_move_validation_baseline.json` |
| Rules canon | `tests/architecture/RULES.md` | Полный каталог правил + baseline update |

**Запуск:**

```bash
bash docker/scripts/run-ais-sentinel.sh
bash docker/scripts/run-stack0-api-tests.sh tests/architecture/ -q
```

**Baseline update (false positives):** `AIS_UPDATE_BASELINE=1 bash docker/scripts/run-ais-sentinel.sh`

**CB-02 уточнение:** transport `session_id` / Socket.IO `sid` по-прежнему разные сущности; **correlation_id** — сквозной trace для observability при явной передаче клиентом (`correlation_id` / `trace_id` / `X-Correlation-Id`).

**CI:** рекомендуется добавить `run-ais-sentinel.sh` в `eliteew-pr-gate` после hygiene (≈0.5s overhead в контейнере).

