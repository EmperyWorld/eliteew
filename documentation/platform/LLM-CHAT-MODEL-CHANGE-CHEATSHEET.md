# Шпаргалка: смена чат-модели (stack2 + stack0 + UGS)

Операторский чеклист при замене GGUF на **`stack2-llama-chat`**. Имя файла в API — **basename** (например `gemma-4-26B.gguf`), должно совпадать с тем, что отдаёт `GET http://<LLAMA_CHAT_CLIENT_BIND>:<LLAMA_CHAT_HOST_PORT>/v1/models`.

> Runtime: **Podman**. `podman restart` **не** подхватывает правки env — нужен **`--force-recreate`**.

---

## 1. Физический файл

| Что | Где |
|-----|-----|
| Каталог GGUF | `STACK2_LLAMA_MODELS_PATH` в `docker/env_file/.env.stack2` (сейчас часто `/home/owned/llama-test-models`) |
| Vision mmproj | Тот же каталог; **mmproj привязан к архитектуре** (E4B ≠ 31B). Без подходящего mmproj в `stack2.yml` — `--no-mmproj` |

Проверка:

```bash
ls -la "${STACK2_LLAMA_MODELS_PATH:-/home/owned/llama-test-models}/"*.gguf
curl -sf http://127.0.0.1:8080/v1/models | python3 -m json.tool
```

**Не путать MoE и Dense:** `gemma-4-26B.gguf` (MoE interactive, parallel≥2, ~40k/slot) ≠ `gemma-4-31B-it-Q4_K_M.gguf` (dense deep profile, ~35 tok/s на RTX 3090, не default hot path).

---

## 2. Stack2 — inference (llama-server)

| Что | Файл / ключ |
|-----|-------------|
| **Главный переключатель модели** | `LLAMA_CHAT_FILE=<basename.gguf>` → `docker/env_file/.env.stack2` |
| Compose | `docker/stack/stack2.yml` → сервис `llama-chat` |
| Контекст `-c` | **26b interactive:** **`-c 81920`** + **`--parallel 2`** → ~**40960**/slot (KV `q8_0`). **31b dense (deep):** явный **`-c 200000`**, `--parallel 1`. Не задавать `-c` выше `n_ctx_train` |
| mmproj | `--no-mmproj` в compose; для E4B vision — отдельная доработка + `LLAMA_CHAT_MMPROJ_FILE` |
| Tunables VRAM | `LLAMA_CHAT_NGL`, `LLAMA_CHAT_CACHE_TYPE_K/V`, `LLAMA_CHAT_FLASH_ATTN`, … |

Recreate только чата:

```bash
cd /path/to/powered_by_emperyworld
podman compose -f docker/stack/stack2.yml \
  --env-file docker/env_file/.env.stack2 \
  up -d --force-recreate llama-chat
podman logs --tail 30 stack2-llama-chat
curl -sf "http://${LLAMA_CHAT_CLIENT_BIND:-127.0.0.1}:${LLAMA_CHAT_HOST_PORT:-8080}/health"
```

Операторский helper (`eliteew-llama-chat-model.sh`; formerly `dewa-ops-*`):

```bash
bash docker/scripts/eliteew-llama-chat-model.sh <26b|31b|e4b|basename.gguf>
# принудительно не пропускать recreate stack0, даже если в окружении выставлен legacy skip:
bash docker/scripts/eliteew-llama-chat-model.sh <preset_or_gguf> --with-stack0
```

- Точные имена известных пресетов (`gemma-4-26B.gguf`, `gemma-4-31B-it-Q4_K_M.gguf`, `gemma-4-E4B-it-UD-Q8_K_XL.gguf`) автоматически резолвятся в профиль (`26b|31b|e4b`) с корректным override.
- Для прочих `*.gguf` режим `custom`: обновляется `LLAMA_CHAT_FILE`, но профиль `stack2.prod-core.override.yml` не переключается автоматически.
- Скрипт делает fail-fast проверку консистентности: если `stack0` runtime `LLAMA_MODEL` не совпадает с целевой chat-моделью после recreate, команда завершается ошибкой.
- Скрипт делает post-switch JSON smoke (`/v1/chat/completions` + `response_format={"type":"json_object"}` + `chat_template_kwargs.enable_thinking=false`) и падает, если ответ невалидный JSON object.

Канон стека: [STACK2-LLM-CONTRACT.md](STACK2-LLM-CONTRACT.md).

Важно по E4B (`gemma-4-E4B-it-UD-Q8_K_XL.gguf`):

- У текущего GGUF `n_ctx_train=131072` (это видно в `/v1/models` и startup logs).
- Принудительный `-c 262144` не даёт реального 262k окна: llama-server предупреждает `... exceeds training context ... capping`, и слот остаётся `n_ctx=131072`.
- Для реального 262k нужен профиль/модель с `n_ctx_train >= 262144` **и** достаточный VRAM под KV (MoE 26B обычно легче; dense 31B на dual-GPU сейчас capped **200k**).

Важно по 31B (`gemma-4-31B-it-Q4_K_M.gguf`):

- Профиль: `docker/stack/profiles/stack2.prod-core.gemma-31b.override.yml` → **`-c 200000`**.
- Switcher также патчит **`.env.stack0.shared`** (workers/celery берут `LLAMA_MODEL*` оттуда, не только из `.env.stack0.backend`).

---

## 3. Stack0 — env бэкенда (fallback и домены)

Файлы: **`docker/env_file/.env.stack0.backend`** (+ **`.env.stack0.shared`** для api-worker / celery)

| Переменная | Назначение |
|------------|------------|
| **`LLAMA_MODEL`** | Главный text fallback (должен = `LLAMA_CHAT_FILE`) |
| **`LLAMA_MODEL_BI`** | BI / аналитика |
| **`LLAMA_MODEL_MARKETING`** | Маркетинговый кабинет (текст) |
| **`MARKETING_CABINET_ROUTER_MODEL`** | Router маркетингового кабинета (если не Qwen sidecar) |
| **`LLAMA_MODEL_MUSIC_TEXT_GEN`** | Музыкальный текст (пусто → `LLAMA_MODEL`) |
| **`LLAMA_MODEL_IMAGE_STUDIO`** | Image studio (если используется) |
| **`EWA_COMPANION_CHAT_MODEL`** | Override чата компаньона (пусто → `LLAMA_MODEL`) |
| **`EWA_ORCH_LLM_MODEL`** | EWA orchestration (пусто → default) |
| **`LLAMA_URL`** | `http://stack2-llama-chat:8080` (без `/v1`) |

**Не чат-модель** (менять только осознанно):

| Переменная | Роль |
|------------|------|
| `EWA_COMPANION_TOOL_ROUTER_MODEL` | FC sidecar Qwen3-4B (`stack2-llama-tool-router`) |
| `DESKTOP_AI_CHAT_TOOL_ROUTER_MODEL` | Тот же sidecar для desktop chat |
| `LLAMA_EMBEDDING_MODEL` + `LLAMA_EMBEDDING_URL` | Эмбеддинги (отдельный сервис) |
| `RAG_RERANK_BASE_URL` | Реранк (отдельный сервис) |

Recreate stack0 (env читается при create, не при restart):

```bash
bash docker/scripts/stack0-recreate-local.sh
# или
python3 docker/scripts/eliteew-container-control.py --yes \
  --include stack0-backend,stack0-frontend recreate
```

Проверка runtime:

```bash
podman exec stack0-eliteew-api-prod printenv | grep -E '^LLAMA_MODEL'
curl -sf http://127.0.0.1:29000/api/health
```

---

## 4. PostgreSQL — UGS (источник правды для runtime)

База: **`ai_services`** на `stack1-postgres`.

### 4.1 `ugs_settings` → ключ `model_routes`

JSON с маршрутизацией. Минимум обновить:

- `global_default_model`
- `category_defaults.text`
- `domain_defaults.*` (imc, music, image_studio, …)
- `provider_defaults.llama`, `miso_provider`, `imc_rag_research_provider`, …

Просмотр:

```bash
podman exec stack1-postgres psql -U ai_user -d ai_services -c \
  "SELECT value FROM ugs_settings WHERE key = 'model_routes';"
```

Приоритет resolver: см. [product/UGS-FLOW-AND-CONFIG.md](../product/UGS-FLOW-AND-CONFIG.md) (`type_overrides` → … → `global_default_model` → env).

### 4.2 `generation_providers.config_json`

Строки с `default_model` для text/chat провайдеров:

```bash
podman exec stack1-postgres psql -U ai_user -d ai_services -c \
  "SELECT provider_name, config_json->>'default_model' FROM generation_providers WHERE config_json->>'default_model' IS NOT NULL;"
```

Типичные: `llama`, `llama`, `miso_provider`, `imc_cabinet_filler_provider`.

### 4.3 Прочие таблицы (если в данных осталось старое имя)

При массовой смене — SQL-миграция (шаблон ниже) также трогает:

- `generation_types.model_name` / `parameters` / `type_metadata`
- `assistant_settings.llama_model`
- `desktop_ai_chat_config.defaults`, `desktop_ai_chats.llama_model` / `settings`
- `comfyui_workflows` (json_body, model_dependencies, metadata)

---

## 5. SQL-миграция + runner

1. Скопировать шаблон: `shared/api/migrations/applied/20260606_02_gemma4_31b_chat_model.sql`
2. Заменить старое/новое имя `.gguf`
3. Добавить строку в **`docker/scripts/apply-eliteew-migrations.sh`** → массив `MIGRATIONS`:

```bash
"20260606_02|gemma4_31b_chat_model|applied/20260606_02_gemma4_31b_chat_model.sql"
```

4. Применить:

```bash
bash docker/scripts/apply-eliteew-migrations.sh
```

Запись попадает в **`schema_migrations`**. Повторный прогон идемпотентен (UPDATE только по старому имени).

---

## 6. Порядок действий (кратко)

```text
1. Положить .gguf в STACK2_LLAMA_MODELS_PATH
2. .env.stack2  → LLAMA_CHAT_FILE
3. Recreate     → stack2-llama-chat
4. Smoke        → /health, /v1/models, короткий chat completion
5. .env.stack0.backend → LLAMA_MODEL* (+ доменные override)
6. Миграция БД  → ugs_settings + generation_providers (+ apply-eliteew-migrations.sh)
7. Recreate     → stack0 (ees0 / stack0-recreate-local.sh)
8. Smoke        → printenv LLAMA_MODEL, UGS admin snapshot, companion/desktop chat
```

---

## 7. Быстрая проверка «всё на одной модели»

```bash
MODEL='gemma-4-31B-it-Q4_K_M.gguf'

echo "=== stack2 ==="
grep '^LLAMA_CHAT_FILE=' docker/env_file/.env.stack2

echo "=== stack0 env file ==="
grep '^LLAMA_MODEL' docker/env_file/.env.stack0.backend

echo "=== stack0 runtime ==="
podman exec stack0-eliteew-api-prod printenv | grep '^LLAMA_MODEL='

echo "=== UGS DB ==="
podman exec stack1-postgres psql -U ai_user -d ai_services -t -c \
  "SELECT value->>'global_default_model' FROM ugs_settings WHERE key='model_routes';"

podman exec stack1-postgres psql -U ai_user -d ai_services -c \
  "SELECT provider_name, config_json->>'default_model' FROM generation_providers WHERE config_json->>'default_model' IS NOT NULL;"
```

Все строки должны показывать **один и тот же basename**, совпадающий с `GET /v1/models` на `:8080`.

---

## 8. UI-слои с локальным override (не забыть при отладке)

| Контур | Где может переопределиться |
|--------|----------------------------|
| Ассистент | `desktop_ai_chats.llama_model`, `desktop_ai_chat_config.defaults` |
| Assistant | `EWA_COMPANION_CHAT_MODEL` env, UGS type/domain routes |
| UGS Admin v2 | `model_routes` через UI (перезапишет JSON в БД) |
| Маркетинг | `LLAMA_MODEL_MARKETING`, AMKA routes |

---

## Связанные документы

- [STACK2-LLM-CONTRACT.md](STACK2-LLM-CONTRACT.md) — роли сервисов stack2, embed/rerank/tool-router
- [product/UGS-FLOW-AND-CONFIG.md](../product/UGS-FLOW-AND-CONFIG.md) — приоритет model routing
- [product/ewa/EWA-COMPANION-STACK2-OPERATOR.md](../product/ewa/EWA-COMPANION-STACK2-OPERATOR.md) — companion + stack2
- [product/DESKTOP-LLAMA-CHAT.md](../product/DESKTOP-LLAMA-CHAT.md) — desktop chat model cascade
- `shared/api/migrations/README.md` — pending/applied, `schema_migrations`
