# UGS: поток генерации и конфигурация

**Обновлено:** 2026-07-18
**Область:** Unified Generation System (UGS) — runtime generate/stream, env, model routing. UI/desktop: [ugs_frontend_contract_and_regression_baseline.md](ugs_frontend_contract_and_regression_baseline.md), [desktop/UGS-DESKTOP-SHELL.md](desktop/UGS-DESKTOP-SHELL.md).

---

## 1. Поток генерации

1. **Клиент** вызывает `POST /api/v1/ugs/generate` или `POST /api/v1/ugs/generate/stream` (SSE) с `type_key`, `input_data`, опционально `project_id`, `company_id`, `priority`, `idempotency_key`.
2. **Координатор** (`UnifiedGenerationService.generate()` / `start_generation_for_stream`; submit helpers in `generation_submit.py` + `generation_submit_helpers.py`):
   - Проверяет тип генерации (по `type_key`), квоты, при необходимости — кеш.
   - Создаёт запись `GenerationRequest` (статус `pending`), коммитит.
   - Выполняет генерацию **напрямую** или через **очередь UGS** (RabbitMQ queue worker — см. `platform/docker-re_doc/UGS-QUEUE-OPERATOR-ENV.md`). Apache Airflow **снят с prod**.
   - **Detached stream:** при падении фоновой задачи строка финализируется через `finalize_detached_generation_failure` (`error_type=detached_execution_crash`).
3. **Завершение (prod):** worker/provider обновляет Postgres (`status`, `output_data`, `completed_at`). Legacy HTTP callback `/api/ugs/callback/complete` **не используется** в текущем queue worker path.
4. **Клиент** опрашивает `GET /api/v1/ugs/status/{request_id}`, слушает SSE, или запрашивает `GET /api/v1/ugs/result/{request_id}`. HTTP/SSE чтение статуса и результата owner-scoped: leaked `request_id` другого пользователя не должен раскрывать payload.

---

## 2. Конфигурационные переменные (env)

| Переменная | Описание | По умолчанию / примечание |
|------------|----------|---------------------------|
| `UGS_CALLBACK_BASE_URL` | Base URL для legacy callback worker → API | Исторический; prod-контур обновляет Postgres напрямую |
| `UGS_CALLBACK_SECRET` | Секрет для заголовка `X-Callback-Secret` при вызове legacy callback | Не используется в текущем queue worker path |
| `UGS_COMFYUI_WORKFLOW_PATH` | Путь к JSON workflow ComfyUI (например `4kimage.json`) | Не задано — используются fallback-пути в провайдере |
| `COMFYUI_URL` | URL ComfyUI (хост:порт) | Living host: **gpu141** `.141:31003` (см. `platform/PRODUCTION-TOPOLOGY-STATE.md`). Code fallback: `http://stack2-comfyui:3000`. **Health and execution share `_resolve_comfyui_base_url`**. Prod-baked example: `COMFYUI_URL=http://192.168.1.141:31003/`. |
| `LLAMA_URL` / `LLAMA_BASE_URL` | Базовый URL текстового LLM (OpenAI-совместимый llama.cpp server или нативный Llama) | Иначе из `unified_config` (сервис `stack2-llama-chat:8080` on prod-core) |

Провайдеры и их URL также задаются в БД (таблица `generation_providers`), редактируются через UGS Admin API. **Приоритет URL для текстовых шагов UGS:** непустой `base_url` в строке провайдера перекрывает `LLAMA_URL`; если `base_url` пустой — используется env / значение из `unified_config` (тот же канал, что и остальной бэкенд). Тип провайдера `llama` в БД маршрутизируется так же, как `llama`.

**Audio TTS (stack9):** `silero` → `audio_generation_tts` (URL `http://stack9-silero:8000`, Silero **MIT `v5_cis_base_nostress`** on GPU, profile `legacy-silero`, image `ew_silero_tts:v5_cis`). Default speaker `ru_ekaterina`; legacy ids (`xenia`/…) mapped in stack9 service. **Live Voice / voice-gateway** читает `generation_providers.silero` через `tts_endpoint_resolver` (env `SILERO_SERVICE_URL` = fallback). Piper / `audio_generation_piper` soft-retired (builder → `trash/`, provider `enabled=false`).

**Приоритет выбора модели для UGS runtime и Admin v2 snapshot:** `type_overrides` → `domain_defaults` → `category_defaults` → `provider_defaults` → `generation_providers.config_json.default_model` → `model_routes.global_default_model` → env fallback. Runtime передаёт `generation_types.category` в resolver, поэтому category defaults в Admin v2 должны совпадать с фактической генерацией. Scoped routes в `model_routes.patch` удаляются значением `null` или пустой строкой; полная замена остаётся за `model_routes.replace`.

**Границы model fields:** `generation_providers.config_json.default_model` и `models` хранятся только для text-LLM compatible провайдеров (`provider_type` `llama`, `llama`, `miso`). Для остальных provider types Admin v2 показывает legacy-поля как warning и предлагает autofix очистки; новые raw `config_json` записи с `default_model` / `models` / `provider_role=text` backend validation отклоняет.

**IMC RAG routing invariant:** legacy bundle `imc_audience_deep_dive`, `imc_brand_positioning`, `imc_competitive_landscape`, `imc_content_messaging`, `imc_gtm_channels`, `imc_pricing_packaging` должен быть неактивен. Актуальные `imc_rag_*` типы идут через `imc_rag_research_provider`, а `imc_cabinet_filler` — через `imc_cabinet_filler_provider`; иначе RAG-only запрос попадает в generic chat/MISO путь без embedding-контекста.

**IMC RAG model split:** `LLAMA_EMBEDDING_URL` / `LLAMA_EMBEDDING_MODEL` используются только для retrieval-эмбеддингов и Qdrant `marketing_project_rag`. `generation_providers.imc_rag_research_provider.base_url`, его `config_json.default_model/models` и `model_routes.*` для `imc_rag_*` должны указывать на chat/text LLM (`stack2-llama-chat`, `qwen3-14b-q4_k_m.gguf` в текущем окружении), а не на embedding server/model.

**Project RAG source indexing:** `PATCH /marketing-cabinet/projects/{project_id}/rag-sources/content/{content_id}` не ждёт построение embeddings при включении источника. Ответ возвращает `indexing_status="queued"`, а indexing идёт background task; при выключении источник синхронно удаляет Qdrant points. Индексатор перед каждым upsert проверяет актуальный `marketing_rag_included`, чтобы не вернуть stale-векторы после быстрого выключения.

**Текстовые chat-шаги UGS** (диалог, RAG-чат, музыкальные lyrics и т.п., не-streaming): провайдер вызывает **`POST /v1/chat/completions`** для OpenAI-совместимого бэкенда (llama-server / vLLM) или **`POST /api/chat`** для нативного Llama — chat-шаблон модели, не legacy **`POST /v1/completions`**. На stack2 после **`GET /health` ok** stack0 **`httpx_compat_generate_json`** всегда использует chat path (§ **`STACK0-LLM-OVERVIEW.md`** §7.3). Structured JSON — gate **`ugs_generation_requests_json_object()`** + опционально `input_data.json_format`.

## 3. Runtime stability invariants (2026-05)

- Result cache key для HTTP/SSE генераций включает `user_id` (`user:<id>:<contentHash>`). Глобальное переиспользование результата между пользователями запрещено для приватных UGS prompts/results.
- `GET /api/v1/ugs/metrics` и `GET /api/v1/ugs/stats` используют throttled stale cleanup (`maybe_cleanup_stale_request_states`) и не запускают полный stale reconciliation на каждый dashboard poll.
- `GET /api/v1/ugs/providers/status` кэширует provider probe payload коротким TTL, чтобы dashboard polling не fan-out'ил outbound checks к каждому провайдеру на каждый запрос.
- Provider status cache coverage: `api/tests/test_ugs_health_metrics.py` фиксирует cache hit/miss поведение и нормализацию failed probe (`response_time=null`, `error` сохранён).
- `GET /api/v1/ugs/admin/queue-ops` возвращает canonical stale counters (`pending_orphan`, `pending_in_queue`, `processing`, `total`) и сохраняет legacy alias keys для совместимости операторских скриптов.
- Queue-ops operator hints используют canonical stale total и не суммируют legacy alias keys повторно; тесты также фиксируют `redis_lease_unavailable` и `beat_on_workers_off` hint paths.
- Queue-ops snapshot остаётся read-mostly, но path через `QueueManagerService.get_queue_stats()` по-прежнему может чистить stale queue entries как побочный эффект (это ожидаемое поведение текущего runtime).
- Direct provider execution treats empty/falsy provider payloads as `failed` (`provider_error`), not as `completed`; focused coverage lives in `api/tests/test_ugs_stream_and_queue_execution.py`.
- **Billing atomicity:** `status=completed` and credit deduct share one DB transaction via `BillingService.deduct_credits_without_commit` (same pattern as desktop solo-slot). Deduct failure → `failed` / `error_type=billing_failed` without persisting free payload; never a free `completed`. Coverage: `api/tests/test_ugs_billing_atomic_complete.py`. Cancel refunds only when `credits_used > 0` (in-flight unpaid cancel does not credit the user).
- **Credit packages list:** `GET` billing packages (`BillingService.get_credit_packages`) includes server-derived `price_per_1k_credits` (`price_usd / credits_amount * 1000`, or `null` when credits ≤ 0). Desktop `UGSBilling` prefers this field and falls back to the same FE formula only if absent.
- Route-level status/result owner-scope coverage lives in `api/tests/test_ugs_unified_generation_service_contracts.py`: HTTP handlers map non-owner `PermissionError` to `403`.
- Hot task list polling использует compact rows + frontend merge preservation: `input_data`, `result`, `result_preview`, `metadata` не затираются `null` из compact poll, если в cache уже есть richer row.
- UGS Hub header (`UgsHubShellHeader`): title + secondary **Analytics** text action (`ugs-analytics`); операторский degradation alert по provider channels и shortcut в `UGS Admin` при `status != healthy` (без rival Dashboard CTA / legacy «Elite Dashboard» / brand pill). Quick Launch на Overview — только сетка типов (без «Все типы» → Dashboard).
- OpenAPI envelope contract (2026-05 typed-contract wave): high-value UGS responses have concrete Pydantic response models around flexible JSON bags. Covered surfaces: `GET /tasks`, `GET /tasks/tray-summary`, `GET /admin/tasks`, `GET /stats`, `GET /analytics`, `GET /metrics`, `GET /providers/status`, `GET /admin/queue-ops`, workflow list/detail/execute/executions. Guard: `api/tests/test_ugs_openapi_contracts.py` fails if critical JSON responses regress to `schema: {}` or a bare arbitrary object.

---

## 4. Связанные документы

- FE contract / regression: [ugs_frontend_contract_and_regression_baseline.md](ugs_frontend_contract_and_regression_baseline.md)
- Desktop deep link / Hub shell: [desktop/UGS-DESKTOP-SHELL.md](desktop/UGS-DESKTOP-SHELL.md)
- Workflow Builder sources: [ugs_workflow_builder_contract.md](ugs_workflow_builder_contract.md)
- Операторский runbook очереди: [platform/docker-re_doc/UGS-QUEUE-OPERATIONS-RUNBOOK.md](../platform/docker-re_doc/UGS-QUEUE-OPERATIONS-RUNBOOK.md)
- API рабочего стола и приложений: [desktop/DESKTOP-API-AND-APPS.md](desktop/DESKTOP-API-AND-APPS.md)
