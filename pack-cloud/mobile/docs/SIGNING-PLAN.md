# Mobile Android production signing plan (ota-008)

## Goal

Ship **prod** APK/AAB with a dedicated release keystore separate from CI debug keystores and from operator sideload debug builds.

## Keystores (do not commit)

| Keystore | Purpose | Storage |
|----------|---------|---------|
| `eliteew-mobile-upload.jks` | Play/AppGallery upload key | Operator HSM or secrets vault |
| `eliteew-mobile-app-signing.jks` | App signing key (Play App Signing) | Google Play App Signing |
| CI debug (`~/.android/debug.keystore`) | Local dev / sideload QA only | Workstations |

## Gradle wiring — Done (2026-07-16)

Implemented in `app/build.gradle.kts`. Credentials: **env wins**, then `local.properties` (gitignored).

| Env | `local.properties` key |
|-----|------------------------|
| `MOBILE_RELEASE_STORE_FILE` | `mobile.android.release.storeFile` |
| `MOBILE_RELEASE_STORE_PASSWORD` | `mobile.android.release.storePassword` |
| `MOBILE_RELEASE_KEY_ALIAS` | `mobile.android.release.keyAlias` |
| `MOBILE_RELEASE_KEY_PASSWORD` | `mobile.android.release.keyPassword` |

Behavior:

1. `signingConfigs.create("release")` is created **only** when the store file exists on disk and all four credential fields are non-empty.
2. `buildTypes.release` signing precedence:
   - `mobile.android.ci=true` → debug keystore (CI / sideload installable APKs without vault secrets);
   - else if release signingConfig available → use it;
   - else → **no** `signingConfig` override (unsigned release until vault/local credentials are present).
3. Debug buildTypes keep default debug signing (`stageDebug` / `prodDebug` / `tunnelBetaDebug`).

## CI/CD sequence

1. Tag release (`mobile/vX.Y.Z`).
2. CI job `assembleProdRelease` with secrets injected from vault (not repo).
3. Upload AAB to Play Internal Testing.
4. Publish APK to `/api/v1/mobile-app/download` only after Play/internal smoke passes.
5. Record `versionCode`, `versionName`, `apk_sha256` in release notes.

## Rotation

- Upload key rotation: generate new upload cert, update Play Console, redeploy CI secrets.
- App signing key: Google-managed; document recovery contacts in operator runbook.

## Verification checklist

- [ ] `apksigner verify --verbose` on prod APK
- [ ] SHA-256 matches `MobileAppOverviewResponse.apk_sha256`
- [ ] Package id `world.empery.mobile.prod` (or flavor-specific) matches Keycloak `empery-mobile` redirect URIs
