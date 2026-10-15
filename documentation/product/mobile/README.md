# Mobile (`documentation/product/mobile/`)

Живой канон **облачной двери** Mobile Android. Код: **`pack-cloud/mobile/`** (бывший корневой `MobileAndroid/`).

**Pack layout SoT:** [`../../platform/ELITEEW-PACK-LAYOUT.md`](../../platform/ELITEEW-PACK-LAYOUT.md) · session scope: shared core + `pack-cloud` (не трогать `pack-organization/connection-agent/` без явного scope).

> Не путать с org Connection Agent (`pack-organization/connection-agent/`) и не с browser Desktop shell.

## Точки входа

| Тема | Документ |
|------|----------|
| Bootstrap / flavors / SSO baseline | [ANDROID-BOOTSTRAP.md](ANDROID-BOOTSTRAP.md) |
| Developer handbook | [ANDROID-DEVELOPER-HANDBOOK.md](ANDROID-DEVELOPER-HANDBOOK.md) |
| Release / OTA runbook | [MOBILE-ANDROID-RELEASE-RUNBOOK.md](MOBILE-ANDROID-RELEASE-RUNBOOK.md) |
| Private tunnel / trusted device | [MOBILE-ANDROID-PRIVATE-TUNNEL.md](MOBILE-ANDROID-PRIVATE-TUNNEL.md) · [MOBILE-TRUSTED-DEVICE-BINDING.md](MOBILE-TRUSTED-DEVICE-BINDING.md) |
| Guidelines / adaptive / WebView SPA | [MOBILE-ANDROID-GUIDELINES.md](MOBILE-ANDROID-GUIDELINES.md) · [MOBILE-ANDROID-ADAPTIVE-LAYOUT.md](MOBILE-ANDROID-ADAPTIVE-LAYOUT.md) · [MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md](MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md) |
| API contracts (backend) | [`../../api/ANDROID-API-CONTRACTS.md`](../../api/ANDROID-API-CONTRACTS.md) |

## Ops

| Действие | Путь |
|----------|------|
| Gradle project | `pack-cloud/mobile/` |
| APK release cycle | `docker/scripts/mobile-apk-release-cycle.sh` |
| Soft-block index | `.cursorindexingignore` → `pack-cloud/mobile/` |
