# Образы API EliteEW (stack0)

- **Dockerfile** — multi-stage на `fedora:44` с digest. Контекст: **`docker/builders/stack0-api`**. По умолчанию `docker build … --target production` собирает тот же runtime, что и **`api`**.
- **Dockerfile.test-runner** — отдельный immutable test-runner (base image = `${STACK0_API_IMAGE}`, код копируется из контекста `shared/api`, без bind-mount `/app/api`).
- **Targets:** `api`, `queue-worker` (алиас **`api-worker`**), **`site-studio-worker`**, `celery-worker`, `celery-beat`. Слои: `builder-base`, per-target **`deps-*`**, **`runtime-base`**; документный/Chromium-слой — **`runtime-docs-browser`** для `api` и `queue-worker` (не для slim Celery/`site-studio-worker`).
- **Python deps:** per-target `requirements/*.in` + `constraints.txt` + `requirements/locks/{api,queue-worker,site-studio-worker}.lock`; **`api`** = CPU-only (no CUDA torch). **`queue-worker`** = api + science/browser stack. Celery targets reuse **`deps-api`**. Re-lock: `scripts/recompile-locks.sh`. Host venv: `scripts/eliteew/sync-host-api-venv.sh`.
- **Старт API:** `scripts/start_all.sh` — кеши в `/tmp`, проверки, **`uvicorn api.main:app`** (workers=1 для Socket.IO).
- **Compose / образы:** `docker/stack/stack0_b.yml` — см. переменные `STACK0_API_IMAGE`, `STACK0_QUEUE_WORKER_IMAGE`, `STACK0_SITE_STUDIO_WORKER_IMAGE`, Celery-образы (см. **`STACK0-BACKEND-IMAGES.md`**).
- **Тесты в контейнере:** `docker/stack/stack0_test.yml` + `docker/scripts/run-stack0-api-tests.sh`.

Точка входа приложения: **`shared/api/main.py`**; lifespan — **`shared/api/core/startup.py`**.

Подробнее: **`platform/docker-re_doc/STACK0-API-STARTUP.md`**.
