# MobileAndroid — release channels

**Status:** Operator canon  
**Updated:** 2026-07-14  
**Roadmap:** release-001, release-005

## Channels

| Channel | Gradle flavor | `applicationId` suffix | Distribution |
|---------|---------------|------------------------|--------------|
| **stage** | `stageDebug` / `stageRelease` | `.stage` | Staging API |
| **prod** | `prodDebug` / `prodRelease` | _(none)_ | OTA + direct APK |
| **tunnelBeta** | `tunnelBetaDebug` / `tunnelBetaRelease` | `.tunnelbeta` | Secure Connection pilot |

Retired (2026-07-14 Security Lockdown): **`dev`**, **`tg`** — removed to stop unmanaged prod-API contamination.

## OTA path (prod)

1. `assembleProdRelease` → `serve-mobile-apk-tunnel.sh publish` → `stack-mobile-release`.
2. API `GET /api/v1/mobile-app/overview` (no Redis cache) → in-app Profile → **Обновления**.
3. Validate: `bash pack-cloud/mobile/scripts/validate-version-bump.sh` and `mobile-release-stack.sh smoke`.

## Rollback (bad OTA)

1. Do not re-publish the broken artifact.
2. Restore previous `local/binaries/empery-mobile.apk` + `empery-mobile.manifest.json`.
3. Re-run `publish` if SHA/size match → `mobile-release-stack.sh up` → `smoke`.
4. Verify API overview shows prior `version_code`.
5. **User copy:** «Профиль → Обновления → Проверить» or reinstall from `https://app.eliteew.ru/mobile-app/`.

## Related

- [SIGNING-PLAN.md](SIGNING-PLAN.md)
- [../../../documentation/product/mobile/MOBILE-ANDROID-RELEASE-RUNBOOK.md](../../../documentation/product/mobile/MOBILE-ANDROID-RELEASE-RUNBOOK.md)
