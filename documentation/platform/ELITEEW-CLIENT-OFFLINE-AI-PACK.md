# EliteEW · client / offline-capable pack — `client-offline-ai`

**Status:** Phase 4+ — **O3a–O3e** Done; **O4** denylist **0.3.5**; **O5** local pack app panels first shipped in shell **0.4.0** (ProjectAbout / Clipboard / Notifications / Music — not SPA Kernel). Public Connected/FoFline shell OTA **0.5.36** RPM-only (TREE **0.5.37** pending publish; last dual-OS NSIS **0.4.61**) — see [DESKTOP-CLIENT-VERSION-SOT.md](../product/desktop/DESKTOP-CLIENT-VERSION-SOT.md) / [DESKTOP-TAURI-CONNECTED-CLIENT.md](../product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md); this pack is **not** FoFline.
**Editions canon:** [ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md) §3.4 / §6 / §9 / §11.
**Not FoFline:** FoFline is a **connected** local SPA pack over mandatory WG — see [DESKTOP-FOFLINE-EDITION.md](../product/desktop/DESKTOP-FOFLINE-EDITION.md). Do not treat this offline-AI pack as FoFline.
**On-prem sibling:** [ELITEEW-ONPREM-TEAM-CORE-PACK.md](ELITEEW-ONPREM-TEAM-CORE-PACK.md).
**Profile SoT:** `shared/apps/_profiles/client-offline-ai.yaml` (`mode: edition_default`, `edition: client`).
**Env overlay (no secrets):** `shared/apps/_profiles/packs/client-offline-ai.env.example`
**Smoke:** `bash scripts/eliteew/smoke-install-profile.sh --profile client-offline-ai`
**AI router:** `shared/api/services/ai_provider_router/` · Tauri: `ai_local_*` / `ai_third_party_*` / `ai_eliteew_*`.

## 1. Intent

Ship a pack where:

- The Desktop shell runs primarily on the **end-user device**.
- Only apps with `edition_default.client: true` are enabled by default (today: Notifications, Project About, Clipboard, Music Player — **4** components).
- Network API is **optional and scoped** (remote tools allowlist), not a permanent full stack0 surface.
- User chooses AI: **local** / **third-party** / **EliteEW** — pack policy is a hard floor over user preference.

## 2. Required env (overlay)

```bash
# from shared/apps/_profiles/packs/client-offline-ai.env.example
ELITEEW_PRODUCT_EDITION=client
ELITEEW_INSTALL_PROFILE=client-offline-ai
```

**Dual-flag:** empty `ELITEEW_INSTALL_PROFILE` + `edition=client` → `client-offline-ai`. Mismatch with another profile’s edition → **503**.

Optional (future / router policy — not required for profile smoke):

| Env (planned) | Meaning |
|---------------|---------|
| `ELITEEW_AI_PROVIDER_DEFAULT` | `ai.local` \| `ai.third_party` \| `ai.eliteew` (UnifiedConfig living) |
| `ELITEEW_AI_PROVIDERS_ALLOWLIST` | Comma list; **empty = `ai.local` only** on client (opt-in `ai.third_party` / `ai.eliteew`) |
| `CLIENT_REMOTE_TOOLS_EXTRA_PREFIXES` | Optional CSV of extra API path prefixes for client remote-tools gate |

**Runtime:** `get_active_ai_provider_snapshot()` · probes `probe_local_ai_provider()` / `probe_third_party_ai_provider()` / `probe_eliteew_http_provider()` · `probe_active_provider()` / `probe_all_providers()`.
**API:** `GET /desktop/install-profile` schema_version **3** includes `access_mode`, `seat_activation_required`, `ai_provider`, `ai_providers_allowlist`, `ai_local_configured`, `ai_third_party_configured`, `ai_eliteew_configured`, `ai_active_configured` (best-effort; AI misconfig does not 503 the catalog). The current official client profile remains a managed delivery channel with signed seat activation; this entitlement is separate from MIT source/runtime rights and from the activation-free `onprem-team-core` community profile.

Optional probe env (no secrets in overlay):

| Env | Meaning |
|-----|---------|
| `ELITEEW_AI_LOCAL_BASE_URL` | Local OpenAI-compat base → `ai.local` configured |
| `ELITEEW_AI_LOCAL_MODEL` | Optional model label |
| `ELITEEW_AI_THIRD_PARTY_BASE_URL` | Third-party base URL (key not in probe) |
| `ELITEEW_AI_THIRD_PARTY_MODEL` | Optional model label |
| `ELITEEW_AI_THIRD_PARTY_API_KEY` | Bearer for O3b completions only (never in probe/API response) |
| platform `llama_url` | `ai.eliteew` configured |

Secrets for third-party keys: **OS keyring** (O3d) or ops env. **O3a–O3e** living (probes, API completions, Tauri local / third_party / eliteew). EliteEW endpoint not baked publicly — set `ELITEEW_AI_ELITEEW_BASE_URL` / `LLAMA_URL` or pack conf.

## 3. Enabled Desktop apps (edition_default.client)

Resolved via `resolve_enabled_app_components("client-offline-ai")`:

| Manifest id | `app_component` |
|-------------|-----------------|
| notifications | NotificationsApp |
| project_about | ProjectAboutApp |
| clipboard | ClipboardManager |
| music_player | MusicPlayer |

**Music Player honesty (`offline_capable: partial`):** offline Kernel panel (`desktop-client/.../MusicPlayerPanel.tsx`) plays a **local file** via **native rodio/cpal** (`native_audio_*`; no HTML5 `<audio>` fallback) and states that the **cloud library is unavailable**. It must not fake remote catalog / `music_playlists` sync. Full library + playlists require SPA/online Desktop Music Player (`DESKTOP-MUSIC-PLAYER.md` §Client edition). Lock: `MusicPlayerPanel.honesty.contract.test.ts`.

**Out of pack (examples):** App Store, Assistant, EWDesk, Social Hub, marketing/admin, and all `_legacy` components until individually marked `client: true`.

Growing the pack = flip `edition_default.client` on a manifest (and satisfy `requires` offline), not a fork.

## 4. Offline / remote capability matrix

| Mode | Meaning | Pack default |
|------|---------|--------------|
| Shell UX (listed apps) | Works without network when local state/cache allows | Expected |
| `ai.local` | User-configured local inference | Preferred when configured |
| `ai.third_party` | User-supplied API keys/endpoints | Opt-in |
| `ai.eliteew` | EliteEW API for selected tools only | Opt-in; fail closed if pack forbids |
| `tools.remote` | Explicit remote tool allowlist | **Deny by default** — API hard gate `client_remote_tools.py` when `ELITEEW_PRODUCT_EDITION=client` (bootstrap + mapped manifest tools + `CLIENT_REMOTE_TOOLS_EXTRA_PREFIXES`) |

Honest UX: if a tool needs network and the provider is missing/unreachable → visible fail, not a silent empty success.

## 5. AI provider router (contract)

Kernel module: `api.services.ai_provider_router`

```text
request → resolve_provider_kind(edition, allowlist, user_pref)
       → probe_provider(kind)  # O3a: configured? base_url?
       → chat_completion_json | chat_completion_stream  # O3b service
```

**Rules (living):**

- Pack / edition allowlist is a **hard floor** — user pref cannot enable a forbidden provider.
- **Client default allowlist = `ai.local` only**; `ai.third_party` / `ai.eliteew` require explicit `ELITEEW_AI_PROVIDERS_ALLOWLIST`.
- **Client remote tools:** `oauth2_protection` applies `client_remote_tools` deny-by-default (not YAML-only).
- Missing required provider → `AiProviderNotConfiguredError` (fail closed).
- **O3a probes:** `ai.local` / `ai.third_party` / `ai.eliteew` report `configured` from env/platform URL only (no API keys in probe payload).
- **O3b completions:** `resolve_active_completion_endpoint` → `httpx_compat_chat_completion_*`; third-party requires `ELITEEW_AI_THIRD_PARTY_API_KEY` at call time; model id required for all kinds.
- **O3c Tauri local:** device OpenAI-compat (`ai_local_*`); baked default `http://127.0.0.1:11434`.
- **O3d Tauri third_party:** URL/model in app data; API key in OS keyring; env read-only fallback.
- **O3e Tauri eliteew:** platform LLM URL via env/conf; network probe (`/health`, `/v1/models`, `/api/tags`); chat hidden when `offline`.
- Cloud/on-prem may reuse the same router with defaults pinned to platform LLM later.

Do **not** claim full Kernel apps offline Done. Regression: vitest `*AiPanelState.test.ts`; `cargo test --lib`.

## 6. Operator / device loop (foundation)

1. Build or package SPA/Desktop with client overlay env (or embed profile at bake time).
2. Apply `ELITEEW_PRODUCT_EDITION=client` + `ELITEEW_INSTALL_PROFILE=client-offline-ai` on any API the client still talks to (optional eliteew tools).
3. Smoke:

```bash
bash scripts/eliteew/validate-app-manifests.sh
bash scripts/eliteew/smoke-install-profile.sh --profile client-offline-ai
```

4. Expect Start/store (when API present) to show only the four client apps; install-profile → `edition=client`, `profile_id=client-offline-ai`.

**Wrapper (connected vs offline):** Tauri 2 in `pack-organization/connection-agent/` — O5 local pack panels landed in **0.4.0**; public Linux shell **0.4.63**. **O0–O5** living per [DESKTOP-TAURI-CONNECTED-CLIENT.md](../product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md) §8/§8.1.

## 7. Failure / Edge-Case Matrix

| Axis | Behavior |
|------|----------|
| **Offline-mode** | Declared client apps degrade honestly without API; remote AI/tools fail visibly. Profile smoke is fully local. |
| **Dual-flag / conflict** | Edition/profile mismatch → **503**. User AI pref vs pack allowlist → pack wins (deny). |
| **Permission / access** | Local principal offline; remote calls need tokens only for opted-in tools. |
| **Regression command** | `bash scripts/eliteew/smoke-install-profile.sh --profile client-offline-ai` (+ pytest `test_ai_provider_router` when present) |

## 8. Explicit non-goals (this foundation)

- Claiming offline Kernel apps Done beyond entitlement cold catalog (DESKTOP-TAURI §8.1).
- Complete local LLM install UX (beyond panels).
- Claiming Phase 4 “Done” for full offline SPA Kernel (O3–O5 living for AI + denylist + **local** pack panels; Kernel bridge Wave K0: [DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md](../product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md); `appMounts` offline Done = later).

## Related

- Profiles: `shared/apps/_profiles/client-offline-ai.yaml`
- Runtime: `shared/api/services/desktop_app_manifests/runtime.py`
- Router: `shared/api/services/ai_provider_router/`
- Connected Tauri sibling: [DESKTOP-TAURI-CONNECTED-CLIENT.md](../product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md) · `pack-organization/connection-agent/`
