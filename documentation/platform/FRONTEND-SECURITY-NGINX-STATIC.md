# EliteEW: безопасность статики фронта и nginx-контейнера

**Статус:** канон. Краткий чеклист и ссылки на конфиги: заголовки nginx, CSP, env фронт-контейнера. Разнесение GPU/LAN — [docker-re_doc/LAN-WORKERS-141.md](docker-re_doc/LAN-WORKERS-141.md).

## Сборка (статика)

| Тема | Где |
|------|-----|
| Прод без source maps | [`shared/web/frontend/vite.config.ts`](../../shared/web/frontend/vite.config.ts) — `build.sourcemap: false` |
| `ANALYZE=true` | Пишет `bundle-stats.html` в outDir — не включать в прод-том `dist-build` |
| `VITE_*` | Только публичные URL и client id; секреты — только на API |
| WebXR / VR pilot (`#/vr-pilot`) | Historical VR pilot notes soft-retired → `trash/…/documentation archive tree2026-05-24-doc-reality-audit/product/VR-PILOT.md` (not living canon; do not recreate the documentation archive tree (forbidden as living canon)) |

## Public disclosure (2026-07-31)

| Surface | Public (no auth / public Host) | Ops / authenticated |
|---------|--------------------------------|---------------------|
| `GET /api/health` | `{"ok": true\|false}` only | Admin JWT (`admin` / `emperyworld_admin` / `msi`) → full topology |
| `GET /health` | Minimal liveness (unchanged) | — |
| `GET /api/version` | `version`, `buildHash`, `appBuildId` (no `environment` / `buildTime`); owner [`routers/version.py`](../../shared/api/routers/version.py) (wins over any duplicate on `main`) | — |
| `/meta.json` | `version`, `buildHash` only | — |
| `/deployment-manifest.json` | **404** on Host `app.eliteew.ru` (edge + FE) | **200** on Host `127.0.0.1`/`localhost` `:29001` |
| `/app-build-version.txt` | Public deploy id for SPA reload | — |
| `/assets/*` | Public hashed JS/CSS (SPA); **no** `Access-Control-Allow-Origin: *` | Same-origin |
| Probe paths `/env`, `/swagger`, `/nginx_status`, `/actuator`, … | **404** (edge denylist + FE) | — |
| FoFline OIDC bridge `/fofline-oidc-bridge.html` | Exact location, `access_log off`, `try_files =404`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, bridge CSP (`frame-ancestors 'none'`); FoFline auth uses `response_mode=fragment`; **never** SPA `index.html` fallback | Linux FoFline WebView only (shell ≥0.4.22) |
| `/auth-proxy/*` CORS | Allowlist Origin (`app.eliteew.ru`, local vite) — never `*` | — |
| Rate limits (FE nginx) | `/api/health`, `/api/v1/health`, `/api/version` ~10r/s; `/socket.io/` ~5r/s | — |
| Socket.IO Engine.IO open | Handshake may return `sid` (protocol) | Application `connect` **requires** JWT |

Code: [`api_health_public.py`](../../shared/api/monitoring/api_health_public.py), [`nginx.prod.conf`](../../shared/web/frontend/nginx.prod.conf), [`nginx-app-https.conf`](../../docker/host_conf/nginx-app-https.conf).

Ops smoke (after deploy / against live): `bash docker/scripts/eliteew-public-surface-smoke.sh`

Dist secret scan: `bash scripts/eliteew/scan-frontend-dist-secrets.sh` (also from `validate-local` when `dist-build/assets` exists).

Site Studio: demo product/presentation binaries are **not** Rollup-imported; template art lives under `public/site-studio-template-assets/`. Embedded admin mirror remains; full demirror is a separate program.

## Контейнер фронта

| Тема | Где |
|------|-----|
| Compose | [`docker/stack/stack0_f.yml`](../../docker/stack/stack0_f.yml) — порт `127.0.0.1:29001`, томы `ro`, `user: 1000:1000`, `no-new-privileges` |
| Сниппеты nginx | `shared/web/frontend/nginx/snippets/` монтируется в `/etc/nginx/snippets` |
| Образ runtime | [`docker/builders/stack0-frontend/Dockerfile`](../../docker/builders/stack0-frontend/Dockerfile) — `dnf upgrade` только с `https://dl.fedoraproject.org` (без MirrorManager), **entrypoint** [`docker-entrypoint-csp.sh`](../../docker/builders/stack0-frontend/docker-entrypoint-csp.sh) пишет CSP в `/var/lib/nginx/csp/csp.conf`; HEALTHCHECK: HTTP GET `/` |
| Access / `podman logs` | [`nginx.prod.conf`](../../shared/web/frontend/nginx.prod.conf): шаблон монтируют в **`/srv/eliteew/nginx.prod.template.conf`**, entrypoint даёт CSI и **`/var/lib/nginx/runtime/default.conf`**. **`[FEC]`**: эффективный IP (первый **`X-Forwarded-For`** иначе **`remote_addr`**) — **внутренние**/loopback серым, **RU публичные** (IPv4 **`geo`** + [`fe-ipv4-ru-zone.geo`](../../shared/web/frontend/nginx/snippets/fe-ipv4-ru-zone.geo) из ipdeny) **жёлтым**, прочие публичные **красным**; столбцы **`remote_addr`** и **`xff`** тем же CSI. **`access.log`** без цветов. Tail: см. **`ELITEEW_FRONTEND_TAIL_ACCESS_TO_STDERR`**. Bearer/Cookie не логируются. |

## Nginx: заголовки и `add_header`
В nginx при наличии **любого** `add_header` внутри `location` заголовки с уровня `server` **не наследуются**. Поэтому общие security-заголовки вынесены в:

- [`eliteew-security-headers-base.conf`](../../shared/web/frontend/nginx/snippets/eliteew-security-headers-base.conf) — база без CSP (если CSP задаётся отдельно в `location`)
- [`eliteew-security-headers.conf`](../../shared/web/frontend/nginx/snippets/eliteew-security-headers.conf) — база + CSP приложения

**Referrer-Policy** выровнена с хостовым HTTPS: `strict-origin-when-cross-origin` (как в [`docker/host_conf/nginx-app-https.conf`](../../docker/host_conf/nginx-app-https.conf)).

## CSP (поэтапно)

**Шаг 1 (включён):** явные директивы CSP вместо одного широкого `default-src`; `object-src 'none'`, `base-uri` / `form-action` / `frame-ancestors`.

**Шаг 2 (включён):** `script-src 'self'` **без** `unsafe-inline` и **без** `unsafe-eval`. Инлайн fallback прелоадера вынесен в [`public/preloader-fallback.js`](../../shared/web/frontend/public/preloader-fallback.js) (DOM + `addEventListener`, без `onclick` в строках). **Post-deploy manual UI** (`staleBundleReload.ts` → `#eliteew-stale-bundle-overlay`) — тот же паттерн: `createElement` + `addEventListener`, не `innerHTML` с `onclick`.

**Zod v4 + CSP (без `unsafe-eval`):** Zod’s `allowsEval` probe вызывает `new Function("")` в `try/catch`; браузер всё равно пишет violation в DevTools (`schemas-*.js`, `script-src`), хотя выполнение продолжает работать. Не добавлять `unsafe-eval`. Вместо этого включён **`jitless`**: classic script [`public/zod-csp-jitless.js`](../../shared/web/frontend/public/zod-csp-jitless.js) в [`index.html`](../../shared/web/frontend/index.html) **до** module entry, плюс side-effect [`src/lib/zodCspJitless.ts`](../../shared/web/frontend/src/lib/zodCspJitless.ts) первым импортом в `mainFullApp.ts`. После деплоя статики violation по `schemas-*.js` / `new Function` не должна появляться.

**Шаг 3 (включён):** стили прелоадера — [`public/preloader.css`](../../shared/web/frontend/public/preloader.css), в [`index.html`](../../shared/web/frontend/index.html) только `<link rel="stylesheet" href="/preloader.css" />`. **`style-src 'unsafe-inline'`** оставлен: runtime-стили (Framer Motion, редакторы и т.д.). Полное снятие `unsafe-inline` для стилей потребует nonce/рефакторинга UI-библиотек.

**Узкий `connect-src` / `frame-src` (генерация при старте контейнера):** вместо голых `https:` / `wss:` в политике — явные origin’ы: `'self'`, **`blob:`** (нужен **PDF.js** и аналоги: `fetch`/stream к `blob:https://…` иначе браузер блокирует по `connect-src`), `https://auth.eliteew.ru`, `wss://app.eliteew.ru`; **`frame-src`** базово **`'self' blob:`** (in-app PDF iframe из authenticated `blob:` — Файловый менеджер, EWRP; без `blob:` Chrome пишет `Framing 'blob:…' violates frame-src`). Дополнительные origin (Site Studio, Meet, ComfyUI по **HTTP** в LAN) — **`CSP_FRAME_EXTRA`** (пробел — несколько значений); опционально `CSP_CONNECT_EXTRA`, `CSP_IMG_EXTRA`, `CSP_MEDIA_EXTRA`. Если образ фронта ещё **без** `blob:` в базовой строке `connect-src` (старый билд), добавьте **`blob:`** в начало **`CSP_CONNECT_EXTRA`** — иначе **PDF.js** блокируется при открытии PDF из `blob:` URL.

**Кому задавать:** только контейнеру **`stack0-eliteew-frontend-prod`**. В [`stack0_f.yml`](../../docker/stack/stack0_f.yml) они в `environment` как `${CSP_CONNECT_EXTRA:-}` и т.д. — значения задаются в **файле, который вы передаёте** в `podman compose --env-file` (обычно тот же [`docker/env_file/.env.stack0.backend`](../../docker/env_file/.env.stack0.backend); пример только CSP — [`docker/env_file/.env.stack0.frontend.example`](../../docker/env_file/.env.stack0.frontend.example)). Это **не** бэкенд API и **не** `VITE_*`. После изменения — пересоздать/перезапустить контейнер фронта.

### Публичный prod и LAN (операторы)

| Контур | Файл env | `CSP_*_EXTRA` | Зачем |
|--------|----------|---------------|--------|
| **Публичный** `app.eliteew.ru` | [`docker/env_file/.env.stack0.backend`](../../docker/env_file/.env.stack0.backend) | `CSP_FRAME_EXTRA` = `https://*.sites.eliteew.ru https://meet.eliteew.ru`; **без** `192.168.x.x` | Нет утечки LAN в DevTools/сканерах; внешним клиентам LAN Comfy недоступен |
| **LAN / VPN** к app или LAN-доступ к Comfy | подмешать [`docker/env_file/.env.stack0.frontend.lan.example`](../../docker/env_file/.env.stack0.frontend.lan.example) | Comfy **`http://192.168.1.141:31003`** в `CONNECT` / `FRAME` / `IMG` | iframe ComfyUI на рабочем столе из доверенной сети; **не** публичный CSP на edge |

**Правило:** private IP и `http://` в CSP на edge и в prod env **не** публиковать. Бэкенд может вызывать Comfy по LAN (`COMFYUI_URL` в API) без отражения origin в CSP ответа HTML.

**Применить prod CSP** (недостаточно `podman restart` — env читается при create):

```bash
podman compose -f docker/stack/stack0_f.yml \
  --env-file docker/env_file/.env.stack0.backend \
  up -d --force-recreate eliteew-frontend-prod
```

**Проверка:**

```bash
podman exec stack0-eliteew-frontend-prod cat /var/lib/nginx/csp/csp.conf | grep -o '192.168[^;]*' || echo "OK: no LAN IP in CSP"
curl -sI https://app.eliteew.ru/ | grep -i content-security-policy
```

Файл политики в рантайме: **`/var/lib/nginx/csp/csp.conf`** (в образе). Сниппет [`eliteew-security-headers.conf`](../../shared/web/frontend/nginx/snippets/eliteew-security-headers.conf) делает `include` этого файла.

**`img-src` / `media-src` (текущая политика):** в [`docker-entrypoint-csp.sh`](../../docker/builders/stack0-frontend/docker-entrypoint-csp.sh) базово **`img-src 'self' data: blob:`** и **`media-src 'self' data: blob:`** (без голого `https:` в образе). Дополнительные источники — **`CSP_IMG_EXTRA`** / **`CSP_MEDIA_EXTRA`** (в т.ч. схема **`https:`** для обложек стриминга и прочих CDN, если нужны; для ComfyUI по **HTTP** в LAN — тот же origin, что в `CSP_CONNECT_EXTRA` / `CSP_FRAME_EXTRA`, продублируйте в **`CSP_IMG_EXTRA`**, иначе превью картинок с Comfy блокируются).

**Типичная ошибка в консоли (prod):** `Framing 'blob:https://app.eliteew.ru/…' violates ... frame-src 'self' https://*.sites.eliteew.ru ...` — PDF preview в `<iframe>` (Файловый менеджер, EWRP) без **`blob:`** в **`frame-src`**. Проверка: `curl -sI https://app.eliteew.ru/ | rg frame-src` — должно быть **`frame-src 'self' blob:`** (+ extras). Исправление: образ фронта с обновлённым [`docker-entrypoint-csp.sh`](../../docker/builders/stack0-frontend/docker-entrypoint-csp.sh) и **recreate** `eliteew-frontend-prod` (не только restart).

**Типичная ошибка в консоли (prod):** `Loading media from 'data:audio/...;base64,...' violates ... media-src 'self' blob: https:` — в действующей политике **нет** `data:` для медиа (устаревший образ фронта или CSP только через `CSP_MEDIA_EXTRA` без базового entrypoint). Проверка: `podman exec stack0-eliteew-frontend-prod cat /var/lib/nginx/csp/csp.conf` — в строке `Content-Security-Policy` для **`media-src`** должны быть **`data:`** и **`blob:`**. Исправление: пересобрать образ из [`docker/builders/stack0-frontend`](../../docker/builders/stack0-frontend) и пересоздать контейнер. Клиентская нормализация (`resolveAudioUrlForPlayback` → `blob:`) снижает требования, но при полном отказе декодирования не подставляйте «сырой» `data:` в `Audio()` — иначе та же CSP ошибка останется.

**Краткий аудит URL (код API / фронт):**

| Назначение | Типичный URL | CSP |
|------------|----------------|-----|
| Аватары, unified content, скачивание файлов | Относительные `/api/v1/content/{id}/download`, `/thumbnail` | `self` |
| Превью после crop / студии | `blob:` | `blob:` |
| Fallback аватара (ошибка storage) | `data:image/...;base64,...` | `data:` |
| Desktop music: обложка трека | Часто внешний **HTTPS** (CDN стриминга) | `https:` в **`CSP_IMG_EXTRA`** при необходимости |
| Comfy / image-studio превью с LAN | `http://<host>:<port>/view?...` | тот же **`http://...`** в **`CSP_IMG_EXTRA`** |
| Воспроизведение музыки в плеере | `blob:` после `GET /api/v1/content/.../download` | `blob:` + `self` |
| PDF в браузере (pdf.js, кабинет заказчика / презентации) | `blob:` URL для документа | **`connect-src`** и **`frame-src`** включают **`blob:`** (см. `docker-entrypoint-csp.sh`) |
| TTS / вставка аудио в документ | `data:audio/...;base64,...` | `data:` в **media-src** (базово) |

Локальная разработка — через Vite, не через `nginx.prod.conf`.

После смены CSP — смоук: логин OIDC (Keycloak), десктоп, iframe (ComfyUI: совпадение `VITE_COMFYUI_URL` с `CSP_*_EXTRA`), чат/WebSocket.

**Хостовый edge:** в [`docker/host_conf/nginx-app-https.conf`](../../docker/host_conf/nginx-app-https.conf) и Yandex-варианте [`docker/host_conf/nginx-app-https-vm-mkcert.conf`](../../docker/host_conf/nginx-app-https-vm-mkcert.conf) отдельного CSP нет — политика задаётся контейнером фронта (один источник CSP на ответ за прокси).
**Cloud-spa edge static** (`deploy-cloud-spa-to-edge.sh`): CSP генерируется тем же `docker-entrypoint-csp.sh`, с публичными defaults `CSP_FRAME_EXTRA` (`meet.eliteew.ru`, `*.sites.eliteew.ru`) — см. [CLOUD-SPA-EDGE-STATIC.md](CLOUD-SPA-EDGE-STATIC.md).
Yandex edge скрывает дублирующиеся upstream headers (`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`), добавляет HSTS / `Permissions-Policy` / COOP / CORP и возвращает `404` на scanner/API-like probe paths (`/docs`, `/redoc`, `/openapi.json`, `/.env`, `/.git/*`, `wp-config*`, `/api/fetch*`, `/proxy*`) без отключения нормального SPA fallback.

### Embedded Jitsi permissions

`app.eliteew.ru` embeds `https://meet.eliteew.ru` in `VideoCallApp`. The app edge
`Permissions-Policy` must not use `camera=()` / `microphone=()`: that blocks
`getUserMedia` in the child frame before browsers, including Meta Quest Browser, can show
the permission prompt. Keep `camera`, `microphone`, `fullscreen`, `display-capture`,
`screen-wake-lock` and `picture-in-picture` allowed for `self` and
`https://meet.eliteew.ru`, matching the iframe `allow` attribute in
`shared/web/frontend/src/pages/Desktop/components/VideoCall/VideoCallApp.tsx`. Do
not include unsupported directives such as `speaker-selection`: Chrome logs them as
policy errors and they add noise to user debugging.

## API: GET `/api/v1/profile/avatar` без аватара

Раньше отдавался **404**; сейчас — **200** и JSON с пустым `avatar_url` (см. `shared/api/routers/user_profile.py`), чтобы в Network не было «ошибочного» 404 при отсутствии загруженного аватара.

## Avatar strict-origin guard (FE boundary)

Компонент **`SecureAvatar`** (`shared/web/frontend/src/components/profile/SecureAvatar.tsx`) и утилита **`isInternalOrTrustedUrl`** (`src/utils/avatarUrlGuard.ts`) блокируют **сторонние** `http(s)` URL (Gravatar, чужие CDN) на границе UI: в `<img src>` попадают только:

| Класс URL | Поведение |
|-----------|-----------|
| `/api/*`, пути с `unified-content` | Blob-fetch через `profileService.getAvatarDownloadObjectUrl` (Bearer) |
| `blob:`, `data:` | Прямой `src` |
| Same-origin `http(s)` (статика на `app.*`) | Прямой `src` |
| Внешний домен | Bundled placeholder `src/assets/default-avatar.svg` — **без сетевого запроса** |

Обёртки **`GAFChatAvatar`**, **`FriendAvatar`**, **`DesktopWorkspaceFloatingWidget`** делегируют в `SecureAvatar`. Очистка «плохих» значений в Postgres — отдельная операторская задача; FE не доверяет полю `avatar_url` слепо.

Тесты: `src/utils/__tests__/avatarUrlGuard.test.ts`, `src/components/profile/__tests__/SecureAvatar.test.tsx`.

## Прокси в `nginx.prod.conf`

Основной маршрут: **`/api/`** → `stack0-eliteew-api-prod:8000` (и узкие префиксы вроде `/api/v1/image-studio/`). Исторические `location` на хост (`/comfyui-proxy/`, `/ewlshield-proxy/` и др.) **удалены**; ComfyUI в Desktop — через **`VITE_COMFYUI_URL`**, прямой URL. **Sentry** (self-host + nginx proxy) **полностью снят** с prod — ошибки: `structlog` + `podman logs`, не отдельный error-tracking stack.

## Edge

`client_max_body_size 100M` согласован: хостовый [`docker/host_conf/nginx-app-https.conf`](../../docker/host_conf/nginx-app-https.conf) (серверы `app.eliteew.ru` и `*.sites.eliteew.ru`) и [`shared/web/frontend/nginx.prod.conf`](../../shared/web/frontend/nginx.prod.conf).

## Зависимости (pnpm audit)

Периодически: `cd shared/web/frontend && pnpm audit`. Overrides живут в **`shared/web/frontend/pnpm-workspace.yaml`** (не только `package.json`): **`lodash`** / **`lodash-es`**, **`dompurify ^3.4.12`** (цепочка **monaco-editor** — GHSA-cmwh-pvxp-8882 и соседние), плюс прочие supply-chain pins. После смены overrides — `pnpm install` и проверка сборки. Router: **`react-router ^8.4.0`** (пакет `react-router-dom` снят upstream; GHSA-qwww-vcr4-c8h2).

## Сравнение аудитов: «до харднинга nginx» vs текущее состояние (2026-04)

Базовая линия «прошлый аудит» — состояние **до** внедрения сниппетов и правок Dockerfile (ранний 2026-04). Текущая проверка — по коду репо и `curl` к `127.0.0.1:29001`.

| Тема | Раньше (до правок) | Сейчас |
|------|-------------------|--------|
| **Source maps в прод** | Уже было `sourcemap: false` | Без изменений; в `dist-build` **0** файлов `*.map` |
| **Security-заголовки на `/` и статике** | Из‑за `add_header` в `location` заголовки с `server` **не доходили** до HTML/JS (проверка `curl`) | `include` сниппетов в нужных `location`; на `/` и `/assets/*.js` есть `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `CSP` |
| **Referrer-Policy** | В контейнере было `no-referrer-when-downgrade`, на хосте — `strict-origin-when-cross-origin` | В сниппетах: **`strict-origin-when-cross-origin`**, как на edge |
| **Compose: монтирование** | Только `dist-build` + `nginx.prod.conf` | Добавлен том **`nginx/snippets` → `/etc/nginx/snippets`** |
| **Dockerfile фронта** | `HEALTHCHECK` через `pgrep nginx`; без явного обновления ОС в слое | **`dnf upgrade`** перед `install`; `curl` в образе; **HEALTHCHECK** = HTTP GET `/` (как в compose) |
| **Документация чеклиста** | Не было единого файла | Этот файл (worklog journals retired → `trash/`; chronology via `git log` / chat) |
| **CSP** | Широкие `connect-src https: wss:` и `frame-src https:` | `connect-src`/`frame-src` с явными host + env extra; `img-src`/`media-src` с узкой базой (`self`+`data`+`blob`) + `CSP_*_EXTRA`; генерация в контейнере (`docker-entrypoint-csp.sh`) |
| **pnpm audit** | Несколько transitive (lodash и др.) | **Overrides** `lodash` / `lodash-es` `^4.18.0`; на дату обновления документа: `pnpm audit` — **0** известных уязвимостей; периодически перезапускать после изменений lockfile |

**Итог:** усилили **доставку** security-заголовков, **гигиену образа** и **узкие `connect-src` / `frame-src`** (без голого `https:`/`wss:` в этих директивах). **`img-src` / `media-src`:** база без `https:`; широкие источники — через env. Долг: **nonce для стилей**, модель **токенов в SPA** (см. ниже) без изменений.

## Client-side HTML sanitization (SPA, 2026-05)

| Поверхность | Модуль | Правило |
|-------------|--------|---------|
| AI / assistant markdown | `components/assistantMessage/sharedChatRehypePlugins.ts` | `rehype-sanitize` **всегда последним** в цепочке |
| Desktop AI Mermaid SVG | `utils/sanitizeUserHtml.ts` → `sanitizeMermaidSvg` | SVG allowlist перед `innerHTML` в `DesktopAiChatMarkdown.tsx`; scripts/event handlers/unsafe protocols удаляются |
| Doc Editor Mermaid SVG | `ChartsDiagramsPanel.tsx` + `sanitizeMermaidSvg` | Mermaid preview/insert sanitizes SVG before `dangerouslySetInnerHTML` or editor insertion |
| Doc Editor markdown/html import | `markdownToHtml.ts`, `ultimateDocEditorBootstrap.ts`, `useDocumentFileExchange.ts` | `marked` output and downloaded HTML are sanitized before editor state/preview |
| Doc editor search highlights | `utils/sanitizeUserHtml.ts` → `sanitizeSearchHighlightHtml` | allowlist `mark/em/strong/b/span` перед `dangerouslySetInnerHTML` в `SearchPanel.tsx` |
| Version preview HTML | `sanitizeUserHtml` | snapshot `rendered_html` в `VersionHistoryPanelV2.tsx` |
| Rich user HTML | `sanitizeUserHtml` | Файловый менеджер, UniversalViewer, markdown→HTML pipeline; user HTML images are downgraded/removed instead of loaded from remote/inline sources |
| Markdown links | `utils/markdownSecurity.ts` → `sanitizeMarkdownHref` | Absolute `http/https` only; protocol-relative, relative, `javascript:` and oversized URLs stay inert text |
| Markdown images | `utils/markdownSecurity.ts` → `isTrustedMarkdownImageSrc` | Assistant images load only from same-origin/product media hosts and use `referrerPolicy="no-referrer"` |
| Local Service iframe | `LocalServiceIframeApp.tsx` | Same-origin proxy iframe is sandboxed without `allow-same-origin`; scripts cannot read app-origin storage or parent DOM |
| Authenticated streaming fetch | `apiFetchWithAuth` | Bearer is attached only for same-origin `/api/*`; external/non-API URLs throw before fetch |
| Frontend logs | `utils/logger.ts` | Tokens, cookies, authorization headers, passwords and client secrets are redacted before console/buffer/export sinks |

Logout: `AuthContext` runs the full **§3.4 six-step cache cascade** ([FRONTEND_BROWSER_CACHE_MODEL.md](../product/FRONTEND_BROWSER_CACHE_MODEL.md), [FRONTEND-AUTH.md](../product/FRONTEND-AUTH.md)) — including `resetQueryClient()` (React Query), ETag maps, shell RAM/IDB, principal-scoped LS, GAF E2EE keys, then OIDC token purge. React Query alone is not the full logout contract.

Manual login now defaults to `sessionStorage`; durable `localStorage` tokens require explicit `persistSession: true` / Remember Me. См. [FRONTEND-AUTH.md](../product/FRONTEND-AUTH.md).

Assistant transform preload: `companionTransformVideoPreload.ts` — `disposeCompanionTransformVideoPreload()` на unmount панели (скрытые `<video>` не остаются в `document.body`).

Файловый менеджер media/text preview: `downloadContentBlob(..., { signal })` + `AbortController` в cleanup, чтобы большие authenticated blob-загрузки не продолжались после закрытия превью.

UGS SSE client: `parseUgsSseBlock` принимает CRLF, comments/keep-alive, несколько `data:` строк и final-buffer flush; malformed JSON chunks игнорируются без падения стрима.

Тесты: `src/utils/__tests__/sanitizeUserHtml.test.ts`, `src/utils/__tests__/markdownSecurity.test.ts`, `src/utils/__tests__/logger.test.ts`, `src/components/UltimateDocEditor/utils/markdownToHtml.test.ts`, `src/services/api/__tests__/api-helpers.test.ts`, `src/services/api/ugs/__tests__/ugsStreamSseParser.test.ts`, `src/features/ewa/__tests__/companionTransformVideoPreload.test.ts`.

## Ограничения (честный аудит): пункты 2, 4, 5

Кратко; подробнее — в ответе ассистента при запросе «разбор аудита».

### 2. Внешние картинки и медиа (`https:` и LAN)

**Для `connect-src` / `frame-src`:** явные origin + `CSP_*_EXTRA`. **Для `img-src` / `media-src`:** в образе — только **`self` + `data:` + `blob:`**; произвольный **HTTPS** по схеме и внешние превью (в т.ч. Comfy по **HTTP** в LAN) задаются в **`CSP_IMG_EXTRA`** / **`CSP_MEDIA_EXTRA`**. Типичный прод: `CSP_IMG_EXTRA` включает **`https:`** (обложки, CDN) и дублирует **HTTP**-origin Comfy с `CSP_CONNECT_EXTRA`. См. таблицу аудита выше.

### 4. Модель угроз SPA (токены в браузере)

Полный канон (IDOR, DevTools, чеклисты, сравнение с индустрией): **`FRONTEND-SPA-BEARER-THREAT-MODEL.md`**.

Это **не** про «API без токена»: защищённые маршруты по-прежнему требуют **Bearer JWT** (и т.п.). Речь про другое: токен выдаётся **легитимному** приложению после логина и хранится/используется в браузере. Если злоумышленник получил **XSS** (или компрометацию расширения), он может **перехватить уже выданный** токен и вызывать API **с ним** — для сервера запрос выглядит как от пользователя. Защита — минимизация XSS (CSP, React), короткий TTL, refresh rotation, проверки на API, ограничение scope.

Текущий OIDC hardening для SPA: короткий access token, rotation refresh-токенов, ограниченный Remember Me и явный mapping claims/roles. Frontend сохраняет обновлённую persisted-пару после успешного refresh, чтобы rotation не оставляла в `localStorage` устаревший refresh token. Канон настройки — [`KEYCLOAK-ELITEEW.md`](docker-re_doc/KEYCLOAK-ELITEEW.md). Локальный same-origin proxy: `/auth-proxy/*` → `stack6-keycloak:8080` в `nginx.prod.conf`. Authentik pilot notes soft-retired → `trash/…/documentation archive treeauthentik-pilot-2026-05-0{4,5}/` — **not** living canon; do **not** recreate the documentation archive tree (forbidden as living canon) as a retire target (use `trash-move.sh`).

### 5. Прокси на хост (исторически)

Раньше в `nginx.prod.conf` были `location` на `127.0.0.1` (ComfyUI, ewlshield и др.). **Удалены** как неиспользуемые. Для любых внешних сервисов по-прежнему важны: кто достукивается до edge (TLS, файрвол), не слушает ли лишний сервис `0.0.0.0` на хосте.
