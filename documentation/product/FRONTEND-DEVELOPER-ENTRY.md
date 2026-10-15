# Frontend developer entry

The product SPA lives in [shared/web/frontend](../../shared/web/frontend/). Read [developer setup](../platform/DEVELOPER-SETUP.md) first for Node/pnpm requirements and the limitations of local backend proxying. This guide describes source entry points and available checks; it does not certify the whole frontend's runtime behavior.

## Boot, identity and requests

[main.tsx](../../shared/web/frontend/src/main.tsx) resolves tab policy before loading the application. Follower tabs enter [followerMain](../../shared/web/frontend/src/followerMain.tsx); the leader/skip path loads [mainFullApp](../../shared/web/frontend/src/mainFullApp.ts). Full boot coordinates bounded authentication, i18n/preloader work and [React mounting](../../shared/web/frontend/src/reactAppEntry.ts). See [boot orchestration](../platform/FRONTEND-BOOT-ORCHESTRATION.md).

[authSession.ts](../../shared/web/frontend/src/services/authSession.ts) is the shared OIDC facade for HTTP/WS clients, re-exporting [keycloak.ts](../../shared/web/frontend/src/services/keycloak.ts). Boot initialization is in [authBootstrap](../../shared/web/frontend/src/services/boot/authBootstrap.ts); React consumers use [AuthContext](../../shared/web/frontend/src/contexts/AuthContext.tsx). Interactive login goes through [authRedirect](../../shared/web/frontend/src/utils/authRedirect.ts). REST requests use [the API client](../../shared/web/frontend/src/services/api/client.ts).

Logout and terminal session changes use [authSessionCoordinator](../../shared/web/frontend/src/services/auth/authSessionCoordinator.ts), which coordinates selective cache teardown. Consult [frontend auth](FRONTEND-AUTH.md), [browser cache model](FRONTEND_BROWSER_CACHE_MODEL.md), [environment settings](FRONTEND-ENV.md) and [SPA Bearer threat model](../platform/FRONTEND-SPA-BEARER-THREAT-MODEL.md) before changing token persistence, principal caches or reload ownership. The retired auth service files are not current owners. Mobile refresh is a distinct path; do not infer SPA refresh behavior from `/api/auth/refresh`.

## Shell routing and state

Top-level navigation uses hash/current-page policy in [pageRouting](../../shared/web/frontend/src/utils/pageRouting.ts), [the reducer](../../shared/web/frontend/src/appState/reducer.ts) and [AppRouter](../../shared/web/frontend/src/components/AppRouter.tsx). Embedded applications can have their own routing; inspect their router rather than treating every URL as a shell page.

State types and actions are in [types.ts](../../shared/web/frontend/src/appState/types.ts); defaults are in [initialState](../../shared/web/frontend/src/appState/initialState.ts). The reducer dispatches to [slices](../../shared/web/frontend/src/appState/slices/). [AppStateContext](../../shared/web/frontend/src/contexts/AppStateContext.tsx) and [useAppState](../../shared/web/frontend/src/hooks/useAppState.tsx) expose the state to consumers.

Application discovery/capabilities also depend on [app manifests](../../shared/apps/README.md) and installation profiles. An enabled app id is not proof that all required remote providers are available.

## Local checks and build

Run these in `shared/web/frontend` with the package's declared toolchain. [package.json](../../shared/web/frontend/package.json) is the command contract.

- `pnpm run typecheck`: TypeScript project validation.
- `pnpm run lint`: Biome checks of `src/`, with formatting disabled; `lint:api` is an additional API integrity script and `lint:gate` combines both.
- `pnpm run test`: Vitest unit tests. The package requests a large Node heap; prefer a targeted suite when verifying a localized change.
- `pnpm run check:local`: typecheck, lint and tests.
- `pnpm run licenses:check` and `pnpm run i18n:check`: dependency/license and locale parity gates.
- `pnpm run build`: preloader quote generation plus Vite build. It does not itself run typecheck.
- `pnpm run build:react-compiler`: the same preparation with `VITE_REACT_COMPILER=true`.
- `pnpm run check:bundle`: compiler build, gzip budgets and app build-id verification.
- `pnpm run check:release`: `check:local`, **licenses**, i18n and bundle checks, in that order.

`test:socket-self-heal`, `test:auth-media-resilience`, `test:content-download-resilience`, `test:boot-layout-resilience`, `test:gutter-stability` and `test:admin-shell` are declared focused regressions. Exact test counts change with source; use runner results rather than historical counts. The primary [PR gate](../../.github/workflows/eliteew-pr-gate.yml) selects these checks and differs from local `check:release`.

The declared `validate:eliteew` command points to a missing relative script. Until a separately authorized code/configuration fix, invoke `bash scripts/eliteew/validate-local.sh` from the monorepository root. The current CI pnpm pin is also below the package requirement. Both issues are recorded in [the audit report](../reference/DOCUMENTATION-AUDIT-REPORT.md).

[Playwright configuration](../../shared/web/frontend/playwright.config.ts) uses `MC_E2E_BASE_URL` or `http://127.0.0.1:5173`. The current Vite development server uses port 3000; set the base URL explicitly for that server. E2E scenarios have opt-in flags, session requirements and backend effects; read [e2e/](../../shared/web/frontend/e2e/) before running them.

For a source-only API detail test, from the monorepository root:

```bash
cd shared/api
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=.. ../../.venv/bin/python -m pytest \
  -o cache_dir=/tmp/eliteew-documentation-pytest tests/test_json_safe_smoke.py -q
```

The path is `../../.venv`, not `../.venv`. Broader integration tests need configured dependencies; see [testing strategy](../platform/TESTING-STRATEGY.md) and [the immutable API test runner](../../docker/scripts/run-stack0-api-tests.sh).

## Cache, i18n and UI conventions

For logout/cache changes, inspect the existing targeted tests under `src/services/auth/__tests__`, including `full_logout_cascade.test.ts`, `cacheLifecycle.integration.test.ts` and `clearPrincipalScopedLocalStorage.test.ts`. Related contracts cover desktop API teardown, follower invalidation and deploy detection. Do not clear all browser storage as a substitute for the coordinated teardown.

Locale registration lives in [i18n/config.ts](../../shared/web/frontend/src/i18n/config.ts) and [locales](../../shared/web/frontend/src/i18n/locales/). Pair English/Russian namespaces and run the parity gate. Do not assume every namespace loads eagerly: inspect the current loader and boot path.

[Toolchain/build](../platform/FRONTEND-TOOLCHAIN-AND-BUILD.md), [UI components](UI-COMPONENTS.md), [virtual-list/performance patterns](FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md) and [emoji policy](EMPERYWORLD-EMOJI-POLICY.md) retain detailed conventions. Tailwind v4 and code-quality rules live in [tailwind-v4-conventions.mdc](../../.cursor/rules/tailwind-v4-conventions.mdc) and [code-quality.mdc](../../.cursor/rules/code-quality.mdc). Use semantic keyboard-accessible controls, stable list keys and explained narrow exceptions.

Desktop styling uses [constants](../../shared/web/frontend/src/pages/Desktop/constants/index.ts) such as `DESKTOP_SURFACE` and `DESKTOP_TYPOGRAPHY`; follow existing theme tokens. [mediaSessionMusic](../../shared/web/frontend/src/pages/Desktop/utils/mediaSessionMusic.ts) owns music Media Session synchronization. IDE CSS custom data and webhint settings are tooling hints, not evidence that a build or accessibility check has passed.

## Production operations

Image builds belong to command-center; production runtime belongs to prod-core. Planned stack0 release uses the unified CLI with API+SPA `--all`; see [infrastructure guide](../platform/INFRASTRUCTURE-SOURCE-GUIDE.md), [dual-line runbook](../platform/PROD-CORE-DEV-BIND-LINE.md), [stale-chunk recovery](../platform/docker-re_doc/FRONTEND-STALE-CHUNK-404.md) and [topology state](../platform/PRODUCTION-TOPOLOGY-STATE.md). No build/deployment was performed as part of this documentation-only change.
