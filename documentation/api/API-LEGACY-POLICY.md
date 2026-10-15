# Legacy API policy (EliteEW)

Applies to the living **EliteEW** FastAPI surface (`shared/api`). Soft-retired DEWA operator APIs are out of scope.

Hub: [`README.md`](README.md). Auth audience for API tokens: Keycloak **`empery-api`**.

## Canonical prefix

**Canonical API prefix: `/api/v1`.**

All new integrations MUST use paths under `/api/v1/...`. Paths under `/api` without the `v1` segment are **deprecated**.

## Removal status (as of 2026-08)

Legacy paths (without `/api/v1`) are **deprecated**. The earlier target date **2026-06-01 passed without a cutover** — dual mounts still exist where `register_router_v1_and_legacy` is used.

**Policy now:**

- New integrations **MUST** use `/api/v1/...` only.
- Do **not** add new legacy (non-v1) mounts.
- Physical removal of remaining legacy prefixes requires an **explicit operator cutover** plus migration evidence (FE/mobile/desktop clients) — not a silent calendar drop.

## Inventory (v1 vs legacy)

| Router / area | v1 prefix | Legacy prefix | OpenAPI tag (v1) | OpenAPI tag (legacy) |
|---------------|-----------|---------------|------------------|----------------------|
| auth_keycloak | /api/v1 | /api | Keycloak SSO Authentication | (Legacy) |
| auth_logout | /api/v1 | /api | OAuth2 + Keycloak Logout | (Legacy) |
| profile | — | /api | — | User Profile - OAuth2 Proxy (Legacy) |
| user_profile | /api/v1/profile | /api/profile | User Profile - Complete Profile Management Cabinet | (Legacy) |
| themes | /api/v1 | /api | Theme Customization System | (Legacy) |
| ai_business_generator | /api/v1 | /api | AI Business Generator | (Legacy) |
| unified_editor | /api/v1 | /api | Unified Editor | (Legacy) |
| elite_editor | /api/v1 | /api | Elite Document Editor | (Legacy) |
| doc_editor | /api/v1/doc-editor | /api/doc-editor | Ultimate Document Editor | (Legacy) |
| ~~websocket_handler~~ | — | ~~/api/ws~~ | — | **Soft-retired 2026-07-28** (unauthenticated FastAPI echo); living realtime = Socket.IO / Live Voice / Doc Yjs — see [`REALTIME-SOCKETIO-AND-WS.md`](../platform/REALTIME-SOCKETIO-AND-WS.md) |
| ewrp | /api/v1/ewrp | — | EWRP - Revolutionary Presentations | — |
| ugs_admin_router | /api/v1/ugs/admin | /api/ugs/admin | UGS Admin | (Legacy) |
| audio_transcription_router | /api/v1/audio-transcription | /api/audio-transcription | Audio Transcription | (Legacy) |
| audio_transcription_local_router | /api/v1/audio-transcription-local | /api/audio-transcription-local | (Legacy) |
| voice_center | /api/v1 | /api | Voice Center | (Legacy) |
| kokoro_tts_router | /api/v1/tts | /api/tts | Kokoro TTS | (Legacy) |
| unified_content | /api/v1 | /api | Unified Content | (Legacy) |
| unified_content_search | /api/v1 | /api | (Legacy) |
| unified_content_versions | /api/v1 | /api | (Legacy) |
| unified_content_shares | /api/v1 | /api | (Legacy) |
| dashboard_widgets | /api/v1/dashboard | /api/dashboard | Dashboard Widgets | (Legacy) |

## Frontend

All frontend requests to EliteEW backend MUST use `/api/v1/...` (via `apiClient` or `createAPIClient` and `API_PATHS.*`). No hardcoded `/api/` without `v1` for REST calls.

## Optional monitoring

A middleware or logger can record requests to legacy paths (path, Referer, User-Agent) to assess usage before removal.

---

# Profile API (canonical vs legacy)

## Canonical source

The **canonical** profile API is **user_profile** at **`/api/v1/profile`** (router: `api/routers/user_profile.py`). Use it for all new integrations.

- **GET/PATCH /api/v1/profile/me** and other **/api/v1/profile/*** endpoints are the canonical contract.

## Legacy profile

The **profile** router with prefix **/api** (`api/routers/profile.py`) exists only for **OAuth2 Proxy / legacy** compatibility. All its operations are deprecated in OpenAPI with the message: use **GET/PATCH /api/v1/profile/...** (user_profile) instead.

- Do not use **/api/profile/*** or the old profile router for new code.
- Frontend uses only **API_PATHS.PROFILE** (`/api/v1/profile`) via **profileService**.
