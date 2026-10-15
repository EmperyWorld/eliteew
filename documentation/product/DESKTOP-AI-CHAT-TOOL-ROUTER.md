# Ассистент — Tool Router

Sidecar **function calling** для умных действий соло-чата: общий контейнер `stack2-llama-tool-router` (профиль `companion-tool-router`), отдельный meta-tool **`desktop_route_turn`**.

> Операторский runtime по умолчанию: **Podman**.

Канон Assistant router: [EWA-COMPANION-TOOL-ROUTER.md](ewa/EWA-COMPANION-TOOL-ROUTER.md).

## Роли моделей

| Роль | Сервис | Env |
|------|--------|-----|
| Видимый ответ (stream) | `stack2-llama-chat` | `LLAMA_URL` |
| Tool Router (FC) | `stack2-llama-tool-router` | `DESKTOP_AI_CHAT_TOOL_ROUTER_URL` → fallback `EWA_COMPANION_TOOL_ROUTER_URL` |

## Meta-tool `desktop_route_turn`

Enum `tool`: `chat_only` | `generate_image` | `fetch_url` | `web_search` + `confidence`, слоты `prompt`, `aspect_ratio`, `url`, `query`.

Код: `shared/api/services/desktop_chat/sidecar/tool_router.py`, Pydantic `DesktopToolRouterResultV1`.

## Режимы rollout

| Режим | Поведение |
|-------|-----------|
| `shadow` | Лог `[STEP] desktop_tool_router`; исполнение через legacy `run_tool_loop` |
| `partial` (**default** env / admin empty form; Wave 5 / `desktop-ai-chat-013`) | Router исполняет `generate_image` и `web_search` (если `use_web_search=true`); иначе fallback `run_tool_loop` при включённом веб-поиске |
| `full` | Router + `generate_image`, `fetch_url`, `web_search` (последний — только при `use_web_search=true`); **opt-in only** |

Admin `defaults`: `desktop_tool_router_enabled`, `desktop_tool_router_mode`, `desktop_tool_router_min_confidence`. Persisted DB `desktop_tool_router_mode` wins over env; unset key → env → **`partial`**.

## Global Search Runtime Config (DB-first)

- Единый контур web-search runtime живёт в `search_runtime_config` (API: `GET/PATCH /api/v1/desktop/admin/search-config/config`, bootstrap env→DB: `POST /api/v1/desktop/admin/search-config/config/bootstrap-env`). Operator hub: admin `?section=search` — probe/test-search/diagnostics; см. `documentation/product/WEB-SEARCH-ADMIN-OPERATIONS.md`.
- Router/loop вызовы `desktop_web_search` используют `search_service.web_search()` с приоритетом:
  1. request-level flags (`use_web_search`, `use_tools`) — SPA **one-shot**: тумблер сбрасывается после отправки
  2. surface toggle (`surfaces.desktop`)
  3. DB runtime settings + encrypted Yandex secrets
  4. env fallback при недоступном DB-конфига или пустом singleton (`[STEP] search_config_fallback_env`)
- Quota enforcement теперь тоже DB-driven (`quota_enforced`, `monthly_free_default`) через `web_search_quota_service`.

### Поведение при web_search miss

- Если router/loop вызвал `desktop_web_search`, но tool-результат пустой/ошибочный (`ничего не найдено`, `не настроен`, quota-denied), в LLM добавляется отдельный no-hits nudge.
- Nudge запрещает выдумывать новости/температуры/ссылки и требует честного ответа «проверяемых фактов нет, уточните запрос/дату/источник».
- Отдельный guard в system prompt покрывает ходы с `use_tools=false`: ассистенту запрещено писать «я провёл поиск», когда инструменты не запускались.
- Если `desktop_web_search` вернул hits, но финальный ответ всё равно утверждает «данных нет», backend делает repair retry (без tools) с принудительным extractive-инструктажем по уже найденным URL.

Env stack0:

- `DESKTOP_AI_CHAT_TOOL_ROUTER_ENABLED=1`
- `DESKTOP_AI_CHAT_TOOL_ROUTER_MODE=shadow|partial|full`
- `DESKTOP_AI_CHAT_TOOL_ROUTER_URL`, `DESKTOP_AI_CHAT_TOOL_ROUTER_MODEL` (опционально)
- `DESKTOP_AI_CHAT_TOOL_ROUTER_NUM_CTX` (default `8192`) — контекст FC-запроса к sidecar; должен быть **≤** `LLAMA_TOOL_ROUTER_CTX` на gpu141 / stack2
- `DESKTOP_AI_CHAT_TOOL_ROUTER_MAX_TOKENS` (default `512`, clamp **64…1024** per STACK2-LLM-CONTRACT) — бюджет FC JSON; не silent-cap на 128

Sidecar gpu141: `LLAMA_TOOL_ROUTER_CTX` в `.env.llama-remote` (deploy `start-gpu141-embed-rerank.sh`, default **8192**). При `exceed_context_size_error` / `n_ctx=2048` в логах — пересоздать `llama-remote-tool-router` с большим `-c`.

## Smoke

1. Поднять sidecar: `podman compose -f docker/stack/stack2.yml --env-file docker/env_file/.env.stack2 --profile companion-tool-router up -d llama-tool-router`
2. Default / `DESKTOP_AI_CHAT_TOOL_ROUTER_MODE=partial` — запрос «нарисуй кота» с smart tools: router может исполнить image (если tools image on); web search только при `use_web_search=true`.
3. `DESKTOP_AI_CHAT_TOOL_ROUTER_MODE=shadow` — тот же запрос: decision в логах, UX через legacy `run_tool_loop`.
4. `full` — только после явного admin/env opt-in (fetch_url + web).

См. также [DESKTOP-LLAMA-CHAT.md](DESKTOP-LLAMA-CHAT.md).
