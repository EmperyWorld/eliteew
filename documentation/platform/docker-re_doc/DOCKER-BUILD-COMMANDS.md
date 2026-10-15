## EliteEW container image builds (Fedora 44 host · Podman-first)

Все команды предполагают запуск из корня репозитория
`<repo>`.

Runtime default is **Podman** (paths under `docker/` are historical layout names — **not** a Docker daemon requirement). Build images on **command-center `.136`**; never rebake on prod-core `.111`.

Общие правила:

- Хост: Fedora 44 (SELinux enforcing; volume labels in compose use `:z` where required).
- Логи **только в stdout/stderr** – сбор логов управляется через `logging: json-file` в `stack*.yml`.
- Безопасность (rename команд Redis, ограничения прав и т.п.) настраивается в compose/конфигах, а не в образах.

---

### 1. API backend (eliteew-api)

Все сборки API перенесены в **docker/builders/stack0-api/**.

**Рекомендуемые сборки**

```bash
bash docker/scripts/build-stack0-api-image.sh            # только target api (см. STACK0_DOCKER_BUILD_TARGET)
bash docker/scripts/build-stack0-backend-images.sh       # api + queue-worker + celery + site-studio-worker
```

Скрипт `build-stack0-api-image.sh` использует `docker/builders/stack0-api/Dockerfile` и контекст `docker/builders/stack0-api`.
Тег берётся из `STACK0_API_IMAGE` в `docker/env_file/.env.stack0.backend`. Сеть сборки задаётся `DOCKER_BUILD_NETWORK` (необязательно; например `host` для тяжёлых wheel).

В builder-стадии **uv** ставится из PyPI (`uv==0.11.0`), без образа `ghcr.io/astral-sh/uv` — чтобы сборка не зависела от доступности ghcr.io/DNS.

---

### 2. Redis (stack1)

Prod использует официальный образ **`redis:7.2.x-alpine`** из `docker/stack/stack1.yml` (пин в compose/env). Кастомный Redis Dockerfile **не** живой (the docker rar_docker tree (not living; do not recreate) отсутствует; soft-retire → `trash/`).

---

### 3. Audio / Voice (stack9) — compose retained

Контексты в **`docker/builders/`** (не resurrect stack9 на prod без явного ТЗ; документ сборки сохраняем):

- `docker/builders/stack9-cosyvoice3` (канонический TTS)
- `docker/builders/stack9-whisper-fast`, `stack9-f5-tts`, `stack9-qwen3-tts`, `stack9-silero` (legacy profiles; Silero = MIT `v5_cis_base_nostress` GPU)

Env-шаблон: `docker/env_file/.env.stack9.example` → `.env.stack9`.

Сборка через compose (из корня репо, обычно на **command-center**):

```bash
podman compose -f docker/stack/stack9.yml --env-file docker/env_file/.env.stack9 build
```

Или вручную:

```bash
podman build -f docker/builders/stack9-whisper-fast/Dockerfile -t ew_whisper_fast:large-v3 docker/builders/stack9-whisper-fast
podman build -f docker/builders/stack9-silero/Dockerfile -t ew_silero_tts:latest docker/builders/stack9-silero
podman build -f docker/builders/stack9-cosyvoice3/Dockerfile -t ew_cosyvoice3:0.5b-v1 docker/builders/stack9-cosyvoice3
```

**Prod-core VRAM note (2026-07-28 / updated 2026-07-30):** на одной 3090 рядом с llama (~20 GiB) CosyVoice3 не влезает. Рабочий голос-контур: **`legacy-whisper`** (`large-v3`) + **`legacy-silero`** (MIT **`v5_cis_base_nostress`** on CUDA, `:32001`, образ `ew_silero_tts:v5_cis`). Piper soft-retired. На prod-core держать `stack9-cosyvoice3` **stopped**.

**Autostart (prod-core `.111`):** `eliteew-podman-autostart.service` → `podman-autostart-prod-core.sh` → `docker/scripts/prod-core/start-stack9-voice.sh`. Ручной подъём:

```bash
bash docker/scripts/prod-core/start-stack9-voice.sh
```

**Disable (hang triage / VRAM+PSU):** create operator marker .disable-stack9-voice *[operator kill-switch marker under docker/env_file/; may be absent]* (not tracked in git; or set `ELITEEW_STACK9_VOICE_DISABLED=1`) — script exits 0 and skips compose up. Re-enable: remove marker (`bash scripts/eliteew/trash-move.sh .disable-stack9-voice kill-switch`), then re-run start script. Do not run whisper crash-loop beside `stack2-llama-chat` on the same 3090 until RAM/PSU checks clear.

Требует рабочий host NVIDIA (после BIOS: MOK enroll + `modprobe nvidia`). Host harden: `sudo bash docker/scripts/prod-core/harden-prod-core-host.sh`.

Voice-gateway / Live Voice TTS URL SSOT = `generation_providers.silero`; env `SILERO_SERVICE_URL=http://stack9-silero:8000` = fallback. CC-NC `v5_*_ru` не использовать на commercial prod (нужен отдельный EE deal или MIT CIS).

**STT model truth:** инференс всегда тот, что загружен в `stack9-whisper-fast` (`MODEL_SIZE` / `.env.stack9`). API `STTService` **не** переключает размер модели по полю `whisper_model` из UI/БД — это метаданные. Держать `user_live_voice_settings.whisper_model` / дефолты = `large-v3` в согласии с контейнером.

Не поднимать на prod-core рядом с llama+whisper: CosyVoice3 / F5 / Qwen3-TTS / Kokoro (VRAM). Piper — предпочтительный non-Silero TTS при дефиците VRAM.

---

### 4. Stack4 (OCRmyPDF, Tesseract)

Контексты в **`docker/builders/stack4-ocrmypdf`** и **`docker/builders/stack4-tesseract`**. Сборка через compose:

```bash
podman compose -f docker/stack/stack4.yml --env-file docker/env_file/.env.stack4 build
```

### 5. Frontend (stack0)

```bash
podman build -f docker/builders/stack0-frontend/Dockerfile -t eliteew-frontend-fedora:latest .
```

### 6. Дополнительно (на будущее)

Согласно плану Phase 2:

- **Fedora-базовые образы**: остальные внутренние сервисы (кроме Keycloak/Jitsi/Elasticsearch) можно постепенно переводить на Fedora 44 базу по аналогии с `Dockerfile.fedora` (builder/runtime, минимальный runtime, healthcheck, логи → stdout).
- **Ubuntu-базовые образы**: Keycloak, Jitsi, Elasticsearch – разумно оставить на официальных Ubuntu‑базовых образах, но при необходимости добавить тонкие Dockerfile’ы с дополнительной защитой (hardening) поверх них.

Когда решишь, какие именно сервисы следующим этапом переводить на свои образы,
можно будет добавить сюда конкретные команды сборки под них.

