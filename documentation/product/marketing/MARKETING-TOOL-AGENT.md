# Агент с инструментами (tool-agent) в маркетинговом кабинете

Документ описывает **реализованный** поток: **router в Llama (tool calling)** → **исполнение инструментов на сервере** → **финальный ответ через UGS** (`text_chat`), а также **UI** (AI Studio и контекстный чат) и **контракт API**.

Общий обзор кабинета: [MARKETING-CABINET.md](MARKETING-CABINET.md). RAG по документам проекта: [MARKETING-PROJECT-RAG.md](MARKETING-PROJECT-RAG.md).

---

## 1. Назначение

**Tool-agent** отвечает на вопросы по проекту, комбинируя:

- **структурированные данные** из PostgreSQL (контекст проекта, счётчики, списки JTBD и конкурентов);
- **семантический поиск по файлам** (RAG в Qdrant), когда router вызывает `search_project_documents`;
- **опционально — краткую переписку** из чата кабинета (`chat_context_excerpt`), чтобы связать ответ с диалогом и уточнить запрос к RAG.

Отличие от **обычного контекстного чата** (`/marketing-cabinet/chat/...`): там один вызов UGS по уже сформированному контексту; **tool-agent** сначала выбирает инструменты отдельной **router-моделью** в Llama, исполняет их на бэкенде, затем один раз собирает финальный промпт и вызывает UGS.

---

## 2. Цепочка выполнения (бэкенд)

1. **Rate limit** и **idempotency** (`tool_agent`, ключ из запроса).
2. **Доступ к проекту**: `get_accessible_project(..., for_mutation=True)`.
3. **Router (LAN tool-router sidecar или fallback Llama `POST /api/chat`)**  
   - **по умолчанию:** HTTP FC к shared inference sidecar на LAN (gpu141 `:8083`; env по умолчанию может совпадать с `EWA_COMPANION_TOOL_ROUTER_URL` — это **инфраструктура**, не продукт Assistant / не вкладка AMKA);  
   - `MARKETING_CABINET_TOOL_ROUTER_ENABLED=1` (или не задан — включено, если URL резолвится); `MARKETING_CABINET_TOOL_ROUTER_URL` / `MARKETING_CABINET_TOOL_ROUTER_MODEL` — опциональные override;  
   - **fallback (opt-in):** `MARKETING_CABINET_TOOL_ROUTER_FALLBACK_STACK2=1` → локальный stack2 Llama + `MARKETING_CABINET_ROUTER_MODEL` (например `gemma-4-…`); **по умолчанию выключено** — при недоступном sidecar **502**;
   - `tools` = whitelist из `marketing_agent_tools.py` (`MARKETING_AGENT_TOOLS_LLAMA`);  
   Системный промпт требует **только вызовы инструментов**, без свободного текста.
4. **Парсинг tool_calls** → `execute_marketing_agent_tools`: последовательное исполнение по плану router (лимиты: `MAX_ROUTER_TOOL_CALLS`, `MAX_AGENT_TOOL_RESULTS_CHARS`).
5. **Контекст проекта + RAG для синтеза**:  
   `build_project_context` → `merge_project_context_text_with_rag` с query из `prompt` + свежего excerpt диалога; в merge используется `min_score=0.22`, а старые реплики режутся раньше новых, чтобы follow-up вопросы не тянули случайные слабые совпадения.  
6. **Финальный промпт** для UGS: блок «данные инструментов», контекст Postgres+RAG, при наличии excerpt — блок **«Контекст диалога»** (до ~6000 символов excerpt в промпте).
7. **UGS** `type_key="text_chat"` → текст ответа.
8. **Запись в `marketing_ai_runs`** с `tool_key="tool_agent"`, в `metadata`: `router_model`, `router_backend` (`lan_tool_router` | `stack2_llama`), `planned_tools`, `tool_traces`, `source` (`chat` | `ai_studio`).

Код: `shared/api/routers/marketing_cabinet/ai.py` (`marketing_tool_agent`), `shared/api/services/marketing_cabinet/marketing_tool_router.py`, `shared/api/routers/marketing_cabinet/marketing_agent_tools.py`, `shared/api/services/marketing_cabinet/marketing_tool_agent_core.py`.

---

## 3. Инструменты (whitelist)

Имя | Назначение
---|---
`search_project_documents` | Семантический поиск по чанкам документов проекта в Qdrant (`search_marketing_project_rag`).
`get_entity_counts` | Сводка заполненности разделов кабинета (счётчики сущностей).
`list_job_stories` | Краткий список Job Stories (JTBD), лимит параметром (по умолчанию до 8).
`list_competitors` | Краткий список конкурентов проекта, лимит параметром (по умолчанию до 8).

Все запросы к данным идут по **`project_id`** с проверкой доступа пользователя.

---

## 4. HTTP API

**`POST /api/v1/marketing-cabinet/ai/tool-agent`**

Поле | Тип | Описание
---|---|---
`prompt` | string, min 4 символа | Вопрос пользователя.
`project_id` | UUID | Обязателен; без проекта агент не вызывается.
`router_model` | string, опционально | По умолчанию `functiongemma:latest`.
`idempotency_key` | string, опционально | Для идемпотентности; если не передан — клиент может генерировать UUID.
`chat_context_excerpt` | string, опционально, до 8000 символов | Укороченная переписка (чат кабинета); в router и в синтезе; для RAG-merge используется усечённо.
`source` | `chat` \| `ai_studio` или не задано | Нормализуется в `metadata` запуска; по умолчанию трактуется как `ai_studio`.

Ответ (`MarketingToolAgentResponse`): `output_text`, `router_model`, `planned_tools`, `tool_traces`, `run` (карточка AI-run).

---

## 5. Фронтенд

### 5.1 AI Studio

Блок запуска tool-agent с `source: 'ai_studio'` (как в `marketingCabinetApi.runToolAgent`).

### 5.2 Контекстный чат (`mc_view=chat`)

- Кнопка **«С инструментами»** рядом с обычной отправкой (`ChatView.tsx`).
- Доступна при **выбранном проекте** и не в read-only; иначе показывается подсказка через `cabinetPage.validation.toolAgentNeedsProject`.
- Перед отправкой строится excerpt: **`buildMarketingChatExcerpt(messages)`** в `marketingCabinetPageHelpers.ts` — последние до **14** реплик, суммарно до **3500** символов (формат `Пользователь:` / `Ассистент:`).
- В запрос уходит **`source: 'chat'`** и `chat_context_excerpt` (excerpt из текущей ленты **до** добавления нового пользовательского сообщения; после успеха ответ ассистента добавляется в ту же ленту локально).
- Ошибки: toast `cabinetPage.notices.toolAgentChatFailed` и баннер в `ChatView` (см. `chatView.toolAgentFailedTitle`).

Оркестрация мутаций: **`MarketingCabinetPage.tsx`** (`sendToolAgentChatMutation`, `handleSendToolAgentMessage`).

### 5.3 Клиент API

`shared/web/frontend/src/pages/MarketingCabinet/marketingCabinetApi/` — метод `runToolAgent` с полями `chat_context_excerpt`, `source`.

---

## 6. Журнал AI и миграции

- Запуски пишутся в **`marketing_ai_runs`** с **`tool_key = 'tool_agent'`** (ранее исторически мог встречаться `agent_demo`; при необходимости миграция переименования — в `shared/api/migrations/applied/`, см. файлы с `tool_key` / `tool_agent`).

---

## 7. Эксплуатация и требования

- **Tool-router (предпочтительно):** LAN sidecar на `.141:8083` (цепочка URL: `MARKETING_CABINET_TOOL_ROUTER_URL` → `EWA_COMPANION_TOOL_ROUTER_URL` → `DESKTOP_AI_CHAT_TOOL_ROUTER_URL` → `http://stack2-llama-tool-router:8080`); модель Qwen3-class (общая цепочка в `api/utils/tool_router_sidecar_runtime.py`).
- **Fallback router (legacy):** только при `MARKETING_CABINET_TOOL_ROUTER_FALLBACK_STACK2=1` — stack2 Llama chat + `MARKETING_CABINET_ROUTER_MODEL`.
- Env: `MARKETING_CABINET_TOOL_ROUTER_ENABLED=1` (явно выключить: `0`); опционально `MARKETING_CABINET_TOOL_ROUTER_URL`, `MARKETING_CABINET_TOOL_ROUTER_TIMEOUT_SEC` (default 45), `MARKETING_CABINET_TOOL_ROUTER_FALLBACK_STACK2` (default `0`).
- При **502** от эндпоинта: проверить health sidecar (`curl -sf http://192.168.1.141:8083/health`); без fallback env в логах не будет `router_remote_failed` — сразу 502; с fallback — `[STEP] marketing_agent.router_remote_failed`.
- Лимиты AI кабинета — общие с другими LLM-вызовами: `check_marketing_cabinet_ai_rate_limit`.

---

## 8. Связанные файлы (карта)

| Компонент | Путь |
|-----------|------|
| Роутер эндпоинта и синтез | `shared/api/routers/marketing_cabinet/ai.py` |
| LAN tool-router sidecar | `shared/api/services/marketing_cabinet/marketing_tool_router.py` |
| Оркестрация tool-agent | `shared/api/services/marketing_cabinet/marketing_tool_agent_core.py` |
| Исполнение инструментов | `shared/api/routers/marketing_cabinet/marketing_agent_tools.py` |
| Llama chat + tools (fallback) | `shared/api/services/llama_service.py` |
| UI чата | `shared/web/frontend/src/pages/MarketingCabinet/views/ChatView.tsx` |
| Страница кабинета | `shared/web/frontend/src/pages/MarketingCabinet/MarketingCabinetPage.tsx` |
| Excerpt переписки | `shared/web/frontend/src/pages/MarketingCabinet/marketingCabinetPageHelpers.ts` |
| i18n | `shared/web/frontend/src/i18n/locales/ru/marketing.json`, `en/marketing.json` (`chatView.sendWithTools*`, `cabinetPage.notices.toolAgentChatFailed`, …) |
