# Архитектура кэширования в EliteEW

Документ описывает **все слои кэша** в проекте: где хранятся данные, какие TTL, кто инвалидирует и как не смешивать данные между пользователями.

**Оглавление**

1. [Обзор: Redis и не-Redis кэши](#1-обзор-redis-и-не-redis-кэши)
2. [Распределение баз Redis (stack1-redis)](#2-распределение-баз-redis-stack1-redis)
3. [Кэши по слоям](#3-кэши-по-слоям)
4. [Инвалидация кэша](#4-инвалидация-кэша)
5. [Правила изоляции пользователей](#5-правила-изоляции-пользователей)
6. [Очистка и мониторинг](#6-очистка-и-мониторинг)

---

## 1. Обзор: Redis и не-Redis кэши

| Хранилище | Назначение |
|-----------|------------|
| **Redis (stack1-redis)** | API response cache, пользователи/токены, сессии, кэши stack2 (Llama/ComfyUI), маркетинг, контент-списки, версия кэша и др. |
| **PostgreSQL** | UGS: кэш результатов генерации (таблица `generation_cache`), все персистентные данные. |
| **In-memory (процесс API)** | Маркетинг: L1 dict; провайдеры: локальные кэши до записи в Redis. Исторический BI Airflow in-memory контур снят с prod. |

Один инстанс Redis (stack1-redis), 16 баз (0–15). Разные сервисы используют **отдельные базы** для изоляции и независимой инвалидации.

---

## 2. Распределение баз Redis (stack1-redis)

| DB | Сервис / назначение | Ключи (примеры) | TTL |
|----|----------------------|-----------------|-----|
| **0** | Response Cache Middleware, RedisService, cache_warmer, маркетинг, unified content, cache_version | `response_cache:*`, `user_profile:*`, `user_theme:*`, `app:cache_version`, `marketing:*`, `content:*` | 30 мин (api_cache), 1 ч (user_cache) |
| **1** | AI SDK cache/rate limit (исторически также использовалась Airflow broker) | `ai_sdk:*` | По настройкам AI SDK |
| **2** | ai_service_orchestrator (исторически также использовалась Airflow result backend) | Результаты задач оркестратора | По сервису |
| **3** | ai_cache_service | Кэш AI-ответов | По сервису |
| **4** | Unified config (connection_strings) | Кэш конфигов | По использованию |
| **5** | **Stack2: Llama cache** | `llama:models` (список моделей) | 5 мин |
| **6** | **Stack2: ComfyUI cache** | `comfyui:checkpoints` | 5 мин |
| **7** | Legacy reserve (бывший BI Airflow Redis-кэш) | — | — |
| **11** | Document collaboration, Elite Editor (конфиг) | Сессии коллаборации, конфиг Redis | По сервисам |
| **14** | Telegram / UGS (Telegram, TalkMateAI) | Состояния бота, очереди | По сервисам |
| **15** | UserCacheService, Live Voice (orchestrator), MTProto sessions | `user:*`, `token:*`, `user:content:list:*`, `user:content:stats:*`, `user:content:tags:*` | 1 ч (user), по exp (token) |

Константы Redis DB для stack2: `api/core/redis_db_constants.py`.

---

## 3. Кэши по слоям

### 3.1. Response Cache (HTTP GET) — Redis DB 0

- **Где:** `api/middleware/response_cache.py`
- **Ключ:** `response_cache:{md5(path|query_params|user_id)}`
- **user_id:** из `request.state.user_id` (OAuth2 выполняется до middleware) или `"anonymous"`.
- **TTL:** 30 мин (`redis_service.DEFAULT_EXPIRATIONS["api_cache"]`).
- **Исключения:** В `EXCLUDED_PATHS` и `EXCLUDED_PATTERNS` — health, monitoring, auth, stream, ws, sse, `/api/v1/ugs/tasks`, `/api/v1/content`, profile, редакторы, `/api/v1/desktop-client/` (ops-token JWT-skip surface; anonymous cache key must not store peer lists) и т.д. Полный список — в коде middleware.

Не кэшируются персональные и тяжёлые ответы (например список задач UGS). **Security:** JWT-skip ops GETs keyed as `user_id=anonymous` must stay excluded — otherwise one authorized `GET …/portal-peers` becomes a Redis HIT for callers without `X-Desktop-Client-Ops-Token`.

---

### 3.2. User Cache Service — Redis DB 15

- **Где:** `api/services/user_cache_service.py`
- **Ключи:**
  - `token:{sha256(token)}` — payload JWT
  - `user:{user_id}` — объект пользователя
  - `user:{user_id}:token:{exp}` — быстрый поиск по user+exp
  - `user:content:list:{user_id}:{filter_hash}` — списки контента (TTL 5 мин)
  - `user:content:stats:{user_id}` — статистика (TTL 10 мин)
  - `user:content:tags:{user_id}` — популярные теги (TTL 15 мин)
- **TTL:** 1 ч по умолчанию; для токенов — по `exp` минус 60 с.

Используется для изоляции пользовательских и токеновых данных от общего кэша (DB 0).

---

### 3.3. Cache warmer (прогрев при старте) — Redis DB 0

- **Где:** `api/core/cache_warmer.py`
- **Ключи:** `user_profile:{user.id}`, `user_theme:{theme.user_id}`
- **TTL:** 1 ч (`user_cache`)

При старте приложения прогреваются профили и темы активных пользователей. Инвалидация при обновлении пользователя — через `CacheEventInvalidator` (паттерны `user_profile:*`, `user_theme:*` в DB 0).

---

### 3.4. UGS: кэш результатов генерации — PostgreSQL

- **Где:** `api/services/ugs/cache_service.py`, таблица `generation_cache`
- **Ключ:** хэш от типа генерации + входных данных (в БД — поле `cache_key`).
- **TTL:** по полю `expires_at` (по умолчанию 1 ч).

Кэш результатов генерации (изображения, текст и т.д.) хранится в PostgreSQL, не в Redis.

---

### 3.5. Stack2: Llama — Redis DB 5

- **Где:** `api/services/ugs/providers/llama_provider.py`
- **Ключ:** `llama:models`
- **Содержимое:** JSON списка моделей (`/api/tags` или `/v1/models`).
- **TTL:** 5 мин (`STACK2_CACHE_TTL_LLAMA_MODELS`).

Снижает число запросов к текущему LLM endpoint из `LLAMA_URL` (обычно `stack2-llama-chat`, legacy-дефолт в коде — `stack2-llama`).

---

### 3.6. Stack2: ComfyUI — Redis DB 6

- **Где:** `api/services/ugs/providers/comfyui_provider.py`
- **Ключ:** `comfyui:checkpoints`
- **Содержимое:** JSON списка чекпоинтов из `/object_info/CheckpointLoaderSimple`.
- **TTL:** 5 мин (`STACK2_CACHE_TTL_COMFYUI_CHECKPOINTS`).

Снижает число запросов к stack2-comfyui за списком чекпоинтов.

---

### 3.7. Legacy BI Airflow (снят с prod)

- BI Airflow-контур архивирован; production runtime его не использует.
- Историческая реализация in-memory кэша и упоминание DB 7 оставлены только как миграционный контекст.
- Airflow / BI legacy notes — в `trash/` (не канон).

---

### 3.8. Marketing Cabinet — Redis DB 0 + in-memory L1

- **Где:** `api/services/marketing_cabinet/cache_service.py`
- **Ключи:** `marketing:{module}:{type}:...` (например `marketing:jtbd:list:...`).
- **TTL:** по модулю и типу данных (от 5 мин до 2 ч), см. `CACHE_TTLS` в сервисе.
- **L1:** in-memory dict в процессе для горячих данных.

---

### 3.9. Unified Cache Service и Cache Version Manager — Redis DB 0

- **Где:** `api/services/unified_cache_service.py`, `api/services/cache_version_manager.py`
- **Назначение:** единая точка доступа к кэшу (get/set/invalidate_pattern), учёт версии приложения для инвалидации при деплое.
- **Версия:** ключ `app:cache_version` в DB 0. При смене версии приложения можно сбрасывать кэш по префиксам (api, content, marketing, user, ai_sdk, dashboard).

---

### 3.10. Прочие Redis-потребители

| Сервис | DB | Назначение |
|--------|----|------------|
| Document collaboration | 11 | Сессии коллаборации по документам |
| Telegram / TalkMateAI | 14 | Состояние бота, очереди |
| Live Voice (redis_orchestrator) | 15 | История/состояние голосового пайплайна |
| MTProto (Telegram) | 15 | Сессии (изоляция пользовательских данных) |
| AI SDK cache / rate limit | 1 | Кэш чат-ответов и лимиты (исторически DB 1 делила роль с Airflow broker) |
| ai_cache_service | 3 | Кэш AI-ответов |
| ai_service_orchestrator | 2 | Кэш оркестратора (исторически DB 2 делила роль с Airflow result backend) |
| Unified content (redis_cache_service) | 0 | Кэш контента по URL/ключам |
| Celery (stack0) | 0 по умолчанию | Очереди/результаты (если не переопределено) |

---

## 4. Инвалидация кэша

- **По событию (обновление пользователя):**  
  `api/services/cache_event_invalidator.py` → `invalidate_on_user_update(user_id)`.  
  Инвалидирует в DB 0 ключи по паттернам: `user:*`, `user_profile:*`, `user_theme:*`, `user:profile:*`, `user:theme:*`, `dashboard:*`, `content:list:*` и др. Вызывается, в частности, из `user_profile_service` после обновления профиля.

- **По событию (контент):**  
  `invalidate_on_content_create`, `invalidate_on_content_update` — сброс списков контента и связанных ключей.

- **По событию (маркетинг):**  
  `invalidate_on_marketing_update(module, company_id, project_id)` — инвалидация по модулю и опционально company/project.

- **При деплое:**  
  `CacheVersionManager.check_and_invalidate_if_needed()` при старте приложения сравнивает версию с `app:cache_version` и при смене версии может инвалидировать кэши (по префиксам в DB 0).

- **Ручная очистка всего Redis:**  
  redis-flush.sh *[absent — historical Redis flush helper]* (FLUSHALL по всем базам). Использовать осторожно.

---

## 5. Правила изоляции пользователей

- **Response Cache:** в ключ входит `user_id` (или `"anonymous"`). Middleware стоит после OAuth2, поэтому пользователь определяется до кэширования. Разные пользователи не получают чужие ответы.
- **UserCacheService (DB 15):** все ключи содержат `user_id` или уникальный хэш токена. В `get_user_content_list` есть проверка: если в закэшированном списке `user_id` не совпадает с запрошенным — кэш сбрасывается и возвращается `None`.
- **Cache warmer:** ключи `user_profile:{id}` и `user_theme:{user_id}` — разделение по пользователю.
- **Маркетинг / content:** ключи строятся с учётом `user_id` или `company_id`/`project_id` там, где данные персональные.

Добавление новых кэшей с персональными данными: всегда включать в ключ идентификатор пользователя (или токен/сессию) и при чтении проверять соответствие.

---

## 6. Очистка и мониторинг

- **Очистка всего Redis:**  
  из корня репозитория: redis-flush.sh *[absent — historical Redis flush helper]* (читает `REDIS_PASSWORD` из .env *[local under docker/env_file/; not tracked]* или окружения).

- **Мониторинг Redis:**  
  - Эндпоинт: `GET /api/v1/monitoring/redis` (или `/api/monitoring/redis`) — проверка доступности и базовая информация.  
  - Операторская диагностика без вывода секрета: `bash docker/scripts/redis-diagnostics.sh summary`. Скрипт читает `REDIS_PASSWORD` из process env, prod-core runtime tmpfs (`$ELITEEW_ENV_RUNTIME_DIR` / `$XDG_RUNTIME_DIR/eliteew/env-runtime`) или `docker/env_file/.env.stack1`, передаёт auth через `REDISCLI_AUTH` и печатает только metadata/PING/`INFO memory`/`DBSIZE`.
  - Не использовать `podman exec stack1-redis redis-cli --pass "$REDIS_PASSWORD" ...` как канон: `stack1-redis` не экспортирует `REDIS_PASSWORD` в env контейнера, поэтому такой ручной вызов легко даёт `WRONGPASS`/`NOAUTH` при рабочем Redis.

- **Документация в коде:**  
  - Response Cache: `api/middleware/response_cache.py` — ссылка на этот документ.  
  - User Cache: `api/services/user_cache_service.py` — DB 15, только пользователи и токены.  
- Stack2: `api/core/redis_db_constants.py`; актуальный compose stack2 — `docker/stack/stack2.yml`.

При изменении TTL, добавлении новых баз или новых типов ключей — обновлять этот документ и при необходимости `api/core/redis_db_constants.py`.
