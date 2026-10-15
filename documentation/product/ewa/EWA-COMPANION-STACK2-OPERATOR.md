# Assistant и stack2 LLM: операторский чеклист

Краткая памятка для смены моделей / диагностики «тихих» сбоев sidecar-классификаторов и перегрузки embed-сервиса. Пайплайн turn phases: [EWA-COMPANION-CHAT-TURN-PHASES.md](EWA-COMPANION-CHAT-TURN-PHASES.md). Топология: [PRODUCTION-TOPOLOGY-STATE.md](../../platform/PRODUCTION-TOPOLOGY-STATE.md) §Current.

## Роли моделей (prod)

| Роль | Где задаётся | Prod endpoint / хост | Комментарий |
|------|----------------|----------------------|-------------|
| Основной ответ чата | `LLAMA_URL`, `EWA_COMPANION_CHAT_MODEL` / unified | **prod-core** `.111` — `stack2-llama-chat` (live: `gemma-4-26B.gguf`) | **Chat template:** Google Gemma 4 Canonical (2026-07-09) — verified via `GET /props`. Companion HTTP: `chat_template_kwargs.enable_thinking=false` + `reasoning_format=none` (override: `EWA_COMPANION_CHAT_ENABLE_THINKING=1`). UI: `openai_visible_assistant_content_only` — CoT не в пузырь. Vision: OCR default; multimodal — [EWA-COMPANION-VISION-MULTIMODAL.md](EWA-COMPANION-VISION-MULTIMODAL.md). |
| Trust / Arlika | `EWA_COMPANION_TRUST_CLASSIFY_MODEL` (fallback chat) | тот же llama-chat | Короткий вызов + `enable_thinking=false`; при длинном CoT поднимайте `EWA_COMPANION_TRUST_CLASSIFY_MAX_TOKENS`. |
| Intent planner | `EWA_COMPANION_INTENT_MODEL` | llama-chat | Бюджеты `INTENT_MIN_NUM_PREDICT` / `INTENT_NUM_PREDICT` + `enable_thinking=false`. При **`partial`/`full` Tool Router** planner **выключен** по умолчанию (`EWA_COMPANION_INTENT_PLANNER_FORCE=1` — override). |
| **Tool Router (FC)** | PG `EWA_COMPANION_TOOL_ROUTER_URL` + compose **`.env.stack0.shared`** `DESKTOP_AI_CHAT_TOOL_ROUTER_*` (не backend-only) | **Штатно:** **gpu141** `:8083` (Qwen3-4B). **Trial 2026-08-16:** prod-core llama-chat `:8080` (Gemma-4-26B) — contention с chat; rollback → `.141:8083` + Qwen | Qwen: `<\|im_start\|>` / `<tool_call>`, `enable_thinking=false`. `EWA_COMPANION_TOOL_ROUTER_MAX_TOKENS` default **384**, clamp **64…1024**. Режимы `shadow` / `partial` / `full`. [EWA-COMPANION-TOOL-ROUTER.md](EWA-COMPANION-TOOL-ROUTER.md). |
| Embeddings | `LLAMA_EMBEDDING_URL` (stack0: `http://192.168.1.141:8081`) | **gpu141** `:8081` (`Qwen3-Embedding-8B-Q4_K_M.gguf`) | На chat-turn с HCM: query embed + Qdrant; на write — episodic embed. Параллелизм: `EWA_COMPANION_EMBED_PARALLELISM` / `EWA_COMPANION_EMBED_HTTP_CONCURRENCY`. |
| Rerank | `RAG_RERANK_BASE_URL` (stack0: `http://192.168.1.141:8082`) | **gpu141** `:8082` (`Qwen3-Reranker-8B.Q4_K_M.gguf`) | Пустой URL = off. Companion episodic: `EWA_COMPANION_EPISODIC_RERANK_*` в PG. Timeout: `min(remaining retrieval budget, EWA_COMPANION_EPISODIC_RERANK_TIMEOUT_SEC)` (default **8 s**). |

**Celery companion/agentic jobs** — на **prod-core** (не gpu141). gpu141 serves inference endpoints and ComfyUI only, not Celery workers.

## Chat templates (live verify)

Снять фактический Jinja с сервера (не полагаться только на GGUF filename):

```bash
curl -sf http://192.168.1.111:8080/props | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["model_path"]); print((d.get("chat_template") or "")[:200]); print(d.get("chat_template_caps"))'
curl -sf http://192.168.1.141:8083/props | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["model_path"]); print((d.get("chat_template") or "")[:160])'
```

| Endpoint | Expected template markers (2026-07-26) |
|----------|----------------------------------------|
| `.111:8080` | `Google Gemma 4 Canonical Chat Template` · `Published: 2026-07-09` · caps `supports_object_arguments` |
| `.141:8083` | Qwen Instruct · `<\|im_start\|>` · `<tool_call>` · `multi_step_tool` |
| `.141:8081` / `:8082` | Qwen Embedding / Reranker GGUF — used via `/v1/embeddings` / `/v1/rerank`, not companion chat FC |

**Gemma 4 invariant for companion:** `tool_calls[].function.arguments` must be a **JSON object** (mapping), never a pre-stringified JSON string — template `raise_exception` otherwise. Tool Router parses both object and string on the response side.

## Симптомы и действия

1. **Trust всегда 0 / planner `…_unparseable` / пустой `content` + форма в `reasoning_content`:** поднять `EWA_COMPANION_TRUST_CLASSIFY_MAX_TOKENS` / `EWA_COMPANION_INTENT_NUM_PREDICT`; проверить `openai_sidecar_merge_reasoning` + что запрос шлёт `chat_template_kwargs.enable_thinking=false`.
2. **429 / таймауты на embed:** `EWA_COMPANION_EMBED_HTTP_CONCURRENCY=3`…`6`; health на **gpu141**: `ssh gpu141 'curl -sf http://127.0.0.1:8081/health'`.
3. **Новая размерность GGUF:** обновить `AI_EMBEDDINGS_DIMENSION` + Qdrant collections по регламенту.
4. **Tool Router unhealthy:** `ssh gpu141 'curl -sf http://127.0.0.1:8083/health'`; из API — URL из PG (не docker-only hostname без LAN rewrite). См. [EWA-COMPANION-TOOL-ROUTER.md](EWA-COMPANION-TOOL-ROUTER.md).
5. **Companion «запустила», ops пусто:** `EWA_COMPANION_TOOL_ROUTER_MODE` в **EWA Admin / PG** (не `shadow`; compose env не override PG); логи `companion_tool_router_*` / `tool_router_dispatch`; companion Celery на `.111`.
6. **`rag.rerank` 500 «too large»:** уменьшить `EWA_COMPANION_EPISODIC_RERANK_MAX_CHARS_PER_DOC` или выключить flag.
7. **`rag.rerank` timeout / `circuit_open`:** `ssh gpu141 'curl -sf http://127.0.0.1:8082/health'`; поднять `EWA_COMPANION_EPISODIC_RERANK_TIMEOUT_SEC` / retrieval budget.
8. **Vision attach → 400:** только JPEG/PNG/WebP — [EWA-COMPANION-VISION-MULTIMODAL.md](EWA-COMPANION-VISION-MULTIMODAL.md) §3.
9. **Vision OOM на llama-chat (.111):** снизить `LLAMA_CHAT_IMAGE_MAX_TOKENS` / ctx; mmproj в `${STACK2_LLAMA_MODELS_PATH}` только для multimodal профиля.
10. **Сырой CoT / пустые пузыри после смены Gemma template:** убедиться что API шлёт `enable_thinking=false` (код: `companion_chat_template_kwargs`); live props `reasoning_format=none`.

## Smoke (ручной)

1. Короткое «привет» — ответ персоны, нет `companion_intent_planner_unparseable`.
2. «что ты помнишь» — оркестратор / RAG без падения.
3. **Tool Router (`MODE=partial|full`):** фраза с действием → операция в панели + Celery на **prod-core** companion worker.
4. **Golden live eval:** companion tool-router pytest suite (`shared/api/tests/test_companion_tool_router.py` — former `shared/api/tests/test_companion_tool_router.py` not in tree) в API-контейнере — см. [EWA-COMPANION-TOOL-ROUTER.md §8.2](EWA-COMPANION-TOOL-ROUTER.md).
5. **Vision:** attach JPEG → вопрос по картинке (OCR default или multimodal при флаге).

Связанный канон: [STACK2-LLM-CONTRACT.md](../../platform/STACK2-LLM-CONTRACT.md), `platform/docker-re_doc/STACK0-LLM-OVERVIEW.md`.
