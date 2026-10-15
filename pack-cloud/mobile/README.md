# EliteEW Android cloud entrance

Explanation · source inspection dated 2026-10-11. The Android client uses the shared EliteEW API and Keycloak/OIDC contracts. It has its own Gradle toolchain, application lifecycle, device storage and permissions.

## Modules and toolchain

[settings.gradle.kts](settings.gradle.kts) includes `app`, `benchmark`, `unity-hand-host`, `core:network`, `core:auth`, `core:storage`, `core:ui`, `core:media`, and features `feed`, `notifications`, `profile`, `chat`, `friends`, `desktop`, `ugs`.

[Root build configuration](build.gradle.kts) declares Android Gradle Plugin 8.13.2 and Kotlin 1.9.24. [The wrapper](gradle/wrapper/gradle-wrapper.properties) selects Gradle 8.13. [The app](app/build.gradle.kts) sets min SDK 28, compile/target SDK 35 and Compose compiler 1.5.14. Use Java 17, as in [mobile CI](../../.github/workflows/mobile-android-ci.yml), plus an installed Android SDK.

The client uses Compose, Retrofit/OkHttp, Room, WorkManager and Firebase libraries. Google Services/Crashlytics Gradle plugins are applied only when `app/google-services.json` exists; checked-in Firebase dependencies do not certify a configured push service.

## Flavors and configuration

- `stage`: package suffix `.stage`, staging API default.
- `prod`: `world.empery.mobile`, production API default.
- `tunnelBeta`: suffix `.tunnelbeta`, Secure Connection/WireGuard pilot.

Only these flavors are declared. Flavor API/Keycloak overrides prefer `local.properties`, then Gradle properties / `-P`, then defaults. Release keystore values prefer environment variables, then ignored local properties. Never commit keystore credentials or private tunnel configurations. `-Pmobile.android.ci=true` uses debug signing for CI release builds and does not produce a production-signed artifact.

## Build and test

From the repository root, with prerequisites prepared:

```bash
cd pack-cloud/mobile
./gradlew :app:assembleProdDebug
./gradlew :app:lintProdDebug :app:testProdDebugUnitTest :app:assembleProdDebug --no-daemon
```

The second command is a targeted prod-debug gate. CI additionally tests core/features and builds/lints all active debug flavors plus prod-release lint; it is broader than this command. These build commands were inspected, not run during the documentation audit.

For an explicitly selected development device:

```bash
adb devices
adb install -r app/build/outputs/apk/prod/debug/app-prod-debug.apk
```

Sign in through the browser/Keycloak flow, verify the redirect, then check live feed/chat/friends/profile data. Installation changes the device; it is not a read-only audit step.

## Network and media

[Android handbook](../../documentation/product/mobile/ANDROID-DEVELOPER-HANDBOOK.md) owns networking, auth and recovery. Domain-targeted OkHttp DNS behavior and LAN/private DNS need inspection when SSO callback requests time out; emulator/literal-IP behavior differs.

Video calls consume the backend `join_url` and use `EmperyMeetWebViewActivity` rather than the Jitsi Meet SDK. Camera/microphone and trusted host handling are documented in [the Meet reference](../../documentation/product/mobile/MOBILE-GAF-VIDEO-CALLS-WEBVIEW.md). Device permissions and a live Meet deployment are separate prerequisites.

## Navigation

- [Bootstrap](../../documentation/product/mobile/ANDROID-BOOTSTRAP.md)
- [API contracts](../../documentation/api/ANDROID-API-CONTRACTS.md)
- [UGS AI chat, IME and navigation](../../documentation/product/mobile/ANDROID-UGS-AI-CHAT-IME-AND-NAV.md)
- [Performance baseline](docs/PERF_BASELINE.md)
- [Signing plan](docs/SIGNING-PLAN.md), [release channels](docs/RELEASE-CHANNELS.md)
- [Release runbook](../../documentation/product/mobile/MOBILE-ANDROID-RELEASE-RUNBOOK.md)
- [Historical worklog](docs/WORKLOG.md) — chronology, not implementation authority
