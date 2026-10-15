# Frontend: toolchain, сборка и тяжёлые вендоры

**Статус:** Канон (2026-05-23; TypeScript **7+** / IDE tsgo — 2026-07-11).

Код: `shared/web/frontend/`. Точка входа для команд и auth: **`product/FRONTEND-DEVELOPER-ENTRY.md`**. Деплой и рестарты: **`.cursor/rules/project-and-deploy.mdc`**. CSP и nginx: **`platform/FRONTEND-SECURITY-NGINX-STATIC.md`**. Рассинхрон чанков после деплоя: **`platform/docker-re_doc/FRONTEND-STALE-CHUNK-404.md`**. Сводный стек: **`platform/ELITEEW-TECH-STACK-SUMMARY.md`**.

## TypeScript 7+ и IDE (tsgo)

| Что | Канон |
|-----|--------|
| Версия | `shared/web/frontend/package.json` → `"typescript": "^7.0.2"` |
| Peer override | SPA: `typescript@^7`. Generator: isolated `shared/web/frontend/tools/openapi-typescript-runtime` (TypeScript **5.9** + `openapi-typescript@7.13`) — TS 7 removed classic `ts.factory` from package root |
| CLI typecheck | `pnpm run typecheck` / `tsc` из frontend (пакет `typescript@7`) |
| IDE language service | **Native TypeScript (tsgo)** — не классический `tsserver.js` из TS6 |

**TS hygiene (2026-07-28 Wave J):** `pnpm exec tsc --noEmit` and Biome `--diagnostic-level=error` both **0** on the SPA tree (prod + tests). Earlier waves A–I cleared product clusters; Wave J finished remaining Desktop/EWRP/DocEditor/services/OpenAPI/test-fixture drift without `@ts-ignore` / `as any` silence. Living note: [`product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md`](../product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md) §GAF Chat Wave J.

**Biome hygiene (2026-07-28 Wave K):** `pnpm exec biome check src` **0 warnings** (was ~565). Cause-layer: narrow Site Studio / Desktop tail-cluster destructuring and drop dead props — not `biome-ignore`. Same living note §Wave K.

**TS hygiene remediation (2026-09-06 Wave M / W0+W1):** After post–Wave-J drift (`pnpm run typecheck` **689**), Cause A on MarketingCabinet atomization: replace `Record<string, unknown>` compose/bag deps with named interfaces + bivariant `LooseFn` at the compose seam (no `@ts-ignore` / `as any` / `as unknown as`). Evidence: typecheck **689 → 437**; MarketingCabinet **376 → 124**; hot builders/compose **0** TS errors; Biome `src/` **0 warnings**. Residual MC ≈ Cause B nullish OpenAPI (W2+). Forecast: [`reference/solution-readiness/README.md`](../reference/solution-readiness/README.md) (registry retired). Fixed-errors: [`reference/fixed-errors/marketing-cabinet/2026-09-06-compose-unknown-deps-bags.md`](../reference/fixed-errors/marketing-cabinet/2026-09-06-compose-unknown-deps-bags.md).

**TS hygiene W2 (2026-09-06):** Cause B nullish in AMKA + Admin + professional-worlds → **0** errors in those trees (`??` / normalize from defaults / fixture fields). Evidence: SPA typecheck **437 → 274**; amka **89→0**, Admin **38→0**, PW **35→0**. Projection: [`reference/solution-readiness/README.md`](../reference/solution-readiness/README.md) (registry retired).

**TS hygiene W3 (2026-09-06):** Desktop + desktop-ai-chat + ewa → **0** in those trees (fixtures, `?? false`, union guards, list-item types). Evidence: SPA **274 → 189**; Desktop **36→0**, ai-chat **26→0**, ewa **23→0**. Projection: [`reference/solution-readiness/README.md`](../reference/solution-readiness/README.md) (registry retired).

**TS hygiene W4 (2026-09-06):** Residual clear — MarketingCabinet `QueryLike`/`MutationLike` hosts + nullish/fixtures; surveys/OIDC/DocEditor/config/other. Evidence at the time: **`pnpm run typecheck` → 0**. Projection: [`reference/solution-readiness/README.md`](../reference/solution-readiness/README.md) (registry retired). **2026-09-15 leftover dep bump did not restore that bar.** Pre-existing (unmodified vs HEAD) errors remain in `AdminUserDetailEbrowserTab.tsx` (`tone="error"` vs `danger`) and `desktopWorkspaceSettingsIntegrationSlices.ts` / its test (`DesktopWindowStyle` has no `'flat'`; `updateConfig` Promise vs void). Not caused by mermaid 12 / Vite 8.3 / pnpm 12.

**Biome repo root (2026-07-28 Wave L):** `pnpm exec biome check .` **0 errors / 0 warnings** — vendor minified paths excluded in `biome.json` (`public/o-proekte/vendor`, `research-content.bundle.js`, generated `elite-quotes-inline.js`, `!!.build-artifacts`, `!!dist*`). First-party CSP scripts under `public/` + `e2e/` + root `*.ts` configs fixed in-tree; `package.json` `"lint"` stays `src/`-scoped.

**API integrity gate (2026-08-06 R0–R6 + residual clear):** Biome `noExplicitAny` / `noNonNullAssertion` = **error** (DOM/UI overrides warn). Fail-closed `pnpm lint:api` / `lint:gate` — Patterns A/C/D via `shared/web/frontend/scripts/lint-api-integrity.sh`. **Default = REST-strict** (allowlists empty; residual **0**; `API_INTEGRITY_STRICT=1` green). Agent meaning of TS at boundaries: `.cursor/rules/typescript-contract-usage.mdc`. Canon: `documentation/plans/api/API-INTEGRITY-BACKLOG.md` *[operator-local process plan; gitignored — not living canon]*, [`api/FRONTEND-BACKEND-HTTP.md`](../api/FRONTEND-BACKEND-HTTP.md) §Adoption.

Workspace settings (корень / `EliteEW/` / `frontend/.vscode`):

- `js/ts.experimental.useTsgo`: `true`
- `typescript.experimental.useTsgo`: `true`
- `js/ts.tsdk.path` → `…/node_modules/typescript` (корень пакета, не только `/lib`)
- `typescript.tsdk` → `…/node_modules/typescript/lib` (совместимость)
- Extension: **`TypeScriptTeam.native-preview`** (в `.vscode/extensions.json`)

**IDE extensions (Cursor):** install/update via `proxychains4 bash .vscode/install-recommended-extensions.sh` (optional `--uninstall-unwanted`). Unwanted includes Prettier/ESLint/Black/… and **`ms-python.vscode-python-envs`**. Python interpreter SoT — workspace `.vscode/settings.json` → `.venv` (do not set user-level `/bin/python3`).

**Workspace tuning (root `.vscode/settings.json`):** Biome `requireConfiguration` + `lsp.bin` from frontend `node_modules`; Ruff `configuration` → `shared/api/ruff.toml` + venv interpreter; `python.languageServer: None` (Cursor Pyright only); Tailwind `classFunctions` (`cn`/`cva`/`clsx`); Vitest `vitestPackagePath` + `rootConfig` under frontend; compose YAML schema; Error Lens excludes `src/generated`. IDE SoT is **folder open** of the monorepo root + `.vscode/settings.json`, `.vscode/tasks.json`, `.vscode/launch.json`, `.vscode/extensions.json` — do **not** reopen a root `.code-workspace` (soft-retired: duplicate settings overrode folder tuning). After change: **Reload Window**.

**Вне scope:** soft-retired деревья (`DEWA/`, `EWGen/`, … → `trash/`) не задают канон toolchain. Канон **EliteEW SPA** = **TS 7+**.

### Types atomization (facade + domain folder)

Large shared type modules follow the **stable facade + `*Domain/` children** pattern (same as CompanionDocumentEditorMode / SiteManagerOps):

| Stable import | Facade | Domain folder | Contract test |
|---------------|--------|---------------|-----------------|
| `@/types/context` | `src/types/context.ts` (≤50 LOC, export-only) | `src/types/contextDomain/` (`enums`, `models`, `schemas`, `guards`, `validators`, `helpers`, `templateVariables`; each ≤800 LOC) | `src/types/contextDomain/__tests__/context.atomization.contract.test.ts` |

`src/types/index.ts` keeps partial re-exports from `'./context'`; consumers must not deep-import `contextDomain/` unless extending the module.

## pnpm 12 and workspace config

| Item | Where |
|------|--------|
| Package manager | `package.json` → `packageManager`: `pnpm@12.4.1` (Corepack hash appended after `corepack use`) |
| Peer / build / release-age rules | `pnpm-workspace.yaml` (pnpm 10+ does **not** read a `pnpm` key from `package.json`) |
| Lockfile | `pnpm-lock.yaml` |

**Clean machine:** `corepack enable` → from `shared/web/frontend`: `corepack use pnpm@12.4.1` (or the version in `packageManager`; retry on registry blips).

**CI / no TTY:** `CI=true pnpm install`. After `patchedDependencies` or a pnpm major: `CI=true pnpm install --no-frozen-lockfile` once, then a normal install.

**Removed (2026-05):** TipTap 3.22.5 `patchedDependencies` (`patches/@tiptap__extension-bubble-menu@3.22.5.patch`, `…-floating-menu@…`) — packages moved to 3.23.6; patches unused. `prebuild` script removed — the Vite plugin writes build metadata (below).

**Dependency refresh (operator):** `pnpm outdated` / `npm-check-updates` (`pnpm dlx npm-check-updates -u --target latest`); then `pnpm install`, `pnpm run typecheck`, `pnpm run build:react-compiler` when Vite/React/compiler majors moved. **2026-09-22:** patch/minor leftover — `react-router ^8.4.0` (no `UNSAFE_` consumers; granular data-router contexts only), `framer-motion ^13.4.0` (still depends on `motion-dom`/`motion-utils` `^13.3.0`; those packages have no 13.4.0 on the registry, so workspace overrides stay `13.3.0`), `@tanstack/react-query ^5.103.2`, `react-i18next ^17.0.15`, Biome `^2.5.14`, Vitest/`@vitest/coverage-v8` `^5.0.1`, `@babel/core ^8.0.6`, `jsdom ^30.1.0`, `@types/node ^26.6.2`. **2026-09-15:** finished leftover SPA bump including majors — `mermaid ^12.0.0` (shared `mermaidProductLayout.ts`: `layout: dagre` + `look: classic` on root and flowchart; chat `htmlLabels: true`; Doc Editor root `htmlLabels: false`; both `initialize` before each render), Vite `8.3.0` (explicit `.ts` config imports for native `configLoader`), `@types/three ^0.186.0` (matches `three ^0.186.0`), `packageManager` `pnpm@12.4.1`, GHSA overrides `dompurify ^3.4.15` / `ws 8.21.3` / `minimatch ^10.2.6` / `tar ^7.5.22` / `postprocessing 6.39.5`. Residual peers (not a newer direct dep on registry): `@react-three/fiber@9.7.0` still declares `react`/`react-dom` `>=19 <19.3` while SPA is on React `19.3.0`; old nested `@radix-ui/*@1.0.x` still asks React 16–18. Pre-existing `pnpm run typecheck` errors in Admin ebrowser banner tone + Desktop settings slices are **not** from this leftover bump. Historical refreshes: 2026-05-23 TipTap 3.23.6 / Vite 8.0.14; **2026-07-11** TypeScript `^7.0.2`; **2026-07-28** `react-router ^8.3.0`, Vite `8.1.5`, `monaco-editor` `0.56.0`; **2026-08-01** pnpm 11.18 / TipTap 3.29.2 / Vite 8.2.0; **2026-08-13** TipTap 3.30.0 / Vite 8.2.1 / Biome 2.5.8 / framer-motion 13.1.0 / katex 0.18.4 / `pnpm@11.21.0`.

## Прод-сборка и артефакты версии

| Команда | Назначение |
|---------|------------|
| `pnpm run build:react-compiler` | Прод: `VITE_REACT_COMPILER=true`, outDir `dist-build`, React Compiler |
| `pnpm run check:bundle` | Сборка + `shared/web/frontend/scripts/check-bundle-budget.mjs` |
| `ANALYZE=true pnpm run build:react-compiler` | `dist-build/bundle-stats.html` (локально, не в прод-том) |

**Плагин `vite-plugin-build-version.ts`** (`apply: 'build'`, `enforce: 'pre'`):

| Хук | Артефакты |
|-----|-----------|
| **`config` / `buildStart`** | `.build-artifacts/appBuildId.ts` — deploy id **до** Rollup (`resolveId` перенаправляет `generated/appBuildId`) |
| **`closeBundle`** | `dist-build/app-build-version.txt`, `dist-build/meta.json` |
| **Не пишет** | `public/meta.json` (gitignored; не загрязняет git tree) |

Committed `src/generated/appBuildId.ts` — dev placeholder (`dev-local`) only.

**Инвариант:** строка в `app-build-version.txt` **должна совпадать** с id внутри бандла (например чанк `staleBundleReload-*.js`). Иначе prod считает вкладку stale на каждой загрузке — см. **`platform/docker-re_doc/FRONTEND-STALE-CHUNK-404.md`**.

**Проверка после prod-сборки:**

```bash
cd shared/web/frontend
node scripts/verify-app-build-id.mjs   # входит в pnpm run check:bundle
```

**После сборки в prod (stack0 release):** с **command-center** только
`bash docker/scripts/eliteew-deploy.sh release stack0 --all`
(alias `eedeploy` → тот же скрипт; **не** interactive menu / **не** `--frontend-only` / `--backend-only`). Hotfix без rebake — `eeprodline` (dev-bind). Локальный bind-mount на `.136` — только dev/fallback. См. **`platform/docker-re_doc/FRONTEND-STALE-CHUNK-404.md`** §Оператору.

**Dev:** `shared/web/frontend/scripts/generate-meta.js` — placeholder (`buildHash: dev-local`); прод не подменяет.

**Удалено из bootstrap:** `public/react-preload-fix.js`, плагин `vite-plugin-preload-react.js`, `<script src="/react-preload-fix.js">` в `index.html` — предзагрузка React через отдельный скрипт больше не нужна.

## Vite: native `configLoader` (ESM)

Vite 8 warns (and a future major will default to `configLoader: 'native'`) when configs use CJS-style helpers. EliteEW SPA configs are ESM (`"type": "module"`):

| Avoid | Prefer |
|-------|--------|
| `__dirname` in `vite.config.ts` | `import.meta.dirname` (Node 20.11+) |
| Extensionless relative imports of local plugins | Explicit `.ts` (e.g. `./vite-plugin-build-version.ts`) |
| Extensionless `import './vite.config'` from Vitest | `import './vite.config.ts'` |

**Do not** set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to silence these — fix the config. There is no such env in the repo on purpose.

## Vite: `modulePreload` и cold start

В `vite.config.ts` задан `build.modulePreload.resolveDependencies`: из списка preload **исключаются** тяжёлые lazy-чанки (паттерн `MODULE_PRELOAD_DEFER_PATTERN`), в том числе:

- `excalidraw*`, `recharts-vendor`, `UGSDesktopContainer`, `monaco-vendor`, `exceljs-vendor`, `markdown-vendor`, `katex-vendor`, …
- крупные route/page чанки: `UltimateDocEditor`, `MarketingCabinetPage`, `DesktopWorkspaceContent`, …

**Смысл:** при первой загрузке браузер не тянет параллельно весь Excalidraw/Monaco/ExcelJS; чанки подгружаются при открытии фичи. CSP: `worker-src 'self' blob:` — см. security doc.

**`react-vendor`:** отдельный manual chunk для React + react-dom + scheduler + use-sync-external-store. Большой **минифицированный** бандл в DevTools (тысячи «строк») — норма; не признак дублирования React, если в Network один чанк `react-vendor-*.js` на старте.

### Cold `#desktop`: chunk isolation (cause-layer)

Тот же класс бага, что у старого `pdf-vendor`: если Vite `__vitePreload` / `clsx` попадают в тяжёлый named chunk, entry (`main` / `mainFullApp` / `cn`) **статически** импортирует этот chunk на каждый cold boot — idle `#desktop` тянет мегабайты редакторов/чартов без открытых окон.

Инварианты в `manualChunks`:

| Правило | Зачем |
|---------|--------|
| Virtual `\0vite` / `preload-helper` → `vite-client-runtime` | Цель: preload на cold path |
| `clsx` + `tailwind-merge` → `vendor-utils` | `cn()` без charts |
| **Не** форсировать named chunks для Monaco / Excalidraw / Recharts / ExcelJS / KaTeX / PDF / Codemirror / Konva / xyflow / markdown / doc-io | Rolldown «крадёт» `__vitePreload` в первый heavy named chunk с `import()`; entry тогда тянет мегабайты на idle `#desktop` |
| Именованные OK | `react-vendor`, `vendor-utils`, `icons`, `framer-motion`, `chakra-ui`, `tanstack-query`, `zustand`, `socketio`, `vendor-keycloak`, `worker-vendor` |
| UGS mount через `React.lazy` | Idle desktop не sync-pull `UGSDesktopContainer` |

Проверка после `pnpm run build:react-compiler` (также Vitest `distColdEntryChunkIsolation.contract.test.ts`):

```bash
rg -n 'from ["'\'']./(excalidraw|recharts|monaco|exceljs|katex|markdown-vendor|canvas-vendor|flow-vendor)' \
  dist-build/assets/main*.js dist-build/assets/cn-*.js dist-build/assets/mainFullApp*.js || true
# Ожидание: нет попаданий
```

Связанный shell UX (не chunk, но cold path): `AppErrorBoundary` использует `resetKey={currentPage}` вместо `key=` — Maintenance/Preferences/Notifications не remount на login→desktop; `fetchMaintenanceStatus` — single-flight + freshness window; desktop avatar / session health читают `PROFILE_ME_QUERY_KEY`. Session health: один module-level poll (`useSessionDeviceHealth`); nav chrome `AuthStatusIndicator` — `pollingEnabled=false` (tray / floating panel retain). **Proactive token refresh** (`refreshTokenNow`, порог `SESSION_TOKEN_WARNING_SECONDS` = 5 min при AT 900 s) вызывает только `authSession.updateToken` — sync идёт через `onAuthRefreshSuccess` → `syncWithAuthSession({ silent: true })`; прямой `checkAuthentication` запрещён (иначе `auth.loading` или `fetchAndApplyProfile` дают ~600 s remount/API storm).

### i18n cold namespaces (2026-07-18)

`src/i18n/config.ts` statically бандлит только RU shell: `commonUi` + `desktopChrome` (также seeded в `desktopUi` для cold paint). Idle-critical keys (`loginFallback`, `sessionAuth`, `titleBarChrome`, `floatingWidgetCtx`, `virtualDesktops`, slim `musicPlayer.nowPlayingBar`) живут в `desktopChrome.json`. `i18next.init({ ns })` получает **только** cold namespaces. Полный `desktopUi` — через `eliteewLazyLocaleBackend` + **`reloadResources`** на Desktop route boundary (`ensureDesktopUiReady` из `AppRouter`). Guards: `i18nColdNamespaceBoundary.contract.test.ts`, `i18nDesktopUiFullReload.contract.test.ts`.

### Framer / preloader cold path

- `AppErrorBoundary` без `framer-motion` (CSS / EliteTechnicalState) — framer не в entry modulepreload.
- `MODULE_PRELOAD_DEFER_PATTERN` включает `framer-motion`.
- Critical Desktop shell wraps `LazyMotion` with synchronous `domAnimation` (no Suspense on `domMax` before first paint). GAF/socket process mounts after idle + max-delay fallback.
- Default static preloader min budget: **300ms** (`appPreloader.ts`; env `VITE_ELITEEW_PRELOADER_MIN_MS` still overrides). Static preloader hides only after React commit (`completeAppPreloaderHandoff`).
- Production minify: Vite 8 `build.minify: "oxc"`. Custom per-chunk esbuild minify is retired.

### Desktop idle weight

- `DesktopWindowLayer`, AppStore, Search overlays, Modals, StartMenu, LiveVoice — **lazy + mount-gated** (не только `return null` при уже скачанном чанке). Guard: `desktopShellColdLazy.contract.test.ts`.
- Folder library **previews**: one `GET /content/folder-previews` after idle (badge totals: `folder-totals`).

### Desktop folder badge totals + previews

`GET /api/v1/content/folder-totals` — один `GROUP BY folder_item_id` вместо N× `GET /content?limit=1`. FE: `useDesktopFolderLibraryCounts`.

`GET /api/v1/content/folder-previews?folder_item_ids=…` — один `ROW_NUMBER()` top-N на папку вместо N× compact list. FE: `useDesktopFolderLibraryPreviews` → batch query key.

### Desktop shell HTTP bootstrap (wave 4–5)

Cold `#desktop` fan-out is collapsed by **`GET /api/v1/desktop/shell-bootstrap`** (`schema_version` **2+**: profile + preferences + notification-center + maintenance + desktop config + installed + **shell-state (+ etags)** + **items** + recents + badge feeds). FE: `pages/Desktop/services/desktopShellBootstrap.ts` — single-flight hydrate into React Query / maintenance / shell-state RAM cache (seeds use `updatedAt` so TanStack treats data as fresh). `useDesktopStorage` skips `GET /items` when bootstrap already carried items and no dirty flush ran.

**Await invariant (wave 5–6 + boot 2026-08-19):** cold callers on `#desktop` must `await ensureDesktopShellBootstrap()` before their own GETs. The fetch has a **12s deadline** and remains single-flight. `DesktopWorkspace` mounts critical shell after hydrate settles (`shellBootstrapReady`); **GAFChatProvider** + socket bridge mount as deferred runtime (idle + 1.2s max delay) and do not wrap/remount `#desktop-main`. Auth / Preferences / NotificationCenter / Voice / recent hooks / `useDesktopStorage` join the same single-flight (`App.tsx` does **not** kick a parallel ensure). Clear bootstrap cache only after a real logout (`hadAuthenticatedRef`), not on initial `!isAuthenticated` boot or brief token gaps — boot-time async clear raced the first ensure and caused `shell-bootstrap` ×2. In-flight responses after clear are discarded (`bootstrapEpoch`). Empty `gaf_chats: []` is a valid RQ seed (`Array.isArray`). Still separate by design: full App Store catalog (and `GET /items` / `GET /shell-state` remain for refresh, dirty flush, and pre-v2 fallback).

**Cold chunk + staleTime (wave 7):** session restore commits window chrome **before** chunk preload (same P7 as `openWindow`); heavy apps (`EwaApp`, ContentManager, studios, … in `DESKTOP_PRELOAD_DEFER_ON_RESTORE`) are **not** batch-preloaded on restore — Suspense + hover/open warm them. Bootstrap-seeded RQ slices share `DESKTOP_SHELL_BOOTSTRAP_STALE_MS` (120s) via `desktopShellQueryFreshness.ts` (Auth / Preferences / NotificationCenter / GAF me / friends / installed); store catalog uses 120s + `refetchOnMount: false` (not in bootstrap).

| Seeded cache | Cold skip mechanism |
|--------------|---------------------|
| profile / preferences / notification-center | await ensure → `fetchQuery` hits warm RQ |
| desktop config / installed | `useDesktopStorage` / installed `refetchOnMount: false` |
| shell-state | `seedDesktopShellStateFromBootstrap` → `fetchDesktopShellStateDeduplicated` cache hit |
| desktop items | peek `bootstrap.items` in `loadDesktopStorageFromApi` (skip GET unless dirty flush) |
| recent files / content feed | peek after await ensure |
| GAF me / chats | workspace gate + `GAF_CHAT_ME_STALE_MS` / chats staleTime; seed `updatedAt=Date.now()`; first socket `connection-restored` (`initial: true`) must **not** invalidate chats (`gafChatConnectionRestorePolicy`) |
| friends overview | tray mounts after gate; overview `staleTime` 30s |

Idle Network cadence (safety nets; Socket.IO remains live where wired):

| Poll | Was | Now | Live path |
|------|-----|-----|-----------|
| `/app-build-version.txt` | 15s | **300s** (`DEPLOY_POLL_MS`) | focus/visibility still immediate |
| `/system/maintenance` idle | 15s | **120s** (`POLL_MS`) | Socket `system.maintenance` |
| EWDesk news counts | 60s | **300s** | Socket `ewdesk.news_updated` |
| UGS tray idle | 90s | **300s** | faster while `active_count > 0` |
| UGS billing stats | 60s | **300s** | invalidate / focus |

Guards: `desktopShellBootstrap.contract.test.ts`, `desktopShellBootstrapAwait.contract.test.ts`, `desktopShellQueryFreshness.contract.test.ts`, `preloadDesktopApp.restoreDefer.contract.test.ts`, `idlePollCadence.contract.test.ts`, `test_desktop_shell_bootstrap_contract.py`.

### Friends cold path (desktop tray)

Idle `#desktop` needs friends **overview** for tray badges, not Social Hub UI. Cause-layer rules:

| Rule | Why |
|------|-----|
| Tray / visual bridge → `hooks/useFriendsOverview.ts` | Thin RQ hook; no mutation surface / barrel |
| Never `@/features/friends` barrel from `pages/Desktop/**` | Barrel re-exports FriendPicker / FriendsApp / Social Hub |
| GAF helpers → `api/friendsApi` + `types` deep imports | Always-on GAF provider must not pull UI barrel |
| Social Hub stays `React.lazy` (`SocialHubApp`) | Full friends UI only when the app window opens |

Guard: `features/friends/__tests__/desktopFriendsColdImportBoundary.contract.test.ts`.

## Monaco Editor и web workers

**Симптом без настройки:** в консоли `Could not create web worker(s)` / `MonacoEnvironment.getWorkerUrl or getWorker`.

**Решение:** `src/lib/monaco/configureMonacoEnvironment.ts` — `globalThis.MonacoEnvironment.getWorker` с Vite `?worker` импортами (editor, json, css, html, ts). Подключается **до** загрузки редактора через `configureMonacoLoader.ts` (`import './configureMonacoEnvironment'`).

**Worker import paths (monaco-editor ≥0.56):** package `exports` maps `./*` → `./esm/vs/*.js`. Use short ids — `monaco-editor/editor/editor.worker?worker`, `monaco-editor/language/{css,html,json,typescript}/*.worker?worker`. **Do not** import `monaco-editor/esm/vs/.../worker` (resolves to double `esm/vs/esm/vs/...` → Rolldown miss; stack0 bake fails).

**Current (2026-07-28):** `monaco-editor@0.56.x` + Vite `8.1.5` / Rolldown are compatible **with** the short worker paths above. Historical pin to `0.55.1` / Vite `8.1.4` (2026-07-22) was a workaround for the old `esm/vs/...` imports — not required after the path fix.

**Проверка:** `pnpm run build:react-compiler` resolves workers; open EWA admin workflow JSON or ensemble plan editor → DevTools: no main-thread fallback; Network — separate worker chunks when typing in Monaco.

## Статика `public/` и PWA

| Файл | Статус (2026-05) |
|------|------------------|
| `logo.webp` | Канон иконки (favicon, apple-touch, taskbar, manifest) |
| `logo.png` | Удалён (дубль, больший размер) |
| `silent-check-sso.html` | Удалён — OIDC без iframe SSO (`oauth4webapi`, см. **KEYCLOAK-ELITEEW.md**) |
| `manifest.json` | Указывает на `/logo.webp`; **правки не обязательны** после удаления PNG. Опционально: поле `id`, отдельные размеры иконок для iOS home screen |

## DevTools: `http://www.w3.org/2000/svg`

Стандартный **XML namespace** для inline `<svg>` в DOM — не HTTP-запрос к w3.org. В Elements отображается как атрибут `xmlns`; на сеть и CSP не влияет.

## Связанные документы

- **`product/FRONTEND-DEVELOPER-ENTRY.md`** — команды check/build, Tailwind, Biome
- **`platform/FRONTEND-LICENSE-CLEANUP.md`** — MIT-first зависимости, `pnpm licenses:check`
- **`platform/docker-re_doc/FRONTEND-STALE-CHUNK-404.md`** — deploy id, mismatch, reload, Socket gate
- Chronology: dated `worklog/session-summaries/*` soft-retired → `trash/` (not living hubs)
