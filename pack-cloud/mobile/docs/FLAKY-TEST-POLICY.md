# MobileAndroid — flaky test policy

**Status:** Operator + CI policy  
**Updated:** 2026-06-02  
**Roadmap:** Mobile Android Super Roadmap — **tests-010**

## Purpose

Keep CI and device smoke trustworthy: flaky tests are quarantined with an owner and removal deadline — **no silent `@Ignore` without tracking**.

## Scope

| Lane | Examples |
|------|----------|
| JVM unit | `:core:network:testDebugUnitTest`, `:core:auth:*`, `:core:storage:*`, `:app:test*UnitTest` |
| Instrumentation | `app/src/androidTest/**` Compose stubs (expand when farm wired) |
| Maestro | `pack-cloud/mobile/maestro/smoke.yaml` (operator/device, not PR gate) |
| Manual | `documentation/product/mobile/MOBILE-ANDROID-DEVICE-SMOKE-TEMPLATE.md` |

## Quarantine rules

1. **Label:** GitHub issue or worklog entry tagged `mobile-flaky-quarantine`.
2. **Owner:** Named operator responsible for fix or deletion.
3. **Deadline:** Max **14 calendar days** from quarantine; extend once with written reason.
4. **No silent skip:** Forbidden: `@Ignore` / `@Disabled` without issue link in test KDoc.
5. **Removal:** Fixed test removes quarantine label; deleted test updates coverage map if API-related.

## CI behaviour

- PR gate: `.github/workflows/mobile-android-ci.yml` runs `core:network`, `core:auth`, `core:storage`, then `:app:*`.
- Maestro and full instrumentation are **out of PR gate** until a stable emulator runner exists.
- CI does **not** auto-retry failed JVM tests.

## Related

- [RELEASE-CHANNELS.md](RELEASE-CHANNELS.md)
- `MOBILE-ANDROID-API-TEST-COVERAGE-MAP.md` (historical reference; absent from this checkout)
