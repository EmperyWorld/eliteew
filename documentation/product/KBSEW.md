# KBSEW — Knowledge Base Service (Empery World)

KBSEW is a **standalone** FastAPI microservice for operator-managed **knowledge barrels**: isolated indexes backed by Qdrant, with driver-based PDF ingestion through stack4 (Tika/OCR), plus markdown and source-code drivers for repo barrels.

## Scope

- **In scope:** barrel CRUD, DB-backed async PDF/markdown/code ingestion, SeaweedFS raw storage, Qdrant per-barrel collections, **semantic search (RAG retrieval)**, admin UI section, stack0 HTTP gateway, desktop **`knowledge_base_search`** agent tool, Prometheus `/metrics`, **MCP** access via stack0 MCP Host (`mcp_list`/`mcp_call`) and package `tools/eliteew-kbsew-mcp/` — see [ELITEEW-MCP-HOST-AND-SERVERS.md](../platform/ELITEEW-MCP-HOST-AND-SERVERS.md).
- **Repo index barrels:** `eliteew-docs` / `eliteew-api` / `eliteew-frontend` (synced via `kbsew-sync-repo-barrels.sh`).
- **Out of scope (v1):** heavy external broker/Celery pipeline, refactoring EliteEW unified content.
- **Retired:** orphan `stack1-chroma-code` soft-retired 2026-08-09 — not a living store (see [STORAGE-AND-VECTOR-TOPOLOGY.md](../platform/docker-re_doc/STORAGE-AND-VECTOR-TOPOLOGY.md)).

## Runtime topology

```text
Admin SPA ──► stack0 API (/api/v1/kbsew/*) ──► stack-kbsew:8030
                                              ├──► ai_services PG (kbsew schema)
                                              │    └──► kbsew.ingestion_jobs worker queue
                                              ├──► Qdrant (kbsew_barrel_* collections)
                                              ├──► SeaweedFS (kbsew/ prefix)
                                              ├──► stack4 Tika + OCRmyPDF
                                              └──► gpu141 embed :8081
```

## Operator checklist

1. Apply migrations `20260703_01_kbsew_schema` + `20260706_01_kbsew_durable_ingestion_jobs` + `20260722_01_kbsew_asset_revisions` + `20260801_01_kbsew_one_active_job_per_asset` via `bash docker/scripts/apply-eliteew-migrations.sh`.
2. Build and start: `docker/stack/kbsew.yml` (networks **`ew_net_2847`**, **`ew_net_7198`**, **`ew_net_9O11`** for Keycloak JWKS).
3. Set `KBSEW_SERVICE_URL=http://stack-kbsew:8030` in stack0 backend runtime env.
4. Smoke: `curl -sf http://127.0.0.1:28030/health` (liveness), `curl -sf http://127.0.0.1:28030/ready` (PG/Qdrant/MinIO), `curl -sf http://127.0.0.1:28030/metrics`, and tokenized `GET /api/v1/kbsew/barrels`.
5. Admin: Unified Admin → **Knowledge base (KBSEW)** (`?section=kbsew`).

## API prefix

Canonical prefix: **`/api/v1/kbsew/`** (gateway and service).

### Search (RAG retrieval)

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/search` | `{ "query": string, "barrel_id": uuid, "limit"?: 1–20, "retrieval_mode"?: "dense"\|"hybrid" }` | `{ "barrel_id": uuid, "chunks": string[] }` — admin default **5** snippets per barrel |

Flow: embed query via **gpu141** (`LLAMA_EMBEDDING_URL`, same model as ingest) → retrieval (dense or hybrid) → **`finalize_search_chunks`** (readable filter + near-duplicate suppress; see Text quality) → optional **rerank** on stack0 (admin toggle, llama-rerank / `RAG_RERANK_BASE_URL`) → return payload `text` fields.

**`retrieval_mode`:** optional request field; omitted → env **`KBSEW_RETRIEVAL_MODE`** (default **`dense`**).

| Mode | Behavior |
|------|----------|
| `dense` | Qdrant dense `query_points` → `finalize_search_chunks` → top_k. |
| `hybrid` | Dense over-fetch **+** sparse ranking list → `rrf_merge` → `finalize_search_chunks` → top_k. Sparse path requires **`KBSEW_SPARSE_VECTORS_ENABLED=true`** and points that already carry sparse payload (re-ingest after enabling). If sparse is disabled, Qdrant/scroll fails, no sparse candidates exist, **or sparse scroll hits `KBSEW_SPARSE_CANDIDATE_LIMIT` with more points remaining** → log **`[STEP] kbsew_hybrid_sparse_skip`** (metric `kbsew_hybrid_sparse_skip_total{reason=…}`) and return dense order (honest degrade; no client break). Opt-in to use truncated sparse: **`KBSEW_HYBRID_ALLOW_TRUNCATED_SPARSE=true`**. |

**Sparse implementation:** hashed log-TF term weights (`sparse_scheme=hashed_log_tf_v1`). Two backends (selected at search/ingest by env):

| Backend | When | Behavior |
|---------|------|----------|
| **Payload scroll** (default) | `KBSEW_SPARSE_VECTORS_ENABLED=true`, native off | Sparse weights on point payload; hybrid scrolls up to **`KBSEW_SPARSE_CANDIDATE_LIMIT`** and scores in-process. Truncated scroll → dense degrade (`sparse_scroll_cap`) unless allow-truncated. Collections stay **unnamed dense** — no recreate. |
| **Native Qdrant** (opt-in) | `KBSEW_SPARSE_VECTORS_ENABLED=true` **and** `KBSEW_SPARSE_NATIVE_QDRANT=true` | Named vectors `dense` + `sparse`; hybrid uses Qdrant sparse ANN (`query_points` + `using=sparse`). New collections created under both flags get the native schema. Existing unnamed collections are **not** auto-deleted — search logs `kbsew_sparse_native_fallback_payload` and uses payload scroll until recreate + force-reindex. |

Operator native enable: set both flags → call `recreate_collection_native_sparse` (or delete+`ensure_collection` on empty) per barrel → **force-reindex** → hybrid search. Do **not** bump `PIPELINE_VERSION` solely for the native flag (would mass-reindex every barrel).

**Rerank:** KBSEW microservice itself does **not** rerank — only vector/hybrid search. When `kbsew_search_settings.rerank_enabled=true`, stack0 fetches up to **4×** `chunks_per_barrel` candidates from KBSEW, then calls `api/services/rerank_client.py` (same path as desktop RAG). On rerank failure, KBSEW order is kept.

Auth: admin JWT **or** internal `X-KBSEW-Service-Token` (read: list/search only; role `kbsew_service`). Gateway never forwards client service tokens.

Env: `KBSEW_SEARCH_TOP_K` (default **5**, max 20); `KBSEW_CHUNK_SIZE` / `KBSEW_CHUNK_OVERLAP` (ingest budgets, default **800** / **100**); `KBSEW_RETRIEVAL_MODE` (default **`dense`**); sparse flags below. Search lives in `api/services/search_service.py` + `api/routers/search.py`.

### Force-reindex (admin)

Idempotent `POST …/ingest` and `…/ingest/upload` **do not** requeue when the latest job is `completed`. Pipeline refresh (new chunker / sparse / OCR fix) uses explicit force-reindex:

| Method | Path | Response |
|--------|------|----------|
| `POST` | `/barrels/{barrel_id}/reindex` | `{ barrel_id, queued, skipped_active, failed, jobs[] }` — **202** |
| `POST` | `/barrels/{barrel_id}/assets/{asset_id}/reindex` | `{ job_id?, asset_id, status, queued, reason }` — **202** |

Behavior:

- Rebuilds job payload from the persisted asset (`object_key` → upload path, else `source_url` → URL path); same `asset_id` lineage.
- Latest job `queued`/`running` → return that job (`queued=false`, `reason=already_active`); no duplicate.
- Latest job `completed`/`failed`/missing → create a **new** job (`queued=true`, `reason=force_reindex`); worker deletes prior Qdrant points for the asset then re-indexes.
- Asset missing both `object_key` and `source_url` → per-asset `failed` / HTTP **400** on single-asset route.
- Stack0 gateway proxies both paths; Admin Barrels tab **Force reindex all** calls barrel-wide `POST …/reindex`.

### Text quality (ingest + search)

| Stage | Behavior |
|-------|----------|
| **Ingest clean** | PDF driver runs `clean_pdf_extracted_text` (drop PDF/XMP hex noise; strip Unicode soft hyphen **U+00AD**; join hyphen+newline; collapse OCR spaced-letter runs; OCR line-wrap glue for short-left / long-stem+short-suffix splits, never closed-class words). Markdown uses the same `normalize_readable_text`. |
| **Ingest quality gate** | Before Qdrant commit, `assert_chunks_ingest_quality` requires high `readable_ratio` and low **residual** OCR damage after normalize (`spaced_letter_ratio`, `midword_break_ratio`, `ocr_breaks_per_100_tokens`) for **document** profile (PDF/markdown). **`code_python` / `code_typescript`** use `profile=source_code` (skip OCR density — snake_case is not line-wrap damage). Failure → job **fails** (asset not `indexed`). Log `[STEP] kbsew_ingest_quality_reject`. |
| **Chunk boundaries** | Shared `api/services/chunking.py` — sentence-aware split within `KBSEW_CHUNK_SIZE`, prefer `.!?` / word boundaries; overlap snaps off mid-word starts. Used by PDF and markdown drivers. Code drivers use `api/drivers/code_chunking.py` (line windows + symbol headers). |
| **Search post-filter** | `finalize_search_chunks`: `filter_readable_chunks` (normalize + noise reject) → `suppress_near_duplicate_chunks` (Jaccard over tokens + prefix similarity) → top_k. Drops log **`[STEP] kbsew_search_dedupe_drop count=…`**. |
| **Pipeline freshness** | `PIPELINE_VERSION` in `api/services/revision_service.py` (current **`kbsew-ingest-v3`**). **Bump** whenever text_quality / chunker / sparse payload schema changes. Unchanged-byte skip only when active revision matches. Worker auto-enqueues force-reindex for stale indexed assets. `POST /search` **409** `index_stale` while any asset is indexed/pending/running on a non-current revision. Barrel status: `pipeline_fresh`, `stale_asset_count`, `required_pipeline_version`. |

**Already-indexed barrels:** Qdrant payloads keep old chunk text until force-reindex / pipeline auto-heal. Search-time normalize still cleans soft hyphens / spaced letters / conservative mid-word glue on return, but mid-word cuts baked into stored points are fixed by re-ingest under the current `PIPELINE_VERSION`.

Search latency is observed through Prometheus histogram `kbsew_search_latency_seconds` without changing the async search behavior.

Smoke (indexed barrel, e.g. `marketing_nw` / `da11ce9f-1d46-4747-8112-7210ebf9f6f2`):

```bash
KBSEW_SERVICE_URL=http://127.0.0.1:8030 \
KBSEW_INTERNAL_SERVICE_TOKEN=… \
bash docker/scripts/kbsew-search-smoke.sh
```

### Opt-in API e2e smoke

Lightweight live check (no Playwright): `/health`, `/ready` (fail-closed), `/metrics`, tokenized `GET /barrels`; with `KBSEW_SMOKE_BARREL_ID` also `GET …/status` (shape of `active_jobs` / `completed_jobs` / optional `trace_id`) and `POST /search`.

```bash
KBSEW_E2E_RUN=1 \
KBSEW_SERVICE_URL=http://127.0.0.1:28030 \
KBSEW_INTERNAL_SERVICE_TOKEN=… \
KBSEW_SMOKE_BARREL_ID=da11ce9f-1d46-4747-8112-7210ebf9f6f2 \
bash docker/scripts/kbsew-e2e-smoke.sh
```

Without `KBSEW_E2E_RUN=1` the script exits **0** (skipped). Optional `KBSEW_E2E_PLAYWRIGHT=1` chains the heavier Playwright full ingest cycle (`e2e/kbsew-full-cycle.spec.ts`) after the API smoke — requires `KBSEW_E2E_BASE_URL`, `KBSEW_E2E_ADMIN_BEARER`, `KBSEW_E2E_SERVICE_TOKEN`, `KBSEW_E2E_BARREL_ID`.

### Eval harness (Recall@k / hit-rate)

Fixture: `KBSEW/eval/sample_queries.yaml` — cases `{query, barrel_id?, must_include_substrings, must_not_match?}`.
`must_not_match` entries are literal substrings or regex (e.g. `(?i)callupper`). HTTP **409** `index_stale` counts as a pass for live eval while auto-reindex heals.

```bash
KBSEW_SERVICE_URL=http://127.0.0.1:8030 \
KBSEW_INTERNAL_SERVICE_TOKEN=… \
bash docker/scripts/kbsew-eval.sh
# or: python3 KBSEW/scripts/kbsew_eval.py --dataset KBSEW/eval/sample_queries.yaml
```

Optional env: `KBSEW_EVAL_DATASET`, `KBSEW_EVAL_BARREL_ID`, `KBSEW_EVAL_MIN_HIT_RATE` (default `1.0`). Exits non-zero when hit-rate is below threshold or search fails (except fail-closed `index_stale`).

**Prod deploy gate:** `kbsew-deploy-prod-core.sh` syncs `KBSEW/eval/sample_queries.yaml` + `kbsew_eval.py` to prod-core and runs the hit-rate eval against `127.0.0.1:${KBSEW_HOST_PORT}` after smoke/quality lock (default on). Override threshold via `KBSEW_EVAL_MIN_HIT_RATE`; emergency skip: **`--skip-eval-gate`**.

Prod deploy (command-center → prod-core): **`bash docker/scripts/kbsew-deploy-prod-core.sh --yes`**. Default path builds on command-center, loads `kbsew:latest` on prod-core, syncs compose/env + **pending** SQL (skipped when empty — nullglob) and **`applied/*kbsew*.sql`** (so prod-core has e.g. `20260722_01_kbsew_asset_revisions.sql`), runs `apply-eliteew-migrations.sh`, replaces **`stack-kbsew` only** via **`podman run --replace`** (not compose-only recreate — avoids leaving a named container on a stale image), verifies the running image id, then **waits** for `GET /ready` (up to ~120s, 2s poll — avoids curl exit 56 while uvicorn is still binding), then smokes `/health`, `/metrics`, and tokenized `/api/v1/kbsew/barrels`, then a **search quality lock**: HTTP **409** `index_stale` (acceptable while pipeline auto-heal runs) **or** HTTP **200** with forbidden OCR patterns absent, then the **eval hit-rate gate** (YAML fixture; skip with `--skip-eval-gate`). Default **`--with-stack0-gateway=skip`**: it does **not** recreate stack0 and does **not** silent-switch baked/dev-bind.

Optional flags:

| Flag | Meaning |
|------|---------|
| `--patch-stack0-env` | Upsert `KBSEW_SERVICE_URL` + `KBSEW_INTERNAL_SERVICE_TOKEN` into stack0 staging + prod-core runtime env (no container recreate). |
| `--with-stack0-gateway skip\|baked\|dev-bind` | Default **`skip`**. `baked` / `dev-bind` recreate stack0 API with the matching compose override after `eeprodline status` confirms remote `active_line`; `dev-bind` also runs `eeprodline sync`. |
| `--skip-eval-gate` | Skip live YAML hit-rate eval after smoke (default runs the gate). |

Deployment chronology: chat summary + `git log` (monthly `documentation/worklog/` retired).

Stack0 desktop tool: **`knowledge_base_search`** (`api/services/desktop_chat/tools/knowledge_base_search_tool.py`) — LLM supplies `query`; **`barrel_id` optional** (discovery mode picks best allowed barrel). Calls KBSEW via `api/services/kbsew/kbsew_client.py` (same contract as gateway `/api/v1/kbsew/search`).

### Context-Aware Orchestration (DTI)

Stack0 **Knowledge-Aware Orchestrator** (`api/services/kbsew/kbsew_orchestration.py`, `kbsew_registry.py`, `kbsew_trace.py`):

| Layer | Behavior |
|-------|----------|
| **DPA (Dynamic Prompt Augmentation)** | Before LLM system prompt: load enabled barrels from KBSEW registry → append **Knowledge Context** block instructing `knowledge_base_search` when user intent matches barrel domains. |
| **Autonomous prefetch** | `build_rag_prefix` always records KBSEW status in `done.context` (`kbsew_prefetch_*`). On success injects chunks into the user message; on **`index_stale`** / service error injects an honest degrade note (model must not invent KB facts). Prefetch is independent of `use_tools` (by design — autonomous retrieval). |
| **Surface detection** | `desktop` (default), `marketing` when chat settings include `amka_ephemeral` / `amka_run_id` (AMKA ensemble). AMKA blueprint ensemble also receives DPA in hero system prompts. |
| **Marketing inherit** | When `agents.desktop=true` and barrels allowlisted, surface `marketing` (IMC/AMKA/marketing chat) is treated as enabled even if `agents.marketing=false` (legacy single-toggle). Explicit `amka_ephemeral` chat settings are preserved through `sanitize_desktop_chat_settings_payload`. |
| **Discovery mode** | Tool call without `barrel_id` → lexical rank over barrel name/description → auto-select allowed barrel. |
| **Traceability** | `X-KBSEW-Trace-Id` on stack0→KBSEW HTTP; logged in KBSEW `POST /search`. |
| **index_stale (stack0)** | KBSEW HTTP **409** `{code:index_stale}` → `KbsewIndexStaleError`. Desktop tool returns a Russian “index refreshing” message (not opaque 409). Admin gateway with `apply_admin_settings=true` re-emits **409** (not 502). Prefetch does **not** silent-skip. |
| **Embed resilience** | KBSEW 503/404 embed failures → graceful tool message (pipeline continues). KBSEW embed client prefers **`/v1/embeddings`** (gpu141) before legacy `/api/embed`. |
| **User «Опора»** | FE footnote includes knowledge-base status from `done.context` (ok / refreshing / unavailable / empty) — metadata only, no chunk bodies. |

**Rerank knobs (do not confuse):** `kbsew_search_settings.rerank_enabled` (KBSEW string results via stack0 `rerank_client`) is separate from desktop chat/vault `rag_rerank_enabled` + `RAG_RERANK_BASE_URL`. Both need the same rerank URL when enabled.

Rerank client: **4 attempts**, exponential backoff up to **5s** (ReadTimeout gets longer base delay).

**Feature toggle (admin):** Unified Admin → **База знаний (KBSEW)** → вкладка **«Доступ агента»** (`?section=kbsew&kbsewTab=agent-access`). Пишет в `desktop_ai_chat_config.defaults.kbsew_search_settings`:

```json
{
  "enabled": true,
  "allowed_barrels": ["uuid", "…"],
  "chunks_per_barrel": 5,
  "rerank_enabled": false,
  "retrieval_mode": "dense",
  "agents": {
    "desktop": true,
    "ewa": false,
    "marketing": false,
    "imperorg": false,
    "ugs": false
  }
}
```

`chunks_per_barrel` — **1–20**, canon default **5** (admin UI on Agent access tab; FE/API clamp invalid → 5). Applies to desktop tool, companion prefetch, marketing/UGS/Imperorg surfaces, and **Test search** (`limit` sent explicitly from the same clamped value). `rerank_enabled` — optional rerank after vector retrieval (stack0 only; needs `RAG_RERANK_BASE_URL`). `retrieval_mode` — **`dense`** (default) or **`hybrid`**; admin Agent access persists it in `kbsew_search_settings`, and Test search may override per request. stack0 gateway precedence: request body `retrieval_mode` > admin settings > dense. The mode is forwarded on `apply_admin_settings=true` via `kbsew_search_with_settings` / `kbsew_search_barrel` into KBSEW `POST /search`.

Поверхности **совпадают с web-search surfaces** (`desktop`, `ewa`, `marketing`, `imperorg`, `ugs`). Общий allowlist `allowed_barrels` для всех включённых агентов. Legacy `enabled=true` без `agents` → только `desktop`. Optional per-chat overlay: `desktop_ai_chats.settings.kbsew_search_settings`.

| Surface | Интеграция |
|---------|------------|
| `desktop` | LLM tool `knowledge_base_search` (desktop chat + ensemble) |
| `ewa` | Авто-prefetch в companion turn (`kbsew_context` в shell prompt) |
| `marketing`, `imperorg`, `ugs` | Prefetch через marketing/EWRP/IMC, UGS web_search, Imperorg research |

Tab **«Тест поиска»** — smoke `POST /api/v1/kbsew/search` через gateway with **`limit` = clamped `chunks_per_barrel`** (canon **5**, not 20) plus optional per-request `retrieval_mode`. Migrations: `20260702_kbsew_search_settings_defaults.sql`, `20260704_kbsew_agent_surfaces_defaults.sql`, `20260705_kbsew_retrieval_settings_defaults.sql`.

## Auth

Keycloak JWT with `admin` or `emperyworld_admin` in `resource_access` for `empery-web` / `empery-api`. Gateway enforces admin JWT and forwards **`Authorization` only** to KBSEW.

**OpenAPI `operationId` + typed gateway (stack0):** GET and POST `/api/v1/kbsew/barrels` use distinct ids (`proxy_kbsew_barrels_list` / `proxy_kbsew_barrels_create`). Gateway handlers expose Pydantic Out/In models (`shared/api/schemas/kbsew_gateway.py`) aligned with KBSEW service schemas — OpenAPI bodies are typed (`KbsewBarrelOut`, `KbsewBarrelStatusOut`, `KbsewReadyOut`, `AdminKbsewSearchOut`, …). Multipart ingest/upload stays a raw proxy with documented success shape. Prefer bake-time `release stack0 --all --refresh-openapi-pilots` (tree export) or post-deploy `openapi:export:prod-core` → extract kbsew pilot. FE bridge: `shared/web/frontend/src/pages/Admin/kbsewOpenApi.ts`; admin client aliases from that bridge.

KBSEW validates JWT via Keycloak JWKS (`/protocol/openid-connect/certs`) with an in-process cache (**TTL 300s**). On `kid` miss the service force-refetches JWKS once (single-flight) before returning 401.

Internal stack0→KBSEW read calls (desktop tool / registry / prefetch): set matching **`KBSEW_INTERNAL_SERVICE_TOKEN`** on stack0 API and KBSEW. **`kbsew_client`** injects **`X-KBSEW-Service-Token`** server-side. The stack0 gateway **strips** any client-supplied service token (never forwards it).

On KBSEW, a valid service token authenticates as role **`kbsew_service`** (not `emperyworld_admin`). It may call **read** routes (`GET /barrels`, `POST /search`). **Mutations** (create/delete/ingest/reindex/enabled) require JWT via `require_admin_user` **or**, when **`KBSEW_SERVICE_CAN_MUTATE=true`**, the same service token via `require_admin_or_service_mutate` (ops ingest / `kbsew-sync-repo-barrels.sh`; default **false**). Barrel allowlists for agents stay on stack0 (`allowed_barrels`); KBSEW does not re-check that allowlist.

Liveness vs readiness: `GET /health` = process up; `GET /ready` = PG `SELECT 1` + Qdrant reachability + Seaweed/MinIO bucket check (503 when degraded).

## Durable ingestion worker

HTTP ingest endpoints create or reuse an asset and enqueue a row in `kbsew.ingestion_jobs` via **`barrel_service.enqueue_job`** (asset `FOR UPDATE` + partial unique `uq_kbsew_jobs_one_active_per_asset`); they do **not** run fire-and-forget request-path `asyncio.create_task` ingestion. Disabled barrels are rejected at enqueue (**409**). External statuses remain lowercase for the admin UI:

| Module | Role |
|--------|------|
| `ingestion_service.py` | Facade: `start_*`, `execute_*`, `execute_persisted_job`; re-exports helpers for tests |
| `ingestion_queue.py` | Idempotent asset create + enqueue / completed-fresh skip |
| `ingestion_index.py` | Unchanged-byte skip + vector commit (quality gate, upsert, prune, revision) |
| `ingestion_reindex.py` | Force-reindex asset/barrel + stale-pipeline auto-heal enqueue |
| `ingestion_support.py` | Digests, progress CAS, structured job logs |
| `ingestion_worker.py` | Lease claim / heartbeat / terminal CAS loop |

| Worker meaning | DB/UI status |
|----------------|--------------|
| Pending | `queued` |
| Processing | `running` |
| Completed | `completed` |
| Failed | `failed` |

Worker fields are owned by migration `20260706_01_kbsew_durable_ingestion_jobs`: `locked_at`, `locked_by`, `attempts`, `max_attempts`, `scheduled_at`, `trace_id`, `source_kind`, `driver_type`, and `payload`.

Startup behavior:

- `api/services/ingestion_worker.py` recovers stale `running` jobs older than `KBSEW_WORKER_LEASE_TIMEOUT_SEC` back to `queued`.
- Claims use PostgreSQL `FOR UPDATE SKIP LOCKED` and a process-local worker id (`hostname:pid`).
- During `execute_persisted_job`, progress updates use **`touch_job_progress`** (CAS `running` + `locked_by`); a background loop calls `heartbeat_job_lease` to refresh **`locked_at`**.
- Heartbeat miss / progress CAS miss → `JobLeaseLostError`; the worker **aborts** the in-flight execute (no terminal complete/fail from the loser) and leaves ownership to stale recovery / the new claimer.
- Terminal transitions `mark_job_completed` / `mark_job_failed` / `reschedule_job` are **CAS**: `UPDATE … WHERE id=$1 AND status='running' AND locked_by=$worker` → `bool` (False = lease lost; no success metric / no asset terminal mutate from the loser).
- Failed attempts retry with exponential backoff until `KBSEW_WORKER_MAX_ATTEMPTS`; final failure stores a non-empty job message and asset error **only if** fail CAS wins.
- Shutdown cancellation requeues the claimed job immediately **only if** reschedule CAS still owns the lease.
- Migration `20260801_01_kbsew_one_active_job_per_asset` collapses duplicate active jobs, adds the unique index, and sets jobs `ON DELETE CASCADE` with their asset.

Idempotency:

- Uploads compute `content_sha256`, store the **raw bytes** under deterministic SeaweedFS object key `kbsew/<barrel>/<sha>_<filename>`, and reuse `barrel_id + upload:<sha>` as asset idempotency key. Concurrent first-create races on that unique key reuse the existing asset (`UniqueViolation` → find → enqueue). Content-Type follows driver/filename (`pdf` → `application/pdf`; markdown/code → text types).
- URL ingests use a stable key from `barrel_id + driver_type + source_url` (same race handling).
- Duplicate **queued/running** ingest returns the existing active job (`enqueue_job` created=false).
- Duplicate **completed** ingest returns the existing job **only when** the request carries a `content_sha256` that matches the stored asset digest (uploads always send the digest). **URL** completed without a matching digest **requeues** so origin drift is re-checked; execute short-circuits with `kbsew_ingest_unchanged_skip` when downloaded bytes still match and the asset is already `indexed` with `chunk_count >= 1`.
- Failed assets are requeued as a new job over the same asset (same `asset_id` / sha lineage; successful re-index appends `asset_revisions`).
- **Force-reindex** (`POST …/reindex`) always calls `enqueue_job` with `force_reindex` in payload (completed is not a skip); if an active job already exists → `queued=false`, `reason=already_active`.
- Upload / URL bodies are capped by **`KBSEW_INGEST_MAX_BYTES`** (default 50 MiB, clamp 1–512 MiB). Oversize → **413**.
- URL ingest goes through **`api/services/safe_http.py`**: scheme http(s) only, no userinfo, hostname/DNS deny for loopback/link-local/metadata/CGNAT; RFC1918 denied unless **`KBSEW_URL_ALLOW_PRIVATE=true`**; redirects re-validated (max 5). Unsafe URL → **400**.

### Asset revisions (indexed lineage)

Migration `20260722_01_kbsew_asset_revisions` adds `kbsew.asset_revisions` and `kbsew.assets.active_revision_id`:

| Column | Meaning |
|--------|---------|
| `asset_id` | Parent asset |
| `content_sha256` | Bytes hash of indexed payload |
| `indexed_at` | When Qdrant upsert completed |
| `chunk_count` | Points written for this revision |
| `embed_model` / `pipeline_version` | Embedding model + ingest pipeline tag (`kbsew-ingest-v1`) |

**Active pointer:** `assets.active_revision_id` → latest successful revision. On each successful index, `api/services/revision_service.py` appends a revision row and updates the pointer (re-index of a failed asset creates a new revision over the same asset).

**Barrel list / status (admin FE):** `GET /api/v1/kbsew/barrels` and `GET /api/v1/kbsew/barrels/{id}/status` include the barrel’s latest active revision (max `indexed_at` among assets with `active_revision_id`):

| JSON field | Meaning |
|------------|---------|
| `revision` | Short badge label — first 12 hex chars of `content_sha256` (FE `kbsewAdminApi` / `revisionLabelOrNa`) |
| `active_revision_id` | UUID of that revision row |
| `revision_indexed_at` | When that revision was indexed |
| `revision_chunk_count` | Chunk/point count for that revision |

When no asset has an active revision, all four fields are `null` and the admin UI shows `n/a`.

**Barrel status job monitor (admin FE):** `GET /api/v1/kbsew/barrels/{id}/status` job arrays:

| JSON field | Meaning |
|------------|---------|
| `active_jobs` | Up to 20 `queued`/`running` jobs; each includes `id`, `asset_id`, `status`, `progress_pct`, `message`, `updated_at`, **`trace_id`**, `driver_type` |
| `completed_jobs` | Up to 20 recent terminal jobs (`completed`/`failed`), same item shape, ordered by `updated_at` DESC |

`trace_id` is persisted on `kbsew.ingestion_jobs` (durable jobs migration). Missing/empty -> admin UI shows **n/a**. Empty arrays when none.

Worker env:

| Env | Default | Meaning |
|-----|---------|---------|
| `KBSEW_WORKER_ENABLED` | `true` | Starts the lifespan worker loop. |
| `KBSEW_WORKER_CONCURRENCY` | `1` | Process-local claim/process concurrency, clamped 1–8. |
| `KBSEW_WORKER_POLL_INTERVAL_SEC` | `1` | Queue polling interval. |
| `KBSEW_WORKER_LEASE_TIMEOUT_SEC` | `900` | Stale `running` lease recovery threshold. |
| `KBSEW_WORKER_HEARTBEAT_INTERVAL_SEC` | `60` | While a claimed job runs, refresh `locked_at` this often (lease heartbeat). `0` disables. |
| `KBSEW_WORKER_MAX_ATTEMPTS` | `3` | Attempts before final `failed`. |
| `KBSEW_INGEST_MAX_BYTES` | `52428800` (50 MiB) | Hard cap for upload body and URL download (clamped 1–512 MiB). |
| `KBSEW_URL_ALLOW_PRIVATE` | `false` | When `true`, RFC1918/ULA may be fetched; loopback/link-local/metadata still denied. |

Structured worker/ingestion logs emit JSON lines containing `trace_id`, `job_id`, `asset_id`, `barrel_id`, `source_kind`, `stage`, and `status`.

## Metrics

`GET /metrics` exposes a private Prometheus registry (`KBSEW/api/monitoring/metrics.py`):

| Metric | Type | Meaning |
|--------|------|---------|
| `kbsew_ingest_success_total` | Counter | Successful worker jobs by `source_kind`. |
| `kbsew_ingest_failure_total` | Counter | Failed worker attempts/finals by `source_kind`. |
| `kbsew_search_latency_seconds` | Histogram | Semantic search latency by status. |
| `kbsew_active_jobs` | Gauge | Count of `queued` + `running` jobs. |

**Alert rules (ops):** sample Prometheus rules ship at **`KBSEW/monitoring/alerts-kbsew.yml`** (`KbsewActiveJobsHigh`, `KbsewIngestFailuresRising`, `KbsewDown`). They assume an existing scrape job named `kbsew` against `stack-kbsew` `/metrics` — they do **not** provision Prometheus/Alertmanager.

**Primary liveness (until Prometheus exists):**

| Tool | Role |
|------|------|
| `bash docker/scripts/kbsew-prod-health.sh` | From command-center: SSH prod-core → container running + `/health` + `/ready` (fail-closed). |
| `bash docker/scripts/kbsew-ensure-running.sh` | On prod-core: idempotent `podman start` if not running. |
| `bash docker/scripts/kbsew-install-user-restart-unit.sh` | User systemd service+timer (5m) when `Linger=yes` — recovers silent exits without sudo. |
| `podman-restart.service` | Preferred host-wide: `sudo systemctl enable --now podman-restart.service` (needs sudo on prod-core). |

Deploy smoke (`kbsew-deploy-prod-core.sh`) asserts `RestartPolicy=unless-stopped` and warns when `podman-restart.service` is not enabled. `/metrics` + `podman logs stack-kbsew` remain the local debug path.

## Chunk schema (text + optional figure)

`api/models/chunk.py` `Chunk` fields used at Qdrant upsert (`chunk_to_point`):

| Field | Default | Notes |
|-------|---------|-------|
| `chunk_kind` | `text` | Optional `figure` for future multimodal ingest (no vision pipeline in v1). |
| `page` | unset | 1-based page when known. |
| `bbox` | unset | `[x0, y0, x1, y1]` page coordinates for figure chunks. |

PDF driver today emits only `chunk_kind=text` chunks. Payload always includes `chunk_kind`; `page`/`bbox` appear only when set.

## Sparse vectors + hybrid retrieval (opt-in)

| Env | Default | Meaning |
|-----|---------|---------|
| `KBSEW_SPARSE_VECTORS_ENABLED` | `false` | When on: **ingest** attaches hashed log-TF sparse term weights (`sparse_indices` / `sparse_values` / `sparse_scheme=hashed_log_tf_v1`, `sparse_vector_ready=true`); **hybrid search** uses payload scroll + in-process score (unless native is also on). Default **off** for prod safety. |
| `KBSEW_SPARSE_NATIVE_QDRANT` | `false` | Opt-in named dense+sparse Qdrant ANN. Requires `KBSEW_SPARSE_VECTORS_ENABLED=true`. New collections get `dense`/`sparse` named vectors; existing unnamed collections need recreate + force-reindex. Schema mismatch → payload-scroll fallback. Default **off**. |
| `KBSEW_SPARSE_MAX_TERMS` | `128` | Cap on sparse terms per chunk (clamped 8–512). |
| `KBSEW_SPARSE_CANDIDATE_LIMIT` | `256` | Max points scrolled for **payload** sparse ranking (clamped 32–2048). Hitting the cap with more points remaining → hybrid skip (`sparse_scroll_cap`) unless allow-truncated is on. Unused on native ANN path. |
| `KBSEW_HYBRID_ALLOW_TRUNCATED_SPARSE` | `false` | When `true`, hybrid may RRF with a truncated sparse scroll (logged `kbsew_hybrid_sparse_truncated_used`). Default **off** — honest dense degrade. |
| `KBSEW_RETRIEVAL_MODE` | `dense` | Service default when request omits `retrieval_mode`. Use `hybrid` only with sparse enabled + re-indexed barrels. |

**Operator enable path (payload sparse):** set `KBSEW_SPARSE_VECTORS_ENABLED=true` → force-reindex so points gain sparse payload → `POST /search` with `retrieval_mode=hybrid`. Points ingested while the flag was off → `kbsew_hybrid_sparse_skip reason=no_sparse_candidates` → dense.

**Operator enable path (native ANN):** set both sparse flags → recreate each barrel collection (`recreate_collection_native_sparse` / empty recreate via `ensure_collection`) → force-reindex → hybrid. Until recreate, hybrid sparse falls back to payload scroll when payloads exist.

**Follow-up (not this wave):** Native Qdrant named sparse vectors after collection recreate.

## Driver plugin model

See **`KBSEW/README.md`** §Adding a new ingestion driver.

Registered drivers (`api/drivers/registry.py`):

| `driver_type` | Class | Notes |
|---------------|-------|-------|
| **`pdf`** | `PDFIngestionDriver` | Download PDF → Tika text/meta → OCR fallback → chunk → embed → Qdrant upsert. Upload path supported. |
| **`markdown`** | `MarkdownIngestionDriver` | http(s) `.md`/`.markdown` (or `text/markdown` / `text/plain` HEAD) → UTF-8 decode → chunk → embed → Qdrant. No stack4. |
| **`code_python`** | `CodePythonIngestionDriver` | `.py` upload/URL → line-window chunks with path/symbol metadata → embed → Qdrant. No stack4. |
| **`code_typescript`** | `CodeTypescriptIngestionDriver` | `.ts`/`.tsx` → same code chunker (`lang=typescript`). |

URL ingest selects driver via barrel default or per-ingest `driver_type` override.

### Repo barrel sync (docs / api / frontend)

Operator script (command-center or host with KBSEW HTTP reachability):

```bash
export KBSEW_SERVICE_URL=http://127.0.0.1:28030   # or SSH tunnel / gateway
export KBSEW_ADMIN_BEARER='<admin JWT>'            # preferred for mutations
# Alt ops path: KBSEW_INTERNAL_SERVICE_TOKEN + server KBSEW_SERVICE_CAN_MUTATE=true
bash docker/scripts/kbsew-sync-repo-barrels.sh --barrel docs   # eliteew-docs / markdown
bash docker/scripts/kbsew-sync-repo-barrels.sh --barrel api    # eliteew-api / code_python
bash docker/scripts/kbsew-sync-repo-barrels.sh --barrel fe     # eliteew-frontend / code_typescript
# Inventory without JWT: --dry-run [--limit N]
```

Creates barrel by name if missing (unless `KBSEW_SYNC_BARREL_ID_*` set). Uploads are idempotent by content SHA. Worker upload path accepts drivers with bytes APIs: **`pdf`**, **`markdown`**, **`code_python`**, **`code_typescript`**. After queue drain, search via admin Test search, desktop `knowledge_base_search`, or MCP `kbsew_search`. After an ops sync that used the service-token mutate flag, set **`KBSEW_SERVICE_CAN_MUTATE=false`** and recreate `stack-kbsew`.

## Admin shell

| Field | Value |
|-------|-------|
| Section id | `kbsew` |
| Nav group | `ugsAi` |
| URL | `?section=kbsew` (+ `kbsewTab=overview\|barrels\|agent-access\|test-search`) |
| Frontend hub | `pages/Admin/kbsew/KbsewAdminSection.tsx` |
| Tabs | **Overview**, **Barrels** (CRUD + ingest + force-reindex + job monitor), **Agent access** (`kbsew_search_settings`), **Test search** |
| API client | `pages/Admin/kbsewAdminApi.ts` |

Admin UX (operator console):

| Widget | Behavior |
|--------|----------|
| Overview readiness | Admin `GET /api/v1/kbsew/ready` via stack0 gateway → KBSEW root `GET /ready` (not under `/api/v1/kbsew/`). **404** → show **n/a**. Non-404 errors → degraded banner. Optional ingest counters (`active_jobs`, `ingest_*_total`) show **n/a** when absent. |
| Barrels job monitor | Polls barrel `status` (~4s via `KBSEW_BARREL_STATUS_POLL_MS`). Table of `active_jobs` + `completed_jobs` (each with `trace_id`). Copy `trace_id` when present; otherwise **n/a**. Force-reindex gated by `canForceReindexBarrel` (`asset_count >= 1`). |
| Force reindex all | Barrel detail → confirm → `POST /api/v1/kbsew/barrels/{id}/reindex`. Shows queued / already-active / failed counts; does **not** re-upload files. |
| Driver / revision | `driver_type` badge always; `revision` badge when API provides it, else **n/a**. |
| Retrieval mode | Agent access persists `retrieval_mode`; Test search overrides per query; gateway forwards mode on admin-settings path (body override, else settings, else dense). |
| Degraded banner | Shared `KbsewDegradedBanner` for list/search/ready failures across tabs. |

## Failure / edge cases

| Axis | Behavior |
|------|----------|
| Offline KBSEW | Gateway returns **502**; admin UI shows error toast. Worker dependency failures retry with backoff and then final `failed` with non-empty message. |
| Offline / unavailable sparse (hybrid) | Qdrant scroll/score failure or empty sparse payload → log `[STEP] kbsew_hybrid_sparse_skip` and return dense order. Sparse flag off at search time → same skip (`reason=sparse_disabled`). Scroll hits candidate cap with more points left → `reason=sparse_scroll_cap` (dense) unless `KBSEW_HYBRID_ALLOW_TRUNCATED_SPARSE`. |
| Dual dense+hybrid flags | Request `retrieval_mode` wins over env `KBSEW_RETRIEVAL_MODE`; invalid values coerce to **dense**. `hybrid` without sparse enabled still succeeds as dense. Truncated-sparse allow flag does not change dense mode. |
| Stale `PIPELINE_VERSION` | Search → **409** `index_stale` (no chunks) while any asset is indexed/pending/running with a non-current active revision (covers mid-reindex). Worker auto-enqueues force-reindex for still-`indexed` stale assets. Unchanged-byte skip blocked until active revision matches current pipeline. |
| Dual: same sha + stale pipeline | No skip — full re-extract / re-embed under current `PIPELINE_VERSION`. |
| Ingest quality reject | Chunk set below readable / OCR thresholds → job fails; asset not `indexed`. |
| Zero readable chunks | Index commit raises; asset stays non-`indexed`; worker retries/fails with non-empty message — never `indexed` with `chunk_count=0`. |
| URL completed re-ingest | Without matching digest → new job; unchanged bytes after download → `kbsew_ingest_unchanged_skip` (no Qdrant wipe). |
| Partial upsert mid-batch | Upsert-first keeps prior overlapping point IDs until overwritten; prune only after full success. Residual: mid-batch crash can mix old/new indices until retry. |
| Disabled barrel | Enqueue/reindex rejected with **409** (`BarrelDisabledError`). If a job was already queued before disable, worker execute fails with barrel disabled. Search remains read-only. |
| Unsafe / oversized ingest | Private/metadata URL → **400**; body over `KBSEW_INGEST_MAX_BYTES` → **413**. |
| Dual concurrent enqueue | DB unique + `enqueue_job` FOR UPDATE → one active job; loser reuses active (`created=false`). |
| Dual driver override | Per-ingest `driver_type` overrides barrel default when set; idempotency key includes the resolved driver. |
| Duplicate upload/source | Same content hash or URL key reuses the asset/latest active or completed job; failed assets are requeued over the same asset. Pipeline refresh of completed assets → force-reindex, not re-upload. |
| Force-reindex dual call | Concurrent force-reindex while job is `queued`/`running` returns `already_active` (no second job). |
| Permission | Default deny; admin JWT on mutations; service token = read-only `kbsew_service` unless **`KBSEW_SERVICE_CAN_MUTATE=true`**; gateway strips client service-token; `/metrics` localhost-bound. |
| Regression | Narrow code drivers: `cd KBSEW && PYTHONPATH=. .venv/bin/python -m pytest tests/test_code_drivers.py tests/test_driver_registry.py -q`; broader KBSEW suite as previously listed (`tests/test_markdown_driver.py`, worker/search/…); FE clamp: `pnpm exec vitest run src/pages/Admin/__tests__/kbsewSearchSettings.test.ts`; `bash -n docker/scripts/kbsew-deploy-prod-core.sh docker/scripts/kbsew-eval.sh docker/scripts/kbsew-e2e-smoke.sh docker/scripts/kbsew-sync-repo-barrels.sh`; live API smoke `KBSEW_E2E_RUN=1 bash docker/scripts/kbsew-e2e-smoke.sh`. |
| basedpyright | KBSEW and EliteEW both own an `api` package. Typecheck KBSEW only via root `pyrightconfig.json` executionEnvironment `root: KBSEW` (`include`: `KBSEW/api`, `KBSEW/tests`; extraPaths: `KBSEW`, `/tmp/kbsew-test-deps`) — never resolve KBSEW sources against EliteEW’s `api`. Prefer concrete imports: `import api.services.<module> as <module>`. Do not add a nested optional host KBSEW pyrightconfig.json *[optional; may be absent]* (may be absent; use monorepo root pyrightconfig) (dual project ownership). |

## Troubleshooting (prod)

| Symptom | Cause | Fix |
|---------|-------|-----|
| Empty barrel list + **500** in `stack-kbsew` logs (`Name or service not known` on JWKS) | Container not on **`ew_net_9O11`** → cannot reach `stack6-keycloak` | Recreate from `docker/stack/kbsew.yml` (all three networks) or `podman network connect ew_net_9O11 stack-kbsew` |
| Create succeeds, list empty on **Обновить** (API **200**) | Redis **ResponseCache** cached first empty `GET /api/v1/kbsew/barrels` | Fixed: exclude `/api/v1/kbsew/` from cache; Ctrl+F5 after deploy |
| Delete **500** / Qdrant SSL `WRONG_VERSION_NUMBER` | Qdrant client spoke HTTPS to HTTP `:6333` | Fixed: `url=http://stack1-qdrant:6333`; PG row still deletes if Qdrant cleanup fails |
| Upload **500** SeaweedFS retries | Object storage: `only -N volumes left`, no writable volumes for collection `eliteew` | Ops: raise `-volume.max` in `stack1.yml`, recreate `stack1-seaweedfs`; see [SEAWEEDFS-OPERATOR-RUNBOOK.md](../platform/docker-re_doc/SEAWEEDFS-OPERATOR-RUNBOOK.md) §volume capacity |
| Upload **failed** at indexing, empty job message, Qdrant collection **0 points** | Single bulk embed/upsert for large PDFs (1000+ chunks) exceeds HTTP payload / connection limits | Fixed: batched embed (`AI_EMBEDDINGS_BATCH_SIZE`) and Qdrant upsert (`KBSEW_QDRANT_UPSERT_BATCH_SIZE`); job stores non-empty error text |
| Upload **failed** at metadata, Tika `/meta` **500**, logs `OutOfMemoryError: Java heap space` | stack4-tika default **512M** limit; language detection on large PDFs | KBSEW degrades metadata and continues; ops: raise Tika memory (`JAVA_TOOL_OPTIONS=-Xmx1024m`, limit **1536M**) in `stack4.yml` and recreate `stack4-tika` |
| UI lag on create/refresh | Qdrant `ensure_collection` on every create (4096-dim) + combined list+status fetch | Collection on first ingest; admin UI splits list vs status loading |
| Job stuck `running` after restart | Previous process died while lease was active | Startup recovery requeues `running` jobs older than `KBSEW_WORKER_LEASE_TIMEOUT_SEC`; clean shutdown requeues immediately |
| Dual worker after stale lease | Loser still finishes execute and marks completed without ownership check | Fixed: heartbeat miss aborts; complete/fail/reschedule require `status=running AND locked_by=worker` (CAS) |
| Re-ingest / worker crash: `ValueError: dictionary update sequence element #0 has length 1` on `dict(job["payload"])` | asyncpg returned `jsonb` as `str` (no codec); `dict("…")` iterates characters | Fixed: pool registers json/jsonb codecs + `coerce_json_object` on payload/metadata reads (`api/core/json_codec.py`) |
| Stale KBSEW image after deploy | Compose `--force-recreate` left named `stack-kbsew` on an old Image id | Use `docker/scripts/kbsew-deploy-prod-core.sh --yes`; it uses `podman run --replace`, verifies running image id == loaded id, waits for `/ready`, then `/health`/`/metrics`/`/barrels` (stack0 unchanged unless `--with-stack0-gateway`) |
| Deploy aborts on `scp …/pending/*.sql` | Empty `pending/` expands to literal glob under `set -u` / no-nullglob | Fixed: deploy script nullglobs pending; syncs `applied/*kbsew*.sql` so migrations still reach prod-core |
| Deploy smoke exit 56 right after replace | uvicorn not listening yet; immediate `curl /ready` races container start | Fixed: deploy waits/polls `/ready` (up to ~120s) before other smokes |
| `/ready` fails after wait window | PG/Qdrant/MinIO unreachable from new container (networks / deps) | Fail-closed by design — fix deps/networks (`ew_net_2847` etc.), re-run deploy; do not treat `/health` alone as ready |
| Re-upload same PDF does nothing | Ingest idempotency returns completed job | Use Admin **Force reindex all** or `POST …/barrels/{id}/reindex` |

Smoke with data (inside `stack-kbsew`):

```bash
podman exec stack-kbsew python -c "
import asyncio
from api.core.database import init_pool, close_pool
from api.services.barrel_service import list_barrels
async def main():
    await init_pool()
    print('barrels=', len(await list_barrels()))
    await close_pool()
asyncio.run(main())
"
```

## Related

- `KBSEW/README.md` — developer guide
- `documentation/platform/UNIFIED-ADMIN-SHELL.md`
- `docker/stack/kbsew.yml`

### Pinned URL ingest transport

`api/services/safe_http.py` delegates GET and HEAD to `api/services/safe_url_transport.py`. The independently packaged API carries the same transport implementation as stack0; a parity regression test checks the copies. Preflight validation alone never authorizes a later connection: each actual hop resolves all addresses, rejects mixed allowed/blocked answers, and connects to the selected numeric IP. Host and verified TLS SNI retain the logical hostname; environment proxies and insecure TLS retries are disabled.

The private-network opt-in permits only RFC1918/ULA, never loopback/link-local/metadata/CGNAT or IPv6 transition mechanisms. Each redirect is checked again. GET has a 120-second total deadline and a hard `KBSEW_INGEST_MAX_BYTES` cap; HEAD has a 30-second deadline and reads no body. HTTP identity encoding is requested; compressed HTTP representations are rejected before reading. This deliberately rejects servers that ignore the identity request. Typed unsafe-URL and oversized-payload errors are retained.
