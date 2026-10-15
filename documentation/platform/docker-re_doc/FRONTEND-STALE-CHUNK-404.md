# Рассинхрон SPA после деплоя (404 чанков, bundle mismatch, reload)

**Статус:** Канон (2026-05-24).

Симптомы: 404 на `/assets/*-[hash].js`, экран «Приложение обновлено», GAF «Сервер чата: офлайн» при живом REST, Socket.IO `connect rejected … app_build_mismatch`, цикл перезагрузок после логина.

Код: `shared/web/frontend/src/utils/staleBundleReload.ts`, `reactAppLifecycle.ts`, `appBuildId.ts`. Сборка deploy id: **`../FRONTEND-TOOLCHAIN-AND-BUILD.md`**.

## Причины

| Сценарий | Что происходит |
|----------|----------------|
| **404 lazy-чанка** | В памяти старый родительский JS ссылается на старые имена чанков; после `pnpm run build` (`emptyOutDir: true`) старых файлов на диске нет |
| **Edge path filter (не stale)** | Файл есть на prod-core `:29001` (**200**), но `https://app.eliteew.ru/assets/<name>` → nginx **404**. Hard refresh **не** лечит. Исторические ложные срабатывания: (1) 2026-07-14 `ActivityLog-*` — rename source; (2) 2026-08-16 `*Env.js` Vite chunks (`useFriendsOverview-*BF5AJEnv.js`) — edge `location ~* …env.js` совпадал case-insensitive; fix: exact `/env.js` only in `docker/host_conf/nginx-app-https*.conf` + redeploy edge nginx (`deploy-nginx-app-to-vm.sh`). |
| **Bundle vs server mismatch** | Запечённый `APP_BUILD_ID` в JS ≠ строка в `/app-build-version.txt` — вкладка считает себя stale |
| **Устаревший mount API** | Bind-mount **одного файла** `app-build-version.txt` в контейнер API: после rebuild inode в контейнере может не обновиться до recreate |
| **OAuth + reload** | Auto-reload во время `?code=` / PKCE ломает callback |

Диагностика edge vs stale:

```bash
# local frontend (prod-core)
ssh 192.168.1.111 'curl -sI http://127.0.0.1:29001/assets/<chunk>.js'   # expect 200 if file in baked image
# public edge
curl -sI "https://app.eliteew.ru/assets/<chunk>.js"                     # 404 here + 200 above ⇒ edge filter, not stale parent
```

## Deploy id: один источник на сборку

Плагин **`vite-plugin-build-version.ts`**:

1. **`config` / `buildStart`** — генерирует deploy id, пишет **`.build-artifacts/appBuildId.ts`** до Rollup; plugin `resolveId` перенаправляет import `generated/appBuildId`.
2. **`closeBundle`** — тот же id в `dist-build/app-build-version.txt` и `dist-build/meta.json`.

**Git hygiene (2026-07-05):** `dist-build/`, `.build-artifacts/`, `public/meta.json` — в `.gitignore`. Tracked tree остаётся clean после prod build.

**Проверка после сборки:**

```bash
cd shared/web/frontend
node scripts/verify-app-build-id.mjs
# или
pnpm run check:bundle
```

## Клиент: `staleBundleReload.ts`

| Механизм | Поведение |
|----------|-----------|
| **`isBundleBuildMismatch()`** | Сравнивает `getAppBuildId()` с `/app-build-version.txt` (prod) |
| **Boot / poll (300 s background; focus/visibility immediate)** | При mismatch — один auto-reload на deploy id (`sessionStorage`); повтор → overlay |
| **`deploy_version_changed`** | txt изменился в сессии → reload всех вкладок (`BroadcastChannel`) |
| **Chunk 404 / import error** | `handleChunkLoadFailure()` — один auto-reload, затем manual UI |
| **OAuth deferral** | Не reload при `?code=` / `isInteractiveLoginInFlight()`; flush только после OAuth callback в **`keycloak.ts`** (не на каждый `onAuthSuccess`) |
| **Maintenance deferral** | Пока `MaintenanceStatus.active=true`, bundle mismatch / deploy-version / Socket.IO stale не делают hard reload; после `completed` — один controlled reload **только если bundle ≠ server**; при совпадении — in-place recovery (socket + maintenance store, без `location.replace`) |
| **Bundle match guard (2026-08-19)** | Auto-reload по `client_stale_*`, `socket_connect_bundle_mismatch`, `deploy_version_changed` **не выполняется**, если `getAppBuildId()` уже совпадает с `/app-build-version.txt` — защита от ложных «обновлений» при живом bundle |
| **Unplanned maintenance debounce** | Одиночный 502/503/504 **не** открывает unplanned maintenance overlay; нужны ≥2 ошибки за 12 с — иначе краткий сбой API не тригgerит recovery reload |
| **Manual UI** | Overlay `#eliteew-stale-bundle-overlay` на `document.body`, `z-index: 100000`; **`detachAppReactRoot()`** перед показом; кнопка через **`addEventListener`** (CSP: без inline `onclick`); снимает `#app-preloader` |
| **Socket / HTTP stale** | `EmperyworldSocketService`, `client.ts` — reload по `client_stale_*` / `socket_connect_bundle_mismatch` |

## Nginx и кэш

- **`/app-build-version.txt`** — `no-cache` в `nginx.prod.conf`.
- Hashed `/assets/*` — `immutable` (нормально для одной версии).
- **`index.html`** — `no-cache` (см. security doc).

## Docker: два контура

### Prod-core baked (канон, `.111`)

Образы **immutable**: код и `dist-build` **внутри** образа, не bind-mount. Сборка **только на command-center** (`.136`), на prod-core — load + recreate.

| Сервис | Deploy |
|--------|--------|
| stack0 API + frontend | `bash docker/scripts/eliteew-deploy.sh release stack0 --all` (только `--all`; без `--frontend-only` / `--backend-only`; optional `--refresh-openapi-pilots`) |
| stack2 llama-chat | `eeprodruntime --yes --stack2-only` |
| stack4 OCR/Tika | `eeprodruntime --yes --stack4-only` |

Проверка deploy id после деплоя: `prod_core_deploy_smoke_stack0` (в т.ч. txt в nginx-образе и API). Канон: **`PROD-CORE-MIGRATION-BAKED-IMAGES.md`**.

**Не использовать** на `.111`: `eectl recreate stack0-*` без `*.prod-baked.override.yml`, `podman build`, rebake на хосте.

### Legacy bind-mount (command-center `.136` / локальная разработка)

| Сервис | Mount |
|--------|--------|
| **Frontend** (`stack0_f.yml`) | `shared/web/frontend/dist-build` → `/usr/share/nginx/html` |
| **API** (`stack0_b.yml`) | тот же `dist-build` → `/app/frontend-dist`; `ELITEEW_APP_BUILD_VERSION_FILE=/app/frontend-dist/app-build-version.txt` |

После **`pnpm run build:react-compiler`** bind-mount подхватывает новые файлы **без** recreate frontend. **API и celery на command-center** — **`eectl --yes recreate --include stack0-backend`** (см. порядок ниже), иначе возможен stale `app-build-version.txt` в контейнере и `app_build_mismatch` на Socket.IO. Публичный prod — только **`bash docker/scripts/eliteew-deploy.sh release stack0 --all`**.

## Оператору

### Prod-core (рекомендуется для публичного runtime)

Из **command-center** после `source …/docker/scripts/eliteew-docker-aliases.sh`:

```bash
# Канон: SPA + API baked → export → recreate на .111 (только --all)
bash docker/scripts/eliteew-deploy.sh release stack0 --all
# optional same-release OpenAPI pilots before SPA build:
# bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --refresh-openapi-pilots

# stack2 + stack4 runtime
eeprodruntime --yes --all

# Повтор export+recreate без пересборки (всё равно --all)
bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --skip-build --tag prod-baked-YYYYMMDD-HHMM
```

Агентам и default release path **запрещены** `--frontend-only` / `--backend-only`. Канон: `bash docker/scripts/eliteew-deploy.sh release stack0 --all`.

Maintenance перед disruptive recreate: `eliteew-maintenance-window.sh` / `--maintenance` на `eliteew-deploy.sh release stack0 --all` (implementer may accept the same flags; см. **`../USER-SAFE-RESTARTS-AND-MAINTENANCE.md`**).

### Legacy command-center bind-mount (не prod-core)

Из **любой cwd** после `source …/docker/scripts/eliteew-docker-aliases.sh`:

```bash
cd shared/web/frontend && pnpm run build:react-compiler
eectl --yes recreate --include stack0-backend,stack0-frontend
bash docker/scripts/start-gpu141-embed-rerank.sh   # при необходимости
```

Справка по коротким командам: **`???`** в shell.

**Socket.IO gate:** клиент шлёт `auth.app_build` / `X-App-Build`; API сверяет с тем же txt. 101 Switching Protocols ≠ успешный `connect` — см. логи `connect rejected … app_build_mismatch`.

### Почему не только `pnpm build` (legacy bind-mount)

| Компонент | После сборки фронта |
|-----------|---------------------|
| **nginx** (static) | Bind-mount `dist-build` — новые файлы видны сразу |
| **API** (`client_build_service`, Socket.IO `app_build`) | Нужен **recreate stack0-backend** — контейнер перечитывает mount и env |
| **gpu141 remote inference** | Для текущего prod path stack0 workers не живут на `.141`; при необходимости обновить `.141` embed/rerank/tool-router через `start-gpu141-embed-rerank.sh` |

### Ручной порядок (legacy command-center bind-mount)

1. Сборка: `cd shared/web/frontend && pnpm run build:react-compiler`.
2. Проверка: `node scripts/verify-app-build-id.mjs`.
3. Stack0: `eectl --yes recreate --include stack0-backend,stack0-frontend`.
4. gpu141 remote inference: `bash docker/scripts/start-gpu141-embed-rerank.sh`.
5. Health: `podman exec stack0-eliteew-api-prod curl -sf http://127.0.0.1:8000/health`.
6. При застревании у пользователя: жёсткое обновление (Ctrl+Shift+R) или «Обновить страницу» на overlay.

**Prod-core:** шаги 1–2 на `.136`, затем **`bash docker/scripts/eliteew-deploy.sh release stack0 --all`** (не голый recreate на `.111`).

### Диагностика mismatch

```bash
curl -sf https://app.eliteew.ru/app-build-version.txt
curl -sf https://app.eliteew.ru/assets/staleBundleReload-*.js  # id из index / main mapDeps
# prod-core baked
ssh prod-core 'podman logs stack0-eliteew-api-prod-baked 2>&1 | tail -50' | rg 'app_build_mismatch|Client connected'

# legacy/dev bind-mount
docker logs stack0-eliteew-api-prod 2>&1 | tail -50 | rg 'app_build_mismatch|Client connected'
```

## Файлы

- `documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md`
- `web/frontend/vite-plugin-build-version.ts`
- `web/frontend/scripts/verify-app-build-id.mjs`
- `web/frontend/src/utils/staleBundleReload.ts`
- `web/frontend/src/utils/reactAppLifecycle.ts`
- `web/frontend/src/mainFullApp.ts`
- `web/frontend/src/services/keycloak.ts`
- `web/frontend/src/pages/Desktop/components/EnhancedWindow.tsx`
- `docker/stack/stack0_b.yml`, `docker/stack/stack0_f.yml`
- `docker/scripts/eliteew-deploy.sh` (канон release); `eliteew-docker-aliases.sh` may expose legacy name `eedeploy`
