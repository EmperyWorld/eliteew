# Android Bootstrap (`pack-cloud/mobile/`)

This document describes the standalone Android project bootstrap in `pack-cloud/mobile/` (historical tree name: MobileAndroid).
Detailed handbook (install, runbook, troubleshooting): `product/mobile/ANDROID-DEVELOPER-HANDBOOK.md`.
Hub: [`README.md`](README.md).
UGS AI-чат: клавиатура (IME) и нижняя навигация (вложенный Scaffold): `product/mobile/ANDROID-UGS-AI-CHAT-IME-AND-NAV.md`.
First-session product milestones: [`MOBILE-ANDROID-ONBOARDING-CHECKLIST.md`](MOBILE-ANDROID-ONBOARDING-CHECKLIST.md).

## MobileAndroid vs archived EliteEWWebViewAndroid (docs-006)

| | **pack-cloud/mobile/** | **EliteEWWebViewAndroid** (archived) |
|---|-------------------|--------------------------------------|
| **Purpose** | Full native companion: feed, chat, friends, UGS, profile, OTA | Historical Quest WebView shell (panel / immersive VR) — not in the active build graph |
| **API** | Retrofit `/api/v1`, Room offline, FCM | Was: load `https://app.eliteew.ru` in WebView |
| **Location** | `pack-cloud/mobile/` (active) | soft-retired EliteEWWebViewAndroid under `trash/` (gitignored preserve; removed from workspace root) |
| **When to edit** | All mobile product work | Only after explicit restore from `trash/` |

**Rule for agents/operators:** default mobile tasks → `pack-cloud/mobile/` only. Do **not** expect `EliteEWWebViewAndroid/` at the monorepo root. Retrieval path: soft-retired EliteEWWebViewAndroid under `trash/` (complete tree preserved; not part of `pack-cloud/mobile` Gradle includes).

### Archived build variants (reference only)

| Flavor | APK task | Launcher | Use |
|--------|----------|----------|-----|
| `panel` | `:app:assemblePanelDebug` | `MainActivity` (2D fullscreen WebView) | Legacy flat Quest panel / phone |
| `immersive` | `:app:assembleImmersiveDebug` | `ImmersiveActivity` (VR room + WebView panel) | Historical VR experience |

Restore-then-build (only after copying the tree out of `trash/`):

```bash
# After restoring sources to a working path, e.g. /tmp/EliteEWWebViewAndroid
pack-cloud/mobile/gradlew -p /tmp/EliteEWWebViewAndroid :app:assembleImmersiveDebug
```

## Goal

Create an independent Android app that talks to the current backend API (`/api/v1`) without duplicating desktop/web code.

## Project layout

- `pack-cloud/mobile/app`
- `pack-cloud/mobile/core/network`
- `pack-cloud/mobile/core/auth`
- `pack-cloud/mobile/core/storage`
- `pack-cloud/mobile/feature/feed`
- `pack-cloud/mobile/feature/notifications`
- `pack-cloud/mobile/feature/profile`
- `pack-cloud/mobile/feature/chat`
- `pack-cloud/mobile/feature/friends`
- `pack-cloud/mobile/feature/desktop`
- `pack-cloud/mobile/feature/ugs`

## Environment flavors

Configured in `pack-cloud/mobile/app/build.gradle.kts`:

- `stage`
- `prod`
- `tunnelBeta`

Retired: `dev`, `tg` (2026-07-14 Security Lockdown).

Each flavor defines:

- `BuildConfig.BASE_URL`
- `BuildConfig.KEYCLOAK_REDIRECT_URI` (custom scheme per flavor, e.g. `world.empery.mobile:/oauth2redirect`)
- `BuildConfig.SSO_LOGIN_URL` (legacy browser-entry URL; not used for in-app login transport)
- `BuildConfig.KEYCLOAK_CLIENT_ID` = **`empery-mobile`**
- `BuildConfig.KEYCLOAK_AUTHORIZATION_ENDPOINT` / `KEYCLOAK_TOKEN_ENDPOINT` / `KEYCLOAK_PUBLIC_URL`

## Build

From project root:

```bash
cd pack-cloud/mobile
./gradlew :app:assembleProdDebug
```

If Gradle wrapper is not initialized yet:

```bash
cd pack-cloud/mobile
gradle wrapper --gradle-version 8.13
./gradlew :app:assembleProdDebug
```

## Install prerequisites quickly (Fedora)

```bash
sudo dnf install -y java-21-openjdk java-21-openjdk-devel unzip git which curl
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk install gradle 8.13
```

## Authentication baseline

- In-app SSO: `EmperySsoWebViewActivity` → Keycloak authorize (`empery-mobile`, PKCE) → custom-scheme callback → `POST /api/v1/auth/sso/callback` (SSO registry class `mobile`).
- OIDC helpers in `core/auth` (`OidcAuthManager`); tokens in `SecureTokenStore` (EncryptedSharedPreferences).
- Refresh is proxied through `POST /api/auth/refresh` (`AuthRepository`, absolute path outside `/api/v1`).
- Access JWT `azp` must stay **`empery-mobile`** (`MobileAccessTokenClientGuard`); do not persist `empery-web` tokens on the phone.
- Harden / redirect URIs: `docker/scripts/keycloak-harden-empery-realm.sh`; canon `platform/docker-re_doc/KEYCLOAK-ELITEEW.md`, `platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md`.
- Full auth model: `product/mobile/ANDROID-DEVELOPER-HANDBOOK.md` §7.

## Offline baseline

- Room cache in `core/storage` for feed, notifications, profile snapshot, chat list, and friends.

## Scope in current bootstrap

- EWDesk feed
- Notification center
- Profile
- Мессенджер Lite
- Friends Lite
- Desktop Hub
- UGS Hub

## Related living canons

- SSO/registry: `ANDROID-DEVELOPER-HANDBOOK.md` §7, `platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md`
- Secure Connection / WG: `MOBILE-SECURE-CONNECTION-OPERATIONS.md`, `MOBILE-ANDROID-PRIVATE-TUNNEL.md`
- OTA: `MOBILE-ANDROID-RELEASE-RUNBOOK.md` (baseline **0.2.196 / 206**)
