# Stack2 LLM Contract

> **Redesign SoT:** [LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md](LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md) — Phases **1–4 live** (interactive MoE parallel≥2 on `.111`; embed/rerank **0.6B @1024** on `.141`; inject/RAG budgets + turn contract; **deep** Gemma 31B on `.136:8080` via `LLAMA_DEEP_URL`). **This file + topology §Current** remain live runtime SoT.

Текущий `stack2` для EliteEW использует **llama.cpp**: на хосте stack2 по умолчанию поднимается **только чат** на **GPU (CUDA)**; **эмбед** (`llama-embed`, GGUF **`server-cuda`**) и **реранк** (`llama-rerank`, GGUF **`server-cuda`**, **`-ngl` / `LLAMA_RERANK_NGL`**) либо задаются профилем **`local-stack2-embed-rerank`**, либо вынесены в LAN (**`stack2-llama-remote-embed-rerank.yml`**), см. **`LLAMA_EMBEDDING_URL` / `RAG_RERANK_BASE_URL`** в stack0. Опционально **[TEI](https://github.com/huggingface/text-embeddings-inference)** (CPU) для HF safetensors. Типичный контур в репозитории до выноса: **Qwen3-Embedding-4B Q4** + **`AI_EMBEDDINGS_DIMENSION=2560`**; удалённый **8B** GGUF — **4096** и реиндекс Qdrant. Если на **одной** карте не хватает VRAM — временно можно снизить `LLAMA_*_NGL` или вернуть CPU fallback (`server`, `-ngl 0`) осознанно. Контракт — `docker/stack/stack2.yml`, `docker/env_file/.env.stack2`, `docker/env_file/.env.stack0.backend`, код API.

> Операторский runtime по умолчанию: **Podman**.

### Prod-core llama-chat (live snapshot · 2026-09-04 Phase 1)

| Поле | Значение |
|------|----------|
| Host | prod-core `.111`, контейнер `stack2-llama-chat` (**single GPU: RTX 3090**; 5060 Ti → memory plane `.141`) |
| Image | `ghcr.io/ggml-org/llama.cpp:server-cuda13` (preloaded on `.111`, `pull_policy: never`; `STACK2_LLAMA_CHAT_BAKED_IMAGE`) |
| Host driver | NVIDIA **610.x**, CUDA UMD **13.3**; image toolkit may lag (forward-compat) |
| Chat GGUF | `gemma-4-26B.gguf` (MoE interactive; профиль `stack2.prod-core.gemma-26b.override.yml`) |
| Context | **`-c 81920`** + **`--parallel 2`** → **`n_ctx_slot` ≈ 40960** per slot (`kv_unified=false`) |
| Speed flags | `-ngl 999`, `--flash-attn on`, **KV `q8_0`**, `-ncmoe 0`, `--no-mmproj` |
| API mirror | **`LLAMA_CHAT_PARALLEL=2`** in `.env.stack2` + `.env.stack0.backend` / `.shared` (`stack2_text_llm_slot`) |
| CUDA graph opt | **`GGML_CUDA_GRAPH_OPT=1`** |
| Compose files | `stack2.yml` + `stack2.prod-core.override.yml` (копия профиля через `eliteew-llama-chat-model.sh`) |
| Stack0 env | Патчить **`.env.stack0.backend` и `.env.stack0.shared`** (`LLAMA_MODEL*` + `LLAMA_CHAT_PARALLEL`) |
| Rollback | `bash docker/scripts/eliteew-llama-chat-model.sh 31b --with-stack0` (dense deep profile; not interactive default) |
| Redesign SoT | [LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md](LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md) |

Обновление: pull `server-cuda` на `.111` (или `eeprodruntime` с retag) → `podman compose … up -d --force-recreate --pull never llama-chat`. Не билдить на prod-core.

## Каталоги весов на хосте (вне монорепо)

| Путь | Назначение |
|------|------------|
| `/home/owned/models` | HF cache (`huggingface/`), Llama blobs, TTS (`tts/`), Whisper (`whisper/`) |
| `/home/owned/llama-test-models` | GGUF для `stack2-llama-chat` — `STACK2_LLAMA_MODELS_PATH` в `.env.stack2` |
| `/home/owned/models/llama` | Опционально: удалённый embed/rerank — `LLAMA_REMOTE_MODELS_PATH` |

`shared/api/models/` — Python ORM, не веса. Переменная `ELITEEW_AI_MODELS_ROOT` — в `docker/env_file/brand_config.env.example` (portable release; основной stack0 — `docker/env_file/.env.stack*`).

## Роли сервисов

| Роль | Контейнер | Базовый URL из stack0 | Основной endpoint |
|------|-----------|------------------------|-------------------|
| Chat / completions | `stack2-llama-chat` | `LLAMA_URL` | **`/v1/chat/completions`** (primary), native **`/api/chat`**, **`/health`**; legacy **`/v1/completions`** — не используется stack0 API после health-ok probe |
| Deep job class (Phase 4) | command-center `.136` container **`eliteew-llama-deep`** (`bash docker/scripts/eliteew-llama-deep.sh`) | `LLAMA_DEEP_URL=http://192.168.1.136:8080` | OpenAI-compat `/v1/chat/completions` + `/health`; **31B** Q4 `-c 81920` `--parallel 1` KV `q8_0`; unset URL → `DeepLlmUnavailableError` (never steals interactive `.111` slots); product gate **`EWA_DEEP_LLM_ENABLED`** — set **`1` only while deep is up**, else **`0`** (Comfy mutex; companion/agentic skip deep hops); missing deep → interactive + STEP fallback; firewall rich-rule `.111`→`:8080` required |
| **Assistant Tool Router (FC)** | `stack2-llama-tool-router` (профиль `companion-tool-router`) | `EWA_COMPANION_TOOL_ROUTER_URL` | `/v1/chat/completions` + `tools`, `/health` |
| **Marketing cabinet tool-agent (FC)** | тот же sidecar (LAN `.141` или docker hostname) | `MARKETING_CABINET_TOOL_ROUTER_URL` → цепочка `EWA_COMPANION` → `DESKTOP` → `stack2-llama-tool-router:8080` | marketing whitelist tools |
| **Assistant intent planner (JSON/KV v2)** | тот же sidecar по умолчанию | `EWA_COMPANION_INTENT_PLANNER_URL` или цепочка tool-router URL; модель — `EWA_COMPANION_INTENT_MODEL` или router model | JSON/KV `{tool, args}` или legacy `{intent, slots}` → `CompanionIntentPlan`; канон [EWA-COMPANION-INTENT-PLANNER.md](../product/ewa/EWA-COMPANION-INTENT-PLANNER.md) |
| **Ассистент Tool Router (FC, shared sidecar)** | тот же `stack2-llama-tool-router` | `DESKTOP_AI_CHAT_TOOL_ROUTER_URL` → `EWA_COMPANION_TOOL_ROUTER_URL` → docker hostname | meta-tool **`desktop_route_turn`** |
| Embeddings | `stack2-llama-embed` (**GGUF + CUDA**, образ **`server-cuda`**) или **`stack2-tei-embed`** (HF, профиль `tei-cpu-embed`) | `LLAMA_EMBEDDING_URL` | `/v1/embeddings`, `/health` |
| Rerank | `stack2-llama-rerank` (**GGUF + CUDA**, образ **`server-cuda`**) | `RAG_RERANK_BASE_URL` | `/v1/rerank`, `/health` |

`stack2-llama` (legacy) и Apache Airflow **сняты** — не являются рабочим baseline для маркетингового контура. Остаточные комментарии и переменные в env допускаются как исторический контекст, но новым кодом и smoke-проверками не считаются каноном.

### Compose: что поднимается без профилей

Команда `podman compose -f docker/stack/stack2.yml --env-file docker/env_file/.env.stack2 up -d` **без** `--profile` поднимает **только чат (`llama-chat`)** — GGUF-эмбед (`llama-embed`) и реранк (`llama-rerank`) по умолчанию **вынесены** на отдельный хост (см. **`stack2-llama-remote-embed-rerank.yml`** и **`LLAMA_EMBEDDING_URL` / `RAG_RERANK_BASE_URL`** в stack0). Чтобы снова поднять эмбед и реранк **на этой же машине**:

```bash
podman compose -f docker/stack/stack2.yml --env-file docker/env_file/.env.stack2 --profile local-stack2-embed-rerank up -d
```

Профиль **`tei-cpu-embed`** по-прежнему добавляет альтернативу TEI:

- **TEI:** `--profile tei-cpu-embed` и сервис `tei-embed`. В stack0 укажите `LLAMA_EMBEDDING_URL` на TEI **или** на `llama-embed` / удалённый llama-server, не на оба одновременно.

Профиль **`companion-tool-router`** добавляет sidecar **Qwen3-4B FC** для Assistant Tool Router на CPU (не поднимается без `--profile`):

```bash
podman compose -f docker/stack/stack2.yml --env-file docker/env_file/.env.stack2 \
  --profile companion-tool-router up -d llama-tool-router
```

Переменные: `LLAMA_TOOL_ROUTER_*` в `.env.stack2`; в stack0 — `EWA_COMPANION_TOOL_ROUTER_*` и **`DESKTOP_AI_CHAT_TOOL_ROUTER_*`** в `.env.stack0.backend`. Desktop solo chat использует тот же sidecar с meta-tool **`desktop_route_turn`** (канон: **`product/DESKTOP-AI-CHAT-TOOL-ROUTER.md`**). Канон EWA: **`product/ewa/EWA-COMPANION-TOOL-ROUTER.md`**.

После перехода на профили **остановите** уже запущенные **`stack2-llama-embed`** и **`stack2-llama-rerank`**, если они остались от старого `up` (Compose сам не снимет контейнеры, исключённые профилем): `podman stop stack2-llama-embed stack2-llama-rerank` или осознанный `podman rm -f …`.

Чтобы **не грузить** эмбед на слабом хосте, остановите контейнер: `podman stop stack2-llama-embed` (при необходимости снимите сервис из compose или задайте профиль обратно локально).

После смены `stack2.yml` уже **запущенный** контейнер эмбеддингов Compose **не остановит** сам — при необходимости: `podman stop stack2-llama-embed` / `podman stop stack2-tei-embed` или осознанный `podman compose … down`.

## Capacity policy: chat + embed + rerank

Операторский baseline для предотвращения GPU contention:

| Профиль нагрузки | Разрешённая комбинация | Политика |
| --- | --- | --- |
| Низкая/средняя | `llama-chat` (GPU) + `llama-embed` (GPU) + `llama-rerank` (GPU) | Базовый режим для локального stack2; на **одной** RTX 3090 с chat ctx 131k — **частичный** `-ngl` для embed/rerank (см. `.env.stack2`: `LLAMA_EMBED_NGL`, `LLAMA_RERANK_NGL`, `LLAMA_RERANK_CTX=4096`); при `cudaMalloc` OOM — снизить слои или CPU fallback |
| Высокая (длинные чаты + частый embed) | `llama-chat` (GPU) + embed/rerank вынесены (`stack2-llama-remote-embed-rerank.yml`) | Рекомендуемый production режим |
| Дефицит VRAM | `llama-chat` (GPU) + `llama-embed` (CPU образ `server`) + `llama-rerank` (CPU образ `server`, `-ngl 0`) | Временно, с деградацией latency |

Инварианты:

1. Не включать одновременно локальный `llama-embed` и удалённый embed endpoint в stack0 (`LLAMA_EMBEDDING_URL` должен указывать ровно на один контур).
2. При включении `local-stack2-embed-rerank` проверять, что на хосте не остались старые удалённые/дублирующие контейнеры.
3. При росте `rerank_request_duration_seconds` + `embedding_request_duration_seconds` и `gpu_usage_percent≈100` — немедленно переходить на remote embed/rerank.
4. **API concurrency:** stack0 зеркалит **`--parallel`** chat-сервера через env **`LLAMA_CHAT_PARALLEL`** (дефолт **`1`**, задаётся в **`docker/env_file/.env.stack2`**, compose `stack2-llama-chat`). Модуль **`api/utils/stack2_text_llm_slot.py`** сериализует исходящие HTTP к **`stack2-llama-chat`** (chat JSON, stream, generate JSON), чтобы параллельные AMKA autofill и desktop ensemble stream не перегружали один слот llama-server (**`ServerDisconnected`**, обрыв SSE). Tool-router / embed / rerank **не** проходят через этот gate. Лог: **`[STEP] stack2_text_llm_slot acquired reason=… wait_ms=…`**.

### GPU contention runbook (краткий)

1. Проверить `nvidia-smi` и health `llama-chat`/`llama-embed`/`llama-rerank`.
2. Снять latency-сигналы API (`embedding_request_duration_seconds`, `rerank_request_duration_seconds`) и backlog (`ops_alarm_state`).
3. Если есть `cudaMalloc OOM` или sustained latency spikes:
   - уменьшить `LLAMA_EMBED_NGL`, `LLAMA_EMBED_CTX`, `LLAMA_EMBED_UBATCH`;
   - либо переключить embed/rerank на remote compose (`stack2-llama-remote-embed-rerank.yml`);
   - либо перевести `llama-embed` на CPU (`server`) как временный fallback.
4. После изменения профиля — `podman compose ... up -d --force-recreate` + `bash docker/scripts/stack2-llm-smoke.sh`.

### nvidia-uvm / CDI: llama-chat Exited after host reboot (2026-07-31)

**Symptom:** Ассистент / ensemble SSE → `ensemble_blueprint_upstream_unreachable` / DNS `Temporary failure in name resolution` while API is healthy. `podman ps -a` shows `stack2-llama-chat` **Exited**.

**Cause (observed):** container recreate/start fails with CDI inject error when `/dev/nvidia-uvm` is missing briefly after driver reload, e.g. `failed to stat CDI host device "/dev/nvidia-uvm"`. Exit code may be `0` with that error in `podman inspect`.

**Recover (prod-core `.111`):**

```bash
ls -la /dev/nvidia-uvm   # if missing: sudo nvidia-modprobe -u -c=0
podman start stack2-llama-chat
# wait for model load, then:
curl -sf http://192.168.1.111:8080/health
podman exec stack0-eliteew-api-prod-baked curl -sf http://stack2-llama-chat:8080/health
```

Do **not** rebuild images on prod-core. If start still fails after uvm exists, recreate via compose on `.111` with `pull_policy: never` / runtime image already loaded (`eeprodruntime` from command-center if the image is missing).

### CDI `/dev/dri/cardN` renumber (2026-08-02)

**Symptom:** `stack2-llama-chat` **Exited**; `podman start` / recreate fails with
`setting up CDI devices: failed to stat CDI host device "/dev/dri/card1"`
(and warning `Could not locate device 226:1 on host`). GPU (`nvidia-smi`) and `/dev/nvidia*` are fine.

**Cause:** stale `/etc/cdi/nvidia.yaml` still lists `/dev/dri/card1`, while after reboot the NVIDIA DRM node is `/dev/dri/card0` (`by-path/pci-…-card → ../card0`).

**Recover (prod-core `.111`):**

```bash
# Preferred (needs sudo once): refresh system CDI
ls -la /dev/dri/card*
sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml
# Then recreate (not bare start — old container may cache card1 maj:min):
# from repo with runtime env, pull_policy never — or eeprodruntime --yes --stack2-only from .136
```

Without sudo: regenerate **user** CDI and prefer it in `~/.config/containers/containers.conf`:

```bash
nvidia-ctk cdi generate --output="$HOME/.config/cdi/nvidia.yaml"
# [engine] cdi_spec_dirs = ["/home/owned/.config/cdi", "/etc/cdi", "/var/run/cdi"]
# then compose force-recreate llama-chat (same files as baked stack2 path)
```

Verify: `curl -sf http://192.168.1.111:8080/health` and
`podman exec stack0-eliteew-api-prod-baked curl -sf http://stack2-llama-chat:8080/health`.

### Auto CDI on boot (prod-core)

Two layers (both intended):

| Layer | What | When |
|-------|------|------|
| **User autostart** | `eliteew-podman-autostart` → `start-prod-core-stacks.sh` → `_require_cdi` → `docker/scripts/prod-core/refresh-nvidia-cdi.sh` | Every boot: regenerates `~/.config/cdi/nvidia.yaml`, prefers it in `containers.conf`, and with `ELITEEW_AUTOSTART_BOOT=1` **force-recreates** `llama-chat` (old container may cache stale `cardN` maj:min). |
| **System unit** | `nvidia-cdi-refresh.service` (+ `.path`) | Writes `/etc/cdi/nvidia.yaml` when enabled. `harden-prod-core-host.sh` enables it once `nvidia-smi` works and sets `NVIDIA_CTK_CDI_OUTPUT_FILE_PATH=/etc/cdi/nvidia.yaml`. |

One-time on `.111` (sudo), if system unit still disabled:

```bash
sudo tee /etc/nvidia-container-toolkit/nvidia-cdi-refresh.env <<'EOF'
NVIDIA_CTK_CDI_OUTPUT_FILE_PATH=/etc/cdi/nvidia.yaml
EOF
sudo systemctl enable --now nvidia-cdi-refresh.service nvidia-cdi-refresh.path
sudo systemctl start nvidia-cdi-refresh.service
```

Manual refresh without sudo (same as boot hook):

```bash
bash docker/scripts/prod-core/refresh-nvidia-cdi.sh
ELITEEW_STACK2_FORCE_RECREATE=1 ELITEEW_PROD_CORE_LOCAL=1 bash docker/scripts/start-prod-core-stacks.sh stack2
```

### llama.cpp context checkpoint log noise

`stack2-llama-chat` на актуальном `llama-server` может регулярно писать строки:

- `created context checkpoint ... size = ... MiB`
- `restored context checkpoint ... size = ... MiB`
- `erased invalidated context checkpoint ... n_swa = ... pos_next = ... size = ... MiB`

Это не отдельный health-failure и не прямой признак VRAM leak. Context checkpoints — кэш состояния промпта/контекста llama.cpp для ускорения повторной обработки; размер в строке лога отражает память checkpoint-данных. Для текущего **Phase 1** 26B профиля (`gemma-4-26B.gguf`, **`-c 81920` / `--parallel 2`** → `n_ctx_slot≈40960`, KV `q8_0`) пары `restored` → `erased invalidated` ожидаемы при смене prompt-prefix / позиции продолжения, особенно на моделях со sliding-window attention (`n_swa` в строке).

Считать это шумом, если одновременно верно:

1. `podman inspect stack2-llama-chat` показывает `Status=running`, `RestartCount=0`, health `healthy`.
2. `GET /health` возвращает `{"status":"ok"}` на фактическом bind (`podman port stack2-llama-chat`).
3. В свежем окне логов нет `cudaMalloc`, `out of memory`, `exceeds training context`, `capping`, `ServerDisconnected`, `failed` / `error`.
4. Нет жалоб на latency или обрывы SSE у stack0-клиентов.

Watch-векторы вместо подсчёта самих checkpoint-строк:

- restart count > 0, health `unhealthy`, падение `GET /v1/models`;
- `cudaMalloc` / OOM / host RAM pressure в `journalctl`;
- `exceeds training context` / `capping` после смены модели или ручного `-c`;
- рост `ServerDisconnected`, 5xx или таймаутов в stack0 API при обращении к `LLAMA_URL`;
- устойчивый latency spike при заполненном checkpoint pool и нехватке host RAM.

Диагностика без runtime-мутаций:

```bash
ssh 192.168.1.111 'podman inspect stack2-llama-chat --format "status={{.State.Status}} restart={{.RestartCount}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}"'
ssh 192.168.1.111 'podman port stack2-llama-chat && curl -sf http://192.168.1.111:8080/health'
ssh 192.168.1.111 'podman logs --since 2h stack2-llama-chat 2>&1 | python3 -c "import sys; data=sys.stdin.read(); [print(k, data.count(k)) for k in (\"context checkpoint\", \"cudaMalloc\", \"out of memory\", \"exceeds training context\", \"ServerDisconnected\", \"failed\", \"error\")]"'
```

## Qwen3-Embedding-8B и Qwen3-Reranker-8B (CPU, RAM)

Модели на Hugging Face ([Qwen3-Embedding-8B](https://huggingface.co/Qwen/Qwen3-Embedding-8B), [Qwen3-Reranker-8B](https://huggingface.co/Qwen/Qwen3-Reranker-8B)) поставляются в **safetensors**; контракт stack2 остаётся HTTP, но путь разный:

1. **Эмбеддинги — TEI на CPU** (как в model card HF): сервис `tei-embed` в `docker/stack/stack2.yml`, образ `ghcr.io/huggingface/text-embeddings-inference:cpu-1.7.2`, переменные `TEI_*` в `docker/env_file/.env.stack2`.
   - Запуск: `podman compose -f docker/stack/stack2.yml --env-file docker/env_file/.env.stack2 --profile tei-cpu-embed up -d tei-embed`
   - Кэш скачиваний: в `docker/env_file/.env.stack2` задайте **`TEI_HF_HOME` как абсолютный путь на хосте** (bind mount в `/data` внутри контейнера). Короткое имя без `/` даст именованный Docker volume.
   - В stack0: `LLAMA_EMBEDDING_URL=http://stack2-tei-embed:80` (порт контейнера TEI — **80**), `LLAMA_EMBEDDING_MODEL` = значение `TEI_EMBED_MODEL_ID` (например `Qwen/Qwen3-Embedding-8B`).
   - Размерность вектора по умолчанию для 8B — до **4096** (`AI_EMBEDDINGS_DIMENSION`); при смене с 4B/768/2560 **нужны** новая коллекция Qdrant и переиндексация.
   - На **CPU** для TEI лучше **`TEI_EMBED_DTYPE=float32`**: `float16` нередко даёт ошибки Intel MKL `HGEMM` в логах (`Parameter … incorrect`); FP32 тяжелее по RAM, но стабильнее. Если **и с FP32** сыплется MKL `SGEMM`/`HGEMM`, в `stack2.yml` для `tei-embed` заданы **`OMP_NUM_THREADS` / `MKL_NUM_THREADS`**, **`KMP_DUPLICATE_LIB_OK`**, **`RAYON_NUM_THREADS`**, **`MKL_DISABLE_FAST_MM`**, **`MKL_ENABLE_INSTRUCTIONS`** (по умолчанию **AVX2** — гасит **AVX512_E4** из образа, на части CPU стабильнее) — через **`TEI_*`** в `.env.stack2`. После правок — **`podman compose … up -d --force-recreate tei-embed`**. После **OOM** / забитого swap те же сообщения могут идти от **нехватки памяти**; сначала **RAM/набор контейнеров**, потом перезапуск. Проверка работоспособности: **`/health`** и **`POST /v1/embeddings`** (`curl -sf` даёт пустое тело при **200 OK** — это нормально).
   - **Цикл перезапусков** (в логах снова и снова `Args { … }` после `Starting Qwen3 model on Cpu`): часто **лимит cgroup** `TEI_EMBED_MEM_LIMIT` меньше фактической памяти, которую считает memcg: смотрите в `journalctl` не только **`anon-rss`**, но и **`file-rss`** — mmap шардов **`model-*.safetensors`** с `/data` тоже входит в лимит; сумма **anon + file** для 8B FP32 легко переваливает **30G**. Ищите `constraint=CONSTRAINT_MEMCG` и строку `Killed process … (text-embeddings)`. Ориентир для 8B на CPU: **36–40G** `TEI_EMBED_MEM_LIMIT` на хосте 62G+ или меньшая модель / GGUF. Плюс **`TOKENIZATION_WORKERS`** через **`TEI_TOKENIZATION_WORKERS`**.
   - В логах контейнера **`Intel MKL ERROR … SGEMM`** после старта Candle и (в худшем случае) **segfault** `text-embeddings-router` в `dmesg` — чаще на фоне нестабильного BLAS/потоков или после частых OOM; сначала **стабильный запас memcg**, затем при необходимости **float16** (риск HGEMM) или перенос эмбеддингов на **GGUF / GPU TEI**.
   - Если **на хосте** в `dmesg`/`journalctl` появляется блок **Mem-Info**, **free** в зоне Normal около или ниже **min/low**, swap почти забит — это **не хватает RAM** под текущий набор процессов (TEI 8B в **FP32** + чат + реранк + stack0/stack1 и т.д.). Снижайте нагрузку: меньшая embedding-модель / **GGUF Q4** в `llama-embed` вместо TEI 8B; если упираетесь в **cgroup TEI** — **увеличьте** `TEI_EMBED_MEM_LIMIT`; не поднимайте лишние тяжёлые контейнеры одновременно, либо больше RAM/swap (swap — только подстраховка).

2. **Эмбеддинги — llama-server CUDA + GGUF** (типично **`Qwen3-Embedding-4B-Q4_K_M.gguf`**): задайте `LLAMA_EMBED_FILE`, путь моделей `STACK2_LLAMA_MODELS_PATH`. В **`docker/stack/stack2.yml`**: **`llama-embed`** — **`ghcr.io/ggml-org/llama.cpp:server-cuda`**, **`runtime: nvidia`**, **`-ngl` / `LLAMA_EMBED_NGL`** (дефолт в compose **999**), **`LLAMA_EMBED_CTX`**, **`LLAMA_EMBED_UBATCH`**, **`LLAMA_EMBED_PARALLEL`**. **`LLAMA_EMBED_MEM_LIMIT`** — в основном **CPU-RAM** контейнера (буферы); веса — **VRAM**. **Чат и эмбед** делят одну карту при `NVIDIA_VISIBLE_DEVICES=all` — следите за **`nvidia-smi`**. В stack0: **`LLAMA_EMBEDDING_MODEL`** = basename `.gguf`, **`AI_EMBEDDINGS_DIMENSION=2560`**. После смены модели/размерности — реиндекс Qdrant.
   - Флаги **`-ub` / `LLAMA_EMBED_UBATCH`** избегают дефолтного ubatch 512 на пачках RAG.
   - **`cudaMalloc` OOM:** снизить **`LLAMA_EMBED_NGL`**, **`LLAMA_EMBED_CTX`** / **`LLAMA_EMBED_UBATCH`**, или уменьшить KV чата (**`LLAMA_CHAT_CTX`**). Запасной путь без VRAM под эмбед: в `stack2.yml` заменить образ на **`ghcr.io/ggml-org/llama.cpp:server`**, убрать **`runtime: nvidia`** и блок **`deploy.devices` у `llama-embed`** (только CPU; исторически **`NVIDIA_VISIBLE_DEVICES=void`** при **`server-cuda`** не отключал резерв CUDA-буферов — надёжнее именно образ **`server`**).
   - После смены образа: **`podman compose … pull llama-embed`**, **`up -d --force-recreate llama-embed`**.

3. **Реранк**: API EliteEW вызывает `POST /v1/rerank` у **llama-server** (`rerank_client.py`). Нужен **GGUF** с `--reranking`; для [Qwen3-Reranker-8B](https://huggingface.co/Qwen/Qwen3-Reranker-8B) возьмите квантизацию (например [QuantFactory/Qwen3-Reranker-8B-GGUF](https://huggingface.co/QuantFactory/Qwen3-Reranker-8B-GGUF), файл вида `Qwen3-Reranker-8B.Q4_K_M.gguf`), положите в `STACK2_LLAMA_MODELS_PATH`, выставьте `LLAMA_RERANK_FILE`, **`LLAMA_RERANK_NGL`** (дефолт **999** в compose) и достаточный `LLAMA_RERANK_MEM_LIMIT`. Локальный **`llama-rerank`** — **`server-cuda`** (профиль `local-stack2-embed-rerank`); **Companion episodic** rerank ждёт до **`min(remaining retrieval budget, EWA_COMPANION_EPISODIC_RERANK_TIMEOUT_SEC)`** (дефолт **8 s**). У **llama-server** дефолт **`--ubatch-size` 512**; один запрос реранка — это токенизированный **query + документ**, часто **>512** токенов → ответ **500** («increase the physical batch size»), а API оставляет порядок как в Qdrant. В `stack2.yml` для `llama-rerank` задано **`-ub` / `LLAMA_RERANK_UBATCH`** (ориентир **2048** в `.env.stack2`); после смены — `podman compose … up -d --force-recreate llama-rerank`. **`cudaMalloc` OOM на реранке:** снизить **`LLAMA_RERANK_NGL`** / **`LLAMA_RERANK_CTX`**, или временно образ **`server`**, **`-ngl 0`** (CPU fallback).

**Две модели по 8B в FP16 на одном хосте** обычно требуют существенно больше **32G RAM**; ориентируйтесь на **Q4_K_M** GGUF или один сервис TEI (embed) + один llama-rerank с квантизацией. Хост **~32G** редко одновременно тянет **TEI Qwen3-Embedding-8B в FP32** (нередко **22–28G** под `TEI_EMBED_MEM_LIMIT`) и **реранк на 16G** плюс ОС и остальной стек — снижайте `LLAMA_RERANK_MEM_LIMIT`, откладывайте реранк или берите меньшую embedding-модель.

## Удалённый хост: эмбед + реранк + tool-router по LAN (без `ew_net_*`)

**Live gpu141 (2026-07-14):** Debian 13 + **host-net** compose — see **`documentation/platform/docker-re_doc/LAN-WORKERS-141.md`** and **`docker/stack/stack2-llama-remote-embed-rerank.host-net.yml`**. Bridge publish on current `.141` hung (TCP connect, no HTTP); do not treat bridge yml as the live deploy path for that host.

Чтобы поднять `llama-embed`, `llama-rerank` и `llama-tool-router` на отдельной машине (например GPU-хост `192.168.1.141` в LAN):

- **Live (Debian gpu141):** **`docker/stack/stack2-llama-remote-embed-rerank.host-net.yml`** — `network_mode: host`, ports from env bind on the host; `restart: always`; no SELinux `:z` needed on Debian.
- **Legacy / Fedora bridge:** **`docker/stack/stack2-llama-remote-embed-rerank.yml`** — порты на хост **`0.0.0.0:${LLAMA_EMBED_HOST_PORT}`** / **`0.0.0.0:${LLAMA_RERANK_HOST_PORT}`** / **`0.0.0.0:${LLAMA_TOOL_ROUTER_HOST_PORT}`**, том **`${LLAMA_REMOTE_MODELS_PATH:-/home/owned/models/llama}:/models:ro,z`** (суффикс **`z`** — для **SELinux** на Fedora/RHEL; без него bind-mount часто даёт **Permission denied** на `.gguf`).
- Шаблон env: **`docker/env_file/.env.llama-remote.example`** (и `docker/scripts/lan-workers/gpu141.env.llama-remote.example`) → на сервере скопировать в **`.env.llama-remote`** (реальные значения не коммитить).

По умолчанию оба сервиса в этом compose — **CUDA** (`ghcr.io/ggml-org/llama.cpp:server-cuda`, `runtime: nvidia`, `LLAMA_EMBED_NGL` / **`LLAMA_RERANK_NGL`**). На **одной** видеокарте **16 ГБ** две 8B Q4 с полным **`-ngl`** нередко дают **`cudaMalloc` OOM** — в шапке compose описан **fallback**: реранк как в каноническом **`stack2.yml`** (**образ `server`**, без GPU, **`-ngl 0`**); URL в stack0 **не** меняются.

**Stack0 (`docker/env_file/.env.stack0.backend` или эквивалент):** базовые URL **без** суффикса `/v1`:

- `LLAMA_EMBEDDING_URL=http://<remote-ip>:<LLAMA_EMBED_HOST_PORT>`
- `RAG_RERANK_BASE_URL=http://<remote-ip>:<LLAMA_RERANK_HOST_PORT>`
- `EWA_COMPANION_TOOL_ROUTER_URL=http://<remote-ip>:<LLAMA_TOOL_ROUTER_HOST_PORT>`
- Для **Qwen3-Embedding-8B** GGUF (**rollback / non-baseline only** — live Phase 2 is **0.6B @1024**, see table below): **`LLAMA_EMBEDDING_MODEL`** и **`AI_EMBEDDINGS_FALLBACK_MODEL`** = basename файла `.gguf`; **`AI_EMBEDDINGS_DIMENSION=4096`** (полный вектор 8B). Смена размерности относительно текущих коллекций → логика **`shared/api/core/qdrant_vector_collection.py`** пересоздаст коллекции; нужен **реиндекс** контента.

**Сеть:** ограничьте доступ к портам эмбеда/реранка на удалённом хосте **firewall**-ом (только IP основного API или доверенная подсеть). Иначе любой узел в LAN сможет слать запросы к inference. Альтернатива: bind **`127.0.0.1`** на удалённой машине и **SSH reverse tunnel** к stack0.

### Доставка по SSH (Docker на удалённом хосте уже есть)

**Образы** `ghcr.io/ggml-org/llama.cpp:…` на удалённую машину не копируют: при первом **`podman compose up`** (или отдельно **`podman compose pull`**) Engine сам скачает слои с реестра (нужен выход в интернет или зеркало).

Передают по SSH **манифест и env** (и при необходимости **`.gguf`**, если их нет на сервере).

С рабочей станции, из **корня монорепозитория** (подставьте пользователя и IP):

```bash
REMOTE=owned@192.168.1.141
DIR=~/llama-remote   # на удалённом хосте: mkdir -p ~/llama-remote

# Live Debian gpu141 — prefer host-net:
scp docker/stack/stack2-llama-remote-embed-rerank.host-net.yml "${REMOTE}:${DIR}/"
# Legacy bridge (Fedora / lab):
# scp docker/stack/stack2-llama-remote-embed-rerank.yml "${REMOTE}:${DIR}/"
scp docker/env_file/.env.llama-remote.example "${REMOTE}:${DIR}/.env.llama-remote"
```

На сервере отредактируйте **`${DIR}/.env.llama-remote`**: порты, **`LLAMA_REMOTE_MODELS_PATH`**, при OOM — меньше **`LLAMA_*_NGL`**.

Удобнее дозаливать **compose** при правках в репозитории (env на сервере правьте вручную, чтобы не затереть):

```bash
rsync -avP docker/stack/stack2-llama-remote-embed-rerank.host-net.yml "${REMOTE}:${DIR}/"
```

(Повторно **`.env.llama-remote`** по сети не заливайте, если уже правили на сервере — только осознанное обновление из примера.)

Большие модели (однократно), если GGUF ещё не на диске сервера:

```bash
rsync -avP /path/to/Qwen3-Embedding-8B-Q4_K_M.gguf \
  /path/to/Qwen3-Reranker-8B.Q4_K_M.gguf \
  "${REMOTE}:${LLAMA_REMOTE_MODELS_PATH:-/home/owned/models/llama}/"
```

Дальше по **SSH** (live gpu141): **`cd ~/llama-remote`** и **`sudo podman-compose -f stack2-llama-remote-embed-rerank.host-net.yml --env-file .env.llama-remote up -d --remove-orphans`**. Autostart: systemd unit **`gpu141-llama-remote.service`**. На `.141` unit uses `podman-compose` via `/usr/bin/env`: bare `podman compose` may pick a docker-compose plugin. Rootful is the live path; rootless remains optional later.

Альтернатива без `scp`: на удалённом хосте клонировать/обновить репозиторий и брать те же пути **`docker/stack/…`** и копию **`.env.llama-remote.example`** → **`.env.llama-remote`** локально на сервере.

### Ops-чеклист: удалённый embed/rerank

1. **SSH** на удалённый хост: установлены **Podman** и **NVIDIA Container Toolkit/CDI**; проверка GPU: например `podman run --rm --device nvidia.com/gpu=all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi`.
2. Каталог **`LLAMA_REMOTE_MODELS_PATH`** с **`Qwen3-Embedding-8B-Q4_K_M.gguf`** и **`Qwen3-Reranker-8B.Q4_K_M.gguf`** (имена как в `.env.llama-remote.example`).
3. Скопировать **`stack2-llama-remote-embed-rerank.host-net.yml`** (live) или bridge yml (legacy) и завести **`.env.llama-remote`**; запуск (live):
   `sudo podman-compose -f stack2-llama-remote-embed-rerank.host-net.yml --env-file .env.llama-remote up -d --remove-orphans`
4. Проверки: **`curl -sf http://127.0.0.1:<EMBED_PORT>/health`**; **`POST /v1/embeddings`** — длина вектора **4096** для 8B GGUF; **`curl -sf http://127.0.0.1:<RERANK_PORT>/health`**; **`POST /v1/rerank`** (короткий query + два документа); **`curl -sf http://127.0.0.1:<TOOL_ROUTER_PORT>/health`**.
5. **Stack0:** после правок env —
   `podman compose -f docker/stack/stack0_b.yml --env-file docker/env_file/.env.stack0.backend up -d --force-recreate eliteew-api-prod …`
   (полный перечень сервисов — см. **`platform/docker-re_doc/STACK0-LLM-OVERVIEW.md`**), затем **`/health`** API.
6. Если эмбед/реранк раньше работали на **локальном stack2**, **остановить** локальные **`stack2-llama-embed`** и **`stack2-llama-rerank`**, чтобы не было двух экземпляров на одну роль.
7. Опционально: **`docker/scripts/stack2-llm-smoke.sh`** с **`STACK2_ENV` / переменными URL**, указывающими на удалённые базовые адреса.

## Структурированный JSON (`format` / `response_format`)

### Поведение llama-server

llama-server на `stack2-llama-chat`:

| Режим | OpenAI-shim | Native API |
|-------|-------------|------------|
| JSON object | `response_format: {"type": "json_object"}` на **`/v1/chat/completions`** | `format: "json"` на **`/api/chat`** / **`/api/generate`** |
| JSON Schema (grammar) | shim принимает только `text` \| `json_object` — **не** raw schema | `format: <schema dict>` на **`POST /api/chat`** |
| Plain text / markdown prose | **`/v1/chat/completions`** (сообщения chat) | **`/api/chat`** |

### Правила stack0 API (`llm_openai_compat_http.py`)

1. **Backend probe:** `GET /health` → `{"status":"ok"}` ⇒ backend **`openai`** + **авто skip** legacy **`POST /v1/completions`** для **`httpx_compat_generate_json`** / **`aiohttp_compat_generate_json`** (в т.ч. **`amka_llm_text`** без `json_format`).
2. **JSON Schema:** при `json_schema` или OpenAI `json_schema` wrapper — **`POST /api/chat`** с `format=<schema>`, даже если probe = OpenAI (иначе HTTP 400 «response_format type must be … object»).
3. **Нормализация OpenAI-shim:** **`openai_compat_response_format_payload`** — schema-запросы на chat-completions без raw dict в `response_format`.
4. **Structured JSON:** `json_format=True` или `json_schema=` → chat path без completions probe.
5. **Concurrency:** все main-chat HTTP через **`maybe_stack2_text_llm_slot`** (§ Capacity policy п.4).

Хелперы: **`llama_native_format_from_response_format`**, **`openai_compat_response_format_payload`**, **`_generate_json_routes_via_chat`**, **`httpx_compat_generate_json`**, **`httpx_compat_chat_completion_json`**.

**Новых SQL-миграций для этого контракта нет.** Env: **`LLAMA_CHAT_PARALLEL`** (stack2 + stack0), **`LLAMA_URL`**, опционально **`STACK2_LLM_DEBUG_SAVE_DIR`**.

Полная таблица контуров (music, marketing, desktop, EWA, Product Assistant, EWRP, Site Studio), UGS gate, миграции `20260620_*` и тесты — **`platform/docker-re_doc/STACK0-LLM-OVERVIEW.md`** §7–8. Контрактные тесты: **`test_llm_json_schema_pass_through.py`**, **`test_llm_chat_compat.py`**, **`test_stack2_text_llm_slot.py`**, **`test_amka_llm_json_mode.py`**.

## Обязательные инварианты

1. `LLAMA_URL` должен указывать на `stack2-llama-chat`, без суффикса `/v1`.
2. `LLAMA_EMBEDDING_URL` должен указывать на `stack2-llama-embed` **или** на `stack2-tei-embed` (TEI: базовый URL с портом **80** внутри Docker, например `http://stack2-tei-embed:80`), **или** на удалённый **llama-server** эмбеддингов по LAN (базовый `http://<host>:<port>` из **`stack2-llama-remote-embed-rerank.yml`**), без суффикса `/v1`.
3. `RAG_RERANK_BASE_URL` должен указывать на `stack2-llama-rerank` **или** на удалённый **llama-server** реранка по LAN (тот же compose), без суффикса `/v1`.
4. `LLAMA_MODEL` и `LLAMA_MODEL_MARKETING` должны соответствовать `LLAMA_CHAT_FILE`.
5. Полный чеклист смены чат-модели (stack2 + stack0 env + UGS + миграции): **[LLM-CHAT-MODEL-CHANGE-CHEATSHEET.md](LLM-CHAT-MODEL-CHANGE-CHEATSHEET.md)**.
6. `LLAMA_EMBEDDING_MODEL` и `AI_EMBEDDINGS_FALLBACK_MODEL` должны совпадать с идентификатором модели на сервере эмбеддингов: для llama-server — с `LLAMA_EMBED_FILE` (часто имя `.gguf`); для TEI — с `TEI_EMBED_MODEL_ID` (например `Qwen/Qwen3-Embedding-8B`).
7. `AI_EMBEDDINGS_DIMENSION` обязана совпадать с фактической длиной вектора, которую возвращает `POST /v1/embeddings` на `LLAMA_EMBEDDING_URL`.
8. `IMC_RAG_LLAMA_NUM_CTX`, `EWA_COMPANION_CHAT_NUM_CTX` и `IMC_RAG_NUM_PREDICT` держать согласованными с фактическим KV **llama-chat** (сейчас `-c` не задаём — auto-fit; см. шпаргалку).
9. **Tool Router** (`profile companion-tool-router`): образ **`server`** (CPU), `--jinja`, `LLAMA_TOOL_ROUTER_NGL=0`.
10. **llama-chat:** **`--metrics`** в `stack2.yml`; **`LLAMA_CHAT_REASONING=off`** в `.env.stack2`, если UI не показывает CoT (companion фильтрует `reasoning_content`).
11. **Gemma 4 Canonical chat template** (live `.111:8080` `/props`, header *Published: 2026-07-09*): companion main SSE/JSON + trust/intent/workflow paths must send ``chat_template_kwargs.enable_thinking=false`` (opt-in ``EWA_COMPANION_CHAT_ENABLE_THINKING=1``) and ``reasoning_format=none`` unless thinking is enabled. Stream helper ``httpx_compat_chat_completion_stream`` forwards the same kwargs as non-stream. Caps include ``supports_object_arguments`` — never stringify tool ``arguments`` before the template.
12. **Qwen Tool Router** (`.141:8083`): Instruct template; ``EWA_COMPANION_TOOL_ROUTER_MAX_TOKENS`` default 384, hard clamp 64…1024 (do not silent-cap at 128). Embed/rerank GGUF on `:8081`/`:8082` are not chat FC endpoints. Operator verify: [EWA-COMPANION-STACK2-OPERATOR.md](../product/ewa/EWA-COMPANION-STACK2-OPERATOR.md) §Chat templates.

### Типовой прод-контур (2026-06 · .111/.141/.136)

| Роль | Хост | URL в stack0 |
|------|------|----------------|
| Chat 26B MoE interactive | `.111` prod-core, stack2 `llama-chat` (GPU, `-c 81920` / `--parallel 2` ≈40k/slot, KV `q8_0`) | `LLAMA_URL=http://stack2-llama-chat:8080` |
| Chat E4B vision | `.111` prod-core, профиль `e4b` (`gemma-4-E4B-it-UD-Q8_K_XL.gguf` + mmproj); **effective `n_ctx` ≈ 131072** (`n_ctx_train`); не задавать `-c` выше train — лишний VRAM без выигрыша | `LLAMA_URL` + vision paths в companion/desktop |
| Tool Router | `.141` gpu141 remote inference sidecar, same managed pod as embed/rerank | `EWA_COMPANION_TOOL_ROUTER_URL=http://192.168.1.141:8083` (or explicit fallback env) |
| Embed **0.6B** GGUF (Phase 2 live) | `.141` gpu141 host-net remote | `LLAMA_EMBEDDING_URL=http://192.168.1.141:8081`, `AI_EMBEDDINGS_DIMENSION=1024`, model `Qwen3-Embedding-0.6B-Q8_0.gguf` |
| Rerank **0.6B** GGUF (Phase 2 live) | `.141` gpu141 same remote compose | `RAG_RERANK_BASE_URL=http://192.168.1.141:8082`, model `qwen3-reranker-0.6b-q8_0.gguf` |

**Embed input budget (API, 2026-08-10):** remote embed defaults to **`LLAMA_EMBED_CTX=4096`**. Callers that reuse `chat_memory_service._get_embedding` / `_get_embeddings_batch` (Desktop episodic memory, chat RAG, companion episodic, marketing RAG) **clip** each input under that ctx with dense multilingual headroom (`~0.85` chars/token) and **do not retry** permanent `exceed_context_size` / HTTP 400 validation. Prefer raising `LLAMA_EMBED_CTX` on gpu141 only when VRAM allows — client clip remains mandatory. Turn ingest caps in `prepare_memory_record` stay under the same budget.

`.136` (**command-center**) remains the **build / Config Plane / Comfy** operator host. Phase 4 adds **`eliteew-llama-deep` on `:8080`** (dense 31B, mutex with Comfy on the same 3090) reached from stack0 via **`LLAMA_DEEP_URL`** — not a second interactive chat fleet and not compose DNS. Soft-retired apps historically hosted there (`EWPower`, `EWC`, DEWA, logwatch trees) — в `trash/`, не living runtime.

После правок compose/env на `.141`: `podman-compose -f /home/owned/llama-remote/stack2-llama-remote-embed-rerank.yml --env-file /home/owned/llama-remote/.env.llama-remote up -d --remove-orphans`; затем на `.111` recreate `stack0-backend`.

Local fallback: если `.141` недоступен, временно включить `local-stack2-embed-rerank` на `.111` или `.136`, остановив remote endpoints и сменив `LLAMA_EMBEDDING_URL` / `RAG_RERANK_BASE_URL` ровно на один контур.

Command-center checks:

```bash
bash docker/scripts/eliteew-migration-command-center.sh smoke
bash docker/scripts/eliteew-migration-command-center.sh install-unit gpu141-llm
```

## Что сейчас зафиксировано в репозитории

- Chat-модель (typical): `Qwen3-4B-Instruct-2507-Q4_K_M.gguf` ([unsloth/Qwen3-4B-Instruct-2507-GGUF](https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF)); старые билды «Qwen3-4B» без суффикса **2507** часто дают **~40k** `n_ctx_train` в GGUF.
- Embedding-модель (**live Phase 2 на gpu141**): **`Qwen3-Embedding-0.6B-Q8_0.gguf`** → **`AI_EMBEDDINGS_DIMENSION=1024`**. Legacy heavier classes (4B→2560, 8B→4096) remain documented above for rollback / TEI paths only — **not** prod baseline.
- Rerank-модель (**live Phase 2**): **`qwen3-reranker-0.6b-q8_0.gguf`** on `:8082` (8B rerank retired from baseline).
- Размерность эмбеддингов (**live**): **`1024`** в `AI_EMBEDDINGS_DIMENSION` (legacy 4B MRL **2560** / 8B **4096** — only with matching model + full Qdrant reindex)
- После cutover dim: one-shot refill ops script **`docker/scripts/eliteew-phase2-qdrant-refill.py`** (run inside stack0 API; see [LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md](LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md) Phase 2). Do **not** use `extract_memory_cell_from_chat` for refill — it hard-deletes the source chat.

Если меняется embedding-модель, нужно обновить одновременно:

- `docker/env_file/.env.stack2`
- `docker/env_file/.env.stack0.backend`
- `shared/api/migrations/` — провайдеры UGS (`generation_providers` / `ugs_settings`), например **`pending/20260514_ugs_remote_llama_embed_rerank_urls_qwen3_8b.sql`** (LAN embed/rerank + 8B basename после локального 4B)
- `product/marketing/MARKETING-PROJECT-RAG.md`
- этот документ

## Smoke-проверка

Перед `compose up`, если сети ещё не созданы: `bash docker/scripts/networks-create.sh` (или вручную `podman network create ew_net_4532`, `ew_net_2847`). Иначе Compose может выдать `refers to undefined network ew_net_4532`.

Из корня монорепозитория:

```bash
bash docker/scripts/stack2-llm-smoke.sh
```

Скрипт проверяет:

- `GET /health` для chat/embed/rerank;
- chat completion через `LLAMA_URL`;
- embeddings через `LLAMA_EMBEDDING_URL` с проверкой `AI_EMBEDDINGS_DIMENSION`;
- rerank через `RAG_RERANK_BASE_URL`.

При необходимости можно подменить env-файлы:

```bash
STACK2_ENV=docker/env_file/.env.stack2 \
STACK0_ENV=docker/env_file/.env.stack0.backend \
bash docker/scripts/stack2-llm-smoke.sh
```

## Связанные файлы

- `docker/stack/stack2.yml`
- `docker/stack/stack2-llama-remote-embed-rerank.yml`
- `docker/env_file/.env.stack2`
- `docker/env_file/.env.llama-remote.example`
- `docker/env_file/.env.stack0.backend`
- `shared/api/core/unified_config.py`
- `product/marketing/MARKETING-PROJECT-RAG.md`
