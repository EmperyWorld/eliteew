# Stack0 backend images

Дата: 2026-08-04 (dependency unification Wave P0)

## Summary

Backend stack0 uses **один multi-target Dockerfile** в **`docker/builders/stack0-api/Dockerfile`** (контекст сборки тот же каталог).

## OS packages

Image builds install RPMs only from the official Fedora tree at `https://dl.fedoraproject.org`. That host serves the files itself. `download.fedoraproject.org` is MirrorManager and redirects to volunteer mirrors, so it is not used.

`docker/builders/stack0-api/fedora-dnf-official-repos.sh` disables `metalink=`, sets `countme=0`, and sets `baseurl=` to `dl.fedoraproject.org` before every `dnf` that starts from a fresh Fedora image: base `Dockerfile` stages `builder-base` and `runtime-base`, the frontend base image, and the thin `Dockerfile.prod-baked` API layer (so an older base image cannot keep metalink). Inside those images the script also installs `/usr/local/bin/dnf`, which prints `DNF_FETCH_HOSTS` and exits non-zero if a package or repodata URL is not `dl.fedoraproject.org`. `fedora-cisco-openh264` is disabled for these builds. Backend, frontend-base, and thin prod-baked builds pass `--jobs $(nproc)`. Backend stages also set `BUILD_JOBS=$(nproc)` for `make`/`cmake`. Layers produced while metalink was active are not reused: rebuild those images with `STACK0_BUILD_NO_CACHE=1`.

Таргеты и роли Docker Compose:

| Target | Compose service | Переменная образа (пример) |
|--------|-----------------|-----------------------------|
| `api` | `eliteew-api-prod` | `STACK0_API_IMAGE` |
| `queue-worker` (алиас `api-worker`) | `eliteew-api-worker-prod` | `STACK0_QUEUE_WORKER_IMAGE` (fallback на `STACK0_API_WORKER_IMAGE`, затем `STACK0_API_IMAGE`) |
| `site-studio-worker` | `eliteew-site-studio-worker-prod` (profile **`site-studio-worker`**, **временно** выкл. по умолчанию) | `STACK0_SITE_STUDIO_WORKER_IMAGE` |
| `celery-worker` | `eliteew-celery-worker-prod` | `STACK0_CELERY_WORKER_IMAGE` |
| `celery-beat` | `eliteew-celery-beat-prod` | `STACK0_CELERY_BEAT_IMAGE` |

Отдельная очередь RabbitMQ **`site_studio`**: общий worker по умолчанию слушает только `ai_generation`, `document_processing`, `notifications` (`QUEUE_WORKER_GENERAL_KEYS`). Site Studio — **`eliteew-site-studio-worker-prod`** (только эта очередь); сервис **временно не стартует** без `--profile site-studio-worker` (см. **`documentation/product/SITE-STUDIO.md`** § «Временная пауза»).

**Политика docker.sock (Site Studio):** монтировать **`/var/run/docker.sock` в этот сервис нельзя** «для удобства» — это доступ к Docker API на хосте от имени группы docker (фактически root). В compose **socket не проброшен**; разрешение возможно только после отдельного threat-model и явной записи в операторском runbook. Если у вас в локальном compose socket всё ещё включён — **удалите volume** и перейдите на сценарий без сокета (образы `SITE_STUDIO_OLENTI_*`, remote docker и т.д.). Хостовый **`docker` CLI** остаётся **read-only** в контейнере для сценариев, где достаточно бинаря без сокета.

## Build integrity gates (Phase 1, 2026-07-04)

Before any stack0 backend or prod-baked export, the build pipeline enforces three hard gates:

| Gate | When | Failure |
|------|------|---------|
| **Lock-sync** | Start of `build-stack0-backend-images.sh` and `build-stack0-prod-baked-images.sh` (always; **not** skipped by `STACK0_PROD_BAKED_SKIP_BASE_IMAGES=1`) | `[ERROR] Dependency Mismatch: <file>.lock is stale. Run 'uv pip compile' first.` |
| **Import probe** | After base `docker build` (api + queue-worker + celery) and after prod-baked backend thin layers | Missing `bcrypt` / `jwt` / **`greenlet`** / `sqlalchemy.ext.asyncio`, or playwright surface mismatch (absent on API/celery, present on queue-worker) |
| **Base lock stamp** | Base targets `api` / `celery-*` get `ENV`+`LABEL` `BUILD_LOCK_HASH` (= sha256 of `api.lock`) | Thin bake with `SKIP_BASE=1` auto-enables `--rebuild-base` when base hash is missing/unknown/drifts vs tree, or when greenlet import fails on base |
| **Traceability metadata** | Prod-baked Dockerfile build args → `ENV` + `LABEL` on exported images | `BUILD_GIT_SHA`, `BUILD_LOCK_HASH` (sha256 of `api.lock`), `BUILD_QUEUE_WORKER_LOCK_HASH` |

**Thin bake invariant:** `Dockerfile.prod-baked` only `COPY`s code onto `eliteew-*:v3`. Python deps change → **must** rebuild base (`--rebuild-base` or auto-enable above). Do **not** ship `*-with-greenlet` commit-layer hotfixes.

Helpers: `docker/scripts/stack0-backend-lock-integrity.sh`, `docker/scripts/stack0-backend-import-probe.sh`.

Regression (command-center):

```bash
bash docker/scripts/verify-stack0-build-integrity-gate.sh --lock-fresh
bash docker/scripts/verify-stack0-build-integrity-gate.sh --stale-lock-negative
bash docker/scripts/verify-stack0-build-integrity-gate.sh --import-negative
bash docker/scripts/verify-stack0-build-integrity-gate.sh --import-live
bash docker/scripts/verify-stack0-build-integrity-gate.sh --metadata eliteew-api:prod-baked-YYYYMMDD-HHMM
```

Post-mortem on a running container: `podman inspect -f '{{index .Config.Labels "org.eliteew.build.git_sha"}}' IMAGE` or `podman exec … printenv BUILD_LOCK_HASH`.

## Build commands

Из корня репозитория:

```bash
# Все таргеты (теги из docker/env_file/.env.stack0.backend)
bash docker/scripts/build-stack0-backend-images.sh

# Только HTTP tier `api`
bash docker/scripts/build-stack0-api-image.sh
# Явный таргет / сеть при необходимости:
STACK0_DOCKER_BUILD_TARGET=api DOCKER_BUILD_NETWORK=host bash docker/scripts/build-stack0-api-image.sh
```

Тестовый immutable-контейнер (без bind-mount `shared/api`):

```bash
# Build + run pytest в отдельном test-runner контейнере
bash docker/scripts/run-stack0-api-tests.sh

# Пример focused pytest
bash docker/scripts/run-stack0-api-tests.sh tests/test_ewa_companion_persona_config.py -q
```

Compose для test-runner: **`docker/stack/stack0_test.yml`**.
Dockerfile test-runner: **`docker/builders/stack0-api/Dockerfile.test-runner`** (build context: monorepo root (`shared/api`)).

Ручная сборка:

```bash
docker build -f docker/builders/stack0-api/Dockerfile --target api -t eliteew-api:v2 docker/builders/stack0-api
docker build -f docker/builders/stack0-api/Dockerfile --target queue-worker -t eliteew-queue-worker:v2 docker/builders/stack0-api
docker build -f docker/builders/stack0-api/Dockerfile --target site-studio-worker -t eliteew-site-studio-worker:v2 docker/builders/stack0-api
docker build -f docker/builders/stack0-api/Dockerfile --target celery-worker -t eliteew-celery-worker:v2 docker/builders/stack0-api
docker build -f docker/builders/stack0-api/Dockerfile --target celery-beat -t eliteew-celery-beat:v2 docker/builders/stack0-api
```

## Dependency policy (2026-06-19)

Per-target venv layers — **не один fat GPU образ на все роли**:

| Stage / target | Venv source | CUDA PyTorch |
|----------------|-------------|--------------|
| `api`, `celery-beat` | `deps-api` ← `api.in` | нет |
| `queue-worker` | `deps-api` + `queue-worker.in` (selenium, **playwright**) | нет |
| `celery-worker` | `deps-api` ← `api.in` (same venv as api) | нет |
| `site-studio-worker` | `deps-site-studio-worker` | нет |

Локальный Whisper / sentence-transformers / CUDA wheels **не** входят в prod stack0 API/workers. STT/TTS/embed — stack9 / stack2 / gpu141 по HTTP. Опциональный dev-рецепт GPU: **soft-retired under `trash/` (stack0-build-legacy)** (каталог `trash/` в `.gitignore`).

- Базовый образ **Fedora 44** с digest в Dockerfile.
- Входные `.in`: `docker/builders/stack0-api/requirements/*.in`; caps **`constraints.txt`** (GPU / legacy ML caps — **`constraints-gpu.txt`**, только optional dev).
- Замки per-target (install truth): **`api.lock`**, **`queue-worker.lock`**, **`site-studio-worker.lock`**. Celery targets **не** имеют отдельных lock-файлов — Dockerfile копирует `deps-api`.
- Host IDE venv: `bash scripts/eliteew/sync-host-api-venv.sh` (см. [TESTING-STRATEGY.md](../TESTING-STRATEGY.md) §Host venv).

Перегенерация локов:

```bash
bash docker/builders/stack0-api/scripts/recompile-locks.sh
```

Ручной эквивалент:

```bash
cd docker/builders/stack0-api
CTX="$PWD"
uv pip compile "$CTX/requirements/api.in" -o "$CTX/requirements/locks/api.lock" --python-version 3.14 -c "$CTX/constraints.txt"
uv pip compile "$CTX/requirements/queue-worker.in" -o "$CTX/requirements/locks/queue-worker.lock" --python-version 3.14 -c "$CTX/constraints.txt" -c "$CTX/requirements/locks/api.lock"
uv pip compile "$CTX/requirements/site-studio-worker.in" -o "$CTX/requirements/locks/site-studio-worker.lock" --python-version 3.14 -c "$CTX/constraints.txt"
```

## Runtime surface

- **Observability:** structured logs (`structlog`) + container logs; **no Sentry** (`sentry-sdk` removed from backend venv, `SENTRY_*` env retired).
- **`runtime-base`** — минимальный Python runtime, Postgres client libs, скрипт `start_all.sh`, smoke для queue-worker boot.
- **`runtime-docs-browser`** — медиа/OCR-пакеты (ffmpeg, tesseract, …): **`api`** и **`queue-worker`**.
- **`api` OpenSSH client** — Air enroll create/reveal execs `ssh` in the API process. Install `openssh-clients` on `Dockerfile` target `api` **and** on thin `Dockerfile.prod-baked` `api-baked` (fail closed: `test -x /usr/bin/ssh`, no `--skip-unavailable`). Line A default `SKIP_BASE=1` does not rebuild `eliteew-api:v3`, so a base-only install never reaches `stack0-eliteew-api-prod-baked`. Smoke after bake: `podman exec stack0-eliteew-api-prod-baked command -v ssh`. Post-build lock: `stack0_backend_probe_api_openssh_client` in `docker/scripts/stack0-backend-import-probe.sh` (base API + prod-baked API). Do not mount host `ssh` or persist the Air private key as a file (Config Plane env only).
- **Playwright/Chromium** — только **`queue-worker`** (`playwright install chromium` + HTTP sidecar `:8095`). **`api`** venv **без** playwright; EWRP PDF вызывает sidecar по `BROWSER_RENDER_SERVICE_URL`.
- **`celery-worker` / `celery-beat`** — от **`runtime-base`**, без Playwright/Chromium/GPU слоя; **`celery-worker`** включает **`ffmpeg`** (ACE v4 long-form stitch / Music Forge audio на Celery UGS path).
- **`site-studio-worker`** — от **`runtime-base`**, лёгкий venv под `docker compose`; **бинарь `docker` и cli-plugins — read-only**. **`/var/run/docker.sock` не монтируется** (см. выше). **`XDG_CONFIG_HOME=/var/lib/eliteew/xdg-config`** (uid 1000) so the Podman client does not `stat` Carrier `HOME=/home/owned/.config`. The dir is created in **both** `Dockerfile` (`site-studio-worker`) **and** thin `Dockerfile.prod-baked` (`site-studio-worker-baked`): Line A default `SKIP_BASE=1` does not rebuild `v3`, so a base-only mkdir never reaches prod. Fail closed if that dir is missing or not writable (no `/tmp`). Do not bind host `~/.config`. Smoke after bake: `ls -ld /var/lib/eliteew/xdg-config` (uid 1000). `podman info` alone is not proof — remote socket can succeed without a writable XDG dir.

### Browser render sidecar (queue-worker)

| Item | Value |
|------|--------|
| Host | `stack0-eliteew-api-worker-prod` (baked container: `…-prod-baked`; **DNS alias** `stack0-eliteew-api-worker-prod` on shared networks in `stack0_b.yml`) |
| Port | `8095` (`BROWSER_RENDER_SIDECAR_PORT`) |
| Entrypoint | `start_queue_worker.sh` (baked image CMD; prod-baked override sets `command` explicitly) |
| Health | `GET /health` |
| Render | `POST /v1/render/html-slides` — paths under `/app/generated_files` |
| API env | `BROWSER_RENDER_SERVICE_URL=http://<worker>:8095`; fallback host `BROWSER_RENDER_WORKER_HOST` (baked default: `…-prod-baked`) |
### Science stack sidecar (queue-worker)

| Item | Value |
|------|--------|
| Host | `stack0-eliteew-api-worker-prod` (baked container: `…-prod-baked`; same DNS alias as browser sidecar) |
| Port | `8096` (`SCIENCE_STACK_SIDECAR_PORT`) |
| Health | `GET /health` |
| Endpoints | `POST /v1/science/semantic-analyze`, `POST /v1/science/merge-wav-chunks` |
| API env | `SCIENCE_STACK_SERVICE_URL=http://<worker>:8096`; fallback host `SCIENCE_STACK_WORKER_HOST` (baked default: `…-prod-baked`) |
| Heavy deps | `numpy`, `scipy`, `pandas`, `scikit-learn`, `opencv-python`, `matplotlib`, `seaborn` — **queue-worker.in only** |

**Note:** `api.lock` may still list **`numpy`** transitively via `qdrant-client` / `soundfile` — not a direct science-stack pin. Follow-up if zero numpy in API venv is required.

**Auth floor:** Wave 2 removed **`passlib`**; **`bcrypt`** remains a direct pin in **`base.in`** (`user_password.py` hashes via bcrypt, not passlib).

## Prod-core deploy (Wave 3 backend, command-center → `.111`)

After lock or sidecar changes on **command-center `.136`**:

```bash
# Recompile locks when base.in / api.in change (see Re-locking above)
eeprodbaked --yes --backend-only --rebuild-base
```

**Baked tag** is timestamped (`prod-baked-YYYYMMDD-HHMM`). **Rollback snapshot** is saved under `docker/tmp/prod-baked-images/<tag>/stack0-env-before-backend.env` before recreate.

**Prod-baked worker:** `stack0_b.prod-baked.override.yml` sets `command: start_queue_worker.sh` so browser (`:8095`) and science (`:8096`) sidecars start with the queue consumer. Do **not** bind-mount the script from `.111` — it is baked in `eliteew-queue-worker:v3`.

**Verified prod-core (2026-07-04):** `prod-baked-20260704-2003` — API health `:29000`, sidecars reachable from API pod, `playwright` absent in API venv.

**Deploy success (baked backend/all):** `eeprodbaked` Step 4 runs **liveness** (`prod_core_deploy_smoke_stack0`) then **contract** (`prod_core_deploy_smoke_stack0_contract`), then **external user-path** (`prod_core_deploy_verify_public_user_path` from command-center + `prod_core_deploy_verify_single_upstream` on prod-core). Contract failure triggers env rollback (default `ROLLBACK_ON_SMOKE_FAIL=1`). Contract verifies: API `bcrypt` + no `playwright`, queue-worker container up, sidecar DNS from API pod, `:8095`/`:8096` health via curl from API pod.

**External user-path gate (2026-07-04):** catches DNS split-brain and broken public Socket.IO after backend recreate — not visible to in-container smoke alone.

```bash
# command-center or prod-core
bash docker/scripts/verify-stack0-user-path-gate.sh --all
bash docker/scripts/verify-stack0-user-path-gate.sh --public    # edge only
bash docker/scripts/verify-stack0-user-path-gate.sh --upstream  # prod-core DNS only
```

Checks: `https://app.eliteew.ru/api/health` (200), Engine.IO polling `sid`, frontend `getent hosts eliteew-api-prod` resolves only IPs belonging to the live API container (ghost/stale records outside the container fail; multi-network may return >1 live IP). After backend recreate, deploy runs `fix-prod-core-baked-frontend-nginx.sh` before external gate. `eliteew-stack0-baked-deploy.sh` Step **2d** rsyncs deploy scripts (including this gate) to prod-core before recreate.

## Smoke checks

Three-layer map (compose vs Dockerfile vs deploy scripts): **[STACK0-HEALTHCHECK-LAYERS.md](STACK0-HEALTHCHECK-LAYERS.md)**.

Prod-core baked runtime — **automated in deploy** via `prod_core_deploy_smoke_stack0_contract()` + external user-path gate; manual replay:

```bash
bash docker/scripts/verify-stack0-deploy-contract-gate.sh --live
bash docker/scripts/verify-stack0-deploy-contract-gate.sh --negative-dns   # regression: must fail
bash docker/scripts/verify-stack0-user-path-gate.sh --all                   # public edge + single upstream
```

Manual probes (same checks as contract gate):

```bash
ssh prod-core 'curl -sf http://127.0.0.1:29000/api/health'
ssh prod-core 'podman exec stack0-eliteew-api-prod-baked curl -sf http://127.0.0.1:8000/api/health'
# Wave 3 sidecars (from API pod — prod-baked worker DNS)
ssh prod-core 'podman exec stack0-eliteew-api-prod-baked getent hosts stack0-eliteew-api-worker-prod'
ssh prod-core 'podman exec stack0-eliteew-api-prod-baked curl -sf http://stack0-eliteew-api-worker-prod:8095/health'
ssh prod-core 'podman exec stack0-eliteew-api-prod-baked curl -sf http://stack0-eliteew-api-worker-prod-baked:8095/health'
ssh prod-core 'podman exec stack0-eliteew-api-prod-baked curl -sf http://stack0-eliteew-api-worker-prod-baked:8096/health'
ssh prod-core 'podman exec stack0-eliteew-api-prod-baked python -c "import importlib.util; assert importlib.util.find_spec(\"playwright\") is None"'
```

Legacy/dev bind-mount runtime:

```bash
docker compose -f docker/stack/stack0_b.yml --env-file docker/env_file/.env.stack0.backend config --quiet
docker exec stack0-eliteew-api-prod curl -sf http://127.0.0.1:8000/health
docker exec stack0-eliteew-api-worker-prod python /app/smoke/smoke_queue_worker_boot.py
docker exec stack0-eliteew-site-studio-worker-prod python /app/smoke/smoke_queue_worker_boot.py
```

Логи: см. **`project-and-deploy.mdc`** (`docker/logs/stack0/...`).

## SELinux (Fedora / RHEL) и `security_opt: label=disable`

Томам в `stack0_b.yml` задан суффикс **`:z`** на bind-mount (общий контекст для контейнеров). Если контейнер падает с **Permission denied** на том:

1. Проверьте **UID/GID** сервиса (`STACK0_USER`) и владельца каталогов на хосте.
2. Уточните, нужен ли **`:Z`** вместо **`:z`** для приватного контекста тома (не смешивать без понимания — `:Z` может «отрезать» доступ другим контейнерам).
3. **`security_opt: ["label=disable"]`** не добавлять без согласования и записи в этот документ / worklog: это отключает SELinux для контейнера и расширяет blast radius.

## NVIDIA / GPU devices в stack0

| Сервис | GPU device | Заметка |
|--------|------------|---------|
| `eliteew-api-prod` | **нет** | CPU venv; LLM/STT remote |
| `eliteew-api-worker-prod` | **нет** | UGS/STT через HTTP |
| `eliteew-site-studio-worker-prod` | нет | |
| `eliteew-celery-worker-prod` | нет | |
| `eliteew-celery-beat-prod` | нет | |

GPU inference: **stack2** (llama на prod-core), **stack9** (voice), **gpu141** (embed/rerank/tool-router).

## Prod-baked images (prod-core migration)

Immutable runtime без bind-mount `shared/api` и `dist-build`: тонкий слой COPY поверх уже собранных base images (venv-кэш не сбрасывается). В **api-baked** также COPY `documentation/product/handbook-kb-articles` → `/app/documentation/product/handbook-kb-articles` (Product Assistant KB; на `.111` каталог `documentation/` на диске не нужен). В корневом `.dockerignore` для этого каталога — negation-паттерны (`!documentation/product/handbook-kb-articles/**`); иначе `podman build` падает на COPY. Новые теги и `container_name` (`*-prod-baked`) — текущий `stack0-*-prod` на command-center local tags не перезаписывается.

**Важно:** скрипт сборки **не** делает `source .env.stack0.backend` (в файле часто `HOME=/tmp`, и podman теряет локальные образы). Читаются только нужные `STACK0_*_IMAGE` через grep.

```bash
# Только на command-center (.136) — не на prod-core
STACK0_PROD_BAKED_TAG=prod-baked-YYYYMMDD bash docker/scripts/build-stack0-prod-baked-images.sh
bash docker/scripts/export-stack0-prod-baked-images.sh prod-core
bash docker/scripts/sync-prod-core-deploy-tree.sh prod-core
```

На **prod-core** допустимы только `podman load` и `compose up` с `*.prod-baked.override.yml` — см. **`eeprodbaked`**.

Compose override: `docker/stack/stack0_b.prod-baked.override.yml`, `stack0_f.prod-baked.override.yml`. Пример env: `docker/env_file/.env.stack0.backend.prod-baked.example`. Полный runbook: **`PROD-CORE-MIGRATION-BAKED-IMAGES.md`**.

## Rollback

Указать для всех `STACK0_*_IMAGE` один и тот же legacy-тег образа **`api`** и пересоздать сервисы. Для временного восстановления синхронного Site Studio без отдельного worker и без RabbitMQ задач см. переменную **`ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK`** (не для прод образа без Docker).

Откат prod-baked cutover: поднять старый compose **без** `*.prod-baked.override.yml` на command-center; образы `stack0-*-prod` не удалялись при сборке baked.
