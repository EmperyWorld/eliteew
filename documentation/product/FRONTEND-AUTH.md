# Frontend: OIDC token and login orchestration

Living SPA auth contract for `shared/web/frontend/`. IdP clients and realm ops: [platform/docker-re_doc/KEYCLOAK-ELITEEW.md](../platform/docker-re_doc/KEYCLOAK-ELITEEW.md). Native desktop/FoFline atomic bind target: [desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md](desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md). Build-time env: [FRONTEND-ENV.md](FRONTEND-ENV.md). Browser cache / logout cascade SSOT: [FRONTEND_BROWSER_CACHE_MODEL.md](FRONTEND_BROWSER_CACHE_MODEL.md). Entry + deploy gates: [FRONTEND-DEVELOPER-ENTRY.md](FRONTEND-DEVELOPER-ENTRY.md).

Retired operator FE trees (DEWA / EWGen / …) are **not** a living SPA path — do not document them as runtime owners.

## Rule

Use **one auth facade** and **one interactive login helper** everywhere:

- Token/session source: `shared/web/frontend/src/services/keycloak.ts` (re-exported by `services/authSession.ts`).
- Interactive redirect source: `shared/web/frontend/src/utils/authRedirect.ts` → `beginInteractiveLogin(reason, options?)`.
- SPA OIDC flow: `oauth4webapi`, public client `empery-web`, PKCE authorization redirect; the authorization **code exchange completes through** `POST /api/v1/auth/sso/callback` so the backend SSO registry can replace the current browser `sid`. Persisted tokens live in `eliteew.keycloak.oidcTokens.v1`: **`sessionStorage` by default** (сброс после закрытия вкладки), **`localStorage`** only when the SPA browser-persistence checkbox is on / explicit `persistSession: true`. Preference: `eliteew.keycloak.persistencePref.v1`. That SPA control is **not** Keycloak login-form Remember Me (SSO cookie / 14d realm policy) — Continuity W2 / [WEB-SSO-SESSION-CONTINUITY-CONTRACT.md](../platform/WEB-SSO-SESSION-CONTINUITY-CONTRACT.md) §Remember Me.
- **Continuity W3 terminal recovery:** idle/max / reuse refresh failures mark `sessionEndedPending` (not `session_replaced`), flush best-effort encrypted capsule via `PUT /api/v1/auth/sso/recovery-capsule`, show session-ended login surface without auto-PKCE, then `GET` consume+restore after same-principal sign-in. Network refresh failures keep the local session.

`App.tsx`, API interceptors, Socket.IO auth failures, `AuthContext.login()` and login fallback UI must call the helper instead of calling `authSession.login()` directly. The helper sets a synchronous guard before discovery/redirect, so multiple 401/socket/App gates do not start competing Keycloak redirects. Axios 401 and `apiFetchWithAuth` 401 both use reason **`api_401`** (same interactive-login bucket).

**TS hygiene (2026-07-28 Wave H):** `sessionSlice` narrows mobile-embedded pages to `ShellPageType`; `AuthContext` validates profile `role` into `User['role']`; `apiFetchWithAuth` uses `api_401`; Socket.IO `opts.auth` patched via typed intersection; OIDC redirect/test hooks are public methods on `AuthOidcFacade` (`clearOidcInteractiveRedirectInFlight`, `*ForTests`).

`AppRouter` must not mount `DesktopWorkspace` while auth is unresolved **and** the user is already authenticated. On `#/desktop`, **unauthenticated** users always get `LoginPageFallback` (auto-SSO or manual sign-in) even when `auth.loading` is still true — bounded OIDC bootstrap (`authBootstrap.ts`) already ran before React mount. Showing `DesktopRouteLoadingFallback` («Открываем Безраздельный мир…») before login blocked auto-SSO and caused an eternal loader on `app.eliteew.ru`. Desktop API bootstrap (`/api/v1/desktop/config`, `/items`, `/shell-state`) is authenticated-only.

## Module layout

Public import path stays **`services/keycloak`** (and `authSession` re-exports). Stage 1–5 complete; export names from `keycloak.ts` remain stable (`recoverMobileEmbeddedSession`, etc.). Leaf modules are implementation only — do not bypass the public barrel for app code:

| Module | Role | Stage |
|--------|------|-------|
| `services/keycloak.ts` | Thin public barrel: re-exports leaves + AuthOidcFacade module | 4 done |
| `services/keycloakAuthOidcFacade.ts` | AuthOidcFacade orchestrator (init/session core + wrappers) | **5 done** |
| `services/keycloakOidcSessionShared.ts` | Shared types/helpers/host for flow modules | **5 done** |
| `services/keycloakOidcLoginFlow.ts` | Interactive login/register PKCE start | **5 done** |
| `services/keycloakOidcCallbackFlow.ts` | Authorization callback + backend SSO exchange | **5 done** |
| `services/keycloakOidcRefreshFlow.ts` | Refresh / updateToken / embedded recover | **5 done** |
| `services/keycloakOidcLogoutFlow.ts` | Logout (local clear + end_session) | **5 done** |
| `services/keycloakOidcDiscovery.ts` | Issuer / auth-proxy discovery URLs, password-reset URL | 1 done |
| `services/keycloakTokenStorage.ts` | Persist / read / clear OIDC tokens | 1 done |
| `services/keycloakProfile.ts` | Runtime profile (`web` / `apk` / `mobileEmbedded`) | pre-existing |
| `services/keycloakPkceState.ts` | PKCE auth-state storage + OAuth callback URL helpers | 2 done |
| `services/keycloakSessionEvents.ts` | Cross-tab `session_replaced` (BroadcastChannel + storage) | 2 done |
| `services/keycloakEmbeddedOidc.ts` | Mobile-embedded bridge: hydrate/refresh via `EmperyMobileNativeOidc` | 3 done |
| `services/keycloakDesktopNativeOidc.ts` | Desktop/FoFline host bridge: hydrate/refresh via `EmperyDesktopNativeOidc` (no JS refresh) | Wave 4 |

Embedded leaf returns token pairs / storage side-effects only — facade applies tokens and callbacks (no import cycle). Session-event leaf binds `clearToken` via `bindSessionReplacedApplicator` (no import cycle with the facade or `authSessionCoordinator`). Flow modules take `AuthOidcSessionHost` and must not import the barrel or facade file. Leaves must not import the barrel or facade.

## Boot orchestration (entry waterfall)

Living SoT: [platform/FRONTEND-BOOT-ORCHESTRATION.md](../platform/FRONTEND-BOOT-ORCHESTRATION.md).

SPA boot is **not** a single global enum. Independent owners run in parallel, and one fullscreen surface is visible:

| State | Owner | Terminal result |
|-------|--------|-----------------|
| entry role | `main.tsx` + `bootRoutePolicy` | full, follower, or fatal |
| auth | `services/boot/authBootstrap.ts` | authenticated, unauthenticated, timeout, or recoverable error |
| cold assets | `i18nReady` + `reactAppEntry.ts` | React commit |
| Desktop data | `ensureDesktopShellBootstrap` (12s deadline) | online, fallback GETs, or recovery |
| Desktop render | critical shell (`DesktopWorkspaceContent`) | `desktop-interactive` |
| extended runtime | deferred GAF/socket process | local degraded if a module fails |

`KeycloakInit` and `IdentityVerificationGate` are compatibility passthroughs. They must not own a second fullscreen loader. `AppRouter` / `LoginPageFallback` / `DesktopWorkspace` own route loaders. Full-tree block on `auth.loading` caused eternal «Проверяем вход…» on `app.eliteew.ru`.

**Login flash guard:** `LoginPageFallback` auto-SSO shows «Подключение…» only (no sign-in form) until callback/error/session-replace paths require manual action. After a successful OIDC callback the auth facade may already hold tokens while `AuthContext` is still syncing — auto-SSO must **not** start a second PKCE redirect in that window (`isAuthSessionAuthenticated()` guard). The auto-login effect must not depend on an unstable `onBeginLogin` callback identity (parent re-renders after `clearAuthAutoLoginAttempted` used to re-trigger `beginInteractiveLogin` and cause an infinite Keycloak redirect loop on `app.eliteew.ru`).

**Socket jitter (desktop):** `socketConnected` moved out of `GAFChatProvider` context into `services/communication/socketConnectionStore.ts` (`useSocketConnectionState`). Tray/header subscribe without GAF message-context rerenders. Socket `connect()` defers until `markDesktopShellReady()` after first desktop config paint (`DesktopWorkspace` + `desktopShellReady.ts`).

`IdentityVerificationGate` is a passthrough. It does **not** block on `auth.loading`, workspace sync, or OIDC redirect — `AppRouter` / `LoginPageFallback` / `DesktopWorkspace` own those surfaces. Full-tree block on `auth.loading` caused eternal «Проверяем вход…» on `app.eliteew.ru`.

Performance marks: `services/boot/bootPerformance.ts` — `performance.mark` / `measure` logged on desktop items ready (`logBootPerformanceSummary` in dev console).

## Localhost / kiosk (portal)

On loopback, OIDC **issuer** stays **`https://auth.eliteew.ru`** (Keycloak callback includes `iss=` that must match). Discovery is fetched same-origin from **`/auth-proxy/.../.well-known/...`** (avoids CORS `Failed to fetch`), then `restorePublicIdpDiscoveryDocument` undoes nginx URL rewrite if present. Top-level login/logout uses public HTTPS (`resolvePublicBrowserAuthorizationUrl`) for Secure cookies + CSS.

`resolveBackendSsoCallbackUrl` keeps **`http://`** on loopback so `POST /api/v1/auth/sso/callback` stays same-origin when the kiosk listens on port 80 without TLS. Non-loopback `http://` bases still upgrade to `https://`.

Chromium kiosk must use **`--host-resolver-rules=MAP auth.eliteew.ru 10.88.89.1,…`** and must **not** use `--app=http://127.0.0.1/`. Nginx must proxy `/auth-proxy/` **without** forcing issuer to loopback (or SPA restores public issuer). Ops: [PORTAL-PRIVATE-TUNNEL-EDGE.md](../platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md) §Kiosk.

## How to send the token

- **Axios / API client**: Use the shared client from `services/api/client.ts` (Wave 26 thin facade; interceptors in `createAPIClient.ts`, streaming via `apiFetchWithAuth`). It attaches `Authorization: Bearer <token>`, refreshes/retries 401 once where possible, then starts interactive login via `beginInteractiveLogin`. Canon: [api/FRONTEND-BACKEND-HTTP.md](../api/FRONTEND-BACKEND-HTTP.md).
- **fetch**: Prefer `apiFetchWithAuth` for streaming `/api/*` endpoints; it refuses external and non-API URLs before adding Bearer. For non-streaming code, add headers explicitly: `headers: { ...getAuthHeader() }` or `headers: { Authorization: \`Bearer ${getToken()}\` }`. Import `getAuthHeader` or `getToken` from `services/keycloak`.
- **Socket.IO / WebSocket**: Use `services/auth/authenticatedSocketAuth.ts` → `buildSocketAuthPayload(getToken())` with path `/socket.io/` and **`window.location.origin`** as Socket.IO URL (not `wss://`). After OIDC access-token refresh call `patchSocketAuth(socket)` / `bindSocketAuthRefresh` — **patch `socket.io.opts.auth` only**; do **not** `disconnect()+connect()` on every refresh (that forced newest-wins `presence:takeover` ~each access-token TTL and Desktop refetch storms). Re-handshake only on auth connect failure via `handleSocketConnectAuthError` / `recoverSocketAuthConnection` (refresh first, then `beginInteractiveLogin('socket_auth')` for terminal auth failure). Socket.IO never replaces the SSO registry `sid`; OAuth callback + HTTP confirm owns takeover. Desktop leader tab (`GAFChatProvider`) retries connect after `presence_superseded` / `connection-lost` when browser lease is busy — см. `SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md` §Leader-tab.

## Do not use

- `(window as any).KeycloakService` — not set in the main app (auth uses `authBootstrap` + AuthContext + `services/keycloak.ts`).
- Soft-retired wrappers: `src/services/auth/KeycloakService.ts`, `src/services/auth/tokenExchange.ts`, `src/services/api/AuthService.ts`, `src/services/core/emperyworldAuthRefresh.ts`, static the shared web auth tree (removed → soft-retired under trash/) (HTML login; path removed — soft-retired under `trash/`); do not reintroduce into the living tree. Shared `User` DTO lives in `src/services/auth/userTypes.ts` (re-exported from `@/services`).
- Password `POST /api/auth/login` and `POST /api/auth/exchange-token` — not registered in `shared/api/domains/auth.py`; SPA never uses them.
- Dual `emperyworld_*` localStorage tokens — retired; BaseService uses `authSession` Bearer only and does not refresh via `/api/auth/refresh`.
- `localStorage.getItem('access_token')` or `'auth_token'` — those are legacy keys and are not the SPA session contract.
- `/oauth2/start` for the web SPA login path — browser/WebView login uses SPA PKCE authorization through `auth.eliteew.ru`, then backend `/api/v1/auth/sso/callback` for token exchange and registry takeover.
- Direct `authSession.login()` in UI/interceptors/socket layers; only the helper should call it.
- SPA / mobile-embedded must not `POST /api/auth/refresh` for OIDC refresh — that path is **MobileAndroid native** only (`MOBILE_AUTH_REFRESH_URL` in `services/auth/mobileAuthRefreshPath.ts`). SPA refresh is Keycloak via `keycloak.ts` / `api/client.ts`.

## Web, Android WebView, native Android

- **Web browser** (and historical Quest shell formerly `EliteEWWebViewAndroid`, now archived at soft-retired EliteEWWebViewAndroid under `trash/`): load `https://app.eliteew.ru`; SPA discovers Keycloak at `https://auth.eliteew.ru`, runs PKCE authorization itself, then posts the code to backend `/api/v1/auth/sso/callback`. Full-screen WebView shells have no custom scheme callback.
- **`pack-cloud/mobile` native**: uses the in-app SSO WebView against Keycloak with public client `empery-mobile`, custom scheme callback (`world.empery.mobile*:/oauth2redirect`), then `POST /api/v1/auth/sso/callback`. Backend selects the client class from `redirect_uri`; the web SPA remains on `empery-web`.
- **FoFline local SPA pack** (`fofline-spa://localhost/…`, profile **`foflineNative`** / `empery-fofline`): custom-scheme pages have opaque `location.origin === "null"`. On **Linux**, default PKCE `redirect_uri` / logout return is the public HTTPS bridge `{APP_ORIGIN}/fofline-oidc-bridge.html` (WebKitGTK cannot follow IdP redirects to `fofline-spa:`); foflineNative authorization uses `response_mode=fragment` so `code`/`state` stay out of HTTPS access logs; the bridge reads the fragment (legacy query fallback), hands off via JS to `fofline-spa://localhost/index.html?…`, and PKCE exchange uses the **stored HTTPS** `redirectUri`. On **Windows** `fofline-spa.localhost`, redirect stays http(s) same-origin (no bridge). OIDC discovery is **baked** (no CORS fetch to Keycloak — live IdP omits ACAO for custom-scheme Origin); refresh uses `POST /api/v1/auth/sso/refresh`; SSO callback posts to absolute API (`VITE_API_*` or `https://app.eliteew.ru`). Desktop hydrate often passes Axios `baseURL: '/api/v1'` — `resolveAbsoluteApiBaseURL` in `services/api/config.ts` (Axios interceptor + streaming `apiFetchWithAuth`) rewrites relative `/api/*` to `https://app.eliteew.ru/api/…` on `fofline-spa:` so shell-bootstrap/config/items/SSE reach stack0 (relative URLs would resolve against the custom scheme and never hit the API). Canon: [`product/desktop/DESKTOP-FOFLINE-EDITION.md`](desktop/DESKTOP-FOFLINE-EDITION.md) §5 / L3.
- **Mobile embedded SPA WebView** (`#/mobile-ewa-companion`, `#/mobile-handbook`, …): общий OIDC runtime profile **`mobileEmbedded`** (`setupMobileEmbeddedOidcProfile.ts` до `initKeycloak`). Токены в `eliteew.keycloak.mobileEmbedded.oidcTokens.v1` через native origin inject + `EmperyMobileNativeOidc` bridge (live read из SecureTokenStore через **`MobileEmbeddedOidcBridgeRegistry`**). Login/redirect на Keycloak **в WebView запрещён**; refresh — **`EmperyMobileNativeOidc.refreshSessionJson()`** (native `AuthRepository` sole owner; не `POST /api/auth/refresh`). Восстановление: `recoverMobileEmbeddedSession()` + `initKeycloak()` (кнопка «Повторить»). Logout embedded — только local clear. Канон: [`product/mobile/MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md`](mobile/MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md).
- **Desktop/FoFline product WebView** (`desktopNative` / `foflineNative`): native-only session ownership. If the host injects `window.EmperyDesktopNativeOidc` and bootstrap has an access token, SPA hydrates access/id, refreshes through `product_session_refresh`, and **never** stores a refresh token. If SPA auth state has not yet observed a newly injected bootstrap, interactive start first recovers through the bridge and fires `onAuthSuccess`; it never sends a direct browser PKCE request for PAR-required `empery-desktop` / `empery-fofline`. Empty/absent/failed bridge in a native profile fails closed and returns control to Hub recovery. Product WebView must **not** `invoke` `native_oidc_*` (main-window ACL). Leftover `session/assert` is skipped when the bridge is present. Canon: [`product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md`](desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md) §9.18.

## Session Replacement UX

Keycloak enforces one browser client session and one native mobile client session per user. API additionally checks the current Keycloak `sid/session_state` in `sso_user_sessions`; a replaced tab/device gets unified auth error `401 reason=session_replaced`.

Frontend behavior:

- `services/api/client.ts` (implementation: `createAPIClient.ts` / `apiClientCore.ts`) handles `session_replaced` before generic refresh retry; parallel 401s dedupe to one toast + `markSessionReplacedPending` (no auto IdP redirect — user clicks «Войти» on `LoginPageFallback`). Unauthenticated API `401 token_missing` rejects silently; background `beginInteractiveLogin` runs only when the client still considers the session authenticated.
- PKCE callback state (`eliteew.keycloak.oidcAuthState.v1` in `sessionStorage`) is preserved while an interactive redirect is in flight or the URL still carries `?code=`; `notifySessionReplaced` must not wipe it mid-login.
- Web OAuth callback posts to backend `/api/v1/auth/sso/callback`. If registry takeover needs confirmation and the callback arrives **without** an active confirm window, backend returns `409 session_replace_confirmation_required`; frontend marks `sessionReplacedPending` + `callbackFailed` and returns to the login fallback (one-time `code` is never retried). **Prevention (2026-07):** `LoginPageFallback` calls `markSessionReplaceConfirmedWindow(SESSION_REPLACE_CONFIRM_OAUTH_WINDOW_MS)` **before** both auto-SSO and every «Войти» click, so the first PKCE callback already sends `X-SSO-Replace-Confirm: 1` when a prior browser `sid` exists in `sso_user_sessions`. Residual 409 (expired window / race) still requires a second explicit sign-in with `forceFreshAuth` when pending markers are set.
- **SSO registry outage (503):** backend returns machine-readable `reason=sso_registry_unavailable` + `action=retry` (not a generic maintenance payload). `services/api/client.ts` / `createAPIClient.ts` skips `publishUnplannedMaintenanceFromHttpError` for that reason; `services/keycloak.ts` surfaces an honest retry message on callback failure. Fail-closed — no silent bypass of registry. Ops: `platform/docker-re_doc/STACK1-POSTGRES-STUCK-CONTAINER.md`.
- Missing PKCE on OAuth callback **does not** auto-restart IdP redirect (that caused Keycloak↔app loops). User sees `loginFallback.callbackFailed` and clicks sign-in once.
- Stale OAuth callback (`401 reason=session_replaced` on `/api/v1/auth/sso/callback` when registry already has a newer Keycloak `sid`) **does not** auto-restart IdP redirect either: frontend sets `callbackFailed` + `sessionReplacedPending`, blocks the one-shot auto-login, and the next explicit «Войти через SSO» uses `prompt=login` (`forceFreshAuth`) so Keycloak issues a fresh session instead of silently reusing an older SSO cookie.
- Auto SSO redirect runs **once per tab** from `LoginPageFallback` (not a parallel `App.tsx` gate). After **explicit logout**, `eliteew.auth.explicitLogoutPending.v1` suppresses that auto redirect until the user clicks «Войти» manually (cleared on successful OIDC callback or explicit sign-in click). The removed 15s login-guard timeout no longer allows a second PKCE overwrite while the user is still at Keycloak.
- `services/auth/ssoSessionReplaceConfirm.ts` coordinates `X-SSO-Replace-Confirm`. Confirm windows persist in `sessionStorage` (`eliteew.auth.sessionReplaceConfirmedUntil.v1`): **30s** default for mid-session API/modal reuse; **15 min** (`SESSION_REPLACE_CONFIRM_OAUTH_WINDOW_MS`) when armed from login fallback so Keycloak password entry survives the full-page redirect. **UI:** desktop-styled modal via `SsoSessionReplaceConfirmHost` where mounted; bootstrap OAuth without a pre-armed window still falls back to login + explicit SSO click because the one-time code cannot be retried.
- `services/auth/sessionAuthToasts.ts` centralizes session toasts (`sessionReplaced`, `loginRedirecting`, replace cancel) for API client and `AuthContext` terminal logout.
- `services/keycloak.ts` exposes `subscribeTokenExpired` / `subscribeAuthRefreshSuccess` so features (Live Voice, sockets) do not overwrite `AuthContext` callbacks; tab visibility triggers proactive refresh.
- **Refresh single-flight (2026-08-26):** `oidcRefreshAccessToken` takes a **sync** `refreshInFlight` lock before any await (no dynamic-import gap). Concurrent `updateToken` / axios / socket / timer join one `refresh_token` grant. `updateToken(Number.MAX_SAFE_INTEGER)` no longer forces refresh when the access token is still fresh (caps effective minValidity). Token read prefers newest `savedAt` across local+session so a stale Remember-Me island cannot win. Terminal refresh failure clears the session **locally** and sets Continuity **session-ended** pending (manual «Войти») — it must **not** IdP-logout/redirect into `LoginPageFallback` auto-SSO (that looped with Keycloak `refreshTokenMaxReuse=0`).
- **Refresh cross-tab + no eager bootstrap rotate (2026-09-26):** cold `init()` skips `refreshAccessToken` when the access token still has ≥70s validity (browser and embedded). Actual grants take `navigator.locks` name `eliteew-oidc-refresh-v1` and re-read persisted tokens after the lock so a second tab adopts a rotated RT instead of replaying the old one (`keycloakOidcRefreshCrossTab.ts`). Without this, Keycloak `Maximum allowed refresh token reuse exceeded` → Continuity W3 «Срок входа истёк» within seconds of a successful SSO callback. UX for `reuse_detected` uses `loginFallback.sessionEndedReuse*` (interrupted, not TTL).
- **Continuity W0 (2026-08-30):** browser `empery-web` refresh emits redacted logger events `browser_oidc_refresh_start` / `browser_oidc_refresh_result` (`WebSsoRefreshContinuity`) with `correlationId` and kind `refreshed` | `idle_or_max_expired` | `session_replaced` | `reuse_detected` | `network` (`services/auth/webSsoRefreshResult.ts`). Declared idle/max policy is **not** inferred from failures — FE `webBrowserSsoSessionPolicy.ts` + `GET /api/v1/auth/sso/session-policy`. Canon: `documentation/plans/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md` *[operator-local process plan; gitignored — not living canon]* §W0.
- UI shows a short warning; user signs in manually from `LoginPageFallback` (`beginInteractiveLogin('manual_login')` resets stuck redirect guards).
- `session_replaced` and terminal refresh failure invoke the same **`onAuthLogout`** handler as explicit sign-out — full **§3.4 six-step cache cascade** (not auth-only purge). See **Logout and cache teardown** below.

## Logout and cache teardown

Explicit `logout()` and `onAuthLogout` (`session_replaced`, terminal refresh) run the **same six-step sequence** via `AuthSessionCoordinator`. **`onAuthError`**, **`onAuthRefreshError`**, and **`keycloak.init()`** paths that call `clearSession(true)` (invalid stored session, callback failure except PKCE-missing) run the **atomic termination** path before step 6. Canonical SSOT: **[FRONTEND_BROWSER_CACHE_MODEL.md](FRONTEND_BROWSER_CACHE_MODEL.md) §3.4**.

### Atomic session termination (kill switch)

Before §3.4 cache steps, terminal auth events call **`executeAuthSessionTermination()`** in `services/auth/authSessionCoordinator.ts`:

| Phase | Action | Code owner |
|-------|--------|------------|
| Lock | `beginAuthSessionTeardown()` — coalesce parallel `onAuthError` / refresh / socket storms; **HTTP freeze** stays until `clearAuthSessionHttpFreeze()` on auth success | `authSessionLock.ts` |
| Abort HTTP | `abortAllPendingHttpRequests()` — **AbortControllerRegistry** (per-request) + session epoch signal merged into axios/fetch | `authSessionHttpAbort.ts`, `services/api/client.ts` |
| Disconnect sockets | `terminateAllAuthenticatedSockets()` — registered hooks + lazy `Services.socket.disconnect()` | `authSessionSocketTeardown.ts`, `useSocketConnection.tsx` |
| Cache cascade | `executeFullLogoutCascade()` — §3.4 steps 1–5 | `authSessionCoordinator.ts` |
| Unlock | `endAuthSessionTeardown()` in `finally` | `authSessionLock.ts` |

While the lock is held, **new auth-bound work is blocked**: axios request interceptor rejects, `apiFetchWithAuth` refuses, `keycloak.updateToken()` returns false, `recoverSocketAuthConnection` / `bindSocketAuthRefresh` no-op, and `AuthContext.syncWithAuthSession` / `onAuthRefreshSuccess` skip. `AuthContext` exposes transient **`isAuthenticating`** during teardown.

Regression lock: `authSessionDeathSpiral.test.ts` (kill switch + session-replaced integrity); see cache model §9 bundle.

| Step | Action |
|------|--------|
| 1–5 | `executeFullLogoutCascade()` in `services/auth/authSessionCoordinator.ts` — principal LS, GAF E2EE, shell RAM/IDB, ETag maps, React Query, token exp RAM cache, notifications |
| 6 | `authSessionLogout()` → `clearPersistedKeycloakTokens()` — OIDC tokens in active storage only |

**Storage rules:**

- Persisted tokens live in `eliteew.keycloak.oidcTokens.v1`: **`sessionStorage` by default** (cleared when tab closes), **`localStorage`** only when SPA browser-persistence is on / `persistSession: true`. Preference: `eliteew.keycloak.persistencePref.v1`. Distinct from Keycloak form Remember Me (theme `eliteew` copy + realm Remember Me timeouts).
- Ordinary logout **never** calls `localStorage.clear()` / `sessionStorage.clear()` — selective purge per steps 1–6. Full origin wipe is **AppErrorBoundary** only (cache model §4.7).
- **Preserved on logout:** pre-auth fallbacks `elite_desktop_config`, `elite_desktop_items`.

Regression lock: `full_logout_cascade.test.ts` (see cache model §9 bundle).

## Login surfaces and profile entry (desktop)

| Surface | Path / trigger | Notes |
|---------|----------------|-------|
| Auto gate | `LoginPageFallback` → one auto `beginInteractiveLogin` per tab | Saves intended page; arms OAuth confirm window (15 min) before PKCE; skips auto redirect after failed OAuth callback / explicit logout pending |
| Explicit login | `AppRouter` `LoginPageFallback` (`#/login`) | i18n `desktopUi.loginFallback.*`; premium green card aligned with Keycloak `eliteew` theme; SPA persistence checkbox default **off** (browser tokens only; hint points at separate Keycloak Remember Me), pref in `sessionStorage` `eliteew.login.rememberMePref.v1`; every «Войти» arms OAuth confirm TTL. **Desktop/FoFline product WebView** shows `loginFallback.desktopClosing` (no «Войти» card) **only while** `hasExplicitLogoutPending()` and the host destroys the window. A native bootstrap arriving after SPA initialization is recovered through `product_session_refresh`; no direct browser PKCE downgrade is permitted for PAR-required native clients. Missing/failed bridge remains an honest Hub recovery state, not a silent no-op or callback loop. |
| Start Menu account | Footer avatar/name chip | Opens Social Hub profile tab via `onOpenProfile` |
| Session panel | Tray → floating panel → «Profile and settings» | Same `onOpenProfile`; panel remains health/session focused |
| Command palette | `openProfile` / Win+U | Unchanged; Start Menu improves discoverability |
| Start Menu sign-out | Power icon footer | Immediate SSO logout (`performLogout` → `AuthContext.logout`); sets `eliteew.auth.explicitLogoutPending.v1` so browser `LoginPageFallback` does not auto-restart OIDC until user clicks «Войти». **Desktop/FoFline product WebView** (`desktopNative` / `foflineNative`): no Keycloak `end_session` **redirect**. Host **RFC 7009 revokes** the refresh token (DPoP), wipes keyring, wipes WebView cookies, and **destroys** the product window (deferred `destroy` after IPC). Hub window close and tray **Выйти** use the same revoke, then **quit the process** (no hide-to-tray). `PRODUCT_LOGOUT_CLOSING` still lets SPA logout destroy the product window without a second app quit. Browser `web` profile still uses IdP logout. |

## Session toast policy

| Event | Toast key | When |
|-------|-----------|------|
| `session_replaced` (API) | `sessionAuth.sessionReplaced` | With login fallback message; manual SSO only |
| Replace confirm cancelled | `sessionAuth.sessionReplaceCancelled` | User declines SSO replace modal |
| Terminal expiry / refresh dead | `sessionAuth.loginRedirecting` | Once per ~5s before IdP logout redirect (`AuthContext`, API client) |

## Summary

| Context        | Use |
|----------------|-----|
| Axios / api client | Use as-is; interceptors add/refresh the token and call `beginInteractiveLogin` on terminal auth failures. |
| fetch          | `getAuthHeader()` or `Authorization: Bearer ${getToken()}`. |
| Socket.IO / WS | `buildSocketAuthPayload(getToken())`, `patchSocketAuth`, `handleSocketConnectAuthError`; refresh/reconnect before interactive login. |
| Manual login UI | `beginInteractiveLogin('manual_login')` resets login guards; durable **browser** token persistence must pass `persistSession: true` (not IdP Remember Me). |

Import from `services/keycloak.ts`: `getToken`, `getAuthHeader`. For fetch with auth use `authFetch` from `services/api/httpUtils.ts`; for 404-as-default use `handle404` from the same file.

**Модель угроз:** Bearer в DevTools не является «дырой» сам по себе; обязательна серверная авторизация на ресурс. См. **`platform/FRONTEND-SPA-BEARER-THREAT-MODEL.md`**.

---

## Error display (toast)

- **API errors**: Use `handleAPIError(error)` from `services/api/error-handler.ts`. It maps status codes to messages from `ErrorMessages` (config) and shows a toast (sonner). Use for failed requests, mutations, and query errors.
- **Other UI notifications**: Use `toast` from `sonner` directly (`toast.success`, `toast.error`, `toast.warning`) for non-API feedback (e.g. "Не удалось воспроизвести аудио").
- Prefer one approach per context: API failures → `handleAPIError`; local/playback feedback → `toast.*`.
