# Frontend environment variables (VITE_*)

Build-time variables (Vite) are available as `import.meta.env.VITE_*` in `shared/web/frontend/`.

| Variable | Description | Example / default |
|----------|-------------|-------------------|
| `VITE_APP_ORIGIN` | App origin for redirects (auth) | `https://app.eliteew.ru` |
| `VITE_API_ORIGIN` | API origin for redirect normalization | `https://api.eliteew.ru` |
| `VITE_API_URL` | Base URL for API (if absolute) | — |
| `VITE_WS_URL` | Socket.IO / realtime **origin** (Tauri/desktop absolute); SPA uses page origin + `/socket.io/` — not legacy `/ws` echo | `wss://app.eliteew.ru` |
| `VITE_WS_ORIGIN` | WebSocket origin (legacy alias; prefer Socket.IO path) | — |
| `VITE_KEYCLOAK_URL` | Keycloak realm base URL | `https://auth.eliteew.ru` |
| `VITE_KEYCLOAK_CLIENT_ID` | Public SPA OIDC client | `empery-web` |
| `VITE_KEYCLOAK_MOBILE_CLIENT_ID` | Native / AppAuth mobile client | `empery-mobile` |
| `VITE_KEYCLOAK_API_CLIENT_ID` | API audience / confidential client id (metadata only in SPA) | `empery-api` |
| `VITE_KEYCLOAK_APK_DOWNLOAD_CLIENT_ID` | Optional override for APK-download OIDC profile | — |
| `VITE_KEYCLOAK_DESKTOP_CLIENT_ID` | Tauri desktopNative OIDC client | `empery-desktop` |
| `VITE_KEYCLOAK_FOFLINE_CLIENT_ID` | FoFline foflineNative OIDC client (W2) | `empery-fofline` |
| `VITE_EWA_COMPANION_DEGRADE_DEBUG` | Companion best-effort degrade `console.debug` (`0`/`false`/`off` silences) | enabled unless `0` |
| `VITE_COMFYUI_URL` | ComfyUI base URL | — |
| `VITE_EWLSHIELD_URL` | EW LShield URL | — |
| `VITE_LLAMA_DEFAULT_MODEL` | Default Llama model | — |
| `VITE_ARLYQUEEN_MODEL` | ArlyQueen model | — |
| `VITE_DEV_*` | Dev-only flags | — |
| `VITE_OUT_DIR` | Build output dir (if overridden) | — |
| `VITE_EWHOME_PROXY` | EW Home proxy base path | `/ewhome-proxy` |
| `VITE_ELITEEW_PRELOADER_MIN_MS` | Minimum static preloader display time before React hides it; keeps the branded quote screen from flashing too fast. Clamped to `0..15000`. | `2000` |

**Auth storage (not env):** OIDC tokens persist under `eliteew.keycloak.oidcTokens.v1` in **`sessionStorage` by default**; **`localStorage`** only when «Запомнить меня» / `persistSession: true`. Preference key: `eliteew.keycloak.persistencePref.v1`. See [FRONTEND-AUTH.md](FRONTEND-AUTH.md) and [FRONTEND_BROWSER_CACHE_MODEL.md](FRONTEND_BROWSER_CACHE_MODEL.md) §3.4–3.5.

For local overrides, create `.env.local` in `shared/web/frontend/` (not committed). IdP clients and realm ops: `platform/docker-re_doc/KEYCLOAK-ELITEEW.md`.
