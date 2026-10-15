# EliteEW apps — product manifests

**SoT path:** `shared/apps/<app_id>/app.manifest.yaml`
**Schema:** `_schema/app.manifest.schema.json`
**Canon:** `documentation/platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md` §5
**Loader:** `shared/api/services/desktop_app_manifests/`

## Rules

1. New Desktop app → add a manifest **before** or **with** the FE mount (skill `eliteew-app-scaffold`).
2. `surfaces.desktop.app_component` must match the React window mount / App Store `app_component`.
3. `KNOWN_DESKTOP_APP_COMPONENTS` = **union** of all manifest `app_component` values + `_legacy/known_desktop_app_components.legacy.json`.
4. When an app gets a full manifest, **remove** its `app_component` from the legacy file (no duplicates).
5. Shell scroll/portal stays in `pages/Desktop/shell/appRegistry*` (U1) — link by `app_component`, do not duplicate in manifest v0.

## Validate

```bash
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m api.services.desktop_app_manifests.validate
# or:
bash scripts/eliteew/validate-app-manifests.sh
```

## Gold / migrated manifests

| id | app_component |
|----|---------------|
| `notifications` | `NotificationsApp` |
| `calendar` | `CalendarApp` |
| `project_about` | `ProjectAboutApp` |
| `clipboard` | `ClipboardManager` |
| `feedback_hub` | `FeedbackHubApp` |
| `survey_hub` | `SurveyHubApp` |
| `music_player` | `MusicPlayer` |
| `ewdesk` | `EWDeskApp` |
| `app_store` | `AppStore` |
| `assistant` | `AssistantApp` (**Справочная навигация** — FAQ + RAG chat) |
| `desktop_ai_chat` | `DesktopAiChatApp` (Experts / Эксперты) |
| `poemma` | `PoemmaApp` |
| `local_service_iframe` | `LocalServiceIframeApp` |
| `customer_cabinet` | `CustomerCabinet` |
| `social_hub` | `SocialHubApp` |
| `friends` | `FriendsApp` |
| `user_site_studio` | `UserSiteStudio` |
| `unified_admin` | `UnifiedAdminApp` |
| `kirs_curation` | `KirsCuration` |
| `kursorina` | `KursorinaApp` (Курсорина — investigation worker) |

## Install profiles (Phase 2)

**Path:** `shared/apps/_profiles/*.yaml`
**Schema:** `_schema/install.profile.schema.json`
**Resolver:** `api/services/desktop_app_manifests/profiles.py`
**Runtime:** `runtime.py` ← `ELITEEW_PRODUCT_EDITION` / `ELITEEW_INSTALL_PROFILE` (`UnifiedConfig`)
**API:** `GET /api/v1/desktop/install-profile`

| Profile id | Edition | Mode | Access | Seat activation |
|------------|---------|------|--------|-----------------|
| `cloud-full` | cloud | `edition_default` + `include_legacy` | `managed` | no native seat |
| `onprem-team-core` | onprem | `allowlist` (no marketing/admin/customer) | `community` | not required |
| `client-offline-ai` | client | `edition_default` | `managed` | required |
| `fofline-connected` | cloud | `allowlist` | `managed` | required |

```python
from api.services.desktop_app_manifests import (
    resolve_enabled_app_components,
    is_app_component_enabled,
    get_active_install_snapshot,
)
resolve_enabled_app_components("onprem-team-core")
is_app_component_enabled("NotificationsApp", "cloud-full")
get_active_install_snapshot()  # env-resolved
```

**Dual-flag:** empty profile → default pack for edition; explicit profile must match edition (fail closed).
**Access boundary:** `access_mode=community` means the self-hosted runtime has no commercial seat activation. It does not bypass OIDC/RBAC. `managed` preserves service/channel entitlements independently from the MIT right to run modified source.
**Store:** catalog/install hide apps whose `app_component` is not in the active enabled set (default `cloud-full` = no change vs today).
**FE:** `useDesktopInstalledApps` + `resolveDesktopAppLaunchItem(..., enabledAppComponents)` consume the same set for Start/Taskbar/launch.

## On-prem pack (`onprem-team-core`)

**Canon:** `documentation/platform/ELITEEW-ONPREM-TEAM-CORE-PACK.md`
**Env overlay:** `_profiles/packs/onprem-team-core.env.example`
**Smoke:**

```bash
bash scripts/eliteew/smoke-install-profile.sh --profile onprem-team-core
```

## Client pack (`client-offline-ai`)

**Canon:** `documentation/platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md`
**Env overlay:** `_profiles/packs/client-offline-ai.env.example`
**AI policy:** `api/services/ai_provider_router/`
**Smoke:**

```bash
bash scripts/eliteew/smoke-install-profile.sh --profile client-offline-ai
```
