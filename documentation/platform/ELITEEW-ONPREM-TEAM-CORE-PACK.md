# EliteEW · on-prem / team edition pack — `onprem-team-core`

**Status:** Phase 3 foundation + community access contract (2026-09-28). Same EliteEW codebase as cloud; different **install profile** + env overlay. Not a second product tree and not an alternate Empery prod-core topology.
**Editions canon:** [ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md) §3.3 / §6 / §11.
**Profile SoT:** `shared/apps/_profiles/onprem-team-core.yaml`
**Env overlay (no secrets):** `shared/apps/_profiles/packs/onprem-team-core.env.example`
**Smoke:** `bash scripts/eliteew/smoke-install-profile.sh --profile onprem-team-core`

## 1. Intent

Ship a **team / LAN / private-cloud** pack where:

- Desktop surface is the `onprem-team-core` allowlist (shell + core apps).
- Marketing Cabinet, Unified Admin, Customer Cabinet, and `_legacy` components stay **off**.
- Auth stays OIDC/Keycloak **protocol**; IdP may be local Keycloak or customer IdP (operator choice — open decision in editions §14).
- Data and accounts stay inside the customer boundary.
- The self-hosted runtime is community access: no paid EliteEW seat, activation server, or signed entitlement is required. This does not weaken OIDC/RBAC inside the customer deployment.

## 2. Required env (overlay)

Merge into stack0 API env (compose `--env-file`, Config Plane staging, or local `.env`) **without** putting secrets in the overlay:

```bash
# from shared/apps/_profiles/packs/onprem-team-core.env.example
ELITEEW_PRODUCT_EDITION=onprem
ELITEEW_INSTALL_PROFILE=onprem-team-core
```

**Dual-flag:** if `ELITEEW_INSTALL_PROFILE` is empty, edition `onprem` already defaults to `onprem-team-core`. Explicit pair above is preferred for OEM clarity. Mismatch (`edition=onprem` + `profile=cloud-full`) → API **503** fail closed.

Do **not** copy Empery prod-core IPs/URLs into customer packs as hardcoded defaults — bind hosts via customer env / DNS.

## 3. Enabled Desktop apps (allowlist)

Resolved at runtime via `resolve_enabled_app_components("onprem-team-core")` (16 components). Manifest ids in the profile YAML:

| Manifest id | `app_component` (typical) |
|-------------|---------------------------|
| notifications | NotificationsApp |
| calendar | CalendarApp |
| project_about | ProjectAboutApp |
| clipboard | ClipboardManager |
| music_player | MusicPlayer |
| app_store | AppStore |
| assistant | AssistantApp |
| desktop_ai_chat | DesktopAiChatApp |
| ewdesk | EWDeskApp |
| poemma | PoemmaApp |
| feedback_hub | FeedbackHubApp |
| survey_hub | SurveyHubApp |
| social_hub | SocialHubApp |
| user_site_studio | UserSiteStudio |
| kirs_curation | KirsCuration |
| local_service_iframe | LocalServiceIframeApp |

**Out of pack (examples):** MarketingCabinet, UnifiedAdminApp, CustomerCabinet, and all `_legacy` KNOWN components.

## 4. Operator install loop (customer host)

Same codebase; customer provides hosts/secrets. High-level:

1. Clone/checkout EliteEW monorepo (or release artifact) on the **build/control** host for that customer.
2. Stage plaintext env from templates + customer secrets (Keycloak, Postgres, Redis, …) — follow Config Plane patterns conceptually; do not scp Empery prod tmpfs layout blindly.
3. Apply overlay: `ELITEEW_PRODUCT_EDITION=onprem` + `ELITEEW_INSTALL_PROFILE=onprem-team-core`.
4. Bring up stack0 (+ stack1 data plane + stack6 Keycloak as needed) with **customer** compose/env — not Empery `.111` baked release unless this *is* Empery cloud.
5. Smoke:

```bash
bash scripts/eliteew/validate-app-manifests.sh
bash scripts/eliteew/smoke-install-profile.sh --profile onprem-team-core
# optional live API (OAuth2 bearer):
bash scripts/eliteew/smoke-install-profile.sh --profile onprem-team-core \
  --api-base "https://app.example.local/api/v1" --token "$ACCESS_TOKEN"
```

6. Browser: Start Menu / App Store must not list marketing/admin/customer apps; `GET /desktop/install-profile` returns `edition=onprem`, `profile_id=onprem-team-core`.
7. The same response returns `access_mode=community` and `seat_activation_required=false`; any other value is a packaging regression.

## 5. Health / smoke matrix

| Check | Offline / local | Live API |
|-------|-----------------|----------|
| Manifests + profiles validate | `validate-app-manifests.sh` | — |
| Profile resolves N components | `smoke-install-profile.sh` | — |
| Env dual-flag consistent | script prints expected env | — |
| Community access / no seat activation | script requires `community` + `false` for `onprem-team-core` | response matches local profile |
| Install-profile endpoint | — | `GET …/desktop/install-profile` matches profile id + edition |
| Store gate | — | `GET …/desktop/store` has no MarketingCabinet / UnifiedAdminApp |

## 6. Failure / Edge-Case Matrix

| Axis | Behavior |
|------|----------|
| **Offline-mode** | Pack validation and community/no-seat checks run without an activation service or network. Live API checks are optional. Runtime apps still need customer LAN services. |
| **Dual-flag / conflict** | Edition/profile mismatch → **503**. Empty profile + `onprem` → `onprem-team-core`. |
| **Permission / access** | No commercial seat gate. OAuth2 remains on install-profile/store; pack hide ≠ RBAC (admin role does not re-enable profile-off apps). Managed cloud/FoFline access is not granted by this profile. |
| **Regression command** | `bash scripts/eliteew/smoke-install-profile.sh --profile onprem-team-core` |

## 7. Explicit non-goals (this foundation)

- Full OEM installer UI / checkbox generator.
- Bundled Keycloak vs external IdP decision for a customer OEM pack (parked).
- The community one-click command. Its contract is
  [ELITEEW-GITHUB-REPOSITORY.md](ELITEEW-GITHUB-REPOSITORY.md) §6. This pack
  remains the profile and the smoke.
- Alternate Empery cloud topology.
- Automatic compose generation for every optional module.

## Related

- Profiles: `shared/apps/_profiles/`
- Runtime: `shared/api/services/desktop_app_manifests/runtime.py`
- Cloud deploy (Empery only): `documentation/platform/PROD-CORE-DEV-BIND-LINE.md`, skill `eliteew-prod-line`
- Git layout and community install target: `documentation/platform/ELITEEW-GITHUB-REPOSITORY.md`
