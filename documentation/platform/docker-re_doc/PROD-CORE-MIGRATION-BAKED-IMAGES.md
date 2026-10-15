# Prod-core migration · baked stack0 images

Дата: 2026-06-12

## Summary

**Каноническая политика деплоя (stack0, stack2, stack4, stack6 Keycloak, gpu141 remote inference):**

| Где | Что делаем |
|-----|------------|
| **command-center `.136`** | `pnpm build` / `podman build` / `podman pull` → тег baked-образов → `podman save` |
| **prod-core `.111`** | `podman load` → `compose up --force-recreate` (**без** build/pull/rebake) |
| **gpu141 `.141`** | remote inference embed/rerank/tool-router через `start-gpu141-embed-rerank.sh`; stack0 workers не являются текущим prod baseline |

Единые entrypoints: **`bash docker/scripts/eliteew-deploy.sh release stack0 --all`** (stack0), **`eeprodruntime`** (stack2+stack4), **`bash docker/scripts/eliteew-deploy.sh release stack6 --all`** (Keycloak 26.7.1 + binding SPI; implementer `eeprodstack6.sh`; never bake on `.111`). Legacy shell name **`eedeploy`** → тот же `eliteew-deploy.sh` (в runbooks предпочитать полный путь). Устаревшие interactive menu / rebake-on-`.111` → `trash/`.

**Альтернатива для hotfix без rebake:** dev-bind line — NFS export с `.136`, bind на `.111`; см. [PROD-CORE-DEV-BIND-LINE.md](../PROD-CORE-DEV-BIND-LINE.md) и `eeprodline`. Линии **baked** и **dev-bind** взаимоисключающие на `29000/29001`.

Перенос **prod-core** на новый хост без rsync всего репозитория и **без bind-mount** `shared/api` / `dist-build`:

1. На **command-center** (`192.168.1.136`) собираются **новые теги** образов (`prod-baked-*`) — старые `stack0-*-prod` fallback не затрагиваются.
2. Образы **save → scp → load** на prod-core (SSH via LAN `192.168.1.111` / alias `prod-core`). Former 2.5G preferred path retired — [PRODUCTION-TOPOLOGY-STATE.md](../PRODUCTION-TOPOLOGY-STATE.md) §Current.
3. Минимальный **deploy-tree** (compose, prod-core ops scripts, `docker-entrypoint-csp.sh`, mutable data mounts, `host/comfyui`, `host/generated_files`, `site-templates`, `local/binaries`) — rsync выборочно. Полный `documentation/`, `shared/api` и SPA `dist-build` на `.111` не синхронизируются.
4. **stack1 / EWA Postgres** — отдельное копирование данных (bind-mount как сейчас).
5. На prod-core **stack2 только llama-chat** (live 2026-06-15: `gemma-4-26B.gguf`); embed/rerank/tool-router — **gpu141** (`192.168.1.141`).
6. После smoke — **reverse tunnel + edge cutover**; `.136` остаётся command-center build/env/`llama-deep` plane, а living ComfyUI работает на `.141`.

## Артефакты в репозитории

| Путь | Назначение |
|------|------------|
| `docker/builders/stack0-api/Dockerfile.prod-baked` | COPY `shared/api`, `shared/apps` → `/app/apps`, `dist-build`, `documentation/product/handbook-kb-articles` поверх base images |

**Line B note:** hotfix без rebake всё равно обязан sync'ить `shared/apps` → NFS `apps/` и bind `/app/apps` (см. [PROD-CORE-DEV-BIND-LINE.md](../PROD-CORE-DEV-BIND-LINE.md)); baked COPY не заменяет live overlay на line B.
| `docker/builders/stack0-frontend/Dockerfile.prod-baked` | COPY static + nginx templates в образ |
| `docker/scripts/build-stack0-prod-baked-images.sh` | Сборка всех baked targets |
| `docker/scripts/export-stack0-prod-baked-images.sh` | `podman save` / `ssh load` |
| `docker/scripts/eliteew-stack0-baked-deploy.sh` | **Command-center → prod-core:** local thin bake → export → recreate (без rebake на `.111`) |
| `docker/scripts/prod-core-deploy-lib.sh` | Env patch, recreate baked stack0, smoke/wait helpers |
| `docker/scripts/eliteew-deploy.sh` | Канон release/deploy (`eedeploy` = legacy alias) |
| `docker/scripts/sync-prod-core-deploy-tree.sh` | Минимальный rsync на `.111`: compose, prod-core ops scripts, `docker-entrypoint-csp.sh`, `host/comfyui`, `host/generated_files`, `site-templates/olenti` (**без** `node_modules`/`.git`/`dist`), `local/binaries`, voice json — **без** `shared/api`, SPA `dist-build`, полного `documentation/` |
| `stack0_b.prod-baked.override.yml` | Backend baked image policy; bind только mutable/ops (без `api`, `dist-build`, `documentation`) |
| `docker/stack/stack0_f.prod-baked.override.yml` | Frontend baked image policy, без bind `dist-build` |
| `docker/env_file/.env.stack0.backend.prod-baked.example` | Пример `STACK0_*_BAKED_*` |
| `docker/scripts/eliteew-migration-command-center.sh` | `.136` wrapper: baseline, acceptance, remote eectl, user-unit install |
| `docker/systemd/eliteew-podman-autostart.service` | `.111` user-level Podman autostart template |

См. также: [STACK0-BACKEND-IMAGES.md](STACK0-BACKEND-IMAGES.md), [EMPERY-EDGE-IP-OPERATIONS.md](EMPERY-EDGE-IP-OPERATIONS.md), [LAN-WORKERS-141.md](LAN-WORKERS-141.md), [STACK2-LLM-CONTRACT.md](../STACK2-LLM-CONTRACT.md).

## Операторский deploy (command-center → prod-core)

Рекомендуемый путь после правок API/SPA: **сборка на command-center `.136`** (legacy hostname «punisher»), экспорт tar на prod-core, recreate только контейнеров. На `.111` **нет** `pnpm build` / rebake образов.

```bash
# Канон release (агенты и операторский default) — только --all:
bash docker/scripts/eliteew-deploy.sh release stack0 --all
# non-interactive:
bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes

# Same-release FE OpenAPI types from current API tree (opt-in; before pnpm build):
bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --refresh-openapi-pilots

# Повтор export+recreate без локальной сборки (образы с тем же тегом уже есть) —
# только через тот же entrypoint с --all, не partial flags:
bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --skip-build --tag prod-baked-YYYYMMDD-HHMM
```

**Запрещено для агентов / default release path:** `--frontend-only`, `--backend-only`, прямой `eeprodbaked --frontend-only`. Только `eliteew-deploy.sh release stack0 --all`.

**`--refresh-openapi-pilots`:** перед `pnpm build` на `.136` экспортирует OpenAPI из **текущего** `shared/api` дерева (`stack0-refresh-openapi-pilots.sh`), обновляет lite pilots + `src/generated/*`, затем собирает SPA. Не ждёт live backend на `.111`. Несовместимо с `--skip-build` / `--skip-frontend-build`. После bake дерево может быть dirty на pilots — закоммитьте отдельно. Канон: [`FRONTEND-BACKEND-HTTP.md`](../../api/FRONTEND-BACKEND-HTTP.md) §Bake-time opt-in.

Переменные (опционально):

| Env | Назначение |
|-----|------------|
| `DEWA_OPS_PROD_CORE_SSH` | SSH alias хоста prod-core (default `prod-core`) |
| `DEWA_OPS_REMOTE_REPO` | Checkout path on prod-core. Override when that host is not the historical default. |
| `STACK0_PROD_BAKED_REMOTE_DIR` | Каталог tar на prod-core (default `…/docker/tmp/prod-baked-images`, не `/tmp`) |
| `STACK0_PROD_BAKED_BASE_MATCH_STRICT` | `1` (default): fail на digest mismatch base image `.136` vs `.111`; bypass: `--allow-base-drift` |
| `STACK0_PROD_BAKED_ROLLBACK_ON_SMOKE_FAIL` | `1` (default): rollback env snapshot + recreate при падении smoke |
| `STACK0_PROD_BAKED_RETAIN_IMAGES` | Сколько последних `prod-baked-*` тегов держать на `.111` для stack0 image repos (default `2`: текущий release + один rollback) |
| `STACK0_PROD_BAKED_REFRESH_OPENAPI_PILOTS` | `1` when `--refresh-openapi-pilots` — tree OpenAPI → pilots before SPA build |

Первый запуск на command-center без base images (`eliteew-api:v3`, …) автоматически включает **`--rebuild-base`** (долго, ~30–50 мин). Повторные деплои — thin COPY слои, быстро.

**Base drift (2026-09-26):** thin bake also auto-enables `--rebuild-base` when local `eliteew-api:v3` has no/unknown `BUILD_LOCK_HASH`, the hash ≠ current `api.lock` sha256, or `import greenlet; import sqlalchemy.ext.asyncio` fails on that base. Stack0 recreate retires named containers first and **fail-closes** on compose `name already in use` (same pattern as stack4) so celery cannot stay on a stale tag while the release reports success.

## Пошаговый конвейер и типовые блокеры

Полный цикл **`eliteew-stack0-baked-deploy.sh`** (алиас **`eeprodbaked`**) — четыре логических шага. На **prod-core `.111` активность начинается только с export** (шаг 2): до этого там нет `pnpm build`, `podman build` и recreate.

**Exclusive deploy lock (2026-07-23):** before step 1, `prod_core_deploy_acquire_baked_deploy_lock` takes flock on `docker/tmp/stack0-baked-deploy.lock` (+ `.meta` with pid/tag). A second concurrent `release` is **refused** by flock. Secondary refuse: orphan **`build-stack0-prod-baked-images.sh` / `export-stack0-prod-baked-images.sh`** PIDs (argv basename match; same process-group as the deployer is ignored). SIGINT/TERM releases the lock and `kill 0` the deploy process group (Cursor abort alone is not enough — do not start another release until orphans are gone / lock is free). Emergency steal: `--force-unlock`.

| Шаг | Где | Действие | Ожидаемое время |
|-----|-----|----------|-----------------|
| **1** | `.136` | optional `--refresh-openapi-pilots` → tree OpenAPI export + pilots; then `pnpm build:react-compiler` (если не `--skip-frontend-build`) | ~1–3 мин (+~30–60s pilots) |
| **1b** | `.136` | `build-stack0-prod-baked-images.sh` — thin COPY поверх base images (если не `--skip-build`) | ~10 с – 50 мин (base) |
| **2** | `.136` → `.111` | `export-stack0-prod-baked-images.sh` — `podman save`, scp, **SHA256 verify**, `podman load` | ~10–15 мин |
| **2c** | `.136` → `.111` | `eliteew-prod-core-env-push.sh` — runtime env в tmpfs (если не `--skip-env-push`) | секунды |
| **3** | `.111` | patch `STACK0_*_BAKED_*` в runtime env + retire named stack0 containers + `compose up --force-recreate` (fail-closed on name collision; assert celery/api image tags) | ~1–2 мин |
| **4** | `.111` | smoke **liveness** (`prod_core_deploy_smoke_stack0`) then **contract** (`prod_core_deploy_smoke_stack0_contract`: bcrypt/playwright venv, worker up, sidecar DNS, `:8095`/`:8096` from API pod); при fail — rollback snapshot + recreate | ~45 с |
| **4b** | `.111` | cleanup старых `prod-baked-*` (exclude images used by running/stopped containers), retention default `2` | секунды |

Логирование по шагам (EliteEW ops / ручной прогон; historical `DEWA/runtime/...` path retired with DEWA → `trash/`):

```bash
LOG=docker/logs/stack0/stack0-baked-deploy-$(date +%Y%m%d-%H%M%S).log
# каждый шаг: echo "=== STEP N … ===" | tee -a "$LOG"
```

**Deploy-tree перед первым recreate или после правок compose:** rsync `docker/stack/` и `docker/scripts/prod-core-deploy-lib.sh` на `.111` (см. `sync-prod-core-deploy-tree.sh`). Скрипт deploy **не** синхronizирует compose автоматически.

**Повтор recreate без rebuild/export** (образы с тем же тегом уже на `.111`, env не менялся):

```bash
# 1) sync исправленного compose/lib (если менялись)
rsync -avz docker/stack/ prod-core:~/powered_by_emperyworld/docker/stack/
rsync -avz docker/scripts/prod-core-deploy-lib.sh prod-core:~/powered_by_emperyworld/docker/scripts/

# 2) только recreate + smoke на .111 (через ssh или --skip-build --skip-env-push)
eeprodbaked --yes --all --skip-build --skip-frontend-build --skip-env-push \
  --tag prod-baked-YYYYMMDD-HHMM
```

> **Известный gap (2026-06-15):** `--skip-build` всё ещё вызывает export (шаг 2). Для экономии ~10 мин при уже загруженных образах — recreate вручную через `prod_core_deploy_recreate_stack0_baked` на `.111` или дождаться флага `--skip-export` в скрипте.

### Успешный прогон 2026-06-15

| Поле | Значение |
|------|----------|
| Тег | `prod-baked-20260615-2154` |
| Deploy id | `1781523859870-h7h5hxb9ym` |
| Лог | historical `DEWA/runtime/deploy-logs/...` (tree soft-retired → `trash/`); living logs under `docker/logs/stack0/` |
| Session summary | worklog session-summaries retired → `trash/` (chronology via `git log` / chat) |

### Блокеры на command-center (до export)

Исправлены в тот же день; без них шаги 1–2 не проходят. Rows about DEWA UI/missions below are **historical** (DEWA soft-retired → `trash/`) — not living ops.

| Симптом | Причина | Решение |
|---------|---------|---------|
| (historical) DEWA «Миссии» `f.filter is not a function` | Коллизия React Query key для operation recommendations | Was in retired `DEWA/frontend`; N/A for living EliteEW deploy |
| (historical) DEWA ops `pnpm: command not found` | PATH без nvm in retired DEWA dispatch | Living path: `eliteew-deploy.sh` / shell with nvm; `eliteew-ops-lib.sh` helpers remain under `docker/scripts/` |
| `frontend-build-deploy` «успех» за ~16 ms | `confirm \|\| exit 0` без TTY | `confirm \|\| exit 1`; wrapper с `--yes` |
| `podman build` exit 125 на COPY handbook | `.dockerignore` исключал `documentation/` | Negation `!documentation/product/handbook-kb-articles/**` |
| Vite/Rolldown parse error в `UnifiedAdminPage` | CSV `.replace(/"/g, '""')` + React Compiler | `src/utils/csvEscapeField.ts` |
| `STACK0_FRONTEND_BASE_IMAGE: unbound variable` | `resolve_stack0_base_images` после использования | Вызов перенесён выше в `build-stack0-prod-baked-images.sh` |

### Блокеры на prod-core (шаг 3 — recreate)

После export образы на `.111` уже есть; падение на recreate **не откатывает load**, но может **снять backend-контейнеры** до успешного повторного `up`. Оператор: не паниковать — повторить recreate после фикса compose/env.

**Среда:** prod-core использует **`podman-compose` 1.5.0** (external compose provider), не только native `podman compose`.

| # | Ошибка | Причина | Решение |
|---|--------|---------|---------|
| 1 | `ValueError: could not parse mount … ${SITE_STUDIO_PODMAN_UID:-1000}` | podman-compose не понимает bash-default `${VAR:-default}` в volume | В `stack0_b.yml` — `${SITE_STUDIO_PODMAN_UID}` без `:-1000`; значение по умолчанию — в env |
| 2 | `Env file at …/docker/env_file/.env.stack0.backend does not exist` | Config Plane: секреты только в `$XDG_RUNTIME_DIR/eliteew/env-runtime/`; compose `env_file:` в YAML указывает legacy путь | `prod_core_deploy_ensure_legacy_env_file_symlink()` — symlink legacy → runtime tmpfs перед recreate |
| 3 | `statfs /run/user/${SITE_STUDIO_PODMAN_UID}/podman/podman.sock: no such file` | podman-compose **не подставляет** `${SITE_STUDIO_PODMAN_UID}` в пути mount, даже если ключ есть в `--env-file` | В `stack0_b.prod-baked.override.yml` — **literal** `/run/user/1000/podman/podman.sock` (rootless uid на `.111` = 1000) |
| 4 | — | `SITE_STUDIO_PODMAN_UID` отсутствовал в runtime env | `prod_core_deploy_ensure_site_studio_podman_uid()` дописывает `SITE_STUDIO_PODMAN_UID=$(id -u)` |
| 5 | `short-name resolution enforced but cannot prompt without a TTY` + containers removed | (a) export читал **stale** `STACK0_*_BAKED_IMAGE` из staging env вместо CLI tag; (b) `podman load` хранит `localhost/<name>:<tag>`, а compose env — `<name>:<tag>` без dual-tag | `export-stack0-prod-baked-images.sh` resolves images from **CLI `BAKED_TAG`** (+ dual-tag after load); `prod_core_deploy_ensure_baked_image_short_tags` before recreate |
| 6 | Thin bake / API image tagged with **previous** release tag while deploy uses new `BAKED_TAG` | leftover `STACK0_*_BAKED_IMAGE` in agent shell | `eeprodbaked` **unsets** stale image env; `build-stack0-prod-baked-images.sh` **always** derives names from `BAKED_TAG` |
| 7 | SOPS decrypt fails: age identity under `/tmp/.config/sops/…` | shell leaked `HOME=/tmp` | `eeprodbaked` restores host `HOME` when `USER` home exists; do not env-push with `HOME=/tmp` |
| 8 | `--refresh-openapi-pilots` + `--skip-frontend-build` | refresh must run before SPA build | refuse — use full `--all` without skip-frontend |

Общий helper перед recreate: **`prod_core_deploy_prepare_stack0_compose_env`** в `docker/scripts/prod-core-deploy-lib.sh` (symlink + uid + short-tag ensure).

**Проверка после успешного deploy:**

```bash
ssh prod-core 'curl -sf http://127.0.0.1:29000/api/health'
ssh prod-core 'curl -sf http://127.0.0.1:29001/app-build-version.txt'
ssh prod-core 'podman ps --filter name=stack0-eliteew --format "{{.Names}} {{.Image}}"'
# deploy id nginx == embedded в API (/app/frontend-dist/app-build-version.txt)
```

### Сопутствующий шум (не блокирует deploy)

| Наблюдение | Статус |
|------------|--------|
| `empery-tunnel-dns-guard.timer` на `.136` | Guard проверяет `stack-yandex-tunnel` (только prod-core); на command-center отключён оператором / skip в `validate-empery-tunnel-security.sh` |
| EWCO Chroma sqlite crash-loop | **Historical** — EWCO soft-retired → `trash/`; not a living deploy gate |
| Cursor/Chromium SIGSEGV при тяжёлом `vite build` | Нагрузка swap; не ошибка deploy-скрипта |

**Порядок reboot:** сначала **command-center `.136`** (Config Plane), затем **prod-core `.111`** (autostart делает env pull по SSH на `.136`), отдельно проверить gpu141 inference + ComfyUI `:31003`. Одновременный reboot `.136`/`.111` → `.111` падает на env-pull (fail-closed); autostart retry (12×15 с) или вручную `eliteew-prod-core-start-all.sh`.

**Ручной старт после reboot:**

| Операция | Действие |
|----------|----------|
| gpu141 host unit / `eliteew-gpu141-comfyui-rootful-start-sudo.sh` | Living ComfyUI на `.141` |
| `prod-core-start-all` | env push + SSH autostart на `.111` |

CLI: `bash docker/scripts/eliteew-command-center.sh start` · `bash docker/scripts/eliteew-prod-core-start-all.sh --yes`


Та же политика: **сборка/pull на command-center → export → load → compose up на .111** (без `build`/`pull` на prod-core).

```bash
source docker/scripts/eliteew-docker-aliases.sh

# llama-chat + stack4
eeprodruntime --yes --all

# Только chat или stack4
eeprodruntime --yes --stack2-only
eeprodruntime --yes --stack4-only
```

Скрипты: `build-prod-core-runtime-images.sh`, `export-prod-core-runtime-images.sh`, `eliteew-prod-core-runtime-deploy.sh`.

Override: `stack2.prod-core.baked.override.yml`, `stack4.prod-baked.override.yml` (`pull_policy: never`).

Stack4 on prod-core is fail-closed for baked env: `start-prod-core-stacks.sh stack4` requires all
`STACK4_TIKA_BAKED_IMAGE`, `STACK4_OCRMYPDF_BAKED_IMAGE`, `STACK4_GOTENBERG_BAKED_IMAGE`,
`STACK4_TESSERACT_BAKED_IMAGE`, and `STACK4_PAPERLESS_BAKED_IMAGE` keys before compose up. It must not fall
back to base compose images on `.111`, because that can leave a partial document stack where OCR/Paperless run but
`stack4-tika` / `stack4-gotenberg` are absent. After local stack4 start it runs `prod_core_deploy_smoke_stack4`.

**stack4 recreate hardening (2026-07-20):** `prod_core_deploy_recreate_stack4_baked` retires existing named containers (`prod_core_deploy_retire_named_container` → `stack4-*-stale-<ts>`) **before** `compose up --force-recreate`. Reason: podman-compose can hit `name already in use` / `the container name "…" is already in use` and leave a stale `stack4-tika` running (wrong image tag, **no** `Healthcheck`). If compose log still matches that class (`prod_core_deploy_stack4_compose_log_fail_closed`), recreate **fails closed** (non-zero) even when compose exit code is 0. Post-recreate assert: `prod_core_deploy_assert_stack4_containers` checks running + image match + Healthcheck present. Regression: `bash docker/scripts/verify-prod-core-env-preserve-selftest.sh`. Cleanup leftovers: `bash docker/scripts/prod-core-cleanup-stale-stack4.sh` on `.111`.

**Bake keys across env-push / reboot:** SOPS bundle often omits `STACK0_*_BAKED_*` / `STACK2_LLAMA_CHAT_BAKED_IMAGE` / `STACK4_*_BAKED_*`. `eliteew-prod-core-env-push.sh` snapshot/restores those keys; `eeprodruntime` Step 2d calls `prod_core_deploy_ensure_stack0_baked_image_env`; autostart after env-pull runs ensure for stack0 + stack2/4 from existing containers. After successful bake/runtime deploy, staging on `.136` is patched via `prod_core_env_sync_*_bake_keys_to_staging` (rebuild+encrypt SOPS for cold-boot). Selftest: `bash docker/scripts/verify-prod-core-env-preserve-selftest.sh`.

GGUF-модели **не** в образе — bind-mount `STACK2_LLAMA_MODELS_PATH` на `.111`. Live check 2026-06-15: `stack2-llama-chat` запущен с `/models/gemma-4-26B.gguf`.

Устаревшие скрипты с rebake на `.111`: soft-retired under `trash/` (id 20260812-150051, was …/trash) (README внутри).

Smoke после recreate: `prod_core_deploy_wait_api_baked` + `prod_core_deploy_smoke_stack0` (health, deploy id, mobile profile 401/403) + **`prod_core_deploy_smoke_stack0_contract`** (backend/all). Regression: `bash docker/scripts/verify-stack0-deploy-contract-gate.sh --live` / `--negative-dns`. For stack4, `prod_core_deploy_smoke_stack4` must pass: `http://127.0.0.1:$STACK4_TIKA_HOST_PORT/tika` plus running containers `stack4-tika`, `stack4-ocrmypdf-api`, `stack4-gotenberg`, `stack4-tesseract`, `stack4-paperless`, **plus** image/Healthcheck assert. Nginx patch после front up — **`ELITEEW_FRONTEND_HEALTH_STRICT=0`**, чтобы не обрывать deploy при гонке boot API.

If stack0 logs `Apache Tika (remote /tika) не отвечает по HTTP: http://stack4-tika:9998/tika`, treat it as stack4 runtime drift, not as a stack0 preflight false positive. Recovery from command-center:

```bash
source docker/scripts/eliteew-docker-aliases.sh
eeprodruntime --yes --stack4-only
```

Then verify on prod-core:

```bash
ssh 192.168.1.111 'cd <repo> && source docker/scripts/prod-core-deploy-lib.sh && export PROD_CORE_DEPLOY_REPO_ROOT=$PWD && prod_core_deploy_smoke_stack4'
```

## Фаза A — сборка на command-center `.136` (rollback-safe)

```bash
cd <repo>

# Опционально: дописать STACK0_*_BAKED_* из .env.stack0.backend.prod-baked.example
export STACK0_PROD_BAKED_TAG=prod-baked-20260610

# Полный цикл: base images (venv cache) → pnpm build → thin COPY layers
bash docker/scripts/build-stack0-prod-baked-images.sh

# Быстрый повтор только кода (venv уже в cache):
# STACK0_PROD_BAKED_SKIP_BASE_IMAGES=1 bash docker/scripts/build-stack0-prod-baked-images.sh
```

Проверка локально (старый prod не трогаем):

```bash
podman compose \
  -f docker/stack/stack0_b.yml \
  -f docker/stack/stack0_b.prod-baked.override.yml \
  --env-file docker/env_file/.env.stack0.backend config --quiet

curl -sf http://127.0.0.1:8000/api/health   # только если подняли *-prod-baked*
```

## Фаза B — экспорт образов

```bash
bash docker/scripts/export-stack0-prod-baked-images.sh owned@192.168.1.111 prod-baked-20260612
```

## Фаза C — deploy-tree + data (без dev-мусора)

```bash
bash docker/scripts/sync-prod-core-deploy-tree.sh owned@192.168.1.111
```

**Не попадает на `.111` через deploy-tree:** `shared/api`, `shared/web`, каталог `documentation/` (handbook KB — в baked API-образ при `eeprodbaked`), build-скрипты stack0.

```bash
# Секреты / env — Config Plane (Wave 4), не plaintext scp:
# см. ../PROD-CORE-CONFIG-PLANE.md
bash docker/scripts/prod-core-env-bundle-build.sh
bash docker/scripts/prod-core-env-sops-encrypt.sh
bash docker/scripts/eliteew-prod-core-env-push.sh --yes
```

Legacy plaintext `scp docker/env_file/.env.*` на `.111` — **снято** после cutover (runtime tmpfs + SOPS bundle).

# stack1 + EWA Postgres (остановить источник или consistent snapshot)
rsync -avz docker/data/stack1/ owned@192.168.1.111:<repo>/docker/data/stack1/
rsync -avz docker/data/ewa/postgresql/ owned@192.168.1.111:<repo>/docker/data/ewa/postgresql/
```

На prod-core поправить env под топологию:

- `LLAMA_URL` → локальный **llama-chat** (stack2 на prod-core).
- `LLAMA_EMBEDDING_URL` / `RAG_RERANK_BASE_URL` → **192.168.1.141**.
- `COMFYUI_URL` → **gpu141 (.141:31003)**.
- Один **celery-beat** на prod-core (не дублировать на command-center `.136`).

## Фаза C.1 — NVIDIA на prod-core (stack2 llama-chat)

На **whitep** (192.168.1.111) до cutover stack2 нужны: проприетарный драйвер, `nvidia-smi`, CDI для Podman.

**Симптом «ущербных» драйверов:** только `nvidia-gpu-firmware`, `nouveau` в `lsmod`, нет `/dev/nvidia*`, `nvidia-smi` not found. RPM Fusion на хосте не включён.

**Secure Boot:** на prod-core включён → после `mokutil --import` обязателен reboot и **Enroll MOK** на синем экране UEFI.

Скрипт (как на command-center `.136`: `akmod-nvidia` + `nvidia-container-toolkit` + `/etc/cdi/nvidia.yaml`).
**install-nvidia-host-fedora.sh — absent** (historical host bootstrap; not in tree). When restored, typical usage:

```bash
# на prod-core (интерактивный sudo)
cd ~/powered_by_emperyworld
sudo bash install-nvidia-host-fedora.sh all
# при первом MOK import: reboot → Enroll MOK → снова на хосте:
sudo REBOOT_AFTER_DRIVER=no bash install-nvidia-host-fedora.sh container-toolkit
sudo bash install-nvidia-host-fedora.sh verify
```

Ожидаемо:

- `nvidia-smi` — RTX 3090, driver ~595.x
- `podman run --rm --device nvidia.com/gpu=all docker.io/nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi` — OK
- stack2 `llama-chat`: `devices: nvidia.com/gpu=all`, `security_opt: label=disable` (SELinux, см. `docker/stack/stack2.yml`)

Модели GGUF на prod-core — bind `STACK2_LLAMA_MODELS_PATH` (не в образе llama.cpp).

## Фаза D — поднять prod-core (domain-ready split stack0)

```bash
# Сети, stack1, stack6, stack11, stack2 (chat only), stack0 baked
bash docker/scripts/networks-create.sh

# stack2: только llama-chat (без local-stack2-embed-rerank profile на prod-core)
# podman compose -f docker/stack/stack2.yml --env-file docker/env_file/.env.stack2 up -d llama-chat

podman compose \
  -f docker/stack/stack0_b.yml \
  -f docker/stack/stack0_b.prod-baked.override.yml \
  --env-file docker/env_file/.env.stack0.backend up -d

podman compose \
  -f docker/stack/stack0_f.yml \
  -f docker/stack/stack0_f.prod-baked.override.yml \
  --env-file docker/env_file/.env.stack0.backend up -d
```

Stack0 acceptance criteria:

- backend and frontend are separate Podman compose projects/containers, not one merged container;
- exactly one `stack0-eliteew-celery-beat-prod-baked` is running across `.111/.136`;
- no legacy `stack0-*-prod` and baked `stack0-*-prod-baked` pair is active for the same role;
- frontend deploy id in API-visible `frontend-dist` matches the generated frontend bundle.

Command-center check:

```bash
bash docker/scripts/eliteew-migration-command-center.sh eectl prod-core status
bash docker/scripts/eliteew-migration-command-center.sh eectl prod-core analyze
bash docker/scripts/eliteew-migration-command-center.sh smoke
```

## Фаза D.1 — reboot autostart

На `.111` после первого успешного `up`:

```bash
bash docker/scripts/eliteew-migration-command-center.sh install-autostart prod-core
ssh 192.168.1.111 'systemctl --user status eliteew-podman-autostart.service --no-pager'
```

После reboot drill повторить:

```bash
bash docker/scripts/eliteew-migration-command-center.sh acceptance
```

## Фаза E — cutover (tunnel + IP)

1. Smoke на prod-core по LAN (`127.0.0.1:29001`, health API, login Keycloak).
2. Перенести **reverse SSH tunnel** на prod-core (порты `29001`, `29000`, `36000`, `34002` — см. EMPERY-EDGE-IP-OPERATIONS.md).
3. Убедиться, что public edge routes смотрят на `.111`, а `.136` не держит public stack0 runtime.
4. Остановить старые `stack0-*-prod` на `.136` после подтверждения домена и первого reboot drill.

## Rollback

- Старые образы и контейнеры `stack0-*-prod` на `.136` не перезаписывались до acceptance.
- Откат: вернуть tunnel/IP на `.136`, `up` старый compose **без** prod-baked override.
- Embed/rerank rollback: переключить stack0 env на локальный `local-stack2-embed-rerank` или прежний LAN endpoint, затем recreate `stack0-backend`.

## Риски

| Риск | Митигация |
|------|-----------|
| RAM 32 GB на новом хосте | Минимум **64 GB** для полного stack1; иначе сузить сервисы |
| `!override` в compose | podman-compose ≥ 1.x; при ошибке — поднять только baked API/front вручную |
| podman-compose mount/env на `.111` | Не использовать `${VAR:-default}` в volumes; symlink legacy `docker/env_file/.env.stack0.backend` → runtime tmpfs; prod-baked override — literal uid `1000` для podman.sock (см. § Пошаговый конвейер) |
| Config Plane vs compose `env_file:` | `prod_core_deploy_prepare_stack0_compose_env` перед recreate; plaintext env на диске `.111` не хранить |
| Один beat | Не запускать beat на command-center `.136` после cutover |
| Deploy id gate | `verify-app-build-id.mjs` в build script; baked API читает `/app/frontend-dist/app-build-version.txt` |
| Base image drift `.136` vs `.111` | `Step 1b` parity check по digest/ID; аварийный bypass только `--allow-base-drift` |
| Broken transfer tar | `Step 2` сверяет SHA256 local/remote до `podman load` |
| Smoke fail after recreate | Авто rollback: snapshot env + recreate прежнего контура (`STACK0_PROD_BAKED_ROLLBACK_ON_SMOKE_FAIL=1`) |
| Growth of stale prod-baked tags | `Step 4b` удаляет старые `prod-baked-*` с retention (`STACK0_PROD_BAKED_RETAIN_IMAGES`) |
| Повторный export при `--skip-build` | Пока нет `--skip-export` — recreate вручную на `.111` или терпеть ~10 мин duplicate save/scp/load |
