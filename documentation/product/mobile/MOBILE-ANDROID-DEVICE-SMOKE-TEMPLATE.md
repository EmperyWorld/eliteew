# Mobile Android — device manual smoke template

**Status:** Operator runbook (releases)  
**Updated:** 2026-07-15  
**Roadmap:** tests-006

Copy this checklist for each prod OTA or major mobile wave. Fill **Build**, **Operator**, **Device** before testing.

## Metadata

| Field | Value |
|-------|-------|
| Build | `versionName (versionCode)` e.g. 0.2.196 (206) |
| Flavor | stage / prod / tunnelBeta |
| Operator | |
| Device | model, Android version |
| Date | |

## Pre-flight (host)

- [ ] `bash pack-cloud/mobile/scripts/validate-version-bump.sh`
- [ ] `bash docker/scripts/mobile-release-stack.sh smoke`
- [ ] Manifest SHA matches `local/binaries/empery-mobile.apk`

## Install / update

- [ ] Fresh install OR OTA from Profile → **Обновления** → **Проверить**
- [ ] Installed version matches server row when update available
- [ ] App opens to login or main shell without crash

## Auth & perimeter

- [ ] SSO login completes in-app WebView (Keycloak `empery-mobile` → custom-scheme → `/api/v1/auth/sso/callback`)
- [ ] Perimeter gate (if required) shows status; renewal works
- [ ] Biometric privacy gate (if enabled in Profile): background >60s → prompt; cancel/fail resumes session without logout; success unlocks shell

## Core tabs (5 min)

| Tab | Action | Pass |
|-----|--------|------|
| Feed | Pull refresh; open one post | |
| Chat | Open thread; verify sender labels + 0.5dp timeline, send/retry, scroll long history | |
| Friends | Incoming/outgoing visible; open friend card | |
| UGS | Open hub; start or view generation screen | |
| Profile | Avatar/name; notification prefs | |

## Push & deeplink

- [ ] Grant notification permission (Android 13+)
- [ ] Tap notification with `tab=chat` → chat tab focused
- [ ] Tap `tab=desktop` → UGS → nested Desktop Hub
- [ ] Custom URI `…:/nav/friends/request/<uuid>` → friends request focus

## GAF video (WebView)

- [ ] Join call from chat; Meet WebView loads HTTPS `meet.eliteew.ru`
- [ ] End call returns to chat without stuck overlay

## Regression notes

_Free text: crashes, ANR, layout, offline behaviour._

## Sign-off

- [ ] Smoke **PASS** / **FAIL**
- [ ] Release notes drafted: `bash pack-cloud/mobile/scripts/generate-release-notes.sh`

## Related

- [MOBILE-ANDROID-RELEASE-RUNBOOK.md](MOBILE-ANDROID-RELEASE-RUNBOOK.md)
- [MOBILE-SECURE-CONNECTION-OPERATIONS.md](MOBILE-SECURE-CONNECTION-OPERATIONS.md)
- [../../pack-cloud/mobile/maestro/smoke.yaml](../../../pack-cloud/mobile/maestro/smoke.yaml)
- [../../pack-cloud/mobile/docs/FLAKY-TEST-POLICY.md](../../../pack-cloud/mobile/docs/FLAKY-TEST-POLICY.md)
